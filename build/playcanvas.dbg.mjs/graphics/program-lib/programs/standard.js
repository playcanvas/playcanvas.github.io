/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { hashCode } from '../../../core/hash.js';
import { Debug } from '../../../core/debug.js';
import { LIGHTTYPE_DIRECTIONAL, SPRITE_RENDERMODE_SLICED, SPRITE_RENDERMODE_TILED, SPECULAR_PHONG, FRESNEL_SCHLICK, BLEND_NONE } from '../../../scene/constants.js';
import { ShaderPass } from '../../../scene/shader-pass.js';
import { LitShader } from './lit-shader.js';
import { ChunkBuilder } from '../chunk-builder.js';
import { ChunkUtils } from '../chunk-utils.js';

const _matTex2D = [];
const standard = {
  optionsContext: {},
  optionsContextMin: {},
  generateKey: function (options) {
    const buildPropertiesList = function buildPropertiesList(options) {
      const props = [];

      for (const prop in options) {
        if (options.hasOwnProperty(prop) && prop !== "chunks" && prop !== "lights") props.push(prop);
      }

      return props.sort();
    };

    let props;

    if (options === this.optionsContextMin) {
      if (!this.propsMin) this.propsMin = buildPropertiesList(options);
      props = this.propsMin;
    } else if (options === this.optionsContext) {
      if (!this.props) this.props = buildPropertiesList(options);
      props = this.props;
    } else {
      props = buildPropertiesList(options);
    }

    let key = "standard";

    for (let i = 0; i < props.length; i++) {
      if (options[props[i]]) key += props[i] + options[props[i]];
    }

    if (options.chunks) {
      const chunks = [];

      for (const p in options.chunks) {
        if (options.chunks.hasOwnProperty(p)) {
          chunks.push(p + options.chunks[p]);
        }
      }

      chunks.sort();
      key += chunks;
    }

    if (options.lights) {
      const isClustered = options.clusteredLightingEnabled;

      for (let i = 0; i < options.lights.length; i++) {
        const light = options.lights[i];

        if (!isClustered || light._type === LIGHTTYPE_DIRECTIONAL) {
          key += light.key;
        }
      }
    }

    return hashCode(key);
  },
  _getUvSourceExpression: function (transformPropName, uVPropName, options) {
    const transformId = options[transformPropName];
    const uvChannel = options[uVPropName];
    const isMainPass = ShaderPass.isForward(options.pass);
    let expression;

    if (isMainPass && options.nineSlicedMode === SPRITE_RENDERMODE_SLICED) {
      expression = "nineSlicedUv";
    } else if (isMainPass && options.nineSlicedMode === SPRITE_RENDERMODE_TILED) {
      expression = "nineSlicedUv";
    } else {
      if (transformId === 0) {
        expression = "vUv" + uvChannel;
      } else {
        expression = "vUV" + uvChannel + "_" + transformId;
      }

      if (options.heightMap && transformPropName !== "heightMapTransform") {
        expression += " + dUvOffset";
      }
    }

    return expression;
  },
  _addMapDef: function (name, enabled) {
    return enabled ? `#define ${name}\n` : `#undef ${name}\n`;
  },
  _addMapDefs: function (float, color, vertex, map) {
    return this._addMapDef("MAPFLOAT", float) + this._addMapDef("MAPCOLOR", color) + this._addMapDef("MAPVERTEX", vertex) + this._addMapDef("MAPTEXTURE", map);
  },
  _addMap: function (propName, chunkName, options, chunks, mapping, encoding = null) {
    const mapPropName = propName + "Map";
    const uVPropName = mapPropName + "Uv";
    const identifierPropName = mapPropName + "Identifier";
    const transformPropName = mapPropName + "Transform";
    const channelPropName = mapPropName + "Channel";
    const vertexColorChannelPropName = propName + "VertexColorChannel";
    const tintPropName = propName + "Tint";
    const vertexColorPropName = propName + "VertexColor";
    const detailModePropName = propName + "Mode";
    const tintOption = options[tintPropName];
    const vertexColorOption = options[vertexColorPropName];
    const textureOption = options[mapPropName];
    const textureIdentifier = options[identifierPropName];
    const detailModeOption = options[detailModePropName];
    let subCode = chunks[chunkName];

    if (textureOption) {
      const uv = this._getUvSourceExpression(transformPropName, uVPropName, options);

      subCode = subCode.replace(/\$UV/g, uv).replace(/\$CH/g, options[channelPropName]);

      if (mapping && subCode.search(/\$SAMPLER/g) !== -1) {
        let samplerName = "texture_" + mapPropName;
        const alias = mapping[textureIdentifier];

        if (alias) {
          samplerName = alias;
        } else {
          mapping[textureIdentifier] = samplerName;
        }

        subCode = subCode.replace(/\$SAMPLER/g, samplerName);
      }

      if (encoding) {
        if (options[channelPropName] === 'aaa') {
          subCode = subCode.replace(/\$DECODE/g, 'passThrough');
        } else {
          subCode = subCode.replace(/\$DECODE/g, ChunkUtils.decodeFunc(!options.gamma && encoding === 'srgb' ? 'linear' : encoding));
        }

        if (subCode.indexOf('$texture2DSAMPLE')) {
          const decodeTable = {
            linear: 'texture2D',
            srgb: 'texture2DSRGB',
            rgbm: 'texture2DRGBM',
            rgbe: 'texture2DRGBE'
          };
          subCode = subCode.replace(/\$texture2DSAMPLE/g, decodeTable[encoding] || 'texture2D');
        }
      }
    }

    if (vertexColorOption) {
      subCode = subCode.replace(/\$VC/g, options[vertexColorChannelPropName]);
    }

    if (detailModeOption) {
      subCode = subCode.replace(/\$DETAILMODE/g, detailModeOption);
    }

    const isFloatTint = !!(tintOption & 1);
    const isVecTint = !!(tintOption & 2);
    subCode = this._addMapDefs(isFloatTint, isVecTint, vertexColorOption, textureOption) + subCode;
    return subCode.replace(/\$/g, "");
  },
  _correctChannel: function (p, chan, _matTex2D) {
    if (_matTex2D[p] > 0) {
      if (_matTex2D[p] < chan.length) {
        return chan.substring(0, _matTex2D[p]);
      } else if (_matTex2D[p] > chan.length) {
        let str = chan;
        const chr = str.charAt(str.length - 1);
        const addLen = _matTex2D[p] - str.length;

        for (let i = 0; i < addLen; i++) str += chr;

        return str;
      }

      return chan;
    }
  },
  createShaderDefinition: function (device, options) {
    const litShader = new LitShader(device, options);
    const useUv = [];
    const useUnmodifiedUv = [];
    const mapTransforms = [];
    const maxUvSets = 2;
    const textureMapping = {};

    for (const p in _matTex2D) {
      const mname = p + "Map";

      if (options[p + "VertexColor"]) {
        const cname = p + "VertexColorChannel";
        options[cname] = this._correctChannel(p, options[cname], _matTex2D);
      }

      if (options[mname]) {
        const cname = mname + "Channel";
        const tname = mname + "Transform";
        const uname = mname + "Uv";
        options[uname] = Math.min(options[uname], maxUvSets - 1);
        options[cname] = this._correctChannel(p, options[cname], _matTex2D);
        const uvSet = options[uname];
        useUv[uvSet] = true;
        useUnmodifiedUv[uvSet] = useUnmodifiedUv[uvSet] || options[mname] && !options[tname];

        if (options[tname]) {
          mapTransforms.push({
            name: p,
            id: options[tname],
            uv: options[uname]
          });
        }
      }
    }

    if (options.forceUv1) {
      useUv[1] = true;
      useUnmodifiedUv[1] = useUnmodifiedUv[1] !== undefined ? useUnmodifiedUv[1] : true;
    }

    litShader.generateVertexShader(useUv, useUnmodifiedUv, mapTransforms);

    if (options.shadingModel === SPECULAR_PHONG) {
      options.fresnelModel = 0;
      options.ambientSH = false;
    } else {
      options.fresnelModel = options.fresnelModel === 0 ? FRESNEL_SCHLICK : options.fresnelModel;
    }

    const decl = new ChunkBuilder();
    const code = new ChunkBuilder();
    const func = new ChunkBuilder();
    let lightingUv = "";

    if (options.nineSlicedMode === SPRITE_RENDERMODE_TILED) {
      decl.append(`const float textureBias = -1000.0;`);
    } else {
      decl.append(`uniform float textureBias;`);
    }

    if (ShaderPass.isForward(options.pass)) {
      if (options.heightMap) {
        decl.append("vec2 dUvOffset;");
        code.append(this._addMap("height", "parallaxPS", options, litShader.chunks, textureMapping));
        func.append("getParallax();");
      }

      if (options.blendType !== BLEND_NONE || options.alphaTest || options.alphaToCoverage) {
        decl.append("float dAlpha;");
        code.append(this._addMap("opacity", "opacityPS", options, litShader.chunks, textureMapping));
        func.append("getOpacity();");

        if (options.alphaTest) {
          code.append(litShader.chunks.alphaTestPS);
          func.append("alphaTest(dAlpha);");
        }
      } else {
        decl.append("float dAlpha = 1.0;");
      }

      if (litShader.needsNormal) {
        if (options.normalMap || options.clearCoatNormalMap) {
          code.append(options.packedNormal ? litShader.chunks.normalXYPS : litShader.chunks.normalXYZPS);

          if (!options.hasTangents) {
            const baseName = options.normalMap ? "normalMap" : "clearCoatNormalMap";
            lightingUv = this._getUvSourceExpression(`${baseName}Transform`, `${baseName}Uv`, options);
          }
        }

        decl.append("vec3 dNormalW;");
        code.append(this._addMap("normalDetail", "normalDetailMapPS", options, litShader.chunks, textureMapping));
        code.append(this._addMap("normal", "normalMapPS", options, litShader.chunks, textureMapping));
        func.append("getNormal();");
      }

      if (litShader.needsSceneColor) {
        decl.append("uniform sampler2D uSceneColorMap;");
      }

      if (litShader.needsScreenSize) {
        decl.append("uniform vec4 uScreenSize;");
      }

      if (litShader.needsTransforms) {
        decl.append("uniform mat4 matrix_viewProjection;");
        decl.append("uniform mat4 matrix_model;");
      }

      decl.append("vec3 dAlbedo;");

      if (options.diffuseDetail) {
        code.append(this._addMap("diffuseDetail", "diffuseDetailMapPS", options, litShader.chunks, textureMapping, options.diffuseDetailEncoding));
      }

      code.append(this._addMap("diffuse", "diffusePS", options, litShader.chunks, textureMapping, options.diffuseEncoding));
      func.append("getAlbedo();");

      if (options.refraction) {
        decl.append("float dTransmission;");
        code.append(this._addMap("refraction", "transmissionPS", options, litShader.chunks, textureMapping));
        func.append("getRefraction();");
        decl.append("float dThickness;");
        code.append(this._addMap("thickness", "thicknessPS", options, litShader.chunks, textureMapping));
        func.append("getThickness();");
      }

      if (options.iridescence) {
        decl.append("vec3 dIridescenceFresnel;");
        decl.append("float dIridescence;");
        code.append(this._addMap("iridescence", "iridescencePS", options, litShader.chunks, textureMapping));
        func.append("getIridescence();");
        decl.append("float dIridescenceThickness;");
        code.append(this._addMap("iridescenceThickness", "iridescenceThicknessPS", options, litShader.chunks, textureMapping));
        func.append("getIridescenceThickness();");
      }

      if (litShader.lighting && options.useSpecular || litShader.reflections) {
        decl.append("vec3 dSpecularity;");
        decl.append("float dGlossiness;");

        if (options.sheen) {
          decl.append("vec3 sSpecularity;");
          code.append(this._addMap("sheen", "sheenPS", options, litShader.chunks, textureMapping, options.sheenEncoding));
          func.append("getSheen();");
          decl.append("float sGlossiness;");
          code.append(this._addMap("sheenGlossiness", "sheenGlossPS", options, litShader.chunks, textureMapping));
          func.append("getSheenGlossiness();");
        }

        if (options.useMetalness) {
          decl.append("float dMetalness;");
          code.append(this._addMap("metalness", "metalnessPS", options, litShader.chunks, textureMapping));
          func.append("getMetalness();");
        }

        if (options.useSpecularityFactor) {
          decl.append("float dSpecularityFactor;");
          code.append(this._addMap("specularityFactor", "specularityFactorPS", options, litShader.chunks, textureMapping));
          func.append("getSpecularityFactor();");
        }

        if (options.useSpecularColor) {
          code.append(this._addMap("specular", "specularPS", options, litShader.chunks, textureMapping, options.specularEncoding));
        } else {
          code.append("void getSpecularity() { dSpecularity = vec3(1); }");
        }

        code.append(this._addMap("gloss", "glossPS", options, litShader.chunks, textureMapping));
        func.append("getGlossiness();");
        func.append("getSpecularity();");
      } else {
        decl.append("vec3 dSpecularity = vec3(0.0);");
        decl.append("float dGlossiness = 0.0;");
      }

      if (options.aoMap || options.aoVertexColor) {
        decl.append("float dAo;");
        code.append(this._addMap("ao", "aoPS", options, litShader.chunks, textureMapping));
        func.append("getAO();");
      }

      decl.append("vec3 dEmission;");
      code.append(this._addMap("emissive", "emissivePS", options, litShader.chunks, textureMapping, options.emissiveEncoding));
      func.append("getEmission();");

      if (options.clearCoat > 0) {
        decl.append("float ccSpecularity;");
        decl.append("float ccGlossiness;");
        decl.append("vec3 ccNormalW;");
        code.append(this._addMap("clearCoat", "clearCoatPS", options, litShader.chunks, textureMapping));
        code.append(this._addMap("clearCoatGloss", "clearCoatGlossPS", options, litShader.chunks, textureMapping));
        code.append(this._addMap("clearCoatNormal", "clearCoatNormalPS", options, litShader.chunks, textureMapping));
        func.append("getClearCoat();");
        func.append("getClearCoatGlossiness();");
        func.append("getClearCoatNormal();");
      }

      if (options.lightMap || options.lightVertexColor) {
        const lightmapDir = options.dirLightMap && options.useSpecular;
        const lightmapChunkPropName = lightmapDir ? 'lightmapDirPS' : 'lightmapSinglePS';
        decl.append("vec3 dLightmap;");

        if (lightmapDir) {
          decl.append("vec3 dLightmapDir;");
        }

        code.append(this._addMap("light", lightmapChunkPropName, options, litShader.chunks, textureMapping, options.lightMapEncoding));
        func.append("getLightMap();");
      }

      if (code.code.indexOf('texture2DSRGB') !== -1 || code.code.indexOf('texture2DRGBM') !== -1 || code.code.indexOf('texture2DRGBE') !== -1) {
        Debug.deprecated('Shader chunk macro $texture2DSAMPLE(XXX) is deprecated. Please use $DECODE(texture2D(XXX)) instead.');
        code.prepend(litShader.chunks.textureSamplePS);
      }
    } else {
      if (options.alphaTest) {
        decl.append("float dAlpha;");
        code.append(this._addMap("opacity", "opacityPS", options, litShader.chunks, textureMapping));
        code.append(litShader.chunks.alphaTestPS);
        func.append("getOpacity();");
        func.append("alphaTest(dAlpha);");
      }
    }

    for (const texture in textureMapping) {
      decl.append(`uniform sampler2D ${textureMapping[texture]};`);
    }

    func.code = `\n${func.code.split('\n').map(l => `    ${l}`).join('\n')}\n\n`;
    litShader.generateFragmentShader(decl.code, code.code, func.code, lightingUv);
    return litShader.getDefinition();
  }
};

