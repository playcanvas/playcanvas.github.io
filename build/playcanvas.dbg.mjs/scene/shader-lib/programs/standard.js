/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { hashCode } from '../../../core/hash.js';
import { Debug } from '../../../core/debug.js';
import { LIGHTTYPE_DIRECTIONAL, SPRITE_RENDERMODE_SLICED, SPRITE_RENDERMODE_TILED, SPECULAR_PHONG, FRESNEL_SCHLICK, BLEND_NONE } from '../../constants.js';
import { ShaderPass } from '../../shader-pass.js';
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhbmRhcmQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL3Byb2dyYW1zL3N0YW5kYXJkLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGhhc2hDb2RlIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9oYXNoLmpzJztcbmltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbmltcG9ydCB7XG4gICAgQkxFTkRfTk9ORSwgRlJFU05FTF9TQ0hMSUNLLCBMSUdIVFRZUEVfRElSRUNUSU9OQUwsXG4gICAgU1BFQ1VMQVJfUEhPTkcsXG4gICAgU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VELCBTUFJJVEVfUkVOREVSTU9ERV9USUxFRFxufSBmcm9tICcuLi8uLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgU2hhZGVyUGFzcyB9IGZyb20gJy4uLy4uL3NoYWRlci1wYXNzLmpzJztcbmltcG9ydCB7IExpdFNoYWRlciB9IGZyb20gJy4vbGl0LXNoYWRlci5qcyc7XG5pbXBvcnQgeyBDaHVua0J1aWxkZXIgfSBmcm9tICcuLi9jaHVuay1idWlsZGVyLmpzJztcbmltcG9ydCB7IENodW5rVXRpbHMgfSBmcm9tICcuLi9jaHVuay11dGlscy5qcyc7XG5cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi8uLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9ncmFwaGljcy1kZXZpY2UuanMnKS5HcmFwaGljc0RldmljZX0gR3JhcGhpY3NEZXZpY2UgKi9cblxuY29uc3QgX21hdFRleDJEID0gW107XG5cbmNvbnN0IHN0YW5kYXJkID0ge1xuICAgIC8vIFNoYXJlZCBTdGFuZGFyZCBNYXRlcmlhbCBvcHRpb24gc3RydWN0dXJlc1xuICAgIG9wdGlvbnNDb250ZXh0OiB7fSxcbiAgICBvcHRpb25zQ29udGV4dE1pbjoge30sXG5cbiAgICAvKiogQHR5cGUgeyBGdW5jdGlvbiB9ICovXG4gICAgZ2VuZXJhdGVLZXk6IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IGJ1aWxkUHJvcGVydGllc0xpc3QgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICAgICAgY29uc3QgcHJvcHMgPSBbXTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgcHJvcCBpbiBvcHRpb25zKSB7XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMuaGFzT3duUHJvcGVydHkocHJvcCkgJiYgcHJvcCAhPT0gXCJjaHVua3NcIiAmJiBwcm9wICE9PSBcImxpZ2h0c1wiKVxuICAgICAgICAgICAgICAgICAgICBwcm9wcy5wdXNoKHByb3ApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHByb3BzLnNvcnQoKTtcbiAgICAgICAgfTtcbiAgICAgICAgbGV0IHByb3BzO1xuICAgICAgICBpZiAob3B0aW9ucyA9PT0gdGhpcy5vcHRpb25zQ29udGV4dE1pbikge1xuICAgICAgICAgICAgaWYgKCF0aGlzLnByb3BzTWluKSB0aGlzLnByb3BzTWluID0gYnVpbGRQcm9wZXJ0aWVzTGlzdChvcHRpb25zKTtcbiAgICAgICAgICAgIHByb3BzID0gdGhpcy5wcm9wc01pbjtcbiAgICAgICAgfSBlbHNlIGlmIChvcHRpb25zID09PSB0aGlzLm9wdGlvbnNDb250ZXh0KSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMucHJvcHMpIHRoaXMucHJvcHMgPSBidWlsZFByb3BlcnRpZXNMaXN0KG9wdGlvbnMpO1xuICAgICAgICAgICAgcHJvcHMgPSB0aGlzLnByb3BzO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcHJvcHMgPSBidWlsZFByb3BlcnRpZXNMaXN0KG9wdGlvbnMpO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGtleSA9IFwic3RhbmRhcmRcIjtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHByb3BzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAob3B0aW9uc1twcm9wc1tpXV0pXG4gICAgICAgICAgICAgICAga2V5ICs9IHByb3BzW2ldICsgb3B0aW9uc1twcm9wc1tpXV07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy5jaHVua3MpIHtcbiAgICAgICAgICAgIGNvbnN0IGNodW5rcyA9IFtdO1xuICAgICAgICAgICAgZm9yIChjb25zdCBwIGluIG9wdGlvbnMuY2h1bmtzKSB7XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMuY2h1bmtzLmhhc093blByb3BlcnR5KHApKSB7XG4gICAgICAgICAgICAgICAgICAgIGNodW5rcy5wdXNoKHAgKyBvcHRpb25zLmNodW5rc1twXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2h1bmtzLnNvcnQoKTtcbiAgICAgICAgICAgIGtleSArPSBjaHVua3M7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy5saWdodHMpIHtcbiAgICAgICAgICAgIGNvbnN0IGlzQ2x1c3RlcmVkID0gb3B0aW9ucy5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQ7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG9wdGlvbnMubGlnaHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbGlnaHQgPSBvcHRpb25zLmxpZ2h0c1tpXTtcbiAgICAgICAgICAgICAgICBpZiAoIWlzQ2x1c3RlcmVkIHx8IGxpZ2h0Ll90eXBlID09PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwpIHtcbiAgICAgICAgICAgICAgICAgICAga2V5ICs9IGxpZ2h0LmtleTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gaGFzaENvZGUoa2V5KTtcbiAgICB9LFxuXG4gICAgLy8gZ2V0IHRoZSB2YWx1ZSB0byByZXBsYWNlICRVViB3aXRoIGluIE1hcCBTaGFkZXIgZnVuY3Rpb25zXG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIGNvZGUgd2l0aCB3aGljaCB0byB0byByZXBsYWNlICckVVYnIGluIHRoZSBtYXAgc2hhZGVyIGZ1bmN0aW9ucy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB0cmFuc2Zvcm1Qcm9wTmFtZSAtIE5hbWUgb2YgdGhlIHRyYW5zZm9ybSBpZCBpbiB0aGUgb3B0aW9ucyBibG9jay4gVXN1YWxseSBcImJhc2VuYW1lVHJhbnNmb3JtXCIuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHVWUHJvcE5hbWUgLSBOYW1lIG9mIHRoZSBVViBjaGFubmVsIGluIHRoZSBvcHRpb25zIGJsb2NrLiBVc3VhbGx5IFwiYmFzZW5hbWVVdlwiLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBvcHRpb25zIC0gVGhlIG9wdGlvbnMgcGFzc2VkIGludG8gY3JlYXRlU2hhZGVyRGVmaW5pdGlvbi5cbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfSBUaGUgY29kZSB1c2VkIHRvIHJlcGxhY2UgXCIkVVZcIiBpbiB0aGUgc2hhZGVyIGNvZGUuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZ2V0VXZTb3VyY2VFeHByZXNzaW9uOiBmdW5jdGlvbiAodHJhbnNmb3JtUHJvcE5hbWUsIHVWUHJvcE5hbWUsIG9wdGlvbnMpIHtcbiAgICAgICAgY29uc3QgdHJhbnNmb3JtSWQgPSBvcHRpb25zW3RyYW5zZm9ybVByb3BOYW1lXTtcbiAgICAgICAgY29uc3QgdXZDaGFubmVsID0gb3B0aW9uc1t1VlByb3BOYW1lXTtcbiAgICAgICAgY29uc3QgaXNNYWluUGFzcyA9IFNoYWRlclBhc3MuaXNGb3J3YXJkKG9wdGlvbnMucGFzcyk7XG5cbiAgICAgICAgbGV0IGV4cHJlc3Npb247XG4gICAgICAgIGlmIChpc01haW5QYXNzICYmIG9wdGlvbnMubmluZVNsaWNlZE1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1NMSUNFRCkge1xuICAgICAgICAgICAgZXhwcmVzc2lvbiA9IFwibmluZVNsaWNlZFV2XCI7XG4gICAgICAgIH0gZWxzZSBpZiAoaXNNYWluUGFzcyAmJiBvcHRpb25zLm5pbmVTbGljZWRNb2RlID09PSBTUFJJVEVfUkVOREVSTU9ERV9USUxFRCkge1xuICAgICAgICAgICAgZXhwcmVzc2lvbiA9IFwibmluZVNsaWNlZFV2XCI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAodHJhbnNmb3JtSWQgPT09IDApIHtcbiAgICAgICAgICAgICAgICBleHByZXNzaW9uID0gXCJ2VXZcIiArIHV2Q2hhbm5lbDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gbm90ZTogZGlmZmVyZW50IGNhcGl0YWxpemF0aW9uIVxuICAgICAgICAgICAgICAgIGV4cHJlc3Npb24gPSBcInZVVlwiICsgdXZDaGFubmVsICsgXCJfXCIgKyB0cmFuc2Zvcm1JZDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gaWYgaGVpZ2h0bWFwIGlzIGVuYWJsZWQgYWxsIG1hcHMgZXhjZXB0IHRoZSBoZWlnaHRtYXAgYXJlIG9mZnNldFxuICAgICAgICAgICAgaWYgKG9wdGlvbnMuaGVpZ2h0TWFwICYmIHRyYW5zZm9ybVByb3BOYW1lICE9PSBcImhlaWdodE1hcFRyYW5zZm9ybVwiKSB7XG4gICAgICAgICAgICAgICAgZXhwcmVzc2lvbiArPSBcIiArIGRVdk9mZnNldFwiO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGV4cHJlc3Npb247XG4gICAgfSxcblxuICAgIF9hZGRNYXBEZWY6IGZ1bmN0aW9uIChuYW1lLCBlbmFibGVkKSB7XG4gICAgICAgIHJldHVybiBlbmFibGVkID8gYCNkZWZpbmUgJHtuYW1lfVxcbmAgOiBgI3VuZGVmICR7bmFtZX1cXG5gO1xuICAgIH0sXG5cbiAgICBfYWRkTWFwRGVmczogZnVuY3Rpb24gKGZsb2F0LCBjb2xvciwgdmVydGV4LCBtYXApIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FkZE1hcERlZihcIk1BUEZMT0FUXCIsIGZsb2F0KSArXG4gICAgICAgICAgICAgICB0aGlzLl9hZGRNYXBEZWYoXCJNQVBDT0xPUlwiLCBjb2xvcikgK1xuICAgICAgICAgICAgICAgdGhpcy5fYWRkTWFwRGVmKFwiTUFQVkVSVEVYXCIsIHZlcnRleCkgK1xuICAgICAgICAgICAgICAgdGhpcy5fYWRkTWFwRGVmKFwiTUFQVEVYVFVSRVwiLCBtYXApO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBBZGQgY2h1bmsgZm9yIE1hcCBUeXBlcyAodXNlZCBmb3IgYWxsIG1hcHMgZXhjZXB0IE5vcm1hbCkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gcHJvcE5hbWUgLSBUaGUgYmFzZSBuYW1lIG9mIHRoZSBtYXA6IGRpZmZ1c2UgfCBlbWlzc2l2ZSB8IG9wYWNpdHkgfCBsaWdodCB8IGhlaWdodCB8IG1ldGFsbmVzcyB8IHNwZWN1bGFyIHwgZ2xvc3MgfCBhby5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY2h1bmtOYW1lIC0gVGhlIG5hbWUgb2YgdGhlIGNodW5rIHRvIHVzZS4gVXN1YWxseSBcImJhc2VuYW1lUFNcIi5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gb3B0aW9ucyAtIFRoZSBvcHRpb25zIHBhc3NlZCBpbnRvIHRvIGNyZWF0ZVNoYWRlckRlZmluaXRpb24uXG4gICAgICogQHBhcmFtIHtvYmplY3R9IGNodW5rcyAtIFRoZSBzZXQgb2Ygc2hhZGVyIGNodW5rcyB0byBjaG9vc2UgZnJvbS5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gbWFwcGluZyAtIFRoZSBtYXBwaW5nIGJldHdlZW4gY2h1bmsgYW5kIHNhbXBsZXJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gZW5jb2RpbmcgLSBUaGUgdGV4dHVyZSdzIGVuY29kaW5nXG4gICAgICogQHJldHVybnMge3N0cmluZ30gVGhlIHNoYWRlciBjb2RlIHRvIHN1cHBvcnQgdGhpcyBtYXAuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfYWRkTWFwOiBmdW5jdGlvbiAocHJvcE5hbWUsIGNodW5rTmFtZSwgb3B0aW9ucywgY2h1bmtzLCBtYXBwaW5nLCBlbmNvZGluZyA9IG51bGwpIHtcbiAgICAgICAgY29uc3QgbWFwUHJvcE5hbWUgPSBwcm9wTmFtZSArIFwiTWFwXCI7XG4gICAgICAgIGNvbnN0IHVWUHJvcE5hbWUgPSBtYXBQcm9wTmFtZSArIFwiVXZcIjtcbiAgICAgICAgY29uc3QgaWRlbnRpZmllclByb3BOYW1lID0gbWFwUHJvcE5hbWUgKyBcIklkZW50aWZpZXJcIjtcbiAgICAgICAgY29uc3QgdHJhbnNmb3JtUHJvcE5hbWUgPSBtYXBQcm9wTmFtZSArIFwiVHJhbnNmb3JtXCI7XG4gICAgICAgIGNvbnN0IGNoYW5uZWxQcm9wTmFtZSA9IG1hcFByb3BOYW1lICsgXCJDaGFubmVsXCI7XG4gICAgICAgIGNvbnN0IHZlcnRleENvbG9yQ2hhbm5lbFByb3BOYW1lID0gcHJvcE5hbWUgKyBcIlZlcnRleENvbG9yQ2hhbm5lbFwiO1xuICAgICAgICBjb25zdCB0aW50UHJvcE5hbWUgPSBwcm9wTmFtZSArIFwiVGludFwiO1xuICAgICAgICBjb25zdCB2ZXJ0ZXhDb2xvclByb3BOYW1lID0gcHJvcE5hbWUgKyBcIlZlcnRleENvbG9yXCI7XG4gICAgICAgIGNvbnN0IGRldGFpbE1vZGVQcm9wTmFtZSA9IHByb3BOYW1lICsgXCJNb2RlXCI7XG5cbiAgICAgICAgY29uc3QgdGludE9wdGlvbiA9IG9wdGlvbnNbdGludFByb3BOYW1lXTtcbiAgICAgICAgY29uc3QgdmVydGV4Q29sb3JPcHRpb24gPSBvcHRpb25zW3ZlcnRleENvbG9yUHJvcE5hbWVdO1xuICAgICAgICBjb25zdCB0ZXh0dXJlT3B0aW9uID0gb3B0aW9uc1ttYXBQcm9wTmFtZV07XG4gICAgICAgIGNvbnN0IHRleHR1cmVJZGVudGlmaWVyID0gb3B0aW9uc1tpZGVudGlmaWVyUHJvcE5hbWVdO1xuICAgICAgICBjb25zdCBkZXRhaWxNb2RlT3B0aW9uID0gb3B0aW9uc1tkZXRhaWxNb2RlUHJvcE5hbWVdO1xuXG4gICAgICAgIGxldCBzdWJDb2RlID0gY2h1bmtzW2NodW5rTmFtZV07XG5cbiAgICAgICAgaWYgKHRleHR1cmVPcHRpb24pIHtcbiAgICAgICAgICAgIGNvbnN0IHV2ID0gdGhpcy5fZ2V0VXZTb3VyY2VFeHByZXNzaW9uKHRyYW5zZm9ybVByb3BOYW1lLCB1VlByb3BOYW1lLCBvcHRpb25zKTtcblxuICAgICAgICAgICAgc3ViQ29kZSA9IHN1YkNvZGUucmVwbGFjZSgvXFwkVVYvZywgdXYpLnJlcGxhY2UoL1xcJENIL2csIG9wdGlvbnNbY2hhbm5lbFByb3BOYW1lXSk7XG5cbiAgICAgICAgICAgIGlmIChtYXBwaW5nICYmIHN1YkNvZGUuc2VhcmNoKC9cXCRTQU1QTEVSL2cpICE9PSAtMSkge1xuICAgICAgICAgICAgICAgIGxldCBzYW1wbGVyTmFtZSA9IFwidGV4dHVyZV9cIiArIG1hcFByb3BOYW1lO1xuICAgICAgICAgICAgICAgIGNvbnN0IGFsaWFzID0gbWFwcGluZ1t0ZXh0dXJlSWRlbnRpZmllcl07XG4gICAgICAgICAgICAgICAgaWYgKGFsaWFzKSB7XG4gICAgICAgICAgICAgICAgICAgIHNhbXBsZXJOYW1lID0gYWxpYXM7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbWFwcGluZ1t0ZXh0dXJlSWRlbnRpZmllcl0gPSBzYW1wbGVyTmFtZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgc3ViQ29kZSA9IHN1YkNvZGUucmVwbGFjZSgvXFwkU0FNUExFUi9nLCBzYW1wbGVyTmFtZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChlbmNvZGluZykge1xuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zW2NoYW5uZWxQcm9wTmFtZV0gPT09ICdhYWEnKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGNvbXBsZXRlbHkgc2tpcCBkZWNvZGluZyBpZiB0aGUgdXNlciBoYXMgc2VsZWN0ZWQgdGhlIGFscGhhIGNoYW5uZWwgKHNpbmNlIGFscGhhXG4gICAgICAgICAgICAgICAgICAgIC8vIGlzIG5ldmVyIGRlY29kZWQpLlxuICAgICAgICAgICAgICAgICAgICBzdWJDb2RlID0gc3ViQ29kZS5yZXBsYWNlKC9cXCRERUNPREUvZywgJ3Bhc3NUaHJvdWdoJyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgc3ViQ29kZSA9IHN1YkNvZGUucmVwbGFjZSgvXFwkREVDT0RFL2csIENodW5rVXRpbHMuZGVjb2RlRnVuYygoIW9wdGlvbnMuZ2FtbWEgJiYgZW5jb2RpbmcgPT09ICdzcmdiJykgPyAnbGluZWFyJyA6IGVuY29kaW5nKSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gY29udGludWUgdG8gc3VwcG9ydCAkdGV4dHVyZTJEU0FNUExFXG4gICAgICAgICAgICAgICAgaWYgKHN1YkNvZGUuaW5kZXhPZignJHRleHR1cmUyRFNBTVBMRScpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGRlY29kZVRhYmxlID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGluZWFyOiAndGV4dHVyZTJEJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNyZ2I6ICd0ZXh0dXJlMkRTUkdCJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJnYm06ICd0ZXh0dXJlMkRSR0JNJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJnYmU6ICd0ZXh0dXJlMkRSR0JFJ1xuICAgICAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgICAgIHN1YkNvZGUgPSBzdWJDb2RlLnJlcGxhY2UoL1xcJHRleHR1cmUyRFNBTVBMRS9nLCBkZWNvZGVUYWJsZVtlbmNvZGluZ10gfHwgJ3RleHR1cmUyRCcpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh2ZXJ0ZXhDb2xvck9wdGlvbikge1xuICAgICAgICAgICAgc3ViQ29kZSA9IHN1YkNvZGUucmVwbGFjZSgvXFwkVkMvZywgb3B0aW9uc1t2ZXJ0ZXhDb2xvckNoYW5uZWxQcm9wTmFtZV0pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGRldGFpbE1vZGVPcHRpb24pIHtcbiAgICAgICAgICAgIHN1YkNvZGUgPSBzdWJDb2RlLnJlcGxhY2UoL1xcJERFVEFJTE1PREUvZywgZGV0YWlsTW9kZU9wdGlvbik7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBpc0Zsb2F0VGludCA9ICEhKHRpbnRPcHRpb24gJiAxKTtcbiAgICAgICAgY29uc3QgaXNWZWNUaW50ID0gISEodGludE9wdGlvbiAmIDIpO1xuXG4gICAgICAgIHN1YkNvZGUgPSB0aGlzLl9hZGRNYXBEZWZzKGlzRmxvYXRUaW50LCBpc1ZlY1RpbnQsIHZlcnRleENvbG9yT3B0aW9uLCB0ZXh0dXJlT3B0aW9uKSArIHN1YkNvZGU7XG4gICAgICAgIHJldHVybiBzdWJDb2RlLnJlcGxhY2UoL1xcJC9nLCBcIlwiKTtcbiAgICB9LFxuXG4gICAgX2NvcnJlY3RDaGFubmVsOiBmdW5jdGlvbiAocCwgY2hhbiwgX21hdFRleDJEKSB7XG4gICAgICAgIGlmIChfbWF0VGV4MkRbcF0gPiAwKSB7XG4gICAgICAgICAgICBpZiAoX21hdFRleDJEW3BdIDwgY2hhbi5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gY2hhbi5zdWJzdHJpbmcoMCwgX21hdFRleDJEW3BdKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoX21hdFRleDJEW3BdID4gY2hhbi5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBsZXQgc3RyID0gY2hhbjtcbiAgICAgICAgICAgICAgICBjb25zdCBjaHIgPSBzdHIuY2hhckF0KHN0ci5sZW5ndGggLSAxKTtcbiAgICAgICAgICAgICAgICBjb25zdCBhZGRMZW4gPSBfbWF0VGV4MkRbcF0gLSBzdHIubGVuZ3RoO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYWRkTGVuOyBpKyspIHN0ciArPSBjaHI7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHN0cjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBjaGFuO1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIC8qKiBAdHlwZSB7IEZ1bmN0aW9uIH0gKi9cbiAgICBjcmVhdGVTaGFkZXJEZWZpbml0aW9uOiBmdW5jdGlvbiAoZGV2aWNlLCBvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IGxpdFNoYWRlciA9IG5ldyBMaXRTaGFkZXIoZGV2aWNlLCBvcHRpb25zKTtcblxuICAgICAgICAvLyBnZW5lcmF0ZSB2ZXJ0ZXggc2hhZGVyXG4gICAgICAgIGNvbnN0IHVzZVV2ID0gW107XG4gICAgICAgIGNvbnN0IHVzZVVubW9kaWZpZWRVdiA9IFtdO1xuICAgICAgICBjb25zdCBtYXBUcmFuc2Zvcm1zID0gW107XG4gICAgICAgIGNvbnN0IG1heFV2U2V0cyA9IDI7XG4gICAgICAgIGNvbnN0IHRleHR1cmVNYXBwaW5nID0ge307XG5cbiAgICAgICAgZm9yIChjb25zdCBwIGluIF9tYXRUZXgyRCkge1xuICAgICAgICAgICAgY29uc3QgbW5hbWUgPSBwICsgXCJNYXBcIjtcblxuICAgICAgICAgICAgaWYgKG9wdGlvbnNbcCArIFwiVmVydGV4Q29sb3JcIl0pIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjbmFtZSA9IHAgKyBcIlZlcnRleENvbG9yQ2hhbm5lbFwiO1xuICAgICAgICAgICAgICAgIG9wdGlvbnNbY25hbWVdID0gdGhpcy5fY29ycmVjdENoYW5uZWwocCwgb3B0aW9uc1tjbmFtZV0sIF9tYXRUZXgyRCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zW21uYW1lXSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNuYW1lID0gbW5hbWUgKyBcIkNoYW5uZWxcIjtcbiAgICAgICAgICAgICAgICBjb25zdCB0bmFtZSA9IG1uYW1lICsgXCJUcmFuc2Zvcm1cIjtcbiAgICAgICAgICAgICAgICBjb25zdCB1bmFtZSA9IG1uYW1lICsgXCJVdlwiO1xuXG4gICAgICAgICAgICAgICAgb3B0aW9uc1t1bmFtZV0gPSBNYXRoLm1pbihvcHRpb25zW3VuYW1lXSwgbWF4VXZTZXRzIC0gMSk7XG4gICAgICAgICAgICAgICAgb3B0aW9uc1tjbmFtZV0gPSB0aGlzLl9jb3JyZWN0Q2hhbm5lbChwLCBvcHRpb25zW2NuYW1lXSwgX21hdFRleDJEKTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IHV2U2V0ID0gb3B0aW9uc1t1bmFtZV07XG4gICAgICAgICAgICAgICAgdXNlVXZbdXZTZXRdID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB1c2VVbm1vZGlmaWVkVXZbdXZTZXRdID0gdXNlVW5tb2RpZmllZFV2W3V2U2V0XSB8fCAob3B0aW9uc1ttbmFtZV0gJiYgIW9wdGlvbnNbdG5hbWVdKTtcblxuICAgICAgICAgICAgICAgIC8vIGNyZWF0ZSBtYXAgdHJhbnNmb3Jtc1xuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zW3RuYW1lXSkge1xuICAgICAgICAgICAgICAgICAgICBtYXBUcmFuc2Zvcm1zLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogcCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGlkOiBvcHRpb25zW3RuYW1lXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHV2OiBvcHRpb25zW3VuYW1lXVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy5mb3JjZVV2MSkge1xuICAgICAgICAgICAgdXNlVXZbMV0gPSB0cnVlO1xuICAgICAgICAgICAgdXNlVW5tb2RpZmllZFV2WzFdID0gKHVzZVVubW9kaWZpZWRVdlsxXSAhPT0gdW5kZWZpbmVkKSA/IHVzZVVubW9kaWZpZWRVdlsxXSA6IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBsaXRTaGFkZXIuZ2VuZXJhdGVWZXJ0ZXhTaGFkZXIodXNlVXYsIHVzZVVubW9kaWZpZWRVdiwgbWFwVHJhbnNmb3Jtcyk7XG5cbiAgICAgICAgLy8gaGFuZGxlIGZyYWdtZW50IHNoYWRlclxuICAgICAgICBpZiAob3B0aW9ucy5zaGFkaW5nTW9kZWwgPT09IFNQRUNVTEFSX1BIT05HKSB7XG4gICAgICAgICAgICBvcHRpb25zLmZyZXNuZWxNb2RlbCA9IDA7XG4gICAgICAgICAgICBvcHRpb25zLmFtYmllbnRTSCA9IGZhbHNlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgb3B0aW9ucy5mcmVzbmVsTW9kZWwgPSAob3B0aW9ucy5mcmVzbmVsTW9kZWwgPT09IDApID8gRlJFU05FTF9TQ0hMSUNLIDogb3B0aW9ucy5mcmVzbmVsTW9kZWw7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBkZWNsID0gbmV3IENodW5rQnVpbGRlcigpO1xuICAgICAgICBjb25zdCBjb2RlID0gbmV3IENodW5rQnVpbGRlcigpO1xuICAgICAgICBjb25zdCBmdW5jID0gbmV3IENodW5rQnVpbGRlcigpO1xuICAgICAgICBsZXQgbGlnaHRpbmdVdiA9IFwiXCI7XG5cbiAgICAgICAgLy8gZ2xvYmFsIHRleHR1cmUgYmlhcyBmb3Igc3RhbmRhcmQgdGV4dHVyZXNcbiAgICAgICAgaWYgKG9wdGlvbnMubmluZVNsaWNlZE1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1RJTEVEKSB7XG4gICAgICAgICAgICBkZWNsLmFwcGVuZChgY29uc3QgZmxvYXQgdGV4dHVyZUJpYXMgPSAtMTAwMC4wO2ApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZGVjbC5hcHBlbmQoYHVuaWZvcm0gZmxvYXQgdGV4dHVyZUJpYXM7YCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoU2hhZGVyUGFzcy5pc0ZvcndhcmQob3B0aW9ucy5wYXNzKSkge1xuICAgICAgICAgICAgLy8gcGFyYWxsYXhcbiAgICAgICAgICAgIGlmIChvcHRpb25zLmhlaWdodE1hcCkge1xuICAgICAgICAgICAgICAgIC8vIGlmICghb3B0aW9ucy5ub3JtYWxNYXApIHtcbiAgICAgICAgICAgICAgICAvLyAgICAgY29uc3QgdHJhbnNmb3JtZWRIZWlnaHRNYXBVdiA9IHRoaXMuX2dldFV2U291cmNlRXhwcmVzc2lvbihcImhlaWdodE1hcFRyYW5zZm9ybVwiLCBcImhlaWdodE1hcFV2XCIsIG9wdGlvbnMpO1xuICAgICAgICAgICAgICAgIC8vICAgICBpZiAoIW9wdGlvbnMuaGFzVGFuZ2VudHMpIHRibiA9IHRibi5yZXBsYWNlKC9cXCRVVi9nLCB0cmFuc2Zvcm1lZEhlaWdodE1hcFV2KTtcbiAgICAgICAgICAgICAgICAvLyAgICAgY29kZSArPSB0Ym47XG4gICAgICAgICAgICAgICAgLy8gfVxuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwidmVjMiBkVXZPZmZzZXQ7XCIpO1xuICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcImhlaWdodFwiLCBcInBhcmFsbGF4UFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcpKTtcbiAgICAgICAgICAgICAgICBmdW5jLmFwcGVuZChcImdldFBhcmFsbGF4KCk7XCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBvcGFjaXR5XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5ibGVuZFR5cGUgIT09IEJMRU5EX05PTkUgfHwgb3B0aW9ucy5hbHBoYVRlc3QgfHwgb3B0aW9ucy5hbHBoYVRvQ292ZXJhZ2UpIHtcbiAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcImZsb2F0IGRBbHBoYTtcIik7XG4gICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwib3BhY2l0eVwiLCBcIm9wYWNpdHlQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZykpO1xuICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0T3BhY2l0eSgpO1wiKTtcbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5hbHBoYVRlc3QpIHtcbiAgICAgICAgICAgICAgICAgICAgY29kZS5hcHBlbmQobGl0U2hhZGVyLmNodW5rcy5hbHBoYVRlc3RQUyk7XG4gICAgICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiYWxwaGFUZXN0KGRBbHBoYSk7XCIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJmbG9hdCBkQWxwaGEgPSAxLjA7XCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBub3JtYWxcbiAgICAgICAgICAgIGlmIChsaXRTaGFkZXIubmVlZHNOb3JtYWwpIHtcbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5ub3JtYWxNYXAgfHwgb3B0aW9ucy5jbGVhckNvYXROb3JtYWxNYXApIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gVE9ETzogbGV0IGVhY2ggbm9ybWFsbWFwIGlucHV0IChub3JtYWxNYXAsIG5vcm1hbERldGFpbE1hcCwgY2xlYXJDb2F0Tm9ybWFsTWFwKSBpbmRlcGVuZGVudGx5IGRlY2lkZSB3aGljaCB1bnBhY2tOb3JtYWwgdG8gdXNlLlxuICAgICAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZChvcHRpb25zLnBhY2tlZE5vcm1hbCA/IGxpdFNoYWRlci5jaHVua3Mubm9ybWFsWFlQUyA6IGxpdFNoYWRlci5jaHVua3Mubm9ybWFsWFlaUFMpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICghb3B0aW9ucy5oYXNUYW5nZW50cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gVE9ETzogZ2VuZXJhbGl6ZSB0byBzdXBwb3J0IGVhY2ggbm9ybWFsbWFwIGlucHV0IChub3JtYWxNYXAsIG5vcm1hbERldGFpbE1hcCwgY2xlYXJDb2F0Tm9ybWFsTWFwKSBpbmRlcGVuZGVudGx5XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBiYXNlTmFtZSA9IG9wdGlvbnMubm9ybWFsTWFwID8gXCJub3JtYWxNYXBcIiA6IFwiY2xlYXJDb2F0Tm9ybWFsTWFwXCI7XG4gICAgICAgICAgICAgICAgICAgICAgICBsaWdodGluZ1V2ID0gdGhpcy5fZ2V0VXZTb3VyY2VFeHByZXNzaW9uKGAke2Jhc2VOYW1lfVRyYW5zZm9ybWAsIGAke2Jhc2VOYW1lfVV2YCwgb3B0aW9ucyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcInZlYzMgZE5vcm1hbFc7XCIpO1xuICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcIm5vcm1hbERldGFpbFwiLCBcIm5vcm1hbERldGFpbE1hcFBTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nKSk7XG4gICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwibm9ybWFsXCIsIFwibm9ybWFsTWFwUFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcpKTtcbiAgICAgICAgICAgICAgICBmdW5jLmFwcGVuZChcImdldE5vcm1hbCgpO1wiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGxpdFNoYWRlci5uZWVkc1NjZW5lQ29sb3IpIHtcbiAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcInVuaWZvcm0gc2FtcGxlcjJEIHVTY2VuZUNvbG9yTWFwO1wiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChsaXRTaGFkZXIubmVlZHNTY3JlZW5TaXplKSB7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJ1bmlmb3JtIHZlYzQgdVNjcmVlblNpemU7XCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGxpdFNoYWRlci5uZWVkc1RyYW5zZm9ybXMpIHtcbiAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcInVuaWZvcm0gbWF0NCBtYXRyaXhfdmlld1Byb2plY3Rpb247XCIpO1xuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwidW5pZm9ybSBtYXQ0IG1hdHJpeF9tb2RlbDtcIik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGFsYmVkb1xuICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJ2ZWMzIGRBbGJlZG87XCIpO1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMuZGlmZnVzZURldGFpbCkge1xuICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcImRpZmZ1c2VEZXRhaWxcIiwgXCJkaWZmdXNlRGV0YWlsTWFwUFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcsIG9wdGlvbnMuZGlmZnVzZURldGFpbEVuY29kaW5nKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJkaWZmdXNlXCIsIFwiZGlmZnVzZVBTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nLCBvcHRpb25zLmRpZmZ1c2VFbmNvZGluZykpO1xuICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRBbGJlZG8oKTtcIik7XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zLnJlZnJhY3Rpb24pIHtcbiAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcImZsb2F0IGRUcmFuc21pc3Npb247XCIpO1xuICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcInJlZnJhY3Rpb25cIiwgXCJ0cmFuc21pc3Npb25QU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZykpO1xuICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0UmVmcmFjdGlvbigpO1wiKTtcblxuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwiZmxvYXQgZFRoaWNrbmVzcztcIik7XG4gICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwidGhpY2tuZXNzXCIsIFwidGhpY2tuZXNzUFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcpKTtcbiAgICAgICAgICAgICAgICBmdW5jLmFwcGVuZChcImdldFRoaWNrbmVzcygpO1wiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG9wdGlvbnMuaXJpZGVzY2VuY2UpIHtcbiAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcInZlYzMgZElyaWRlc2NlbmNlRnJlc25lbDtcIik7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJmbG9hdCBkSXJpZGVzY2VuY2U7XCIpO1xuICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcImlyaWRlc2NlbmNlXCIsIFwiaXJpZGVzY2VuY2VQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZykpO1xuICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0SXJpZGVzY2VuY2UoKTtcIik7XG5cbiAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcImZsb2F0IGRJcmlkZXNjZW5jZVRoaWNrbmVzcztcIik7XG4gICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwiaXJpZGVzY2VuY2VUaGlja25lc3NcIiwgXCJpcmlkZXNjZW5jZVRoaWNrbmVzc1BTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nKSk7XG4gICAgICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRJcmlkZXNjZW5jZVRoaWNrbmVzcygpO1wiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gc3BlY3VsYXJpdHkgJiBnbG9zc2luZXNzXG4gICAgICAgICAgICBpZiAoKGxpdFNoYWRlci5saWdodGluZyAmJiBvcHRpb25zLnVzZVNwZWN1bGFyKSB8fCBsaXRTaGFkZXIucmVmbGVjdGlvbnMpIHtcbiAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcInZlYzMgZFNwZWN1bGFyaXR5O1wiKTtcbiAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcImZsb2F0IGRHbG9zc2luZXNzO1wiKTtcbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5zaGVlbikge1xuICAgICAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcInZlYzMgc1NwZWN1bGFyaXR5O1wiKTtcbiAgICAgICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwic2hlZW5cIiwgXCJzaGVlblBTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nLCBvcHRpb25zLnNoZWVuRW5jb2RpbmcpKTtcbiAgICAgICAgICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRTaGVlbigpO1wiKTtcblxuICAgICAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcImZsb2F0IHNHbG9zc2luZXNzO1wiKTtcbiAgICAgICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwic2hlZW5HbG9zc2luZXNzXCIsIFwic2hlZW5HbG9zc1BTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nKSk7XG4gICAgICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0U2hlZW5HbG9zc2luZXNzKCk7XCIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy51c2VNZXRhbG5lc3MpIHtcbiAgICAgICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJmbG9hdCBkTWV0YWxuZXNzO1wiKTtcbiAgICAgICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwibWV0YWxuZXNzXCIsIFwibWV0YWxuZXNzUFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcpKTtcbiAgICAgICAgICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRNZXRhbG5lc3MoKTtcIik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLnVzZVNwZWN1bGFyaXR5RmFjdG9yKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwiZmxvYXQgZFNwZWN1bGFyaXR5RmFjdG9yO1wiKTtcbiAgICAgICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwic3BlY3VsYXJpdHlGYWN0b3JcIiwgXCJzcGVjdWxhcml0eUZhY3RvclBTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nKSk7XG4gICAgICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0U3BlY3VsYXJpdHlGYWN0b3IoKTtcIik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLnVzZVNwZWN1bGFyQ29sb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwic3BlY3VsYXJcIiwgXCJzcGVjdWxhclBTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nLCBvcHRpb25zLnNwZWN1bGFyRW5jb2RpbmcpKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZChcInZvaWQgZ2V0U3BlY3VsYXJpdHkoKSB7IGRTcGVjdWxhcml0eSA9IHZlYzMoMSk7IH1cIik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcImdsb3NzXCIsIFwiZ2xvc3NQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZykpO1xuICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0R2xvc3NpbmVzcygpO1wiKTtcbiAgICAgICAgICAgICAgICBmdW5jLmFwcGVuZChcImdldFNwZWN1bGFyaXR5KCk7XCIpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcInZlYzMgZFNwZWN1bGFyaXR5ID0gdmVjMygwLjApO1wiKTtcbiAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcImZsb2F0IGRHbG9zc2luZXNzID0gMC4wO1wiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gYW9cbiAgICAgICAgICAgIGlmIChvcHRpb25zLmFvTWFwIHx8IG9wdGlvbnMuYW9WZXJ0ZXhDb2xvcikge1xuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwiZmxvYXQgZEFvO1wiKTtcbiAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJhb1wiLCBcImFvUFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcpKTtcbiAgICAgICAgICAgICAgICBmdW5jLmFwcGVuZChcImdldEFPKCk7XCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBlbWlzc2lvblxuICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJ2ZWMzIGRFbWlzc2lvbjtcIik7XG4gICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJlbWlzc2l2ZVwiLCBcImVtaXNzaXZlUFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcsIG9wdGlvbnMuZW1pc3NpdmVFbmNvZGluZykpO1xuICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRFbWlzc2lvbigpO1wiKTtcblxuICAgICAgICAgICAgLy8gY2xlYXJjb2F0XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5jbGVhckNvYXQgPiAwKSB7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJmbG9hdCBjY1NwZWN1bGFyaXR5O1wiKTtcbiAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcImZsb2F0IGNjR2xvc3NpbmVzcztcIik7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJ2ZWMzIGNjTm9ybWFsVztcIik7XG5cbiAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJjbGVhckNvYXRcIiwgXCJjbGVhckNvYXRQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZykpO1xuICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcImNsZWFyQ29hdEdsb3NzXCIsIFwiY2xlYXJDb2F0R2xvc3NQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZykpO1xuICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcImNsZWFyQ29hdE5vcm1hbFwiLCBcImNsZWFyQ29hdE5vcm1hbFBTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nKSk7XG5cbiAgICAgICAgICAgICAgICBmdW5jLmFwcGVuZChcImdldENsZWFyQ29hdCgpO1wiKTtcbiAgICAgICAgICAgICAgICBmdW5jLmFwcGVuZChcImdldENsZWFyQ29hdEdsb3NzaW5lc3MoKTtcIik7XG4gICAgICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRDbGVhckNvYXROb3JtYWwoKTtcIik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGxpZ2h0bWFwXG4gICAgICAgICAgICBpZiAob3B0aW9ucy5saWdodE1hcCB8fCBvcHRpb25zLmxpZ2h0VmVydGV4Q29sb3IpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBsaWdodG1hcERpciA9IChvcHRpb25zLmRpckxpZ2h0TWFwICYmIG9wdGlvbnMudXNlU3BlY3VsYXIpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0bWFwQ2h1bmtQcm9wTmFtZSA9IGxpZ2h0bWFwRGlyID8gJ2xpZ2h0bWFwRGlyUFMnIDogJ2xpZ2h0bWFwU2luZ2xlUFMnO1xuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwidmVjMyBkTGlnaHRtYXA7XCIpO1xuICAgICAgICAgICAgICAgIGlmIChsaWdodG1hcERpcikge1xuICAgICAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcInZlYzMgZExpZ2h0bWFwRGlyO1wiKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwibGlnaHRcIiwgbGlnaHRtYXBDaHVua1Byb3BOYW1lLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZywgb3B0aW9ucy5saWdodE1hcEVuY29kaW5nKSk7XG4gICAgICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRMaWdodE1hcCgpO1wiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gb25seSBhZGQgdGhlIGxlZ2FjeSBjaHVuayBpZiBpdCdzIHJlZmVyZW5jZWRcbiAgICAgICAgICAgIGlmIChjb2RlLmNvZGUuaW5kZXhPZigndGV4dHVyZTJEU1JHQicpICE9PSAtMSB8fFxuICAgICAgICAgICAgICAgIGNvZGUuY29kZS5pbmRleE9mKCd0ZXh0dXJlMkRSR0JNJykgIT09IC0xIHx8XG4gICAgICAgICAgICAgICAgY29kZS5jb2RlLmluZGV4T2YoJ3RleHR1cmUyRFJHQkUnKSAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdTaGFkZXIgY2h1bmsgbWFjcm8gJHRleHR1cmUyRFNBTVBMRShYWFgpIGlzIGRlcHJlY2F0ZWQuIFBsZWFzZSB1c2UgJERFQ09ERSh0ZXh0dXJlMkQoWFhYKSkgaW5zdGVhZC4nKTtcbiAgICAgICAgICAgICAgICBjb2RlLnByZXBlbmQobGl0U2hhZGVyLmNodW5rcy50ZXh0dXJlU2FtcGxlUFMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBhbGwgb3RoZXIgcGFzc2VzIHJlcXVpcmUgb25seSBvcGFjaXR5XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5hbHBoYVRlc3QpIHtcbiAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcImZsb2F0IGRBbHBoYTtcIik7XG4gICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwib3BhY2l0eVwiLCBcIm9wYWNpdHlQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZykpO1xuICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKGxpdFNoYWRlci5jaHVua3MuYWxwaGFUZXN0UFMpO1xuICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0T3BhY2l0eSgpO1wiKTtcbiAgICAgICAgICAgICAgICBmdW5jLmFwcGVuZChcImFscGhhVGVzdChkQWxwaGEpO1wiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAoY29uc3QgdGV4dHVyZSBpbiB0ZXh0dXJlTWFwcGluZykge1xuICAgICAgICAgICAgZGVjbC5hcHBlbmQoYHVuaWZvcm0gc2FtcGxlcjJEICR7dGV4dHVyZU1hcHBpbmdbdGV4dHVyZV19O2ApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZGVjbC5hcHBlbmQoJy8vLS0tLS0tLS0gZnJvbnRlbmQgZGVjbCBiZWdpbicsIGRlY2wuY29kZSwgJy8vLS0tLS0tLS0gZnJvbnRlbmQgZGVjbCBlbmQnKTtcbiAgICAgICAgLy8gY29kZS5hcHBlbmQoJy8vLS0tLS0tLS0gZnJvbnRlbmQgY29kZSBiZWdpbicsIGNvZGUuY29kZSwgJy8vLS0tLS0tLS0gZnJvbnRlbmQgY29kZSBlbmQnKTtcbiAgICAgICAgLy8gZnVuYy5hcHBlbmQoJy8vLS0tLS0tLS0gZnJvbnRlbmQgZnVuYyBiZWdpblxcbiR7ZnVuY30vLy0tLS0tLS0tIGZyb250ZW5kIGZ1bmMgZW5kXFxuYDtcblxuICAgICAgICAvLyBmb3JtYXQgZnVuY1xuICAgICAgICBmdW5jLmNvZGUgPSBgXFxuJHtmdW5jLmNvZGUuc3BsaXQoJ1xcbicpLm1hcChsID0+IGAgICAgJHtsfWApLmpvaW4oJ1xcbicpfVxcblxcbmA7XG5cbiAgICAgICAgbGl0U2hhZGVyLmdlbmVyYXRlRnJhZ21lbnRTaGFkZXIoZGVjbC5jb2RlLCBjb2RlLmNvZGUsIGZ1bmMuY29kZSwgbGlnaHRpbmdVdik7XG5cbiAgICAgICAgcmV0dXJuIGxpdFNoYWRlci5nZXREZWZpbml0aW9uKCk7XG4gICAgfVxufTtcblxuZXhwb3J0IHsgX21hdFRleDJELCBzdGFuZGFyZCB9O1xuIl0sIm5hbWVzIjpbIl9tYXRUZXgyRCIsInN0YW5kYXJkIiwib3B0aW9uc0NvbnRleHQiLCJvcHRpb25zQ29udGV4dE1pbiIsImdlbmVyYXRlS2V5Iiwib3B0aW9ucyIsImJ1aWxkUHJvcGVydGllc0xpc3QiLCJwcm9wcyIsInByb3AiLCJoYXNPd25Qcm9wZXJ0eSIsInB1c2giLCJzb3J0IiwicHJvcHNNaW4iLCJrZXkiLCJpIiwibGVuZ3RoIiwiY2h1bmtzIiwicCIsImxpZ2h0cyIsImlzQ2x1c3RlcmVkIiwiY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkIiwibGlnaHQiLCJfdHlwZSIsIkxJR0hUVFlQRV9ESVJFQ1RJT05BTCIsImhhc2hDb2RlIiwiX2dldFV2U291cmNlRXhwcmVzc2lvbiIsInRyYW5zZm9ybVByb3BOYW1lIiwidVZQcm9wTmFtZSIsInRyYW5zZm9ybUlkIiwidXZDaGFubmVsIiwiaXNNYWluUGFzcyIsIlNoYWRlclBhc3MiLCJpc0ZvcndhcmQiLCJwYXNzIiwiZXhwcmVzc2lvbiIsIm5pbmVTbGljZWRNb2RlIiwiU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VEIiwiU1BSSVRFX1JFTkRFUk1PREVfVElMRUQiLCJoZWlnaHRNYXAiLCJfYWRkTWFwRGVmIiwibmFtZSIsImVuYWJsZWQiLCJfYWRkTWFwRGVmcyIsImZsb2F0IiwiY29sb3IiLCJ2ZXJ0ZXgiLCJtYXAiLCJfYWRkTWFwIiwicHJvcE5hbWUiLCJjaHVua05hbWUiLCJtYXBwaW5nIiwiZW5jb2RpbmciLCJtYXBQcm9wTmFtZSIsImlkZW50aWZpZXJQcm9wTmFtZSIsImNoYW5uZWxQcm9wTmFtZSIsInZlcnRleENvbG9yQ2hhbm5lbFByb3BOYW1lIiwidGludFByb3BOYW1lIiwidmVydGV4Q29sb3JQcm9wTmFtZSIsImRldGFpbE1vZGVQcm9wTmFtZSIsInRpbnRPcHRpb24iLCJ2ZXJ0ZXhDb2xvck9wdGlvbiIsInRleHR1cmVPcHRpb24iLCJ0ZXh0dXJlSWRlbnRpZmllciIsImRldGFpbE1vZGVPcHRpb24iLCJzdWJDb2RlIiwidXYiLCJyZXBsYWNlIiwic2VhcmNoIiwic2FtcGxlck5hbWUiLCJhbGlhcyIsIkNodW5rVXRpbHMiLCJkZWNvZGVGdW5jIiwiZ2FtbWEiLCJpbmRleE9mIiwiZGVjb2RlVGFibGUiLCJsaW5lYXIiLCJzcmdiIiwicmdibSIsInJnYmUiLCJpc0Zsb2F0VGludCIsImlzVmVjVGludCIsIl9jb3JyZWN0Q2hhbm5lbCIsImNoYW4iLCJzdWJzdHJpbmciLCJzdHIiLCJjaHIiLCJjaGFyQXQiLCJhZGRMZW4iLCJjcmVhdGVTaGFkZXJEZWZpbml0aW9uIiwiZGV2aWNlIiwibGl0U2hhZGVyIiwiTGl0U2hhZGVyIiwidXNlVXYiLCJ1c2VVbm1vZGlmaWVkVXYiLCJtYXBUcmFuc2Zvcm1zIiwibWF4VXZTZXRzIiwidGV4dHVyZU1hcHBpbmciLCJtbmFtZSIsImNuYW1lIiwidG5hbWUiLCJ1bmFtZSIsIk1hdGgiLCJtaW4iLCJ1dlNldCIsImlkIiwiZm9yY2VVdjEiLCJ1bmRlZmluZWQiLCJnZW5lcmF0ZVZlcnRleFNoYWRlciIsInNoYWRpbmdNb2RlbCIsIlNQRUNVTEFSX1BIT05HIiwiZnJlc25lbE1vZGVsIiwiYW1iaWVudFNIIiwiRlJFU05FTF9TQ0hMSUNLIiwiZGVjbCIsIkNodW5rQnVpbGRlciIsImNvZGUiLCJmdW5jIiwibGlnaHRpbmdVdiIsImFwcGVuZCIsImJsZW5kVHlwZSIsIkJMRU5EX05PTkUiLCJhbHBoYVRlc3QiLCJhbHBoYVRvQ292ZXJhZ2UiLCJhbHBoYVRlc3RQUyIsIm5lZWRzTm9ybWFsIiwibm9ybWFsTWFwIiwiY2xlYXJDb2F0Tm9ybWFsTWFwIiwicGFja2VkTm9ybWFsIiwibm9ybWFsWFlQUyIsIm5vcm1hbFhZWlBTIiwiaGFzVGFuZ2VudHMiLCJiYXNlTmFtZSIsIm5lZWRzU2NlbmVDb2xvciIsIm5lZWRzU2NyZWVuU2l6ZSIsIm5lZWRzVHJhbnNmb3JtcyIsImRpZmZ1c2VEZXRhaWwiLCJkaWZmdXNlRGV0YWlsRW5jb2RpbmciLCJkaWZmdXNlRW5jb2RpbmciLCJyZWZyYWN0aW9uIiwiaXJpZGVzY2VuY2UiLCJsaWdodGluZyIsInVzZVNwZWN1bGFyIiwicmVmbGVjdGlvbnMiLCJzaGVlbiIsInNoZWVuRW5jb2RpbmciLCJ1c2VNZXRhbG5lc3MiLCJ1c2VTcGVjdWxhcml0eUZhY3RvciIsInVzZVNwZWN1bGFyQ29sb3IiLCJzcGVjdWxhckVuY29kaW5nIiwiYW9NYXAiLCJhb1ZlcnRleENvbG9yIiwiZW1pc3NpdmVFbmNvZGluZyIsImNsZWFyQ29hdCIsImxpZ2h0TWFwIiwibGlnaHRWZXJ0ZXhDb2xvciIsImxpZ2h0bWFwRGlyIiwiZGlyTGlnaHRNYXAiLCJsaWdodG1hcENodW5rUHJvcE5hbWUiLCJsaWdodE1hcEVuY29kaW5nIiwiRGVidWciLCJkZXByZWNhdGVkIiwicHJlcGVuZCIsInRleHR1cmVTYW1wbGVQUyIsInRleHR1cmUiLCJzcGxpdCIsImwiLCJqb2luIiwiZ2VuZXJhdGVGcmFnbWVudFNoYWRlciIsImdldERlZmluaXRpb24iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7QUFlTUEs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
