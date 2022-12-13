/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { hashCode } from '../../../core/hash.js';
import { Debug } from '../../../core/debug.js';
import { LIGHTTYPE_DIRECTIONAL, SPRITE_RENDERMODE_SLICED, SPRITE_RENDERMODE_TILED, SPECULAR_PHONG, FRESNEL_SCHLICK, BLEND_NONE } from '../../constants.js';
import { ShaderPass } from '../../shader-pass.js';
import { LitShader } from './lit-shader.js';
import { ChunkBuilder } from '../chunk-builder.js';
import { ChunkUtils } from '../chunk-utils.js';
import { StandardMaterialOptions } from '../../materials/standard-material-options.js';

const _matTex2D = [];
const standard = {
  optionsContext: new StandardMaterialOptions(),
  optionsContextMin: new StandardMaterialOptions(),
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
    if (options.litOptions) {
      for (const m in options.litOptions) key += m + options.litOptions[m];
      if (options.litOptions.lights) {
        const isClustered = options.litOptions.clusteredLightingEnabled;
        for (let i = 0; i < options.litOptions.lights.length; i++) {
          const light = options.litOptions.lights[i];
          if (!isClustered || light._type === LIGHTTYPE_DIRECTIONAL) {
            key += light.key;
          }
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
    if (isMainPass && options.litOptions.nineSlicedMode === SPRITE_RENDERMODE_SLICED) {
      expression = "nineSlicedUv";
    } else if (isMainPass && options.litOptions.nineSlicedMode === SPRITE_RENDERMODE_TILED) {
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
          subCode = subCode.replace(/\$DECODE/g, ChunkUtils.decodeFunc(!options.litOptions.gamma && encoding === 'srgb' ? 'linear' : encoding));
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
    const litShader = new LitShader(device, options.litOptions);

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

    if (options.litOptions.shadingModel === SPECULAR_PHONG) {
      options.litOptions.fresnelModel = 0;
      options.litOptions.ambientSH = false;
    } else {
      options.litOptions.fresnelModel = options.litOptions.fresnelModel === 0 ? FRESNEL_SCHLICK : options.litOptions.fresnelModel;
    }
    const decl = new ChunkBuilder();
    const code = new ChunkBuilder();
    const func = new ChunkBuilder();
    let lightingUv = "";

    if (options.litOptions.nineSlicedMode === SPRITE_RENDERMODE_TILED) {
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

      if (options.litOptions.blendType !== BLEND_NONE || options.litOptions.alphaTest || options.litOptions.alphaToCoverage) {
        decl.append("float dAlpha;");
        code.append(this._addMap("opacity", "opacityPS", options, litShader.chunks, textureMapping));
        func.append("getOpacity();");
        if (options.litOptions.alphaTest) {
          code.append(litShader.chunks.alphaTestPS);
          func.append("alphaTest(dAlpha);");
        }
      } else {
        decl.append("float dAlpha = 1.0;");
      }

      if (litShader.needsNormal) {
        if (options.normalMap || options.clearCoatNormalMap) {
          code.append(options.packedNormal ? litShader.chunks.normalXYPS : litShader.chunks.normalXYZPS);
          if (!options.litOptions.hasTangents) {
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
      if (options.litOptions.useRefraction) {
        decl.append("float dTransmission;");
        code.append(this._addMap("refraction", "transmissionPS", options, litShader.chunks, textureMapping));
        func.append("getRefraction();");
        decl.append("float dThickness;");
        code.append(this._addMap("thickness", "thicknessPS", options, litShader.chunks, textureMapping));
        func.append("getThickness();");
      }
      if (options.litOptions.useIridescence) {
        decl.append("vec3 dIridescenceFresnel;");
        decl.append("float dIridescence;");
        code.append(this._addMap("iridescence", "iridescencePS", options, litShader.chunks, textureMapping));
        func.append("getIridescence();");
        decl.append("float dIridescenceThickness;");
        code.append(this._addMap("iridescenceThickness", "iridescenceThicknessPS", options, litShader.chunks, textureMapping));
        func.append("getIridescenceThickness();");
      }

      if (litShader.lighting && options.litOptions.useSpecular || litShader.reflections) {
        decl.append("vec3 dSpecularity;");
        decl.append("float dGlossiness;");
        if (options.litOptions.useSheen) {
          decl.append("vec3 sSpecularity;");
          code.append(this._addMap("sheen", "sheenPS", options, litShader.chunks, textureMapping, options.sheenEncoding));
          func.append("getSheen();");
          decl.append("float sGlossiness;");
          code.append(this._addMap("sheenGlossiness", "sheenGlossPS", options, litShader.chunks, textureMapping));
          func.append("getSheenGlossiness();");
        }
        if (options.litOptions.useMetalness) {
          decl.append("float dMetalness;");
          code.append(this._addMap("metalness", "metalnessPS", options, litShader.chunks, textureMapping));
          func.append("getMetalness();");
        }
        if (options.litOptions.useSpecularityFactor) {
          decl.append("float dSpecularityFactor;");
          code.append(this._addMap("specularityFactor", "specularityFactorPS", options, litShader.chunks, textureMapping));
          func.append("getSpecularityFactor();");
        }
        if (options.litOptions.useSpecularColor) {
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

      if (options.litOptions.useClearCoat) {
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

      if (options.litOptions.lightMapEnabled || options.lightMapVertexColors) {
        const lightmapDir = options.litOptions.dirLightMapEnabled && options.litOptions.useSpecular;
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
      if (options.litOptions.alphaTest) {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhbmRhcmQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL3Byb2dyYW1zL3N0YW5kYXJkLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGhhc2hDb2RlIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9oYXNoLmpzJztcbmltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbmltcG9ydCB7XG4gICAgQkxFTkRfTk9ORSwgRlJFU05FTF9TQ0hMSUNLLCBMSUdIVFRZUEVfRElSRUNUSU9OQUwsXG4gICAgU1BFQ1VMQVJfUEhPTkcsXG4gICAgU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VELCBTUFJJVEVfUkVOREVSTU9ERV9USUxFRFxufSBmcm9tICcuLi8uLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgU2hhZGVyUGFzcyB9IGZyb20gJy4uLy4uL3NoYWRlci1wYXNzLmpzJztcbmltcG9ydCB7IExpdFNoYWRlciB9IGZyb20gJy4vbGl0LXNoYWRlci5qcyc7XG5pbXBvcnQgeyBDaHVua0J1aWxkZXIgfSBmcm9tICcuLi9jaHVuay1idWlsZGVyLmpzJztcbmltcG9ydCB7IENodW5rVXRpbHMgfSBmcm9tICcuLi9jaHVuay11dGlscy5qcyc7XG5pbXBvcnQgeyBTdGFuZGFyZE1hdGVyaWFsT3B0aW9ucyB9IGZyb20gJy4uLy4uL21hdGVyaWFscy9zdGFuZGFyZC1tYXRlcmlhbC1vcHRpb25zLmpzJztcblxuY29uc3QgX21hdFRleDJEID0gW107XG5cbmNvbnN0IHN0YW5kYXJkID0ge1xuICAgIC8vIFNoYXJlZCBTdGFuZGFyZCBNYXRlcmlhbCBvcHRpb24gc3RydWN0dXJlc1xuICAgIG9wdGlvbnNDb250ZXh0OiBuZXcgU3RhbmRhcmRNYXRlcmlhbE9wdGlvbnMoKSxcbiAgICBvcHRpb25zQ29udGV4dE1pbjogbmV3IFN0YW5kYXJkTWF0ZXJpYWxPcHRpb25zKCksXG5cbiAgICAvKiogQHR5cGUgeyBGdW5jdGlvbiB9ICovXG4gICAgZ2VuZXJhdGVLZXk6IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IGJ1aWxkUHJvcGVydGllc0xpc3QgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICAgICAgY29uc3QgcHJvcHMgPSBbXTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgcHJvcCBpbiBvcHRpb25zKSB7XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMuaGFzT3duUHJvcGVydHkocHJvcCkgJiYgcHJvcCAhPT0gXCJjaHVua3NcIiAmJiBwcm9wICE9PSBcImxpZ2h0c1wiKVxuICAgICAgICAgICAgICAgICAgICBwcm9wcy5wdXNoKHByb3ApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHByb3BzLnNvcnQoKTtcbiAgICAgICAgfTtcbiAgICAgICAgbGV0IHByb3BzO1xuICAgICAgICBpZiAob3B0aW9ucyA9PT0gdGhpcy5vcHRpb25zQ29udGV4dE1pbikge1xuICAgICAgICAgICAgaWYgKCF0aGlzLnByb3BzTWluKSB0aGlzLnByb3BzTWluID0gYnVpbGRQcm9wZXJ0aWVzTGlzdChvcHRpb25zKTtcbiAgICAgICAgICAgIHByb3BzID0gdGhpcy5wcm9wc01pbjtcbiAgICAgICAgfSBlbHNlIGlmIChvcHRpb25zID09PSB0aGlzLm9wdGlvbnNDb250ZXh0KSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMucHJvcHMpIHRoaXMucHJvcHMgPSBidWlsZFByb3BlcnRpZXNMaXN0KG9wdGlvbnMpO1xuICAgICAgICAgICAgcHJvcHMgPSB0aGlzLnByb3BzO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcHJvcHMgPSBidWlsZFByb3BlcnRpZXNMaXN0KG9wdGlvbnMpO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGtleSA9IFwic3RhbmRhcmRcIjtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHByb3BzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAob3B0aW9uc1twcm9wc1tpXV0pXG4gICAgICAgICAgICAgICAga2V5ICs9IHByb3BzW2ldICsgb3B0aW9uc1twcm9wc1tpXV07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy5jaHVua3MpIHtcbiAgICAgICAgICAgIGNvbnN0IGNodW5rcyA9IFtdO1xuICAgICAgICAgICAgZm9yIChjb25zdCBwIGluIG9wdGlvbnMuY2h1bmtzKSB7XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMuY2h1bmtzLmhhc093blByb3BlcnR5KHApKSB7XG4gICAgICAgICAgICAgICAgICAgIGNodW5rcy5wdXNoKHAgKyBvcHRpb25zLmNodW5rc1twXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2h1bmtzLnNvcnQoKTtcbiAgICAgICAgICAgIGtleSArPSBjaHVua3M7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy5saXRPcHRpb25zKSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IG0gaW4gb3B0aW9ucy5saXRPcHRpb25zKVxuICAgICAgICAgICAgICAgIGtleSArPSBtICsgb3B0aW9ucy5saXRPcHRpb25zW21dO1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMubGl0T3B0aW9ucy5saWdodHMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBpc0NsdXN0ZXJlZCA9IG9wdGlvbnMubGl0T3B0aW9ucy5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQ7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBvcHRpb25zLmxpdE9wdGlvbnMubGlnaHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0ID0gb3B0aW9ucy5saXRPcHRpb25zLmxpZ2h0c1tpXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFpc0NsdXN0ZXJlZCB8fCBsaWdodC5fdHlwZSA9PT0gTElHSFRUWVBFX0RJUkVDVElPTkFMKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBrZXkgKz0gbGlnaHQua2V5O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGhhc2hDb2RlKGtleSk7XG4gICAgfSxcblxuICAgIC8vIGdldCB0aGUgdmFsdWUgdG8gcmVwbGFjZSAkVVYgd2l0aCBpbiBNYXAgU2hhZGVyIGZ1bmN0aW9uc1xuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBjb2RlIHdpdGggd2hpY2ggdG8gdG8gcmVwbGFjZSAnJFVWJyBpbiB0aGUgbWFwIHNoYWRlciBmdW5jdGlvbnMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdHJhbnNmb3JtUHJvcE5hbWUgLSBOYW1lIG9mIHRoZSB0cmFuc2Zvcm0gaWQgaW4gdGhlIG9wdGlvbnMgYmxvY2suIFVzdWFsbHkgXCJiYXNlbmFtZVRyYW5zZm9ybVwiLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB1VlByb3BOYW1lIC0gTmFtZSBvZiB0aGUgVVYgY2hhbm5lbCBpbiB0aGUgb3B0aW9ucyBibG9jay4gVXN1YWxseSBcImJhc2VuYW1lVXZcIi5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gb3B0aW9ucyAtIFRoZSBvcHRpb25zIHBhc3NlZCBpbnRvIGNyZWF0ZVNoYWRlckRlZmluaXRpb24uXG4gICAgICogQHJldHVybnMge3N0cmluZ30gVGhlIGNvZGUgdXNlZCB0byByZXBsYWNlIFwiJFVWXCIgaW4gdGhlIHNoYWRlciBjb2RlLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2dldFV2U291cmNlRXhwcmVzc2lvbjogZnVuY3Rpb24gKHRyYW5zZm9ybVByb3BOYW1lLCB1VlByb3BOYW1lLCBvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IHRyYW5zZm9ybUlkID0gb3B0aW9uc1t0cmFuc2Zvcm1Qcm9wTmFtZV07XG4gICAgICAgIGNvbnN0IHV2Q2hhbm5lbCA9IG9wdGlvbnNbdVZQcm9wTmFtZV07XG4gICAgICAgIGNvbnN0IGlzTWFpblBhc3MgPSBTaGFkZXJQYXNzLmlzRm9yd2FyZChvcHRpb25zLnBhc3MpO1xuXG4gICAgICAgIGxldCBleHByZXNzaW9uO1xuICAgICAgICBpZiAoaXNNYWluUGFzcyAmJiBvcHRpb25zLmxpdE9wdGlvbnMubmluZVNsaWNlZE1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1NMSUNFRCkge1xuICAgICAgICAgICAgZXhwcmVzc2lvbiA9IFwibmluZVNsaWNlZFV2XCI7XG4gICAgICAgIH0gZWxzZSBpZiAoaXNNYWluUGFzcyAmJiBvcHRpb25zLmxpdE9wdGlvbnMubmluZVNsaWNlZE1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1RJTEVEKSB7XG4gICAgICAgICAgICBleHByZXNzaW9uID0gXCJuaW5lU2xpY2VkVXZcIjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmICh0cmFuc2Zvcm1JZCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIGV4cHJlc3Npb24gPSBcInZVdlwiICsgdXZDaGFubmVsO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBub3RlOiBkaWZmZXJlbnQgY2FwaXRhbGl6YXRpb24hXG4gICAgICAgICAgICAgICAgZXhwcmVzc2lvbiA9IFwidlVWXCIgKyB1dkNoYW5uZWwgKyBcIl9cIiArIHRyYW5zZm9ybUlkO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBpZiBoZWlnaHRtYXAgaXMgZW5hYmxlZCBhbGwgbWFwcyBleGNlcHQgdGhlIGhlaWdodG1hcCBhcmUgb2Zmc2V0XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5oZWlnaHRNYXAgJiYgdHJhbnNmb3JtUHJvcE5hbWUgIT09IFwiaGVpZ2h0TWFwVHJhbnNmb3JtXCIpIHtcbiAgICAgICAgICAgICAgICBleHByZXNzaW9uICs9IFwiICsgZFV2T2Zmc2V0XCI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZXhwcmVzc2lvbjtcbiAgICB9LFxuXG4gICAgX2FkZE1hcERlZjogZnVuY3Rpb24gKG5hbWUsIGVuYWJsZWQpIHtcbiAgICAgICAgcmV0dXJuIGVuYWJsZWQgPyBgI2RlZmluZSAke25hbWV9XFxuYCA6IGAjdW5kZWYgJHtuYW1lfVxcbmA7XG4gICAgfSxcblxuICAgIF9hZGRNYXBEZWZzOiBmdW5jdGlvbiAoZmxvYXQsIGNvbG9yLCB2ZXJ0ZXgsIG1hcCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYWRkTWFwRGVmKFwiTUFQRkxPQVRcIiwgZmxvYXQpICtcbiAgICAgICAgICAgICAgIHRoaXMuX2FkZE1hcERlZihcIk1BUENPTE9SXCIsIGNvbG9yKSArXG4gICAgICAgICAgICAgICB0aGlzLl9hZGRNYXBEZWYoXCJNQVBWRVJURVhcIiwgdmVydGV4KSArXG4gICAgICAgICAgICAgICB0aGlzLl9hZGRNYXBEZWYoXCJNQVBURVhUVVJFXCIsIG1hcCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEFkZCBjaHVuayBmb3IgTWFwIFR5cGVzICh1c2VkIGZvciBhbGwgbWFwcyBleGNlcHQgTm9ybWFsKS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBwcm9wTmFtZSAtIFRoZSBiYXNlIG5hbWUgb2YgdGhlIG1hcDogZGlmZnVzZSB8IGVtaXNzaXZlIHwgb3BhY2l0eSB8IGxpZ2h0IHwgaGVpZ2h0IHwgbWV0YWxuZXNzIHwgc3BlY3VsYXIgfCBnbG9zcyB8IGFvLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBjaHVua05hbWUgLSBUaGUgbmFtZSBvZiB0aGUgY2h1bmsgdG8gdXNlLiBVc3VhbGx5IFwiYmFzZW5hbWVQU1wiLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBvcHRpb25zIC0gVGhlIG9wdGlvbnMgcGFzc2VkIGludG8gdG8gY3JlYXRlU2hhZGVyRGVmaW5pdGlvbi5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gY2h1bmtzIC0gVGhlIHNldCBvZiBzaGFkZXIgY2h1bmtzIHRvIGNob29zZSBmcm9tLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBtYXBwaW5nIC0gVGhlIG1hcHBpbmcgYmV0d2VlbiBjaHVuayBhbmQgc2FtcGxlclxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBlbmNvZGluZyAtIFRoZSB0ZXh0dXJlJ3MgZW5jb2RpbmdcbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfSBUaGUgc2hhZGVyIGNvZGUgdG8gc3VwcG9ydCB0aGlzIG1hcC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9hZGRNYXA6IGZ1bmN0aW9uIChwcm9wTmFtZSwgY2h1bmtOYW1lLCBvcHRpb25zLCBjaHVua3MsIG1hcHBpbmcsIGVuY29kaW5nID0gbnVsbCkge1xuICAgICAgICBjb25zdCBtYXBQcm9wTmFtZSA9IHByb3BOYW1lICsgXCJNYXBcIjtcbiAgICAgICAgY29uc3QgdVZQcm9wTmFtZSA9IG1hcFByb3BOYW1lICsgXCJVdlwiO1xuICAgICAgICBjb25zdCBpZGVudGlmaWVyUHJvcE5hbWUgPSBtYXBQcm9wTmFtZSArIFwiSWRlbnRpZmllclwiO1xuICAgICAgICBjb25zdCB0cmFuc2Zvcm1Qcm9wTmFtZSA9IG1hcFByb3BOYW1lICsgXCJUcmFuc2Zvcm1cIjtcbiAgICAgICAgY29uc3QgY2hhbm5lbFByb3BOYW1lID0gbWFwUHJvcE5hbWUgKyBcIkNoYW5uZWxcIjtcbiAgICAgICAgY29uc3QgdmVydGV4Q29sb3JDaGFubmVsUHJvcE5hbWUgPSBwcm9wTmFtZSArIFwiVmVydGV4Q29sb3JDaGFubmVsXCI7XG4gICAgICAgIGNvbnN0IHRpbnRQcm9wTmFtZSA9IHByb3BOYW1lICsgXCJUaW50XCI7XG4gICAgICAgIGNvbnN0IHZlcnRleENvbG9yUHJvcE5hbWUgPSBwcm9wTmFtZSArIFwiVmVydGV4Q29sb3JcIjtcbiAgICAgICAgY29uc3QgZGV0YWlsTW9kZVByb3BOYW1lID0gcHJvcE5hbWUgKyBcIk1vZGVcIjtcblxuICAgICAgICBjb25zdCB0aW50T3B0aW9uID0gb3B0aW9uc1t0aW50UHJvcE5hbWVdO1xuICAgICAgICBjb25zdCB2ZXJ0ZXhDb2xvck9wdGlvbiA9IG9wdGlvbnNbdmVydGV4Q29sb3JQcm9wTmFtZV07XG4gICAgICAgIGNvbnN0IHRleHR1cmVPcHRpb24gPSBvcHRpb25zW21hcFByb3BOYW1lXTtcbiAgICAgICAgY29uc3QgdGV4dHVyZUlkZW50aWZpZXIgPSBvcHRpb25zW2lkZW50aWZpZXJQcm9wTmFtZV07XG4gICAgICAgIGNvbnN0IGRldGFpbE1vZGVPcHRpb24gPSBvcHRpb25zW2RldGFpbE1vZGVQcm9wTmFtZV07XG5cbiAgICAgICAgbGV0IHN1YkNvZGUgPSBjaHVua3NbY2h1bmtOYW1lXTtcblxuICAgICAgICBpZiAodGV4dHVyZU9wdGlvbikge1xuICAgICAgICAgICAgY29uc3QgdXYgPSB0aGlzLl9nZXRVdlNvdXJjZUV4cHJlc3Npb24odHJhbnNmb3JtUHJvcE5hbWUsIHVWUHJvcE5hbWUsIG9wdGlvbnMpO1xuXG4gICAgICAgICAgICBzdWJDb2RlID0gc3ViQ29kZS5yZXBsYWNlKC9cXCRVVi9nLCB1dikucmVwbGFjZSgvXFwkQ0gvZywgb3B0aW9uc1tjaGFubmVsUHJvcE5hbWVdKTtcblxuICAgICAgICAgICAgaWYgKG1hcHBpbmcgJiYgc3ViQ29kZS5zZWFyY2goL1xcJFNBTVBMRVIvZykgIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgbGV0IHNhbXBsZXJOYW1lID0gXCJ0ZXh0dXJlX1wiICsgbWFwUHJvcE5hbWU7XG4gICAgICAgICAgICAgICAgY29uc3QgYWxpYXMgPSBtYXBwaW5nW3RleHR1cmVJZGVudGlmaWVyXTtcbiAgICAgICAgICAgICAgICBpZiAoYWxpYXMpIHtcbiAgICAgICAgICAgICAgICAgICAgc2FtcGxlck5hbWUgPSBhbGlhcztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBtYXBwaW5nW3RleHR1cmVJZGVudGlmaWVyXSA9IHNhbXBsZXJOYW1lO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBzdWJDb2RlID0gc3ViQ29kZS5yZXBsYWNlKC9cXCRTQU1QTEVSL2csIHNhbXBsZXJOYW1lKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGVuY29kaW5nKSB7XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnNbY2hhbm5lbFByb3BOYW1lXSA9PT0gJ2FhYScpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gY29tcGxldGVseSBza2lwIGRlY29kaW5nIGlmIHRoZSB1c2VyIGhhcyBzZWxlY3RlZCB0aGUgYWxwaGEgY2hhbm5lbCAoc2luY2UgYWxwaGFcbiAgICAgICAgICAgICAgICAgICAgLy8gaXMgbmV2ZXIgZGVjb2RlZCkuXG4gICAgICAgICAgICAgICAgICAgIHN1YkNvZGUgPSBzdWJDb2RlLnJlcGxhY2UoL1xcJERFQ09ERS9nLCAncGFzc1Rocm91Z2gnKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBzdWJDb2RlID0gc3ViQ29kZS5yZXBsYWNlKC9cXCRERUNPREUvZywgQ2h1bmtVdGlscy5kZWNvZGVGdW5jKCghb3B0aW9ucy5saXRPcHRpb25zLmdhbW1hICYmIGVuY29kaW5nID09PSAnc3JnYicpID8gJ2xpbmVhcicgOiBlbmNvZGluZykpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIGNvbnRpbnVlIHRvIHN1cHBvcnQgJHRleHR1cmUyRFNBTVBMRVxuICAgICAgICAgICAgICAgIGlmIChzdWJDb2RlLmluZGV4T2YoJyR0ZXh0dXJlMkRTQU1QTEUnKSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBkZWNvZGVUYWJsZSA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpbmVhcjogJ3RleHR1cmUyRCcsXG4gICAgICAgICAgICAgICAgICAgICAgICBzcmdiOiAndGV4dHVyZTJEU1JHQicsXG4gICAgICAgICAgICAgICAgICAgICAgICByZ2JtOiAndGV4dHVyZTJEUkdCTScsXG4gICAgICAgICAgICAgICAgICAgICAgICByZ2JlOiAndGV4dHVyZTJEUkdCRSdcbiAgICAgICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgICAgICBzdWJDb2RlID0gc3ViQ29kZS5yZXBsYWNlKC9cXCR0ZXh0dXJlMkRTQU1QTEUvZywgZGVjb2RlVGFibGVbZW5jb2RpbmddIHx8ICd0ZXh0dXJlMkQnKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodmVydGV4Q29sb3JPcHRpb24pIHtcbiAgICAgICAgICAgIHN1YkNvZGUgPSBzdWJDb2RlLnJlcGxhY2UoL1xcJFZDL2csIG9wdGlvbnNbdmVydGV4Q29sb3JDaGFubmVsUHJvcE5hbWVdKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChkZXRhaWxNb2RlT3B0aW9uKSB7XG4gICAgICAgICAgICBzdWJDb2RlID0gc3ViQ29kZS5yZXBsYWNlKC9cXCRERVRBSUxNT0RFL2csIGRldGFpbE1vZGVPcHRpb24pO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgaXNGbG9hdFRpbnQgPSAhISh0aW50T3B0aW9uICYgMSk7XG4gICAgICAgIGNvbnN0IGlzVmVjVGludCA9ICEhKHRpbnRPcHRpb24gJiAyKTtcblxuICAgICAgICBzdWJDb2RlID0gdGhpcy5fYWRkTWFwRGVmcyhpc0Zsb2F0VGludCwgaXNWZWNUaW50LCB2ZXJ0ZXhDb2xvck9wdGlvbiwgdGV4dHVyZU9wdGlvbikgKyBzdWJDb2RlO1xuICAgICAgICByZXR1cm4gc3ViQ29kZS5yZXBsYWNlKC9cXCQvZywgXCJcIik7XG4gICAgfSxcblxuICAgIF9jb3JyZWN0Q2hhbm5lbDogZnVuY3Rpb24gKHAsIGNoYW4sIF9tYXRUZXgyRCkge1xuICAgICAgICBpZiAoX21hdFRleDJEW3BdID4gMCkge1xuICAgICAgICAgICAgaWYgKF9tYXRUZXgyRFtwXSA8IGNoYW4ubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNoYW4uc3Vic3RyaW5nKDAsIF9tYXRUZXgyRFtwXSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKF9tYXRUZXgyRFtwXSA+IGNoYW4ubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgbGV0IHN0ciA9IGNoYW47XG4gICAgICAgICAgICAgICAgY29uc3QgY2hyID0gc3RyLmNoYXJBdChzdHIubGVuZ3RoIC0gMSk7XG4gICAgICAgICAgICAgICAgY29uc3QgYWRkTGVuID0gX21hdFRleDJEW3BdIC0gc3RyLmxlbmd0aDtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFkZExlbjsgaSsrKSBzdHIgKz0gY2hyO1xuICAgICAgICAgICAgICAgIHJldHVybiBzdHI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gY2hhbjtcbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICAvKiogQHR5cGUgeyBGdW5jdGlvbiB9ICovXG4gICAgY3JlYXRlU2hhZGVyRGVmaW5pdGlvbjogZnVuY3Rpb24gKGRldmljZSwgb3B0aW9ucykge1xuICAgICAgICBjb25zdCBsaXRTaGFkZXIgPSBuZXcgTGl0U2hhZGVyKGRldmljZSwgb3B0aW9ucy5saXRPcHRpb25zKTtcblxuICAgICAgICAvLyBnZW5lcmF0ZSB2ZXJ0ZXggc2hhZGVyXG4gICAgICAgIGNvbnN0IHVzZVV2ID0gW107XG4gICAgICAgIGNvbnN0IHVzZVVubW9kaWZpZWRVdiA9IFtdO1xuICAgICAgICBjb25zdCBtYXBUcmFuc2Zvcm1zID0gW107XG4gICAgICAgIGNvbnN0IG1heFV2U2V0cyA9IDI7XG4gICAgICAgIGNvbnN0IHRleHR1cmVNYXBwaW5nID0ge307XG5cbiAgICAgICAgZm9yIChjb25zdCBwIGluIF9tYXRUZXgyRCkge1xuICAgICAgICAgICAgY29uc3QgbW5hbWUgPSBwICsgXCJNYXBcIjtcblxuICAgICAgICAgICAgaWYgKG9wdGlvbnNbcCArIFwiVmVydGV4Q29sb3JcIl0pIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjbmFtZSA9IHAgKyBcIlZlcnRleENvbG9yQ2hhbm5lbFwiO1xuICAgICAgICAgICAgICAgIG9wdGlvbnNbY25hbWVdID0gdGhpcy5fY29ycmVjdENoYW5uZWwocCwgb3B0aW9uc1tjbmFtZV0sIF9tYXRUZXgyRCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zW21uYW1lXSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNuYW1lID0gbW5hbWUgKyBcIkNoYW5uZWxcIjtcbiAgICAgICAgICAgICAgICBjb25zdCB0bmFtZSA9IG1uYW1lICsgXCJUcmFuc2Zvcm1cIjtcbiAgICAgICAgICAgICAgICBjb25zdCB1bmFtZSA9IG1uYW1lICsgXCJVdlwiO1xuXG4gICAgICAgICAgICAgICAgb3B0aW9uc1t1bmFtZV0gPSBNYXRoLm1pbihvcHRpb25zW3VuYW1lXSwgbWF4VXZTZXRzIC0gMSk7XG4gICAgICAgICAgICAgICAgb3B0aW9uc1tjbmFtZV0gPSB0aGlzLl9jb3JyZWN0Q2hhbm5lbChwLCBvcHRpb25zW2NuYW1lXSwgX21hdFRleDJEKTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IHV2U2V0ID0gb3B0aW9uc1t1bmFtZV07XG4gICAgICAgICAgICAgICAgdXNlVXZbdXZTZXRdID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB1c2VVbm1vZGlmaWVkVXZbdXZTZXRdID0gdXNlVW5tb2RpZmllZFV2W3V2U2V0XSB8fCAob3B0aW9uc1ttbmFtZV0gJiYgIW9wdGlvbnNbdG5hbWVdKTtcblxuICAgICAgICAgICAgICAgIC8vIGNyZWF0ZSBtYXAgdHJhbnNmb3Jtc1xuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zW3RuYW1lXSkge1xuICAgICAgICAgICAgICAgICAgICBtYXBUcmFuc2Zvcm1zLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogcCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGlkOiBvcHRpb25zW3RuYW1lXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHV2OiBvcHRpb25zW3VuYW1lXVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy5mb3JjZVV2MSkge1xuICAgICAgICAgICAgdXNlVXZbMV0gPSB0cnVlO1xuICAgICAgICAgICAgdXNlVW5tb2RpZmllZFV2WzFdID0gKHVzZVVubW9kaWZpZWRVdlsxXSAhPT0gdW5kZWZpbmVkKSA/IHVzZVVubW9kaWZpZWRVdlsxXSA6IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBsaXRTaGFkZXIuZ2VuZXJhdGVWZXJ0ZXhTaGFkZXIodXNlVXYsIHVzZVVubW9kaWZpZWRVdiwgbWFwVHJhbnNmb3Jtcyk7XG5cbiAgICAgICAgLy8gaGFuZGxlIGZyYWdtZW50IHNoYWRlclxuICAgICAgICBpZiAob3B0aW9ucy5saXRPcHRpb25zLnNoYWRpbmdNb2RlbCA9PT0gU1BFQ1VMQVJfUEhPTkcpIHtcbiAgICAgICAgICAgIG9wdGlvbnMubGl0T3B0aW9ucy5mcmVzbmVsTW9kZWwgPSAwO1xuICAgICAgICAgICAgb3B0aW9ucy5saXRPcHRpb25zLmFtYmllbnRTSCA9IGZhbHNlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgb3B0aW9ucy5saXRPcHRpb25zLmZyZXNuZWxNb2RlbCA9IChvcHRpb25zLmxpdE9wdGlvbnMuZnJlc25lbE1vZGVsID09PSAwKSA/IEZSRVNORUxfU0NITElDSyA6IG9wdGlvbnMubGl0T3B0aW9ucy5mcmVzbmVsTW9kZWw7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBkZWNsID0gbmV3IENodW5rQnVpbGRlcigpO1xuICAgICAgICBjb25zdCBjb2RlID0gbmV3IENodW5rQnVpbGRlcigpO1xuICAgICAgICBjb25zdCBmdW5jID0gbmV3IENodW5rQnVpbGRlcigpO1xuICAgICAgICBsZXQgbGlnaHRpbmdVdiA9IFwiXCI7XG5cbiAgICAgICAgLy8gZ2xvYmFsIHRleHR1cmUgYmlhcyBmb3Igc3RhbmRhcmQgdGV4dHVyZXNcbiAgICAgICAgaWYgKG9wdGlvbnMubGl0T3B0aW9ucy5uaW5lU2xpY2VkTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfVElMRUQpIHtcbiAgICAgICAgICAgIGRlY2wuYXBwZW5kKGBjb25zdCBmbG9hdCB0ZXh0dXJlQmlhcyA9IC0xMDAwLjA7YCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkZWNsLmFwcGVuZChgdW5pZm9ybSBmbG9hdCB0ZXh0dXJlQmlhcztgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChTaGFkZXJQYXNzLmlzRm9yd2FyZChvcHRpb25zLnBhc3MpKSB7XG4gICAgICAgICAgICAvLyBwYXJhbGxheFxuICAgICAgICAgICAgaWYgKG9wdGlvbnMuaGVpZ2h0TWFwKSB7XG4gICAgICAgICAgICAgICAgLy8gaWYgKCFvcHRpb25zLm5vcm1hbE1hcCkge1xuICAgICAgICAgICAgICAgIC8vICAgICBjb25zdCB0cmFuc2Zvcm1lZEhlaWdodE1hcFV2ID0gdGhpcy5fZ2V0VXZTb3VyY2VFeHByZXNzaW9uKFwiaGVpZ2h0TWFwVHJhbnNmb3JtXCIsIFwiaGVpZ2h0TWFwVXZcIiwgb3B0aW9ucyk7XG4gICAgICAgICAgICAgICAgLy8gICAgIGlmICghb3B0aW9ucy5oYXNUYW5nZW50cykgdGJuID0gdGJuLnJlcGxhY2UoL1xcJFVWL2csIHRyYW5zZm9ybWVkSGVpZ2h0TWFwVXYpO1xuICAgICAgICAgICAgICAgIC8vICAgICBjb2RlICs9IHRibjtcbiAgICAgICAgICAgICAgICAvLyB9XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJ2ZWMyIGRVdk9mZnNldDtcIik7XG4gICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwiaGVpZ2h0XCIsIFwicGFyYWxsYXhQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZykpO1xuICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0UGFyYWxsYXgoKTtcIik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIG9wYWNpdHlcbiAgICAgICAgICAgIGlmIChvcHRpb25zLmxpdE9wdGlvbnMuYmxlbmRUeXBlICE9PSBCTEVORF9OT05FIHx8IG9wdGlvbnMubGl0T3B0aW9ucy5hbHBoYVRlc3QgfHwgb3B0aW9ucy5saXRPcHRpb25zLmFscGhhVG9Db3ZlcmFnZSkge1xuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwiZmxvYXQgZEFscGhhO1wiKTtcbiAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJvcGFjaXR5XCIsIFwib3BhY2l0eVBTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nKSk7XG4gICAgICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRPcGFjaXR5KCk7XCIpO1xuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLmxpdE9wdGlvbnMuYWxwaGFUZXN0KSB7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKGxpdFNoYWRlci5jaHVua3MuYWxwaGFUZXN0UFMpO1xuICAgICAgICAgICAgICAgICAgICBmdW5jLmFwcGVuZChcImFscGhhVGVzdChkQWxwaGEpO1wiKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwiZmxvYXQgZEFscGhhID0gMS4wO1wiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gbm9ybWFsXG4gICAgICAgICAgICBpZiAobGl0U2hhZGVyLm5lZWRzTm9ybWFsKSB7XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMubm9ybWFsTWFwIHx8IG9wdGlvbnMuY2xlYXJDb2F0Tm9ybWFsTWFwKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFRPRE86IGxldCBlYWNoIG5vcm1hbG1hcCBpbnB1dCAobm9ybWFsTWFwLCBub3JtYWxEZXRhaWxNYXAsIGNsZWFyQ29hdE5vcm1hbE1hcCkgaW5kZXBlbmRlbnRseSBkZWNpZGUgd2hpY2ggdW5wYWNrTm9ybWFsIHRvIHVzZS5cbiAgICAgICAgICAgICAgICAgICAgY29kZS5hcHBlbmQob3B0aW9ucy5wYWNrZWROb3JtYWwgPyBsaXRTaGFkZXIuY2h1bmtzLm5vcm1hbFhZUFMgOiBsaXRTaGFkZXIuY2h1bmtzLm5vcm1hbFhZWlBTKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoIW9wdGlvbnMubGl0T3B0aW9ucy5oYXNUYW5nZW50cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gVE9ETzogZ2VuZXJhbGl6ZSB0byBzdXBwb3J0IGVhY2ggbm9ybWFsbWFwIGlucHV0IChub3JtYWxNYXAsIG5vcm1hbERldGFpbE1hcCwgY2xlYXJDb2F0Tm9ybWFsTWFwKSBpbmRlcGVuZGVudGx5XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBiYXNlTmFtZSA9IG9wdGlvbnMubm9ybWFsTWFwID8gXCJub3JtYWxNYXBcIiA6IFwiY2xlYXJDb2F0Tm9ybWFsTWFwXCI7XG4gICAgICAgICAgICAgICAgICAgICAgICBsaWdodGluZ1V2ID0gdGhpcy5fZ2V0VXZTb3VyY2VFeHByZXNzaW9uKGAke2Jhc2VOYW1lfVRyYW5zZm9ybWAsIGAke2Jhc2VOYW1lfVV2YCwgb3B0aW9ucyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcInZlYzMgZE5vcm1hbFc7XCIpO1xuICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcIm5vcm1hbERldGFpbFwiLCBcIm5vcm1hbERldGFpbE1hcFBTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nKSk7XG4gICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwibm9ybWFsXCIsIFwibm9ybWFsTWFwUFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcpKTtcbiAgICAgICAgICAgICAgICBmdW5jLmFwcGVuZChcImdldE5vcm1hbCgpO1wiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGxpdFNoYWRlci5uZWVkc1NjZW5lQ29sb3IpIHtcbiAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcInVuaWZvcm0gc2FtcGxlcjJEIHVTY2VuZUNvbG9yTWFwO1wiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChsaXRTaGFkZXIubmVlZHNTY3JlZW5TaXplKSB7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJ1bmlmb3JtIHZlYzQgdVNjcmVlblNpemU7XCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGxpdFNoYWRlci5uZWVkc1RyYW5zZm9ybXMpIHtcbiAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcInVuaWZvcm0gbWF0NCBtYXRyaXhfdmlld1Byb2plY3Rpb247XCIpO1xuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwidW5pZm9ybSBtYXQ0IG1hdHJpeF9tb2RlbDtcIik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGFsYmVkb1xuICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJ2ZWMzIGRBbGJlZG87XCIpO1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMuZGlmZnVzZURldGFpbCkge1xuICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcImRpZmZ1c2VEZXRhaWxcIiwgXCJkaWZmdXNlRGV0YWlsTWFwUFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcsIG9wdGlvbnMuZGlmZnVzZURldGFpbEVuY29kaW5nKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJkaWZmdXNlXCIsIFwiZGlmZnVzZVBTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nLCBvcHRpb25zLmRpZmZ1c2VFbmNvZGluZykpO1xuICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRBbGJlZG8oKTtcIik7XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zLmxpdE9wdGlvbnMudXNlUmVmcmFjdGlvbikge1xuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwiZmxvYXQgZFRyYW5zbWlzc2lvbjtcIik7XG4gICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwicmVmcmFjdGlvblwiLCBcInRyYW5zbWlzc2lvblBTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nKSk7XG4gICAgICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRSZWZyYWN0aW9uKCk7XCIpO1xuXG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJmbG9hdCBkVGhpY2tuZXNzO1wiKTtcbiAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJ0aGlja25lc3NcIiwgXCJ0aGlja25lc3NQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZykpO1xuICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0VGhpY2tuZXNzKCk7XCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAob3B0aW9ucy5saXRPcHRpb25zLnVzZUlyaWRlc2NlbmNlKSB7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJ2ZWMzIGRJcmlkZXNjZW5jZUZyZXNuZWw7XCIpO1xuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwiZmxvYXQgZElyaWRlc2NlbmNlO1wiKTtcbiAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJpcmlkZXNjZW5jZVwiLCBcImlyaWRlc2NlbmNlUFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcpKTtcbiAgICAgICAgICAgICAgICBmdW5jLmFwcGVuZChcImdldElyaWRlc2NlbmNlKCk7XCIpO1xuXG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJmbG9hdCBkSXJpZGVzY2VuY2VUaGlja25lc3M7XCIpO1xuICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcImlyaWRlc2NlbmNlVGhpY2tuZXNzXCIsIFwiaXJpZGVzY2VuY2VUaGlja25lc3NQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZykpO1xuICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0SXJpZGVzY2VuY2VUaGlja25lc3MoKTtcIik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHNwZWN1bGFyaXR5ICYgZ2xvc3NpbmVzc1xuICAgICAgICAgICAgaWYgKChsaXRTaGFkZXIubGlnaHRpbmcgJiYgb3B0aW9ucy5saXRPcHRpb25zLnVzZVNwZWN1bGFyKSB8fCBsaXRTaGFkZXIucmVmbGVjdGlvbnMpIHtcbiAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcInZlYzMgZFNwZWN1bGFyaXR5O1wiKTtcbiAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcImZsb2F0IGRHbG9zc2luZXNzO1wiKTtcbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5saXRPcHRpb25zLnVzZVNoZWVuKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwidmVjMyBzU3BlY3VsYXJpdHk7XCIpO1xuICAgICAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJzaGVlblwiLCBcInNoZWVuUFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcsIG9wdGlvbnMuc2hlZW5FbmNvZGluZykpO1xuICAgICAgICAgICAgICAgICAgICBmdW5jLmFwcGVuZChcImdldFNoZWVuKCk7XCIpO1xuXG4gICAgICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwiZmxvYXQgc0dsb3NzaW5lc3M7XCIpO1xuICAgICAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJzaGVlbkdsb3NzaW5lc3NcIiwgXCJzaGVlbkdsb3NzUFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcpKTtcbiAgICAgICAgICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRTaGVlbkdsb3NzaW5lc3MoKTtcIik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLmxpdE9wdGlvbnMudXNlTWV0YWxuZXNzKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwiZmxvYXQgZE1ldGFsbmVzcztcIik7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcIm1ldGFsbmVzc1wiLCBcIm1ldGFsbmVzc1BTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nKSk7XG4gICAgICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0TWV0YWxuZXNzKCk7XCIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5saXRPcHRpb25zLnVzZVNwZWN1bGFyaXR5RmFjdG9yKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwiZmxvYXQgZFNwZWN1bGFyaXR5RmFjdG9yO1wiKTtcbiAgICAgICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwic3BlY3VsYXJpdHlGYWN0b3JcIiwgXCJzcGVjdWxhcml0eUZhY3RvclBTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nKSk7XG4gICAgICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0U3BlY3VsYXJpdHlGYWN0b3IoKTtcIik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLmxpdE9wdGlvbnMudXNlU3BlY3VsYXJDb2xvcikge1xuICAgICAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJzcGVjdWxhclwiLCBcInNwZWN1bGFyUFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcsIG9wdGlvbnMuc3BlY3VsYXJFbmNvZGluZykpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKFwidm9pZCBnZXRTcGVjdWxhcml0eSgpIHsgZFNwZWN1bGFyaXR5ID0gdmVjMygxKTsgfVwiKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwiZ2xvc3NcIiwgXCJnbG9zc1BTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nKSk7XG4gICAgICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRHbG9zc2luZXNzKCk7XCIpO1xuICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0U3BlY3VsYXJpdHkoKTtcIik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwidmVjMyBkU3BlY3VsYXJpdHkgPSB2ZWMzKDAuMCk7XCIpO1xuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwiZmxvYXQgZEdsb3NzaW5lc3MgPSAwLjA7XCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBhb1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMuYW9NYXAgfHwgb3B0aW9ucy5hb1ZlcnRleENvbG9yKSB7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJmbG9hdCBkQW87XCIpO1xuICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcImFvXCIsIFwiYW9QU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZykpO1xuICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0QU8oKTtcIik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGVtaXNzaW9uXG4gICAgICAgICAgICBkZWNsLmFwcGVuZChcInZlYzMgZEVtaXNzaW9uO1wiKTtcbiAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcImVtaXNzaXZlXCIsIFwiZW1pc3NpdmVQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZywgb3B0aW9ucy5lbWlzc2l2ZUVuY29kaW5nKSk7XG4gICAgICAgICAgICBmdW5jLmFwcGVuZChcImdldEVtaXNzaW9uKCk7XCIpO1xuXG4gICAgICAgICAgICAvLyBjbGVhcmNvYXRcbiAgICAgICAgICAgIGlmIChvcHRpb25zLmxpdE9wdGlvbnMudXNlQ2xlYXJDb2F0KSB7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJmbG9hdCBjY1NwZWN1bGFyaXR5O1wiKTtcbiAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcImZsb2F0IGNjR2xvc3NpbmVzcztcIik7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJ2ZWMzIGNjTm9ybWFsVztcIik7XG5cbiAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJjbGVhckNvYXRcIiwgXCJjbGVhckNvYXRQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZykpO1xuICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcImNsZWFyQ29hdEdsb3NzXCIsIFwiY2xlYXJDb2F0R2xvc3NQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZykpO1xuICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcImNsZWFyQ29hdE5vcm1hbFwiLCBcImNsZWFyQ29hdE5vcm1hbFBTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nKSk7XG5cbiAgICAgICAgICAgICAgICBmdW5jLmFwcGVuZChcImdldENsZWFyQ29hdCgpO1wiKTtcbiAgICAgICAgICAgICAgICBmdW5jLmFwcGVuZChcImdldENsZWFyQ29hdEdsb3NzaW5lc3MoKTtcIik7XG4gICAgICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRDbGVhckNvYXROb3JtYWwoKTtcIik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGxpZ2h0bWFwXG4gICAgICAgICAgICBpZiAob3B0aW9ucy5saXRPcHRpb25zLmxpZ2h0TWFwRW5hYmxlZCB8fCBvcHRpb25zLmxpZ2h0TWFwVmVydGV4Q29sb3JzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbGlnaHRtYXBEaXIgPSAob3B0aW9ucy5saXRPcHRpb25zLmRpckxpZ2h0TWFwRW5hYmxlZCAmJiBvcHRpb25zLmxpdE9wdGlvbnMudXNlU3BlY3VsYXIpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0bWFwQ2h1bmtQcm9wTmFtZSA9IGxpZ2h0bWFwRGlyID8gJ2xpZ2h0bWFwRGlyUFMnIDogJ2xpZ2h0bWFwU2luZ2xlUFMnO1xuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwidmVjMyBkTGlnaHRtYXA7XCIpO1xuICAgICAgICAgICAgICAgIGlmIChsaWdodG1hcERpcikge1xuICAgICAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcInZlYzMgZExpZ2h0bWFwRGlyO1wiKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwibGlnaHRcIiwgbGlnaHRtYXBDaHVua1Byb3BOYW1lLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZywgb3B0aW9ucy5saWdodE1hcEVuY29kaW5nKSk7XG4gICAgICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRMaWdodE1hcCgpO1wiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gb25seSBhZGQgdGhlIGxlZ2FjeSBjaHVuayBpZiBpdCdzIHJlZmVyZW5jZWRcbiAgICAgICAgICAgIGlmIChjb2RlLmNvZGUuaW5kZXhPZigndGV4dHVyZTJEU1JHQicpICE9PSAtMSB8fFxuICAgICAgICAgICAgICAgIGNvZGUuY29kZS5pbmRleE9mKCd0ZXh0dXJlMkRSR0JNJykgIT09IC0xIHx8XG4gICAgICAgICAgICAgICAgY29kZS5jb2RlLmluZGV4T2YoJ3RleHR1cmUyRFJHQkUnKSAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdTaGFkZXIgY2h1bmsgbWFjcm8gJHRleHR1cmUyRFNBTVBMRShYWFgpIGlzIGRlcHJlY2F0ZWQuIFBsZWFzZSB1c2UgJERFQ09ERSh0ZXh0dXJlMkQoWFhYKSkgaW5zdGVhZC4nKTtcbiAgICAgICAgICAgICAgICBjb2RlLnByZXBlbmQobGl0U2hhZGVyLmNodW5rcy50ZXh0dXJlU2FtcGxlUFMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBhbGwgb3RoZXIgcGFzc2VzIHJlcXVpcmUgb25seSBvcGFjaXR5XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5saXRPcHRpb25zLmFscGhhVGVzdCkge1xuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwiZmxvYXQgZEFscGhhO1wiKTtcbiAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJvcGFjaXR5XCIsIFwib3BhY2l0eVBTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nKSk7XG4gICAgICAgICAgICAgICAgY29kZS5hcHBlbmQobGl0U2hhZGVyLmNodW5rcy5hbHBoYVRlc3RQUyk7XG4gICAgICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRPcGFjaXR5KCk7XCIpO1xuICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiYWxwaGFUZXN0KGRBbHBoYSk7XCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChjb25zdCB0ZXh0dXJlIGluIHRleHR1cmVNYXBwaW5nKSB7XG4gICAgICAgICAgICBkZWNsLmFwcGVuZChgdW5pZm9ybSBzYW1wbGVyMkQgJHt0ZXh0dXJlTWFwcGluZ1t0ZXh0dXJlXX07YCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBkZWNsLmFwcGVuZCgnLy8tLS0tLS0tLSBmcm9udGVuZCBkZWNsIGJlZ2luJywgZGVjbC5jb2RlLCAnLy8tLS0tLS0tLSBmcm9udGVuZCBkZWNsIGVuZCcpO1xuICAgICAgICAvLyBjb2RlLmFwcGVuZCgnLy8tLS0tLS0tLSBmcm9udGVuZCBjb2RlIGJlZ2luJywgY29kZS5jb2RlLCAnLy8tLS0tLS0tLSBmcm9udGVuZCBjb2RlIGVuZCcpO1xuICAgICAgICAvLyBmdW5jLmFwcGVuZCgnLy8tLS0tLS0tLSBmcm9udGVuZCBmdW5jIGJlZ2luXFxuJHtmdW5jfS8vLS0tLS0tLS0gZnJvbnRlbmQgZnVuYyBlbmRcXG5gO1xuXG4gICAgICAgIC8vIGZvcm1hdCBmdW5jXG4gICAgICAgIGZ1bmMuY29kZSA9IGBcXG4ke2Z1bmMuY29kZS5zcGxpdCgnXFxuJykubWFwKGwgPT4gYCAgICAke2x9YCkuam9pbignXFxuJyl9XFxuXFxuYDtcblxuICAgICAgICBsaXRTaGFkZXIuZ2VuZXJhdGVGcmFnbWVudFNoYWRlcihkZWNsLmNvZGUsIGNvZGUuY29kZSwgZnVuYy5jb2RlLCBsaWdodGluZ1V2KTtcblxuICAgICAgICByZXR1cm4gbGl0U2hhZGVyLmdldERlZmluaXRpb24oKTtcbiAgICB9XG59O1xuXG5leHBvcnQgeyBfbWF0VGV4MkQsIHN0YW5kYXJkIH07XG4iXSwibmFtZXMiOlsiX21hdFRleDJEIiwic3RhbmRhcmQiLCJvcHRpb25zQ29udGV4dCIsIlN0YW5kYXJkTWF0ZXJpYWxPcHRpb25zIiwib3B0aW9uc0NvbnRleHRNaW4iLCJnZW5lcmF0ZUtleSIsIm9wdGlvbnMiLCJidWlsZFByb3BlcnRpZXNMaXN0IiwicHJvcHMiLCJwcm9wIiwiaGFzT3duUHJvcGVydHkiLCJwdXNoIiwic29ydCIsInByb3BzTWluIiwia2V5IiwiaSIsImxlbmd0aCIsImNodW5rcyIsInAiLCJsaXRPcHRpb25zIiwibSIsImxpZ2h0cyIsImlzQ2x1c3RlcmVkIiwiY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkIiwibGlnaHQiLCJfdHlwZSIsIkxJR0hUVFlQRV9ESVJFQ1RJT05BTCIsImhhc2hDb2RlIiwiX2dldFV2U291cmNlRXhwcmVzc2lvbiIsInRyYW5zZm9ybVByb3BOYW1lIiwidVZQcm9wTmFtZSIsInRyYW5zZm9ybUlkIiwidXZDaGFubmVsIiwiaXNNYWluUGFzcyIsIlNoYWRlclBhc3MiLCJpc0ZvcndhcmQiLCJwYXNzIiwiZXhwcmVzc2lvbiIsIm5pbmVTbGljZWRNb2RlIiwiU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VEIiwiU1BSSVRFX1JFTkRFUk1PREVfVElMRUQiLCJoZWlnaHRNYXAiLCJfYWRkTWFwRGVmIiwibmFtZSIsImVuYWJsZWQiLCJfYWRkTWFwRGVmcyIsImZsb2F0IiwiY29sb3IiLCJ2ZXJ0ZXgiLCJtYXAiLCJfYWRkTWFwIiwicHJvcE5hbWUiLCJjaHVua05hbWUiLCJtYXBwaW5nIiwiZW5jb2RpbmciLCJtYXBQcm9wTmFtZSIsImlkZW50aWZpZXJQcm9wTmFtZSIsImNoYW5uZWxQcm9wTmFtZSIsInZlcnRleENvbG9yQ2hhbm5lbFByb3BOYW1lIiwidGludFByb3BOYW1lIiwidmVydGV4Q29sb3JQcm9wTmFtZSIsImRldGFpbE1vZGVQcm9wTmFtZSIsInRpbnRPcHRpb24iLCJ2ZXJ0ZXhDb2xvck9wdGlvbiIsInRleHR1cmVPcHRpb24iLCJ0ZXh0dXJlSWRlbnRpZmllciIsImRldGFpbE1vZGVPcHRpb24iLCJzdWJDb2RlIiwidXYiLCJyZXBsYWNlIiwic2VhcmNoIiwic2FtcGxlck5hbWUiLCJhbGlhcyIsIkNodW5rVXRpbHMiLCJkZWNvZGVGdW5jIiwiZ2FtbWEiLCJpbmRleE9mIiwiZGVjb2RlVGFibGUiLCJsaW5lYXIiLCJzcmdiIiwicmdibSIsInJnYmUiLCJpc0Zsb2F0VGludCIsImlzVmVjVGludCIsIl9jb3JyZWN0Q2hhbm5lbCIsImNoYW4iLCJzdWJzdHJpbmciLCJzdHIiLCJjaHIiLCJjaGFyQXQiLCJhZGRMZW4iLCJjcmVhdGVTaGFkZXJEZWZpbml0aW9uIiwiZGV2aWNlIiwibGl0U2hhZGVyIiwiTGl0U2hhZGVyIiwidXNlVXYiLCJ1c2VVbm1vZGlmaWVkVXYiLCJtYXBUcmFuc2Zvcm1zIiwibWF4VXZTZXRzIiwidGV4dHVyZU1hcHBpbmciLCJtbmFtZSIsImNuYW1lIiwidG5hbWUiLCJ1bmFtZSIsIk1hdGgiLCJtaW4iLCJ1dlNldCIsImlkIiwiZm9yY2VVdjEiLCJ1bmRlZmluZWQiLCJnZW5lcmF0ZVZlcnRleFNoYWRlciIsInNoYWRpbmdNb2RlbCIsIlNQRUNVTEFSX1BIT05HIiwiZnJlc25lbE1vZGVsIiwiYW1iaWVudFNIIiwiRlJFU05FTF9TQ0hMSUNLIiwiZGVjbCIsIkNodW5rQnVpbGRlciIsImNvZGUiLCJmdW5jIiwibGlnaHRpbmdVdiIsImFwcGVuZCIsImJsZW5kVHlwZSIsIkJMRU5EX05PTkUiLCJhbHBoYVRlc3QiLCJhbHBoYVRvQ292ZXJhZ2UiLCJhbHBoYVRlc3RQUyIsIm5lZWRzTm9ybWFsIiwibm9ybWFsTWFwIiwiY2xlYXJDb2F0Tm9ybWFsTWFwIiwicGFja2VkTm9ybWFsIiwibm9ybWFsWFlQUyIsIm5vcm1hbFhZWlBTIiwiaGFzVGFuZ2VudHMiLCJiYXNlTmFtZSIsIm5lZWRzU2NlbmVDb2xvciIsIm5lZWRzU2NyZWVuU2l6ZSIsIm5lZWRzVHJhbnNmb3JtcyIsImRpZmZ1c2VEZXRhaWwiLCJkaWZmdXNlRGV0YWlsRW5jb2RpbmciLCJkaWZmdXNlRW5jb2RpbmciLCJ1c2VSZWZyYWN0aW9uIiwidXNlSXJpZGVzY2VuY2UiLCJsaWdodGluZyIsInVzZVNwZWN1bGFyIiwicmVmbGVjdGlvbnMiLCJ1c2VTaGVlbiIsInNoZWVuRW5jb2RpbmciLCJ1c2VNZXRhbG5lc3MiLCJ1c2VTcGVjdWxhcml0eUZhY3RvciIsInVzZVNwZWN1bGFyQ29sb3IiLCJzcGVjdWxhckVuY29kaW5nIiwiYW9NYXAiLCJhb1ZlcnRleENvbG9yIiwiZW1pc3NpdmVFbmNvZGluZyIsInVzZUNsZWFyQ29hdCIsImxpZ2h0TWFwRW5hYmxlZCIsImxpZ2h0TWFwVmVydGV4Q29sb3JzIiwibGlnaHRtYXBEaXIiLCJkaXJMaWdodE1hcEVuYWJsZWQiLCJsaWdodG1hcENodW5rUHJvcE5hbWUiLCJsaWdodE1hcEVuY29kaW5nIiwiRGVidWciLCJkZXByZWNhdGVkIiwicHJlcGVuZCIsInRleHR1cmVTYW1wbGVQUyIsInRleHR1cmUiLCJzcGxpdCIsImwiLCJqb2luIiwiZ2VuZXJhdGVGcmFnbWVudFNoYWRlciIsImdldERlZmluaXRpb24iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7O0FBY01BLE1BQUFBLFNBQVMsR0FBRyxHQUFFO0FBRXBCLE1BQU1DLFFBQVEsR0FBRztFQUViQyxjQUFjLEVBQUUsSUFBSUMsdUJBQXVCLEVBQUU7RUFDN0NDLGlCQUFpQixFQUFFLElBQUlELHVCQUF1QixFQUFFO0VBR2hERSxXQUFXLEVBQUUsVUFBVUMsT0FBTyxFQUFFO0FBQzVCLElBQUEsTUFBTUMsbUJBQW1CLEdBQUcsU0FBdEJBLG1CQUFtQixDQUFhRCxPQUFPLEVBQUU7TUFDM0MsTUFBTUUsS0FBSyxHQUFHLEVB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