export { _matTex2D, standard };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhbmRhcmQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9ncmFwaGljcy9wcm9ncmFtLWxpYi9wcm9ncmFtcy9zdGFuZGFyZC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBoYXNoQ29kZSB9IGZyb20gJy4uLy4uLy4uL2NvcmUvaGFzaC5qcyc7XG5pbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvZGVidWcuanMnO1xuXG5pbXBvcnQge1xuICAgIEJMRU5EX05PTkUsIEZSRVNORUxfU0NITElDSywgTElHSFRUWVBFX0RJUkVDVElPTkFMLFxuICAgIFNQRUNVTEFSX1BIT05HLFxuICAgIFNQUklURV9SRU5ERVJNT0RFX1NMSUNFRCwgU1BSSVRFX1JFTkRFUk1PREVfVElMRURcbn0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IFNoYWRlclBhc3MgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9zaGFkZXItcGFzcy5qcyc7XG5pbXBvcnQgeyBMaXRTaGFkZXIgfSBmcm9tICcuL2xpdC1zaGFkZXIuanMnO1xuaW1wb3J0IHsgQ2h1bmtCdWlsZGVyIH0gZnJvbSAnLi4vY2h1bmstYnVpbGRlci5qcyc7XG5pbXBvcnQgeyBDaHVua1V0aWxzIH0gZnJvbSAnLi4vY2h1bmstdXRpbHMuanMnO1xuXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vLi4vZ3JhcGhpY3MtZGV2aWNlLmpzJykuR3JhcGhpY3NEZXZpY2V9IEdyYXBoaWNzRGV2aWNlICovXG5cbmNvbnN0IF9tYXRUZXgyRCA9IFtdO1xuXG5jb25zdCBzdGFuZGFyZCA9IHtcbiAgICAvLyBTaGFyZWQgU3RhbmRhcmQgTWF0ZXJpYWwgb3B0aW9uIHN0cnVjdHVyZXNcbiAgICBvcHRpb25zQ29udGV4dDoge30sXG4gICAgb3B0aW9uc0NvbnRleHRNaW46IHt9LFxuXG4gICAgLyoqIEB0eXBlIHsgRnVuY3Rpb24gfSAqL1xuICAgIGdlbmVyYXRlS2V5OiBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBjb25zdCBidWlsZFByb3BlcnRpZXNMaXN0ID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgICAgIGNvbnN0IHByb3BzID0gW107XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHByb3AgaW4gb3B0aW9ucykge1xuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLmhhc093blByb3BlcnR5KHByb3ApICYmIHByb3AgIT09IFwiY2h1bmtzXCIgJiYgcHJvcCAhPT0gXCJsaWdodHNcIilcbiAgICAgICAgICAgICAgICAgICAgcHJvcHMucHVzaChwcm9wKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBwcm9wcy5zb3J0KCk7XG4gICAgICAgIH07XG4gICAgICAgIGxldCBwcm9wcztcbiAgICAgICAgaWYgKG9wdGlvbnMgPT09IHRoaXMub3B0aW9uc0NvbnRleHRNaW4pIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5wcm9wc01pbikgdGhpcy5wcm9wc01pbiA9IGJ1aWxkUHJvcGVydGllc0xpc3Qob3B0aW9ucyk7XG4gICAgICAgICAgICBwcm9wcyA9IHRoaXMucHJvcHNNaW47XG4gICAgICAgIH0gZWxzZSBpZiAob3B0aW9ucyA9PT0gdGhpcy5vcHRpb25zQ29udGV4dCkge1xuICAgICAgICAgICAgaWYgKCF0aGlzLnByb3BzKSB0aGlzLnByb3BzID0gYnVpbGRQcm9wZXJ0aWVzTGlzdChvcHRpb25zKTtcbiAgICAgICAgICAgIHByb3BzID0gdGhpcy5wcm9wcztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHByb3BzID0gYnVpbGRQcm9wZXJ0aWVzTGlzdChvcHRpb25zKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBrZXkgPSBcInN0YW5kYXJkXCI7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwcm9wcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKG9wdGlvbnNbcHJvcHNbaV1dKVxuICAgICAgICAgICAgICAgIGtleSArPSBwcm9wc1tpXSArIG9wdGlvbnNbcHJvcHNbaV1dO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdGlvbnMuY2h1bmtzKSB7XG4gICAgICAgICAgICBjb25zdCBjaHVua3MgPSBbXTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgcCBpbiBvcHRpb25zLmNodW5rcykge1xuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLmNodW5rcy5oYXNPd25Qcm9wZXJ0eShwKSkge1xuICAgICAgICAgICAgICAgICAgICBjaHVua3MucHVzaChwICsgb3B0aW9ucy5jaHVua3NbcF0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNodW5rcy5zb3J0KCk7XG4gICAgICAgICAgICBrZXkgKz0gY2h1bmtzO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdGlvbnMubGlnaHRzKSB7XG4gICAgICAgICAgICBjb25zdCBpc0NsdXN0ZXJlZCA9IG9wdGlvbnMuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBvcHRpb25zLmxpZ2h0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0ID0gb3B0aW9ucy5saWdodHNbaV07XG4gICAgICAgICAgICAgICAgaWYgKCFpc0NsdXN0ZXJlZCB8fCBsaWdodC5fdHlwZSA9PT0gTElHSFRUWVBFX0RJUkVDVElPTkFMKSB7XG4gICAgICAgICAgICAgICAgICAgIGtleSArPSBsaWdodC5rZXk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGhhc2hDb2RlKGtleSk7XG4gICAgfSxcblxuICAgIC8vIGdldCB0aGUgdmFsdWUgdG8gcmVwbGFjZSAkVVYgd2l0aCBpbiBNYXAgU2hhZGVyIGZ1bmN0aW9uc1xuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBjb2RlIHdpdGggd2hpY2ggdG8gdG8gcmVwbGFjZSAnJFVWJyBpbiB0aGUgbWFwIHNoYWRlciBmdW5jdGlvbnMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdHJhbnNmb3JtUHJvcE5hbWUgLSBOYW1lIG9mIHRoZSB0cmFuc2Zvcm0gaWQgaW4gdGhlIG9wdGlvbnMgYmxvY2suIFVzdWFsbHkgXCJiYXNlbmFtZVRyYW5zZm9ybVwiLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB1VlByb3BOYW1lIC0gTmFtZSBvZiB0aGUgVVYgY2hhbm5lbCBpbiB0aGUgb3B0aW9ucyBibG9jay4gVXN1YWxseSBcImJhc2VuYW1lVXZcIi5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gb3B0aW9ucyAtIFRoZSBvcHRpb25zIHBhc3NlZCBpbnRvIGNyZWF0ZVNoYWRlckRlZmluaXRpb24uXG4gICAgICogQHJldHVybnMge3N0cmluZ30gVGhlIGNvZGUgdXNlZCB0byByZXBsYWNlIFwiJFVWXCIgaW4gdGhlIHNoYWRlciBjb2RlLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2dldFV2U291cmNlRXhwcmVzc2lvbjogZnVuY3Rpb24gKHRyYW5zZm9ybVByb3BOYW1lLCB1VlByb3BOYW1lLCBvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IHRyYW5zZm9ybUlkID0gb3B0aW9uc1t0cmFuc2Zvcm1Qcm9wTmFtZV07XG4gICAgICAgIGNvbnN0IHV2Q2hhbm5lbCA9IG9wdGlvbnNbdVZQcm9wTmFtZV07XG4gICAgICAgIGNvbnN0IGlzTWFpblBhc3MgPSBTaGFkZXJQYXNzLmlzRm9yd2FyZChvcHRpb25zLnBhc3MpO1xuXG4gICAgICAgIGxldCBleHByZXNzaW9uO1xuICAgICAgICBpZiAoaXNNYWluUGFzcyAmJiBvcHRpb25zLm5pbmVTbGljZWRNb2RlID09PSBTUFJJVEVfUkVOREVSTU9ERV9TTElDRUQpIHtcbiAgICAgICAgICAgIGV4cHJlc3Npb24gPSBcIm5pbmVTbGljZWRVdlwiO1xuICAgICAgICB9IGVsc2UgaWYgKGlzTWFpblBhc3MgJiYgb3B0aW9ucy5uaW5lU2xpY2VkTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfVElMRUQpIHtcbiAgICAgICAgICAgIGV4cHJlc3Npb24gPSBcIm5pbmVTbGljZWRVdlwiO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKHRyYW5zZm9ybUlkID09PSAwKSB7XG4gICAgICAgICAgICAgICAgZXhwcmVzc2lvbiA9IFwidlV2XCIgKyB1dkNoYW5uZWw7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIG5vdGU6IGRpZmZlcmVudCBjYXBpdGFsaXphdGlvbiFcbiAgICAgICAgICAgICAgICBleHByZXNzaW9uID0gXCJ2VVZcIiArIHV2Q2hhbm5lbCArIFwiX1wiICsgdHJhbnNmb3JtSWQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGlmIGhlaWdodG1hcCBpcyBlbmFibGVkIGFsbCBtYXBzIGV4Y2VwdCB0aGUgaGVpZ2h0bWFwIGFyZSBvZmZzZXRcbiAgICAgICAgICAgIGlmIChvcHRpb25zLmhlaWdodE1hcCAmJiB0cmFuc2Zvcm1Qcm9wTmFtZSAhPT0gXCJoZWlnaHRNYXBUcmFuc2Zvcm1cIikge1xuICAgICAgICAgICAgICAgIGV4cHJlc3Npb24gKz0gXCIgKyBkVXZPZmZzZXRcIjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBleHByZXNzaW9uO1xuICAgIH0sXG5cbiAgICBfYWRkTWFwRGVmOiBmdW5jdGlvbiAobmFtZSwgZW5hYmxlZCkge1xuICAgICAgICByZXR1cm4gZW5hYmxlZCA/IGAjZGVmaW5lICR7bmFtZX1cXG5gIDogYCN1bmRlZiAke25hbWV9XFxuYDtcbiAgICB9LFxuXG4gICAgX2FkZE1hcERlZnM6IGZ1bmN0aW9uIChmbG9hdCwgY29sb3IsIHZlcnRleCwgbWFwKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hZGRNYXBEZWYoXCJNQVBGTE9BVFwiLCBmbG9hdCkgK1xuICAgICAgICAgICAgICAgdGhpcy5fYWRkTWFwRGVmKFwiTUFQQ09MT1JcIiwgY29sb3IpICtcbiAgICAgICAgICAgICAgIHRoaXMuX2FkZE1hcERlZihcIk1BUFZFUlRFWFwiLCB2ZXJ0ZXgpICtcbiAgICAgICAgICAgICAgIHRoaXMuX2FkZE1hcERlZihcIk1BUFRFWFRVUkVcIiwgbWFwKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQWRkIGNodW5rIGZvciBNYXAgVHlwZXMgKHVzZWQgZm9yIGFsbCBtYXBzIGV4Y2VwdCBOb3JtYWwpLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHByb3BOYW1lIC0gVGhlIGJhc2UgbmFtZSBvZiB0aGUgbWFwOiBkaWZmdXNlIHwgZW1pc3NpdmUgfCBvcGFjaXR5IHwgbGlnaHQgfCBoZWlnaHQgfCBtZXRhbG5lc3MgfCBzcGVjdWxhciB8IGdsb3NzIHwgYW8uXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGNodW5rTmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBjaHVuayB0byB1c2UuIFVzdWFsbHkgXCJiYXNlbmFtZVBTXCIuXG4gICAgICogQHBhcmFtIHtvYmplY3R9IG9wdGlvbnMgLSBUaGUgb3B0aW9ucyBwYXNzZWQgaW50byB0byBjcmVhdGVTaGFkZXJEZWZpbml0aW9uLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBjaHVua3MgLSBUaGUgc2V0IG9mIHNoYWRlciBjaHVua3MgdG8gY2hvb3NlIGZyb20uXG4gICAgICogQHBhcmFtIHtvYmplY3R9IG1hcHBpbmcgLSBUaGUgbWFwcGluZyBiZXR3ZWVuIGNodW5rIGFuZCBzYW1wbGVyXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGVuY29kaW5nIC0gVGhlIHRleHR1cmUncyBlbmNvZGluZ1xuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IFRoZSBzaGFkZXIgY29kZSB0byBzdXBwb3J0IHRoaXMgbWFwLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2FkZE1hcDogZnVuY3Rpb24gKHByb3BOYW1lLCBjaHVua05hbWUsIG9wdGlvbnMsIGNodW5rcywgbWFwcGluZywgZW5jb2RpbmcgPSBudWxsKSB7XG4gICAgICAgIGNvbnN0IG1hcFByb3BOYW1lID0gcHJvcE5hbWUgKyBcIk1hcFwiO1xuICAgICAgICBjb25zdCB1VlByb3BOYW1lID0gbWFwUHJvcE5hbWUgKyBcIlV2XCI7XG4gICAgICAgIGNvbnN0IGlkZW50aWZpZXJQcm9wTmFtZSA9IG1hcFByb3BOYW1lICsgXCJJZGVudGlmaWVyXCI7XG4gICAgICAgIGNvbnN0IHRyYW5zZm9ybVByb3BOYW1lID0gbWFwUHJvcE5hbWUgKyBcIlRyYW5zZm9ybVwiO1xuICAgICAgICBjb25zdCBjaGFubmVsUHJvcE5hbWUgPSBtYXBQcm9wTmFtZSArIFwiQ2hhbm5lbFwiO1xuICAgICAgICBjb25zdCB2ZXJ0ZXhDb2xvckNoYW5uZWxQcm9wTmFtZSA9IHByb3BOYW1lICsgXCJWZXJ0ZXhDb2xvckNoYW5uZWxcIjtcbiAgICAgICAgY29uc3QgdGludFByb3BOYW1lID0gcHJvcE5hbWUgKyBcIlRpbnRcIjtcbiAgICAgICAgY29uc3QgdmVydGV4Q29sb3JQcm9wTmFtZSA9IHByb3BOYW1lICsgXCJWZXJ0ZXhDb2xvclwiO1xuICAgICAgICBjb25zdCBkZXRhaWxNb2RlUHJvcE5hbWUgPSBwcm9wTmFtZSArIFwiTW9kZVwiO1xuXG4gICAgICAgIGNvbnN0IHRpbnRPcHRpb24gPSBvcHRpb25zW3RpbnRQcm9wTmFtZV07XG4gICAgICAgIGNvbnN0IHZlcnRleENvbG9yT3B0aW9uID0gb3B0aW9uc1t2ZXJ0ZXhDb2xvclByb3BOYW1lXTtcbiAgICAgICAgY29uc3QgdGV4dHVyZU9wdGlvbiA9IG9wdGlvbnNbbWFwUHJvcE5hbWVdO1xuICAgICAgICBjb25zdCB0ZXh0dXJlSWRlbnRpZmllciA9IG9wdGlvbnNbaWRlbnRpZmllclByb3BOYW1lXTtcbiAgICAgICAgY29uc3QgZGV0YWlsTW9kZU9wdGlvbiA9IG9wdGlvbnNbZGV0YWlsTW9kZVByb3BOYW1lXTtcblxuICAgICAgICBsZXQgc3ViQ29kZSA9IGNodW5rc1tjaHVua05hbWVdO1xuXG4gICAgICAgIGlmICh0ZXh0dXJlT3B0aW9uKSB7XG4gICAgICAgICAgICBjb25zdCB1diA9IHRoaXMuX2dldFV2U291cmNlRXhwcmVzc2lvbih0cmFuc2Zvcm1Qcm9wTmFtZSwgdVZQcm9wTmFtZSwgb3B0aW9ucyk7XG5cbiAgICAgICAgICAgIHN1YkNvZGUgPSBzdWJDb2RlLnJlcGxhY2UoL1xcJFVWL2csIHV2KS5yZXBsYWNlKC9cXCRDSC9nLCBvcHRpb25zW2NoYW5uZWxQcm9wTmFtZV0pO1xuXG4gICAgICAgICAgICBpZiAobWFwcGluZyAmJiBzdWJDb2RlLnNlYXJjaCgvXFwkU0FNUExFUi9nKSAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICBsZXQgc2FtcGxlck5hbWUgPSBcInRleHR1cmVfXCIgKyBtYXBQcm9wTmFtZTtcbiAgICAgICAgICAgICAgICBjb25zdCBhbGlhcyA9IG1hcHBpbmdbdGV4dHVyZUlkZW50aWZpZXJdO1xuICAgICAgICAgICAgICAgIGlmIChhbGlhcykge1xuICAgICAgICAgICAgICAgICAgICBzYW1wbGVyTmFtZSA9IGFsaWFzO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIG1hcHBpbmdbdGV4dHVyZUlkZW50aWZpZXJdID0gc2FtcGxlck5hbWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHN1YkNvZGUgPSBzdWJDb2RlLnJlcGxhY2UoL1xcJFNBTVBMRVIvZywgc2FtcGxlck5hbWUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoZW5jb2RpbmcpIHtcbiAgICAgICAgICAgICAgICBpZiAob3B0aW9uc1tjaGFubmVsUHJvcE5hbWVdID09PSAnYWFhJykge1xuICAgICAgICAgICAgICAgICAgICAvLyBjb21wbGV0ZWx5IHNraXAgZGVjb2RpbmcgaWYgdGhlIHVzZXIgaGFzIHNlbGVjdGVkIHRoZSBhbHBoYSBjaGFubmVsIChzaW5jZSBhbHBoYVxuICAgICAgICAgICAgICAgICAgICAvLyBpcyBuZXZlciBkZWNvZGVkKS5cbiAgICAgICAgICAgICAgICAgICAgc3ViQ29kZSA9IHN1YkNvZGUucmVwbGFjZSgvXFwkREVDT0RFL2csICdwYXNzVGhyb3VnaCcpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHN1YkNvZGUgPSBzdWJDb2RlLnJlcGxhY2UoL1xcJERFQ09ERS9nLCBDaHVua1V0aWxzLmRlY29kZUZ1bmMoKCFvcHRpb25zLmdhbW1hICYmIGVuY29kaW5nID09PSAnc3JnYicpID8gJ2xpbmVhcicgOiBlbmNvZGluZykpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIGNvbnRpbnVlIHRvIHN1cHBvcnQgJHRleHR1cmUyRFNBTVBMRVxuICAgICAgICAgICAgICAgIGlmIChzdWJDb2RlLmluZGV4T2YoJyR0ZXh0dXJlMkRTQU1QTEUnKSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBkZWNvZGVUYWJsZSA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpbmVhcjogJ3RleHR1cmUyRCcsXG4gICAgICAgICAgICAgICAgICAgICAgICBzcmdiOiAndGV4dHVyZTJEU1JHQicsXG4gICAgICAgICAgICAgICAgICAgICAgICByZ2JtOiAndGV4dHVyZTJEUkdCTScsXG4gICAgICAgICAgICAgICAgICAgICAgICByZ2JlOiAndGV4dHVyZTJEUkdCRSdcbiAgICAgICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgICAgICBzdWJDb2RlID0gc3ViQ29kZS5yZXBsYWNlKC9cXCR0ZXh0dXJlMkRTQU1QTEUvZywgZGVjb2RlVGFibGVbZW5jb2RpbmddIHx8ICd0ZXh0dXJlMkQnKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodmVydGV4Q29sb3JPcHRpb24pIHtcbiAgICAgICAgICAgIHN1YkNvZGUgPSBzdWJDb2RlLnJlcGxhY2UoL1xcJFZDL2csIG9wdGlvbnNbdmVydGV4Q29sb3JDaGFubmVsUHJvcE5hbWVdKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChkZXRhaWxNb2RlT3B0aW9uKSB7XG4gICAgICAgICAgICBzdWJDb2RlID0gc3ViQ29kZS5yZXBsYWNlKC9cXCRERVRBSUxNT0RFL2csIGRldGFpbE1vZGVPcHRpb24pO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgaXNGbG9hdFRpbnQgPSAhISh0aW50T3B0aW9uICYgMSk7XG4gICAgICAgIGNvbnN0IGlzVmVjVGludCA9ICEhKHRpbnRPcHRpb24gJiAyKTtcblxuICAgICAgICBzdWJDb2RlID0gdGhpcy5fYWRkTWFwRGVmcyhpc0Zsb2F0VGludCwgaXNWZWNUaW50LCB2ZXJ0ZXhDb2xvck9wdGlvbiwgdGV4dHVyZU9wdGlvbikgKyBzdWJDb2RlO1xuICAgICAgICByZXR1cm4gc3ViQ29kZS5yZXBsYWNlKC9cXCQvZywgXCJcIik7XG4gICAgfSxcblxuICAgIF9jb3JyZWN0Q2hhbm5lbDogZnVuY3Rpb24gKHAsIGNoYW4sIF9tYXRUZXgyRCkge1xuICAgICAgICBpZiAoX21hdFRleDJEW3BdID4gMCkge1xuICAgICAgICAgICAgaWYgKF9tYXRUZXgyRFtwXSA8IGNoYW4ubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNoYW4uc3Vic3RyaW5nKDAsIF9tYXRUZXgyRFtwXSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKF9tYXRUZXgyRFtwXSA+IGNoYW4ubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgbGV0IHN0ciA9IGNoYW47XG4gICAgICAgICAgICAgICAgY29uc3QgY2hyID0gc3RyLmNoYXJBdChzdHIubGVuZ3RoIC0gMSk7XG4gICAgICAgICAgICAgICAgY29uc3QgYWRkTGVuID0gX21hdFRleDJEW3BdIC0gc3RyLmxlbmd0aDtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFkZExlbjsgaSsrKSBzdHIgKz0gY2hyO1xuICAgICAgICAgICAgICAgIHJldHVybiBzdHI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gY2hhbjtcbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICAvKiogQHR5cGUgeyBGdW5jdGlvbiB9ICovXG4gICAgY3JlYXRlU2hhZGVyRGVmaW5pdGlvbjogZnVuY3Rpb24gKGRldmljZSwgb3B0aW9ucykge1xuICAgICAgICBjb25zdCBsaXRTaGFkZXIgPSBuZXcgTGl0U2hhZGVyKGRldmljZSwgb3B0aW9ucyk7XG5cbiAgICAgICAgLy8gZ2VuZXJhdGUgdmVydGV4IHNoYWRlclxuICAgICAgICBjb25zdCB1c2VVdiA9IFtdO1xuICAgICAgICBjb25zdCB1c2VVbm1vZGlmaWVkVXYgPSBbXTtcbiAgICAgICAgY29uc3QgbWFwVHJhbnNmb3JtcyA9IFtdO1xuICAgICAgICBjb25zdCBtYXhVdlNldHMgPSAyO1xuICAgICAgICBjb25zdCB0ZXh0dXJlTWFwcGluZyA9IHt9O1xuXG4gICAgICAgIGZvciAoY29uc3QgcCBpbiBfbWF0VGV4MkQpIHtcbiAgICAgICAgICAgIGNvbnN0IG1uYW1lID0gcCArIFwiTWFwXCI7XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zW3AgKyBcIlZlcnRleENvbG9yXCJdKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY25hbWUgPSBwICsgXCJWZXJ0ZXhDb2xvckNoYW5uZWxcIjtcbiAgICAgICAgICAgICAgICBvcHRpb25zW2NuYW1lXSA9IHRoaXMuX2NvcnJlY3RDaGFubmVsKHAsIG9wdGlvbnNbY25hbWVdLCBfbWF0VGV4MkQpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAob3B0aW9uc1ttbmFtZV0pIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjbmFtZSA9IG1uYW1lICsgXCJDaGFubmVsXCI7XG4gICAgICAgICAgICAgICAgY29uc3QgdG5hbWUgPSBtbmFtZSArIFwiVHJhbnNmb3JtXCI7XG4gICAgICAgICAgICAgICAgY29uc3QgdW5hbWUgPSBtbmFtZSArIFwiVXZcIjtcblxuICAgICAgICAgICAgICAgIG9wdGlvbnNbdW5hbWVdID0gTWF0aC5taW4ob3B0aW9uc1t1bmFtZV0sIG1heFV2U2V0cyAtIDEpO1xuICAgICAgICAgICAgICAgIG9wdGlvbnNbY25hbWVdID0gdGhpcy5fY29ycmVjdENoYW5uZWwocCwgb3B0aW9uc1tjbmFtZV0sIF9tYXRUZXgyRCk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCB1dlNldCA9IG9wdGlvbnNbdW5hbWVdO1xuICAgICAgICAgICAgICAgIHVzZVV2W3V2U2V0XSA9IHRydWU7XG4gICAgICAgICAgICAgICAgdXNlVW5tb2RpZmllZFV2W3V2U2V0XSA9IHVzZVVubW9kaWZpZWRVdlt1dlNldF0gfHwgKG9wdGlvbnNbbW5hbWVdICYmICFvcHRpb25zW3RuYW1lXSk7XG5cbiAgICAgICAgICAgICAgICAvLyBjcmVhdGUgbWFwIHRyYW5zZm9ybXNcbiAgICAgICAgICAgICAgICBpZiAob3B0aW9uc1t0bmFtZV0pIHtcbiAgICAgICAgICAgICAgICAgICAgbWFwVHJhbnNmb3Jtcy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IHAsXG4gICAgICAgICAgICAgICAgICAgICAgICBpZDogb3B0aW9uc1t0bmFtZV0sXG4gICAgICAgICAgICAgICAgICAgICAgICB1djogb3B0aW9uc1t1bmFtZV1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdGlvbnMuZm9yY2VVdjEpIHtcbiAgICAgICAgICAgIHVzZVV2WzFdID0gdHJ1ZTtcbiAgICAgICAgICAgIHVzZVVubW9kaWZpZWRVdlsxXSA9ICh1c2VVbm1vZGlmaWVkVXZbMV0gIT09IHVuZGVmaW5lZCkgPyB1c2VVbm1vZGlmaWVkVXZbMV0gOiB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgbGl0U2hhZGVyLmdlbmVyYXRlVmVydGV4U2hhZGVyKHVzZVV2LCB1c2VVbm1vZGlmaWVkVXYsIG1hcFRyYW5zZm9ybXMpO1xuXG4gICAgICAgIC8vIGhhbmRsZSBmcmFnbWVudCBzaGFkZXJcbiAgICAgICAgaWYgKG9wdGlvbnMuc2hhZGluZ01vZGVsID09PSBTUEVDVUxBUl9QSE9ORykge1xuICAgICAgICAgICAgb3B0aW9ucy5mcmVzbmVsTW9kZWwgPSAwO1xuICAgICAgICAgICAgb3B0aW9ucy5hbWJpZW50U0ggPSBmYWxzZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG9wdGlvbnMuZnJlc25lbE1vZGVsID0gKG9wdGlvbnMuZnJlc25lbE1vZGVsID09PSAwKSA/IEZSRVNORUxfU0NITElDSyA6IG9wdGlvbnMuZnJlc25lbE1vZGVsO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZGVjbCA9IG5ldyBDaHVua0J1aWxkZXIoKTtcbiAgICAgICAgY29uc3QgY29kZSA9IG5ldyBDaHVua0J1aWxkZXIoKTtcbiAgICAgICAgY29uc3QgZnVuYyA9IG5ldyBDaHVua0J1aWxkZXIoKTtcbiAgICAgICAgbGV0IGxpZ2h0aW5nVXYgPSBcIlwiO1xuXG4gICAgICAgIC8vIGdsb2JhbCB0ZXh0dXJlIGJpYXMgZm9yIHN0YW5kYXJkIHRleHR1cmVzXG4gICAgICAgIGlmIChvcHRpb25zLm5pbmVTbGljZWRNb2RlID09PSBTUFJJVEVfUkVOREVSTU9ERV9USUxFRCkge1xuICAgICAgICAgICAgZGVjbC5hcHBlbmQoYGNvbnN0IGZsb2F0IHRleHR1cmVCaWFzID0gLTEwMDAuMDtgKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGRlY2wuYXBwZW5kKGB1bmlmb3JtIGZsb2F0IHRleHR1cmVCaWFzO2ApO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKFNoYWRlclBhc3MuaXNGb3J3YXJkKG9wdGlvbnMucGFzcykpIHtcbiAgICAgICAgICAgIC8vIHBhcmFsbGF4XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5oZWlnaHRNYXApIHtcbiAgICAgICAgICAgICAgICAvLyBpZiAoIW9wdGlvbnMubm9ybWFsTWFwKSB7XG4gICAgICAgICAgICAgICAgLy8gICAgIGNvbnN0IHRyYW5zZm9ybWVkSGVpZ2h0TWFwVXYgPSB0aGlzLl9nZXRVdlNvdXJjZUV4cHJlc3Npb24oXCJoZWlnaHRNYXBUcmFuc2Zvcm1cIiwgXCJoZWlnaHRNYXBVdlwiLCBvcHRpb25zKTtcbiAgICAgICAgICAgICAgICAvLyAgICAgaWYgKCFvcHRpb25zLmhhc1RhbmdlbnRzKSB0Ym4gPSB0Ym4ucmVwbGFjZSgvXFwkVVYvZywgdHJhbnNmb3JtZWRIZWlnaHRNYXBVdik7XG4gICAgICAgICAgICAgICAgLy8gICAgIGNvZGUgKz0gdGJuO1xuICAgICAgICAgICAgICAgIC8vIH1cbiAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcInZlYzIgZFV2T2Zmc2V0O1wiKTtcbiAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJoZWlnaHRcIiwgXCJwYXJhbGxheFBTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nKSk7XG4gICAgICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRQYXJhbGxheCgpO1wiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gb3BhY2l0eVxuICAgICAgICAgICAgaWYgKG9wdGlvbnMuYmxlbmRUeXBlICE9PSBCTEVORF9OT05FIHx8IG9wdGlvbnMuYWxwaGFUZXN0IHx8IG9wdGlvbnMuYWxwaGFUb0NvdmVyYWdlKSB7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJmbG9hdCBkQWxwaGE7XCIpO1xuICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcIm9wYWNpdHlcIiwgXCJvcGFjaXR5UFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcpKTtcbiAgICAgICAgICAgICAgICBmdW5jLmFwcGVuZChcImdldE9wYWNpdHkoKTtcIik7XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMuYWxwaGFUZXN0KSB7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKGxpdFNoYWRlci5jaHVua3MuYWxwaGFUZXN0UFMpO1xuICAgICAgICAgICAgICAgICAgICBmdW5jLmFwcGVuZChcImFscGhhVGVzdChkQWxwaGEpO1wiKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwiZmxvYXQgZEFscGhhID0gMS4wO1wiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gbm9ybWFsXG4gICAgICAgICAgICBpZiAobGl0U2hhZGVyLm5lZWRzTm9ybWFsKSB7XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMubm9ybWFsTWFwIHx8IG9wdGlvbnMuY2xlYXJDb2F0Tm9ybWFsTWFwKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFRPRE86IGxldCBlYWNoIG5vcm1hbG1hcCBpbnB1dCAobm9ybWFsTWFwLCBub3JtYWxEZXRhaWxNYXAsIGNsZWFyQ29hdE5vcm1hbE1hcCkgaW5kZXBlbmRlbnRseSBkZWNpZGUgd2hpY2ggdW5wYWNrTm9ybWFsIHRvIHVzZS5cbiAgICAgICAgICAgICAgICAgICAgY29kZS5hcHBlbmQob3B0aW9ucy5wYWNrZWROb3JtYWwgPyBsaXRTaGFkZXIuY2h1bmtzLm5vcm1hbFhZUFMgOiBsaXRTaGFkZXIuY2h1bmtzLm5vcm1hbFhZWlBTKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoIW9wdGlvbnMuaGFzVGFuZ2VudHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFRPRE86IGdlbmVyYWxpemUgdG8gc3VwcG9ydCBlYWNoIG5vcm1hbG1hcCBpbnB1dCAobm9ybWFsTWFwLCBub3JtYWxEZXRhaWxNYXAsIGNsZWFyQ29hdE5vcm1hbE1hcCkgaW5kZXBlbmRlbnRseVxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYmFzZU5hbWUgPSBvcHRpb25zLm5vcm1hbE1hcCA/IFwibm9ybWFsTWFwXCIgOiBcImNsZWFyQ29hdE5vcm1hbE1hcFwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgbGlnaHRpbmdVdiA9IHRoaXMuX2dldFV2U291cmNlRXhwcmVzc2lvbihgJHtiYXNlTmFtZX1UcmFuc2Zvcm1gLCBgJHtiYXNlTmFtZX1VdmAsIG9wdGlvbnMpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJ2ZWMzIGROb3JtYWxXO1wiKTtcbiAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJub3JtYWxEZXRhaWxcIiwgXCJub3JtYWxEZXRhaWxNYXBQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZykpO1xuICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcIm5vcm1hbFwiLCBcIm5vcm1hbE1hcFBTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nKSk7XG4gICAgICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXROb3JtYWwoKTtcIik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChsaXRTaGFkZXIubmVlZHNTY2VuZUNvbG9yKSB7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJ1bmlmb3JtIHNhbXBsZXIyRCB1U2NlbmVDb2xvck1hcDtcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAobGl0U2hhZGVyLm5lZWRzU2NyZWVuU2l6ZSkge1xuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwidW5pZm9ybSB2ZWM0IHVTY3JlZW5TaXplO1wiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChsaXRTaGFkZXIubmVlZHNUcmFuc2Zvcm1zKSB7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJ1bmlmb3JtIG1hdDQgbWF0cml4X3ZpZXdQcm9qZWN0aW9uO1wiKTtcbiAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcInVuaWZvcm0gbWF0NCBtYXRyaXhfbW9kZWw7XCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBhbGJlZG9cbiAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwidmVjMyBkQWxiZWRvO1wiKTtcbiAgICAgICAgICAgIGlmIChvcHRpb25zLmRpZmZ1c2VEZXRhaWwpIHtcbiAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJkaWZmdXNlRGV0YWlsXCIsIFwiZGlmZnVzZURldGFpbE1hcFBTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nLCBvcHRpb25zLmRpZmZ1c2VEZXRhaWxFbmNvZGluZykpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwiZGlmZnVzZVwiLCBcImRpZmZ1c2VQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZywgb3B0aW9ucy5kaWZmdXNlRW5jb2RpbmcpKTtcbiAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0QWxiZWRvKCk7XCIpO1xuXG4gICAgICAgICAgICBpZiAob3B0aW9ucy5yZWZyYWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJmbG9hdCBkVHJhbnNtaXNzaW9uO1wiKTtcbiAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJyZWZyYWN0aW9uXCIsIFwidHJhbnNtaXNzaW9uUFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcpKTtcbiAgICAgICAgICAgICAgICBmdW5jLmFwcGVuZChcImdldFJlZnJhY3Rpb24oKTtcIik7XG5cbiAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcImZsb2F0IGRUaGlja25lc3M7XCIpO1xuICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcInRoaWNrbmVzc1wiLCBcInRoaWNrbmVzc1BTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nKSk7XG4gICAgICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRUaGlja25lc3MoKTtcIik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zLmlyaWRlc2NlbmNlKSB7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJ2ZWMzIGRJcmlkZXNjZW5jZUZyZXNuZWw7XCIpO1xuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwiZmxvYXQgZElyaWRlc2NlbmNlO1wiKTtcbiAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJpcmlkZXNjZW5jZVwiLCBcImlyaWRlc2NlbmNlUFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcpKTtcbiAgICAgICAgICAgICAgICBmdW5jLmFwcGVuZChcImdldElyaWRlc2NlbmNlKCk7XCIpO1xuXG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJmbG9hdCBkSXJpZGVzY2VuY2VUaGlja25lc3M7XCIpO1xuICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcImlyaWRlc2NlbmNlVGhpY2tuZXNzXCIsIFwiaXJpZGVzY2VuY2VUaGlja25lc3NQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZykpO1xuICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0SXJpZGVzY2VuY2VUaGlja25lc3MoKTtcIik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHNwZWN1bGFyaXR5ICYgZ2xvc3NpbmVzc1xuICAgICAgICAgICAgaWYgKChsaXRTaGFkZXIubGlnaHRpbmcgJiYgb3B0aW9ucy51c2VTcGVjdWxhcikgfHwgbGl0U2hhZGVyLnJlZmxlY3Rpb25zKSB7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJ2ZWMzIGRTcGVjdWxhcml0eTtcIik7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJmbG9hdCBkR2xvc3NpbmVzcztcIik7XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMuc2hlZW4pIHtcbiAgICAgICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJ2ZWMzIHNTcGVjdWxhcml0eTtcIik7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcInNoZWVuXCIsIFwic2hlZW5QU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZywgb3B0aW9ucy5zaGVlbkVuY29kaW5nKSk7XG4gICAgICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0U2hlZW4oKTtcIik7XG5cbiAgICAgICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJmbG9hdCBzR2xvc3NpbmVzcztcIik7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcInNoZWVuR2xvc3NpbmVzc1wiLCBcInNoZWVuR2xvc3NQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZykpO1xuICAgICAgICAgICAgICAgICAgICBmdW5jLmFwcGVuZChcImdldFNoZWVuR2xvc3NpbmVzcygpO1wiKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMudXNlTWV0YWxuZXNzKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwiZmxvYXQgZE1ldGFsbmVzcztcIik7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcIm1ldGFsbmVzc1wiLCBcIm1ldGFsbmVzc1BTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nKSk7XG4gICAgICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0TWV0YWxuZXNzKCk7XCIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy51c2VTcGVjdWxhcml0eUZhY3Rvcikge1xuICAgICAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcImZsb2F0IGRTcGVjdWxhcml0eUZhY3RvcjtcIik7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcInNwZWN1bGFyaXR5RmFjdG9yXCIsIFwic3BlY3VsYXJpdHlGYWN0b3JQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZykpO1xuICAgICAgICAgICAgICAgICAgICBmdW5jLmFwcGVuZChcImdldFNwZWN1bGFyaXR5RmFjdG9yKCk7XCIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy51c2VTcGVjdWxhckNvbG9yKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcInNwZWN1bGFyXCIsIFwic3BlY3VsYXJQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZywgb3B0aW9ucy5zcGVjdWxhckVuY29kaW5nKSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29kZS5hcHBlbmQoXCJ2b2lkIGdldFNwZWN1bGFyaXR5KCkgeyBkU3BlY3VsYXJpdHkgPSB2ZWMzKDEpOyB9XCIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJnbG9zc1wiLCBcImdsb3NzUFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcpKTtcbiAgICAgICAgICAgICAgICBmdW5jLmFwcGVuZChcImdldEdsb3NzaW5lc3MoKTtcIik7XG4gICAgICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRTcGVjdWxhcml0eSgpO1wiKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJ2ZWMzIGRTcGVjdWxhcml0eSA9IHZlYzMoMC4wKTtcIik7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJmbG9hdCBkR2xvc3NpbmVzcyA9IDAuMDtcIik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGFvXG4gICAgICAgICAgICBpZiAob3B0aW9ucy5hb01hcCB8fCBvcHRpb25zLmFvVmVydGV4Q29sb3IpIHtcbiAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcImZsb2F0IGRBbztcIik7XG4gICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwiYW9cIiwgXCJhb1BTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nKSk7XG4gICAgICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRBTygpO1wiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gZW1pc3Npb25cbiAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwidmVjMyBkRW1pc3Npb247XCIpO1xuICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwiZW1pc3NpdmVcIiwgXCJlbWlzc2l2ZVBTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nLCBvcHRpb25zLmVtaXNzaXZlRW5jb2RpbmcpKTtcbiAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0RW1pc3Npb24oKTtcIik7XG5cbiAgICAgICAgICAgIC8vIGNsZWFyY29hdFxuICAgICAgICAgICAgaWYgKG9wdGlvbnMuY2xlYXJDb2F0ID4gMCkge1xuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwiZmxvYXQgY2NTcGVjdWxhcml0eTtcIik7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJmbG9hdCBjY0dsb3NzaW5lc3M7XCIpO1xuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwidmVjMyBjY05vcm1hbFc7XCIpO1xuXG4gICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwiY2xlYXJDb2F0XCIsIFwiY2xlYXJDb2F0UFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcpKTtcbiAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJjbGVhckNvYXRHbG9zc1wiLCBcImNsZWFyQ29hdEdsb3NzUFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcpKTtcbiAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJjbGVhckNvYXROb3JtYWxcIiwgXCJjbGVhckNvYXROb3JtYWxQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZykpO1xuXG4gICAgICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRDbGVhckNvYXQoKTtcIik7XG4gICAgICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRDbGVhckNvYXRHbG9zc2luZXNzKCk7XCIpO1xuICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0Q2xlYXJDb2F0Tm9ybWFsKCk7XCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBsaWdodG1hcFxuICAgICAgICAgICAgaWYgKG9wdGlvbnMubGlnaHRNYXAgfHwgb3B0aW9ucy5saWdodFZlcnRleENvbG9yKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbGlnaHRtYXBEaXIgPSAob3B0aW9ucy5kaXJMaWdodE1hcCAmJiBvcHRpb25zLnVzZVNwZWN1bGFyKTtcbiAgICAgICAgICAgICAgICBjb25zdCBsaWdodG1hcENodW5rUHJvcE5hbWUgPSBsaWdodG1hcERpciA/ICdsaWdodG1hcERpclBTJyA6ICdsaWdodG1hcFNpbmdsZVBTJztcbiAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcInZlYzMgZExpZ2h0bWFwO1wiKTtcbiAgICAgICAgICAgICAgICBpZiAobGlnaHRtYXBEaXIpIHtcbiAgICAgICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJ2ZWMzIGRMaWdodG1hcERpcjtcIik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcImxpZ2h0XCIsIGxpZ2h0bWFwQ2h1bmtQcm9wTmFtZSwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcsIG9wdGlvbnMubGlnaHRNYXBFbmNvZGluZykpO1xuICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0TGlnaHRNYXAoKTtcIik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIG9ubHkgYWRkIHRoZSBsZWdhY3kgY2h1bmsgaWYgaXQncyByZWZlcmVuY2VkXG4gICAgICAgICAgICBpZiAoY29kZS5jb2RlLmluZGV4T2YoJ3RleHR1cmUyRFNSR0InKSAhPT0gLTEgfHxcbiAgICAgICAgICAgICAgICBjb2RlLmNvZGUuaW5kZXhPZigndGV4dHVyZTJEUkdCTScpICE9PSAtMSB8fFxuICAgICAgICAgICAgICAgIGNvZGUuY29kZS5pbmRleE9mKCd0ZXh0dXJlMkRSR0JFJykgIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgnU2hhZGVyIGNodW5rIG1hY3JvICR0ZXh0dXJlMkRTQU1QTEUoWFhYKSBpcyBkZXByZWNhdGVkLiBQbGVhc2UgdXNlICRERUNPREUodGV4dHVyZTJEKFhYWCkpIGluc3RlYWQuJyk7XG4gICAgICAgICAgICAgICAgY29kZS5wcmVwZW5kKGxpdFNoYWRlci5jaHVua3MudGV4dHVyZVNhbXBsZVBTKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gYWxsIG90aGVyIHBhc3NlcyByZXF1aXJlIG9ubHkgb3BhY2l0eVxuICAgICAgICAgICAgaWYgKG9wdGlvbnMuYWxwaGFUZXN0KSB7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJmbG9hdCBkQWxwaGE7XCIpO1xuICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcIm9wYWNpdHlcIiwgXCJvcGFjaXR5UFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcpKTtcbiAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZChsaXRTaGFkZXIuY2h1bmtzLmFscGhhVGVzdFBTKTtcbiAgICAgICAgICAgICAgICBmdW5jLmFwcGVuZChcImdldE9wYWNpdHkoKTtcIik7XG4gICAgICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJhbHBoYVRlc3QoZEFscGhhKTtcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGNvbnN0IHRleHR1cmUgaW4gdGV4dHVyZU1hcHBpbmcpIHtcbiAgICAgICAgICAgIGRlY2wuYXBwZW5kKGB1bmlmb3JtIHNhbXBsZXIyRCAke3RleHR1cmVNYXBwaW5nW3RleHR1cmVdfTtgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGRlY2wuYXBwZW5kKCcvLy0tLS0tLS0tIGZyb250ZW5kIGRlY2wgYmVnaW4nLCBkZWNsLmNvZGUsICcvLy0tLS0tLS0tIGZyb250ZW5kIGRlY2wgZW5kJyk7XG4gICAgICAgIC8vIGNvZGUuYXBwZW5kKCcvLy0tLS0tLS0tIGZyb250ZW5kIGNvZGUgYmVnaW4nLCBjb2RlLmNvZGUsICcvLy0tLS0tLS0tIGZyb250ZW5kIGNvZGUgZW5kJyk7XG4gICAgICAgIC8vIGZ1bmMuYXBwZW5kKCcvLy0tLS0tLS0tIGZyb250ZW5kIGZ1bmMgYmVnaW5cXG4ke2Z1bmN9Ly8tLS0tLS0tLSBmcm9udGVuZCBmdW5jIGVuZFxcbmA7XG5cbiAgICAgICAgLy8gZm9ybWF0IGZ1bmNcbiAgICAgICAgZnVuYy5jb2RlID0gYFxcbiR7ZnVuYy5jb2RlLnNwbGl0KCdcXG4nKS5tYXAobCA9PiBgICAgICR7bH1gKS5qb2luKCdcXG4nKX1cXG5cXG5gO1xuXG4gICAgICAgIGxpdFNoYWRlci5nZW5lcmF0ZUZyYWdtZW50U2hhZGVyKGRlY2wuY29kZSwgY29kZS5jb2RlLCBmdW5jLmNvZGUsIGxpZ2h0aW5nVXYpO1xuXG4gICAgICAgIHJldHVybiBsaXRTaGFkZXIuZ2V0RGVmaW5pdGlvbigpO1xuICAgIH1cbn07XG5cbmV4cG9ydCB7IF9tYXRUZXgyRCwgc3RhbmRhcmQgfTtcbiJdLCJuYW1lcyI6WyJfbWF0VGV4MkQiLCJzdGFuZGFyZCIsIm9wdGlvbnNDb250ZXh0Iiwib3B0aW9uc0NvbnRleHRNaW4iLCJnZW5lcmF0ZUtleSIsIm9wdGlvbnMiLCJidWlsZFByb3BlcnRpZXNMaXN0IiwicHJvcHMiLCJwcm9wIiwiaGFzT3duUHJvcGVydHkiLCJwdXNoIiwic29ydCIsInByb3BzTWluIiwia2V5IiwiaSIsImxlbmd0aCIsImNodW5rcyIsInAiLCJsaWdodHMiLCJpc0NsdXN0ZXJlZCIsImNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCIsImxpZ2h0IiwiX3R5cGUiLCJMSUdIVFRZUEVfRElSRUNUSU9OQUwiLCJoYXNoQ29kZSIsIl9nZXRVdlNvdXJjZUV4cHJlc3Npb24iLCJ0cmFuc2Zvcm1Qcm9wTmFtZSIsInVWUHJvcE5hbWUiLCJ0cmFuc2Zvcm1JZCIsInV2Q2hhbm5lbCIsImlzTWFpblBhc3MiLCJTaGFkZXJQYXNzIiwiaXNGb3J3YXJkIiwicGFzcyIsImV4cHJlc3Npb24iLCJuaW5lU2xpY2VkTW9kZSIsIlNQUklURV9SRU5ERVJNT0RFX1NMSUNFRCIsIlNQUklURV9SRU5ERVJNT0RFX1RJTEVEIiwiaGVpZ2h0TWFwIiwiX2FkZE1hcERlZiIsIm5hbWUiLCJlbmFibGVkIiwiX2FkZE1hcERlZnMiLCJmbG9hdCIsImNvbG9yIiwidmVydGV4IiwibWFwIiwiX2FkZE1hcCIsInByb3BOYW1lIiwiY2h1bmtOYW1lIiwibWFwcGluZyIsImVuY29kaW5nIiwibWFwUHJvcE5hbWUiLCJpZGVudGlmaWVyUHJvcE5hbWUiLCJjaGFubmVsUHJvcE5hbWUiLCJ2ZXJ0ZXhDb2xvckNoYW5uZWxQcm9wTmFtZSIsInRpbnRQcm9wTmFtZSIsInZlcnRleENvbG9yUHJvcE5hbWUiLCJkZXRhaWxNb2RlUHJvcE5hbWUiLCJ0aW50T3B0aW9uIiwidmVydGV4Q29sb3JPcHRpb24iLCJ0ZXh0dXJlT3B0aW9uIiwidGV4dHVyZUlkZW50aWZpZXIiLCJkZXRhaWxNb2RlT3B0aW9uIiwic3ViQ29kZSIsInV2IiwicmVwbGFjZSIsInNlYXJjaCIsInNhbXBsZXJOYW1lIiwiYWxpYXMiLCJDaHVua1V0aWxzIiwiZGVjb2RlRnVuYyIsImdhbW1hIiwiaW5kZXhPZiIsImRlY29kZVRhYmxlIiwibGluZWFyIiwic3JnYiIsInJnYm0iLCJyZ2JlIiwiaXNGbG9hdFRpbnQiLCJpc1ZlY1RpbnQiLCJfY29ycmVjdENoYW5uZWwiLCJjaGFuIiwic3Vic3RyaW5nIiwic3RyIiwiY2hyIiwiY2hhckF0IiwiYWRkTGVuIiwiY3JlYXRlU2hhZGVyRGVmaW5pdGlvbiIsImRldmljZSIsImxpdFNoYWRlciIsIkxpdFNoYWRlciIsInVzZVV2IiwidXNlVW5tb2RpZmllZFV2IiwibWFwVHJhbnNmb3JtcyIsIm1heFV2U2V0cyIsInRleHR1cmVNYXBwaW5nIiwibW5hbWUiLCJjbmFtZSIsInRuYW1lIiwidW5hbWUiLCJNYXRoIiwibWluIiwidXZTZXQiLCJpZCIsImZvcmNlVXYxIiwidW5kZWZpbmVkIiwiZ2VuZXJhdGVWZXJ0ZXhTaGFkZXIiLCJzaGFkaW5nTW9kZWwiLCJTUEVDVUxBUl9QSE9ORyIsImZyZXNuZWxNb2RlbCIsImFtYmllbnRTSCIsIkZSRVNORUxfU0NITElDSyIsImRlY2wiLCJDaHVua0J1aWxkZXIiLCJjb2RlIiwiZnVuYyIsImxpZ2h0aW5nVXYiLCJhcHBlbmQiLCJibGVuZFR5cGUiLCJCTEVORF9OT05FIiwiYWxwaGFUZXN0IiwiYWxwaGFUb0NvdmVyYWdlIiwiYWxwaGFUZXN0UFMiLCJuZWVkc05vcm1hbCIsIm5vcm1hbE1hcCIsImNsZWFyQ29hdE5vcm1hbE1hcCIsInBhY2tlZE5vcm1hbCIsIm5vcm1hbFhZUFMiLCJub3JtYWxYWVpQUyIsImhhc1RhbmdlbnRzIiwiYmFzZU5hbWUiLCJuZWVkc1NjZW5lQ29sb3IiLCJuZWVkc1NjcmVlblNpemUiLCJuZWVkc1RyYW5zZm9ybXMiLCJkaWZmdXNlRGV0YWlsIiwiZGlmZnVzZURldGFpbEVuY29kaW5nIiwiZGlmZnVzZUVuY29kaW5nIiwicmVmcmFjdGlvbiIsImlyaWRlc2NlbmNlIiwibGlnaHRpbmciLCJ1c2VTcGVjdWxhciIsInJlZmxlY3Rpb25zIiwic2hlZW4iLCJzaGVlbkVuY29kaW5nIiwidXNlTWV0YWxuZXNzIiwidXNlU3BlY3VsYXJpdHlGYWN0b3IiLCJ1c2VTcGVjdWxhckNvbG9yIiwic3BlY3VsYXJFbmNvZGluZyIsImFvTWFwIiwiYW9WZXJ0ZXhDb2xvciIsImVtaXNzaXZlRW5jb2RpbmciLCJjbGVhckNvYXQiLCJsaWdodE1hcCIsImxpZ2h0VmVydGV4Q29sb3IiLCJsaWdodG1hcERpciIsImRpckxpZ2h0TWFwIiwibGlnaHRtYXBDaHVua1Byb3BOYW1lIiwibGlnaHRNYXBFbmNvZGluZyIsIkRlYnVnIiwiZGVwcmVjYXRlZCIsInByZXBlbmQiLCJ0ZXh0dXJlU2FtcGxlUFMiLCJ0ZXh0dXJlIiwic3BsaXQiLCJsIiwiam9pbiIsImdlbmVyYXRlRnJhZ21lbnRTaGFkZXIiLCJnZXREZWZpbml0aW9uIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7O0FBZU1B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
