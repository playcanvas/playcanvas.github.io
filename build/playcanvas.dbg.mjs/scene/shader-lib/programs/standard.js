/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
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
  // Shared Standard Material option structures
  optionsContext: new StandardMaterialOptions(),
  optionsContextMin: new StandardMaterialOptions(),
  /** @type { Function } */
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
      for (const m in options.litOptions) {
        // handle lights in a custom way
        if (m === 'lights') {
          const isClustered = options.litOptions.clusteredLightingEnabled;
          for (let i = 0; i < options.litOptions.lights.length; i++) {
            const light = options.litOptions.lights[i];
            if (!isClustered || light._type === LIGHTTYPE_DIRECTIONAL) {
              key += light.key;
            }
          }
        } else {
          key += m + options.litOptions[m];
        }
      }
    }
    return hashCode(key);
  },
  // get the value to replace $UV with in Map Shader functions

  /**
   * Get the code with which to to replace '$UV' in the map shader functions.
   *
   * @param {string} transformPropName - Name of the transform id in the options block. Usually "basenameTransform".
   * @param {string} uVPropName - Name of the UV channel in the options block. Usually "basenameUv".
   * @param {object} options - The options passed into createShaderDefinition.
   * @returns {string} The code used to replace "$UV" in the shader code.
   * @private
   */
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
        // note: different capitalization!
        expression = "vUV" + uvChannel + "_" + transformId;
      }

      // if heightmap is enabled all maps except the heightmap are offset
      if (options.heightMap && transformPropName !== "heightMapTransform") {
        expression += " + dUvOffset";
      }
    }
    return expression;
  },
  _addMapDef: function (name, enabled) {
    return enabled ? `#define ${name}\n` : `#undef ${name}\n`;
  },
  _addMapDefs: function (float, color, vertex, map, invert) {
    return this._addMapDef("MAPFLOAT", float) + this._addMapDef("MAPCOLOR", color) + this._addMapDef("MAPVERTEX", vertex) + this._addMapDef("MAPTEXTURE", map) + this._addMapDef("MAPINVERT", invert);
  },
  /**
   * Add chunk for Map Types (used for all maps except Normal).
   *
   * @param {string} propName - The base name of the map: diffuse | emissive | opacity | light | height | metalness | specular | gloss | ao.
   * @param {string} chunkName - The name of the chunk to use. Usually "basenamePS".
   * @param {object} options - The options passed into to createShaderDefinition.
   * @param {object} chunks - The set of shader chunks to choose from.
   * @param {object} mapping - The mapping between chunk and sampler
   * @param {string} encoding - The texture's encoding
   * @returns {string} The shader code to support this map.
   * @private
   */
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
    const invertName = propName + "Invert";
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
          // completely skip decoding if the user has selected the alpha channel (since alpha
          // is never decoded).
          subCode = subCode.replace(/\$DECODE/g, 'passThrough');
        } else {
          subCode = subCode.replace(/\$DECODE/g, ChunkUtils.decodeFunc(!options.litOptions.gamma && encoding === 'srgb' ? 'linear' : encoding));
        }

        // continue to support $texture2DSAMPLE
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
    const invertOption = !!options[invertName];
    subCode = this._addMapDefs(isFloatTint, isVecTint, vertexColorOption, textureOption, invertOption) + subCode;
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
  /** @type { Function } */
  createShaderDefinition: function (device, options) {
    const litShader = new LitShader(device, options.litOptions);

    // generate vertex shader
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

        // create map transforms
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

    // handle fragment shader
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

    // global texture bias for standard textures
    if (options.litOptions.nineSlicedMode === SPRITE_RENDERMODE_TILED) {
      decl.append(`const float textureBias = -1000.0;`);
    } else {
      decl.append(`uniform float textureBias;`);
    }
    if (ShaderPass.isForward(options.pass)) {
      // parallax
      if (options.heightMap) {
        // if (!options.normalMap) {
        //     const transformedHeightMapUv = this._getUvSourceExpression("heightMapTransform", "heightMapUv", options);
        //     if (!options.hasTangents) tbn = tbn.replace(/\$UV/g, transformedHeightMapUv);
        //     code += tbn;
        // }
        decl.append("vec2 dUvOffset;");
        code.append(this._addMap("height", "parallaxPS", options, litShader.chunks, textureMapping));
        func.append("getParallax();");
      }

      // opacity
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

      // normal
      if (litShader.needsNormal) {
        if (options.normalMap || options.clearCoatNormalMap) {
          // TODO: let each normalmap input (normalMap, normalDetailMap, clearCoatNormalMap) independently decide which unpackNormal to use.
          code.append(options.packedNormal ? litShader.chunks.normalXYPS : litShader.chunks.normalXYZPS);
          if (!options.litOptions.hasTangents) {
            // TODO: generalize to support each normalmap input (normalMap, normalDetailMap, clearCoatNormalMap) independently
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

      // albedo
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

      // specularity & glossiness
      if (litShader.lighting && options.litOptions.useSpecular || litShader.reflections) {
        decl.append("vec3 dSpecularity;");
        decl.append("float dGlossiness;");
        if (options.litOptions.useSheen) {
          decl.append("vec3 sSpecularity;");
          code.append(this._addMap("sheen", "sheenPS", options, litShader.chunks, textureMapping, options.sheenEncoding));
          func.append("getSheen();");
          decl.append("float sGlossiness;");
          code.append(this._addMap("sheenGloss", "sheenGlossPS", options, litShader.chunks, textureMapping));
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

      // ao
      if (options.aoMap || options.aoVertexColor) {
        decl.append("float dAo;");
        code.append(this._addMap("ao", "aoPS", options, litShader.chunks, textureMapping));
        func.append("getAO();");
      }

      // emission
      decl.append("vec3 dEmission;");
      code.append(this._addMap("emissive", "emissivePS", options, litShader.chunks, textureMapping, options.emissiveEncoding));
      func.append("getEmission();");

      // clearcoat
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

      // lightmap
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

      // only add the legacy chunk if it's referenced
      if (code.code.indexOf('texture2DSRGB') !== -1 || code.code.indexOf('texture2DRGBM') !== -1 || code.code.indexOf('texture2DRGBE') !== -1) {
        Debug.deprecated('Shader chunk macro $texture2DSAMPLE(XXX) is deprecated. Please use $DECODE(texture2D(XXX)) instead.');
        code.prepend(litShader.chunks.textureSamplePS);
      }
    } else {
      // all other passes require only opacity
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

    // decl.append('//-------- frontend decl begin', decl.code, '//-------- frontend decl end');
    // code.append('//-------- frontend code begin', code.code, '//-------- frontend code end');
    // func.append('//-------- frontend func begin\n${func}//-------- frontend func end\n`;

    // format func
    func.code = `\n${func.code.split('\n').map(l => `    ${l}`).join('\n')}\n\n`;
    litShader.generateFragmentShader(decl.code, code.code, func.code, lightingUv);
    return litShader.getDefinition();
  }
};

export { _matTex2D, standard };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhbmRhcmQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL3Byb2dyYW1zL3N0YW5kYXJkLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGhhc2hDb2RlIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9oYXNoLmpzJztcbmltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbmltcG9ydCB7XG4gICAgQkxFTkRfTk9ORSwgRlJFU05FTF9TQ0hMSUNLLCBMSUdIVFRZUEVfRElSRUNUSU9OQUwsXG4gICAgU1BFQ1VMQVJfUEhPTkcsXG4gICAgU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VELCBTUFJJVEVfUkVOREVSTU9ERV9USUxFRFxufSBmcm9tICcuLi8uLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgU2hhZGVyUGFzcyB9IGZyb20gJy4uLy4uL3NoYWRlci1wYXNzLmpzJztcbmltcG9ydCB7IExpdFNoYWRlciB9IGZyb20gJy4vbGl0LXNoYWRlci5qcyc7XG5pbXBvcnQgeyBDaHVua0J1aWxkZXIgfSBmcm9tICcuLi9jaHVuay1idWlsZGVyLmpzJztcbmltcG9ydCB7IENodW5rVXRpbHMgfSBmcm9tICcuLi9jaHVuay11dGlscy5qcyc7XG5pbXBvcnQgeyBTdGFuZGFyZE1hdGVyaWFsT3B0aW9ucyB9IGZyb20gJy4uLy4uL21hdGVyaWFscy9zdGFuZGFyZC1tYXRlcmlhbC1vcHRpb25zLmpzJztcblxuY29uc3QgX21hdFRleDJEID0gW107XG5cbmNvbnN0IHN0YW5kYXJkID0ge1xuICAgIC8vIFNoYXJlZCBTdGFuZGFyZCBNYXRlcmlhbCBvcHRpb24gc3RydWN0dXJlc1xuICAgIG9wdGlvbnNDb250ZXh0OiBuZXcgU3RhbmRhcmRNYXRlcmlhbE9wdGlvbnMoKSxcbiAgICBvcHRpb25zQ29udGV4dE1pbjogbmV3IFN0YW5kYXJkTWF0ZXJpYWxPcHRpb25zKCksXG5cbiAgICAvKiogQHR5cGUgeyBGdW5jdGlvbiB9ICovXG4gICAgZ2VuZXJhdGVLZXk6IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IGJ1aWxkUHJvcGVydGllc0xpc3QgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICAgICAgY29uc3QgcHJvcHMgPSBbXTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgcHJvcCBpbiBvcHRpb25zKSB7XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMuaGFzT3duUHJvcGVydHkocHJvcCkgJiYgcHJvcCAhPT0gXCJjaHVua3NcIiAmJiBwcm9wICE9PSBcImxpZ2h0c1wiKVxuICAgICAgICAgICAgICAgICAgICBwcm9wcy5wdXNoKHByb3ApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHByb3BzLnNvcnQoKTtcbiAgICAgICAgfTtcbiAgICAgICAgbGV0IHByb3BzO1xuICAgICAgICBpZiAob3B0aW9ucyA9PT0gdGhpcy5vcHRpb25zQ29udGV4dE1pbikge1xuICAgICAgICAgICAgaWYgKCF0aGlzLnByb3BzTWluKSB0aGlzLnByb3BzTWluID0gYnVpbGRQcm9wZXJ0aWVzTGlzdChvcHRpb25zKTtcbiAgICAgICAgICAgIHByb3BzID0gdGhpcy5wcm9wc01pbjtcbiAgICAgICAgfSBlbHNlIGlmIChvcHRpb25zID09PSB0aGlzLm9wdGlvbnNDb250ZXh0KSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMucHJvcHMpIHRoaXMucHJvcHMgPSBidWlsZFByb3BlcnRpZXNMaXN0KG9wdGlvbnMpO1xuICAgICAgICAgICAgcHJvcHMgPSB0aGlzLnByb3BzO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcHJvcHMgPSBidWlsZFByb3BlcnRpZXNMaXN0KG9wdGlvbnMpO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGtleSA9IFwic3RhbmRhcmRcIjtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHByb3BzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAob3B0aW9uc1twcm9wc1tpXV0pXG4gICAgICAgICAgICAgICAga2V5ICs9IHByb3BzW2ldICsgb3B0aW9uc1twcm9wc1tpXV07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy5jaHVua3MpIHtcbiAgICAgICAgICAgIGNvbnN0IGNodW5rcyA9IFtdO1xuICAgICAgICAgICAgZm9yIChjb25zdCBwIGluIG9wdGlvbnMuY2h1bmtzKSB7XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMuY2h1bmtzLmhhc093blByb3BlcnR5KHApKSB7XG4gICAgICAgICAgICAgICAgICAgIGNodW5rcy5wdXNoKHAgKyBvcHRpb25zLmNodW5rc1twXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2h1bmtzLnNvcnQoKTtcbiAgICAgICAgICAgIGtleSArPSBjaHVua3M7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy5saXRPcHRpb25zKSB7XG5cbiAgICAgICAgICAgIGZvciAoY29uc3QgbSBpbiBvcHRpb25zLmxpdE9wdGlvbnMpIHtcblxuICAgICAgICAgICAgICAgIC8vIGhhbmRsZSBsaWdodHMgaW4gYSBjdXN0b20gd2F5XG4gICAgICAgICAgICAgICAgaWYgKG0gPT09ICdsaWdodHMnKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGlzQ2x1c3RlcmVkID0gb3B0aW9ucy5saXRPcHRpb25zLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZDtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBvcHRpb25zLmxpdE9wdGlvbnMubGlnaHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBsaWdodCA9IG9wdGlvbnMubGl0T3B0aW9ucy5saWdodHNbaV07XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWlzQ2x1c3RlcmVkIHx8IGxpZ2h0Ll90eXBlID09PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBrZXkgKz0gbGlnaHQua2V5O1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAga2V5ICs9IG0gKyBvcHRpb25zLmxpdE9wdGlvbnNbbV07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGhhc2hDb2RlKGtleSk7XG4gICAgfSxcblxuICAgIC8vIGdldCB0aGUgdmFsdWUgdG8gcmVwbGFjZSAkVVYgd2l0aCBpbiBNYXAgU2hhZGVyIGZ1bmN0aW9uc1xuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBjb2RlIHdpdGggd2hpY2ggdG8gdG8gcmVwbGFjZSAnJFVWJyBpbiB0aGUgbWFwIHNoYWRlciBmdW5jdGlvbnMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdHJhbnNmb3JtUHJvcE5hbWUgLSBOYW1lIG9mIHRoZSB0cmFuc2Zvcm0gaWQgaW4gdGhlIG9wdGlvbnMgYmxvY2suIFVzdWFsbHkgXCJiYXNlbmFtZVRyYW5zZm9ybVwiLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB1VlByb3BOYW1lIC0gTmFtZSBvZiB0aGUgVVYgY2hhbm5lbCBpbiB0aGUgb3B0aW9ucyBibG9jay4gVXN1YWxseSBcImJhc2VuYW1lVXZcIi5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gb3B0aW9ucyAtIFRoZSBvcHRpb25zIHBhc3NlZCBpbnRvIGNyZWF0ZVNoYWRlckRlZmluaXRpb24uXG4gICAgICogQHJldHVybnMge3N0cmluZ30gVGhlIGNvZGUgdXNlZCB0byByZXBsYWNlIFwiJFVWXCIgaW4gdGhlIHNoYWRlciBjb2RlLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2dldFV2U291cmNlRXhwcmVzc2lvbjogZnVuY3Rpb24gKHRyYW5zZm9ybVByb3BOYW1lLCB1VlByb3BOYW1lLCBvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IHRyYW5zZm9ybUlkID0gb3B0aW9uc1t0cmFuc2Zvcm1Qcm9wTmFtZV07XG4gICAgICAgIGNvbnN0IHV2Q2hhbm5lbCA9IG9wdGlvbnNbdVZQcm9wTmFtZV07XG4gICAgICAgIGNvbnN0IGlzTWFpblBhc3MgPSBTaGFkZXJQYXNzLmlzRm9yd2FyZChvcHRpb25zLnBhc3MpO1xuXG4gICAgICAgIGxldCBleHByZXNzaW9uO1xuICAgICAgICBpZiAoaXNNYWluUGFzcyAmJiBvcHRpb25zLmxpdE9wdGlvbnMubmluZVNsaWNlZE1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1NMSUNFRCkge1xuICAgICAgICAgICAgZXhwcmVzc2lvbiA9IFwibmluZVNsaWNlZFV2XCI7XG4gICAgICAgIH0gZWxzZSBpZiAoaXNNYWluUGFzcyAmJiBvcHRpb25zLmxpdE9wdGlvbnMubmluZVNsaWNlZE1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1RJTEVEKSB7XG4gICAgICAgICAgICBleHByZXNzaW9uID0gXCJuaW5lU2xpY2VkVXZcIjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmICh0cmFuc2Zvcm1JZCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIGV4cHJlc3Npb24gPSBcInZVdlwiICsgdXZDaGFubmVsO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBub3RlOiBkaWZmZXJlbnQgY2FwaXRhbGl6YXRpb24hXG4gICAgICAgICAgICAgICAgZXhwcmVzc2lvbiA9IFwidlVWXCIgKyB1dkNoYW5uZWwgKyBcIl9cIiArIHRyYW5zZm9ybUlkO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBpZiBoZWlnaHRtYXAgaXMgZW5hYmxlZCBhbGwgbWFwcyBleGNlcHQgdGhlIGhlaWdodG1hcCBhcmUgb2Zmc2V0XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5oZWlnaHRNYXAgJiYgdHJhbnNmb3JtUHJvcE5hbWUgIT09IFwiaGVpZ2h0TWFwVHJhbnNmb3JtXCIpIHtcbiAgICAgICAgICAgICAgICBleHByZXNzaW9uICs9IFwiICsgZFV2T2Zmc2V0XCI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZXhwcmVzc2lvbjtcbiAgICB9LFxuXG4gICAgX2FkZE1hcERlZjogZnVuY3Rpb24gKG5hbWUsIGVuYWJsZWQpIHtcbiAgICAgICAgcmV0dXJuIGVuYWJsZWQgPyBgI2RlZmluZSAke25hbWV9XFxuYCA6IGAjdW5kZWYgJHtuYW1lfVxcbmA7XG4gICAgfSxcblxuICAgIF9hZGRNYXBEZWZzOiBmdW5jdGlvbiAoZmxvYXQsIGNvbG9yLCB2ZXJ0ZXgsIG1hcCwgaW52ZXJ0KSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hZGRNYXBEZWYoXCJNQVBGTE9BVFwiLCBmbG9hdCkgK1xuICAgICAgICAgICAgICAgdGhpcy5fYWRkTWFwRGVmKFwiTUFQQ09MT1JcIiwgY29sb3IpICtcbiAgICAgICAgICAgICAgIHRoaXMuX2FkZE1hcERlZihcIk1BUFZFUlRFWFwiLCB2ZXJ0ZXgpICtcbiAgICAgICAgICAgICAgIHRoaXMuX2FkZE1hcERlZihcIk1BUFRFWFRVUkVcIiwgbWFwKSArXG4gICAgICAgICAgICAgICB0aGlzLl9hZGRNYXBEZWYoXCJNQVBJTlZFUlRcIiwgaW52ZXJ0KTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQWRkIGNodW5rIGZvciBNYXAgVHlwZXMgKHVzZWQgZm9yIGFsbCBtYXBzIGV4Y2VwdCBOb3JtYWwpLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHByb3BOYW1lIC0gVGhlIGJhc2UgbmFtZSBvZiB0aGUgbWFwOiBkaWZmdXNlIHwgZW1pc3NpdmUgfCBvcGFjaXR5IHwgbGlnaHQgfCBoZWlnaHQgfCBtZXRhbG5lc3MgfCBzcGVjdWxhciB8IGdsb3NzIHwgYW8uXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGNodW5rTmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBjaHVuayB0byB1c2UuIFVzdWFsbHkgXCJiYXNlbmFtZVBTXCIuXG4gICAgICogQHBhcmFtIHtvYmplY3R9IG9wdGlvbnMgLSBUaGUgb3B0aW9ucyBwYXNzZWQgaW50byB0byBjcmVhdGVTaGFkZXJEZWZpbml0aW9uLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBjaHVua3MgLSBUaGUgc2V0IG9mIHNoYWRlciBjaHVua3MgdG8gY2hvb3NlIGZyb20uXG4gICAgICogQHBhcmFtIHtvYmplY3R9IG1hcHBpbmcgLSBUaGUgbWFwcGluZyBiZXR3ZWVuIGNodW5rIGFuZCBzYW1wbGVyXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGVuY29kaW5nIC0gVGhlIHRleHR1cmUncyBlbmNvZGluZ1xuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IFRoZSBzaGFkZXIgY29kZSB0byBzdXBwb3J0IHRoaXMgbWFwLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2FkZE1hcDogZnVuY3Rpb24gKHByb3BOYW1lLCBjaHVua05hbWUsIG9wdGlvbnMsIGNodW5rcywgbWFwcGluZywgZW5jb2RpbmcgPSBudWxsKSB7XG4gICAgICAgIGNvbnN0IG1hcFByb3BOYW1lID0gcHJvcE5hbWUgKyBcIk1hcFwiO1xuICAgICAgICBjb25zdCB1VlByb3BOYW1lID0gbWFwUHJvcE5hbWUgKyBcIlV2XCI7XG4gICAgICAgIGNvbnN0IGlkZW50aWZpZXJQcm9wTmFtZSA9IG1hcFByb3BOYW1lICsgXCJJZGVudGlmaWVyXCI7XG4gICAgICAgIGNvbnN0IHRyYW5zZm9ybVByb3BOYW1lID0gbWFwUHJvcE5hbWUgKyBcIlRyYW5zZm9ybVwiO1xuICAgICAgICBjb25zdCBjaGFubmVsUHJvcE5hbWUgPSBtYXBQcm9wTmFtZSArIFwiQ2hhbm5lbFwiO1xuICAgICAgICBjb25zdCB2ZXJ0ZXhDb2xvckNoYW5uZWxQcm9wTmFtZSA9IHByb3BOYW1lICsgXCJWZXJ0ZXhDb2xvckNoYW5uZWxcIjtcbiAgICAgICAgY29uc3QgdGludFByb3BOYW1lID0gcHJvcE5hbWUgKyBcIlRpbnRcIjtcbiAgICAgICAgY29uc3QgdmVydGV4Q29sb3JQcm9wTmFtZSA9IHByb3BOYW1lICsgXCJWZXJ0ZXhDb2xvclwiO1xuICAgICAgICBjb25zdCBkZXRhaWxNb2RlUHJvcE5hbWUgPSBwcm9wTmFtZSArIFwiTW9kZVwiO1xuICAgICAgICBjb25zdCBpbnZlcnROYW1lID0gcHJvcE5hbWUgKyBcIkludmVydFwiO1xuXG4gICAgICAgIGNvbnN0IHRpbnRPcHRpb24gPSBvcHRpb25zW3RpbnRQcm9wTmFtZV07XG4gICAgICAgIGNvbnN0IHZlcnRleENvbG9yT3B0aW9uID0gb3B0aW9uc1t2ZXJ0ZXhDb2xvclByb3BOYW1lXTtcbiAgICAgICAgY29uc3QgdGV4dHVyZU9wdGlvbiA9IG9wdGlvbnNbbWFwUHJvcE5hbWVdO1xuICAgICAgICBjb25zdCB0ZXh0dXJlSWRlbnRpZmllciA9IG9wdGlvbnNbaWRlbnRpZmllclByb3BOYW1lXTtcbiAgICAgICAgY29uc3QgZGV0YWlsTW9kZU9wdGlvbiA9IG9wdGlvbnNbZGV0YWlsTW9kZVByb3BOYW1lXTtcblxuICAgICAgICBsZXQgc3ViQ29kZSA9IGNodW5rc1tjaHVua05hbWVdO1xuXG4gICAgICAgIGlmICh0ZXh0dXJlT3B0aW9uKSB7XG4gICAgICAgICAgICBjb25zdCB1diA9IHRoaXMuX2dldFV2U291cmNlRXhwcmVzc2lvbih0cmFuc2Zvcm1Qcm9wTmFtZSwgdVZQcm9wTmFtZSwgb3B0aW9ucyk7XG5cbiAgICAgICAgICAgIHN1YkNvZGUgPSBzdWJDb2RlLnJlcGxhY2UoL1xcJFVWL2csIHV2KS5yZXBsYWNlKC9cXCRDSC9nLCBvcHRpb25zW2NoYW5uZWxQcm9wTmFtZV0pO1xuXG4gICAgICAgICAgICBpZiAobWFwcGluZyAmJiBzdWJDb2RlLnNlYXJjaCgvXFwkU0FNUExFUi9nKSAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICBsZXQgc2FtcGxlck5hbWUgPSBcInRleHR1cmVfXCIgKyBtYXBQcm9wTmFtZTtcbiAgICAgICAgICAgICAgICBjb25zdCBhbGlhcyA9IG1hcHBpbmdbdGV4dHVyZUlkZW50aWZpZXJdO1xuICAgICAgICAgICAgICAgIGlmIChhbGlhcykge1xuICAgICAgICAgICAgICAgICAgICBzYW1wbGVyTmFtZSA9IGFsaWFzO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIG1hcHBpbmdbdGV4dHVyZUlkZW50aWZpZXJdID0gc2FtcGxlck5hbWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHN1YkNvZGUgPSBzdWJDb2RlLnJlcGxhY2UoL1xcJFNBTVBMRVIvZywgc2FtcGxlck5hbWUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoZW5jb2RpbmcpIHtcbiAgICAgICAgICAgICAgICBpZiAob3B0aW9uc1tjaGFubmVsUHJvcE5hbWVdID09PSAnYWFhJykge1xuICAgICAgICAgICAgICAgICAgICAvLyBjb21wbGV0ZWx5IHNraXAgZGVjb2RpbmcgaWYgdGhlIHVzZXIgaGFzIHNlbGVjdGVkIHRoZSBhbHBoYSBjaGFubmVsIChzaW5jZSBhbHBoYVxuICAgICAgICAgICAgICAgICAgICAvLyBpcyBuZXZlciBkZWNvZGVkKS5cbiAgICAgICAgICAgICAgICAgICAgc3ViQ29kZSA9IHN1YkNvZGUucmVwbGFjZSgvXFwkREVDT0RFL2csICdwYXNzVGhyb3VnaCcpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHN1YkNvZGUgPSBzdWJDb2RlLnJlcGxhY2UoL1xcJERFQ09ERS9nLCBDaHVua1V0aWxzLmRlY29kZUZ1bmMoKCFvcHRpb25zLmxpdE9wdGlvbnMuZ2FtbWEgJiYgZW5jb2RpbmcgPT09ICdzcmdiJykgPyAnbGluZWFyJyA6IGVuY29kaW5nKSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gY29udGludWUgdG8gc3VwcG9ydCAkdGV4dHVyZTJEU0FNUExFXG4gICAgICAgICAgICAgICAgaWYgKHN1YkNvZGUuaW5kZXhPZignJHRleHR1cmUyRFNBTVBMRScpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGRlY29kZVRhYmxlID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGluZWFyOiAndGV4dHVyZTJEJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNyZ2I6ICd0ZXh0dXJlMkRTUkdCJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJnYm06ICd0ZXh0dXJlMkRSR0JNJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJnYmU6ICd0ZXh0dXJlMkRSR0JFJ1xuICAgICAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgICAgIHN1YkNvZGUgPSBzdWJDb2RlLnJlcGxhY2UoL1xcJHRleHR1cmUyRFNBTVBMRS9nLCBkZWNvZGVUYWJsZVtlbmNvZGluZ10gfHwgJ3RleHR1cmUyRCcpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh2ZXJ0ZXhDb2xvck9wdGlvbikge1xuICAgICAgICAgICAgc3ViQ29kZSA9IHN1YkNvZGUucmVwbGFjZSgvXFwkVkMvZywgb3B0aW9uc1t2ZXJ0ZXhDb2xvckNoYW5uZWxQcm9wTmFtZV0pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGRldGFpbE1vZGVPcHRpb24pIHtcbiAgICAgICAgICAgIHN1YkNvZGUgPSBzdWJDb2RlLnJlcGxhY2UoL1xcJERFVEFJTE1PREUvZywgZGV0YWlsTW9kZU9wdGlvbik7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBpc0Zsb2F0VGludCA9ICEhKHRpbnRPcHRpb24gJiAxKTtcbiAgICAgICAgY29uc3QgaXNWZWNUaW50ID0gISEodGludE9wdGlvbiAmIDIpO1xuICAgICAgICBjb25zdCBpbnZlcnRPcHRpb24gPSAhIShvcHRpb25zW2ludmVydE5hbWVdKTtcblxuICAgICAgICBzdWJDb2RlID0gdGhpcy5fYWRkTWFwRGVmcyhpc0Zsb2F0VGludCwgaXNWZWNUaW50LCB2ZXJ0ZXhDb2xvck9wdGlvbiwgdGV4dHVyZU9wdGlvbiwgaW52ZXJ0T3B0aW9uKSArIHN1YkNvZGU7XG4gICAgICAgIHJldHVybiBzdWJDb2RlLnJlcGxhY2UoL1xcJC9nLCBcIlwiKTtcbiAgICB9LFxuXG4gICAgX2NvcnJlY3RDaGFubmVsOiBmdW5jdGlvbiAocCwgY2hhbiwgX21hdFRleDJEKSB7XG4gICAgICAgIGlmIChfbWF0VGV4MkRbcF0gPiAwKSB7XG4gICAgICAgICAgICBpZiAoX21hdFRleDJEW3BdIDwgY2hhbi5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gY2hhbi5zdWJzdHJpbmcoMCwgX21hdFRleDJEW3BdKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoX21hdFRleDJEW3BdID4gY2hhbi5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBsZXQgc3RyID0gY2hhbjtcbiAgICAgICAgICAgICAgICBjb25zdCBjaHIgPSBzdHIuY2hhckF0KHN0ci5sZW5ndGggLSAxKTtcbiAgICAgICAgICAgICAgICBjb25zdCBhZGRMZW4gPSBfbWF0VGV4MkRbcF0gLSBzdHIubGVuZ3RoO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYWRkTGVuOyBpKyspIHN0ciArPSBjaHI7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHN0cjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBjaGFuO1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIC8qKiBAdHlwZSB7IEZ1bmN0aW9uIH0gKi9cbiAgICBjcmVhdGVTaGFkZXJEZWZpbml0aW9uOiBmdW5jdGlvbiAoZGV2aWNlLCBvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IGxpdFNoYWRlciA9IG5ldyBMaXRTaGFkZXIoZGV2aWNlLCBvcHRpb25zLmxpdE9wdGlvbnMpO1xuXG4gICAgICAgIC8vIGdlbmVyYXRlIHZlcnRleCBzaGFkZXJcbiAgICAgICAgY29uc3QgdXNlVXYgPSBbXTtcbiAgICAgICAgY29uc3QgdXNlVW5tb2RpZmllZFV2ID0gW107XG4gICAgICAgIGNvbnN0IG1hcFRyYW5zZm9ybXMgPSBbXTtcbiAgICAgICAgY29uc3QgbWF4VXZTZXRzID0gMjtcbiAgICAgICAgY29uc3QgdGV4dHVyZU1hcHBpbmcgPSB7fTtcblxuICAgICAgICBmb3IgKGNvbnN0IHAgaW4gX21hdFRleDJEKSB7XG4gICAgICAgICAgICBjb25zdCBtbmFtZSA9IHAgKyBcIk1hcFwiO1xuXG4gICAgICAgICAgICBpZiAob3B0aW9uc1twICsgXCJWZXJ0ZXhDb2xvclwiXSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNuYW1lID0gcCArIFwiVmVydGV4Q29sb3JDaGFubmVsXCI7XG4gICAgICAgICAgICAgICAgb3B0aW9uc1tjbmFtZV0gPSB0aGlzLl9jb3JyZWN0Q2hhbm5lbChwLCBvcHRpb25zW2NuYW1lXSwgX21hdFRleDJEKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG9wdGlvbnNbbW5hbWVdKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY25hbWUgPSBtbmFtZSArIFwiQ2hhbm5lbFwiO1xuICAgICAgICAgICAgICAgIGNvbnN0IHRuYW1lID0gbW5hbWUgKyBcIlRyYW5zZm9ybVwiO1xuICAgICAgICAgICAgICAgIGNvbnN0IHVuYW1lID0gbW5hbWUgKyBcIlV2XCI7XG5cbiAgICAgICAgICAgICAgICBvcHRpb25zW3VuYW1lXSA9IE1hdGgubWluKG9wdGlvbnNbdW5hbWVdLCBtYXhVdlNldHMgLSAxKTtcbiAgICAgICAgICAgICAgICBvcHRpb25zW2NuYW1lXSA9IHRoaXMuX2NvcnJlY3RDaGFubmVsKHAsIG9wdGlvbnNbY25hbWVdLCBfbWF0VGV4MkQpO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgdXZTZXQgPSBvcHRpb25zW3VuYW1lXTtcbiAgICAgICAgICAgICAgICB1c2VVdlt1dlNldF0gPSB0cnVlO1xuICAgICAgICAgICAgICAgIHVzZVVubW9kaWZpZWRVdlt1dlNldF0gPSB1c2VVbm1vZGlmaWVkVXZbdXZTZXRdIHx8IChvcHRpb25zW21uYW1lXSAmJiAhb3B0aW9uc1t0bmFtZV0pO1xuXG4gICAgICAgICAgICAgICAgLy8gY3JlYXRlIG1hcCB0cmFuc2Zvcm1zXG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnNbdG5hbWVdKSB7XG4gICAgICAgICAgICAgICAgICAgIG1hcFRyYW5zZm9ybXMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiBwLFxuICAgICAgICAgICAgICAgICAgICAgICAgaWQ6IG9wdGlvbnNbdG5hbWVdLFxuICAgICAgICAgICAgICAgICAgICAgICAgdXY6IG9wdGlvbnNbdW5hbWVdXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLmZvcmNlVXYxKSB7XG4gICAgICAgICAgICB1c2VVdlsxXSA9IHRydWU7XG4gICAgICAgICAgICB1c2VVbm1vZGlmaWVkVXZbMV0gPSAodXNlVW5tb2RpZmllZFV2WzFdICE9PSB1bmRlZmluZWQpID8gdXNlVW5tb2RpZmllZFV2WzFdIDogdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxpdFNoYWRlci5nZW5lcmF0ZVZlcnRleFNoYWRlcih1c2VVdiwgdXNlVW5tb2RpZmllZFV2LCBtYXBUcmFuc2Zvcm1zKTtcblxuICAgICAgICAvLyBoYW5kbGUgZnJhZ21lbnQgc2hhZGVyXG4gICAgICAgIGlmIChvcHRpb25zLmxpdE9wdGlvbnMuc2hhZGluZ01vZGVsID09PSBTUEVDVUxBUl9QSE9ORykge1xuICAgICAgICAgICAgb3B0aW9ucy5saXRPcHRpb25zLmZyZXNuZWxNb2RlbCA9IDA7XG4gICAgICAgICAgICBvcHRpb25zLmxpdE9wdGlvbnMuYW1iaWVudFNIID0gZmFsc2U7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBvcHRpb25zLmxpdE9wdGlvbnMuZnJlc25lbE1vZGVsID0gKG9wdGlvbnMubGl0T3B0aW9ucy5mcmVzbmVsTW9kZWwgPT09IDApID8gRlJFU05FTF9TQ0hMSUNLIDogb3B0aW9ucy5saXRPcHRpb25zLmZyZXNuZWxNb2RlbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGRlY2wgPSBuZXcgQ2h1bmtCdWlsZGVyKCk7XG4gICAgICAgIGNvbnN0IGNvZGUgPSBuZXcgQ2h1bmtCdWlsZGVyKCk7XG4gICAgICAgIGNvbnN0IGZ1bmMgPSBuZXcgQ2h1bmtCdWlsZGVyKCk7XG4gICAgICAgIGxldCBsaWdodGluZ1V2ID0gXCJcIjtcblxuICAgICAgICAvLyBnbG9iYWwgdGV4dHVyZSBiaWFzIGZvciBzdGFuZGFyZCB0ZXh0dXJlc1xuICAgICAgICBpZiAob3B0aW9ucy5saXRPcHRpb25zLm5pbmVTbGljZWRNb2RlID09PSBTUFJJVEVfUkVOREVSTU9ERV9USUxFRCkge1xuICAgICAgICAgICAgZGVjbC5hcHBlbmQoYGNvbnN0IGZsb2F0IHRleHR1cmVCaWFzID0gLTEwMDAuMDtgKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGRlY2wuYXBwZW5kKGB1bmlmb3JtIGZsb2F0IHRleHR1cmVCaWFzO2ApO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKFNoYWRlclBhc3MuaXNGb3J3YXJkKG9wdGlvbnMucGFzcykpIHtcbiAgICAgICAgICAgIC8vIHBhcmFsbGF4XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5oZWlnaHRNYXApIHtcbiAgICAgICAgICAgICAgICAvLyBpZiAoIW9wdGlvbnMubm9ybWFsTWFwKSB7XG4gICAgICAgICAgICAgICAgLy8gICAgIGNvbnN0IHRyYW5zZm9ybWVkSGVpZ2h0TWFwVXYgPSB0aGlzLl9nZXRVdlNvdXJjZUV4cHJlc3Npb24oXCJoZWlnaHRNYXBUcmFuc2Zvcm1cIiwgXCJoZWlnaHRNYXBVdlwiLCBvcHRpb25zKTtcbiAgICAgICAgICAgICAgICAvLyAgICAgaWYgKCFvcHRpb25zLmhhc1RhbmdlbnRzKSB0Ym4gPSB0Ym4ucmVwbGFjZSgvXFwkVVYvZywgdHJhbnNmb3JtZWRIZWlnaHRNYXBVdik7XG4gICAgICAgICAgICAgICAgLy8gICAgIGNvZGUgKz0gdGJuO1xuICAgICAgICAgICAgICAgIC8vIH1cbiAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcInZlYzIgZFV2T2Zmc2V0O1wiKTtcbiAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJoZWlnaHRcIiwgXCJwYXJhbGxheFBTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nKSk7XG4gICAgICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRQYXJhbGxheCgpO1wiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gb3BhY2l0eVxuICAgICAgICAgICAgaWYgKG9wdGlvbnMubGl0T3B0aW9ucy5ibGVuZFR5cGUgIT09IEJMRU5EX05PTkUgfHwgb3B0aW9ucy5saXRPcHRpb25zLmFscGhhVGVzdCB8fCBvcHRpb25zLmxpdE9wdGlvbnMuYWxwaGFUb0NvdmVyYWdlKSB7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJmbG9hdCBkQWxwaGE7XCIpO1xuICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcIm9wYWNpdHlcIiwgXCJvcGFjaXR5UFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcpKTtcbiAgICAgICAgICAgICAgICBmdW5jLmFwcGVuZChcImdldE9wYWNpdHkoKTtcIik7XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMubGl0T3B0aW9ucy5hbHBoYVRlc3QpIHtcbiAgICAgICAgICAgICAgICAgICAgY29kZS5hcHBlbmQobGl0U2hhZGVyLmNodW5rcy5hbHBoYVRlc3RQUyk7XG4gICAgICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiYWxwaGFUZXN0KGRBbHBoYSk7XCIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJmbG9hdCBkQWxwaGEgPSAxLjA7XCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBub3JtYWxcbiAgICAgICAgICAgIGlmIChsaXRTaGFkZXIubmVlZHNOb3JtYWwpIHtcbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5ub3JtYWxNYXAgfHwgb3B0aW9ucy5jbGVhckNvYXROb3JtYWxNYXApIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gVE9ETzogbGV0IGVhY2ggbm9ybWFsbWFwIGlucHV0IChub3JtYWxNYXAsIG5vcm1hbERldGFpbE1hcCwgY2xlYXJDb2F0Tm9ybWFsTWFwKSBpbmRlcGVuZGVudGx5IGRlY2lkZSB3aGljaCB1bnBhY2tOb3JtYWwgdG8gdXNlLlxuICAgICAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZChvcHRpb25zLnBhY2tlZE5vcm1hbCA/IGxpdFNoYWRlci5jaHVua3Mubm9ybWFsWFlQUyA6IGxpdFNoYWRlci5jaHVua3Mubm9ybWFsWFlaUFMpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICghb3B0aW9ucy5saXRPcHRpb25zLmhhc1RhbmdlbnRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBUT0RPOiBnZW5lcmFsaXplIHRvIHN1cHBvcnQgZWFjaCBub3JtYWxtYXAgaW5wdXQgKG5vcm1hbE1hcCwgbm9ybWFsRGV0YWlsTWFwLCBjbGVhckNvYXROb3JtYWxNYXApIGluZGVwZW5kZW50bHlcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGJhc2VOYW1lID0gb3B0aW9ucy5ub3JtYWxNYXAgPyBcIm5vcm1hbE1hcFwiIDogXCJjbGVhckNvYXROb3JtYWxNYXBcIjtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpZ2h0aW5nVXYgPSB0aGlzLl9nZXRVdlNvdXJjZUV4cHJlc3Npb24oYCR7YmFzZU5hbWV9VHJhbnNmb3JtYCwgYCR7YmFzZU5hbWV9VXZgLCBvcHRpb25zKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwidmVjMyBkTm9ybWFsVztcIik7XG4gICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwibm9ybWFsRGV0YWlsXCIsIFwibm9ybWFsRGV0YWlsTWFwUFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcpKTtcbiAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJub3JtYWxcIiwgXCJub3JtYWxNYXBQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZykpO1xuICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0Tm9ybWFsKCk7XCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAobGl0U2hhZGVyLm5lZWRzU2NlbmVDb2xvcikge1xuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwidW5pZm9ybSBzYW1wbGVyMkQgdVNjZW5lQ29sb3JNYXA7XCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGxpdFNoYWRlci5uZWVkc1NjcmVlblNpemUpIHtcbiAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcInVuaWZvcm0gdmVjNCB1U2NyZWVuU2l6ZTtcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAobGl0U2hhZGVyLm5lZWRzVHJhbnNmb3Jtcykge1xuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwidW5pZm9ybSBtYXQ0IG1hdHJpeF92aWV3UHJvamVjdGlvbjtcIik7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJ1bmlmb3JtIG1hdDQgbWF0cml4X21vZGVsO1wiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gYWxiZWRvXG4gICAgICAgICAgICBkZWNsLmFwcGVuZChcInZlYzMgZEFsYmVkbztcIik7XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5kaWZmdXNlRGV0YWlsKSB7XG4gICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwiZGlmZnVzZURldGFpbFwiLCBcImRpZmZ1c2VEZXRhaWxNYXBQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZywgb3B0aW9ucy5kaWZmdXNlRGV0YWlsRW5jb2RpbmcpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcImRpZmZ1c2VcIiwgXCJkaWZmdXNlUFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcsIG9wdGlvbnMuZGlmZnVzZUVuY29kaW5nKSk7XG4gICAgICAgICAgICBmdW5jLmFwcGVuZChcImdldEFsYmVkbygpO1wiKTtcblxuICAgICAgICAgICAgaWYgKG9wdGlvbnMubGl0T3B0aW9ucy51c2VSZWZyYWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJmbG9hdCBkVHJhbnNtaXNzaW9uO1wiKTtcbiAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJyZWZyYWN0aW9uXCIsIFwidHJhbnNtaXNzaW9uUFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcpKTtcbiAgICAgICAgICAgICAgICBmdW5jLmFwcGVuZChcImdldFJlZnJhY3Rpb24oKTtcIik7XG5cbiAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcImZsb2F0IGRUaGlja25lc3M7XCIpO1xuICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcInRoaWNrbmVzc1wiLCBcInRoaWNrbmVzc1BTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nKSk7XG4gICAgICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRUaGlja25lc3MoKTtcIik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zLmxpdE9wdGlvbnMudXNlSXJpZGVzY2VuY2UpIHtcbiAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcInZlYzMgZElyaWRlc2NlbmNlRnJlc25lbDtcIik7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJmbG9hdCBkSXJpZGVzY2VuY2U7XCIpO1xuICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcImlyaWRlc2NlbmNlXCIsIFwiaXJpZGVzY2VuY2VQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZykpO1xuICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0SXJpZGVzY2VuY2UoKTtcIik7XG5cbiAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcImZsb2F0IGRJcmlkZXNjZW5jZVRoaWNrbmVzcztcIik7XG4gICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwiaXJpZGVzY2VuY2VUaGlja25lc3NcIiwgXCJpcmlkZXNjZW5jZVRoaWNrbmVzc1BTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nKSk7XG4gICAgICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRJcmlkZXNjZW5jZVRoaWNrbmVzcygpO1wiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gc3BlY3VsYXJpdHkgJiBnbG9zc2luZXNzXG4gICAgICAgICAgICBpZiAoKGxpdFNoYWRlci5saWdodGluZyAmJiBvcHRpb25zLmxpdE9wdGlvbnMudXNlU3BlY3VsYXIpIHx8IGxpdFNoYWRlci5yZWZsZWN0aW9ucykge1xuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwidmVjMyBkU3BlY3VsYXJpdHk7XCIpO1xuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwiZmxvYXQgZEdsb3NzaW5lc3M7XCIpO1xuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLmxpdE9wdGlvbnMudXNlU2hlZW4pIHtcbiAgICAgICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJ2ZWMzIHNTcGVjdWxhcml0eTtcIik7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcInNoZWVuXCIsIFwic2hlZW5QU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZywgb3B0aW9ucy5zaGVlbkVuY29kaW5nKSk7XG4gICAgICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0U2hlZW4oKTtcIik7XG5cbiAgICAgICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJmbG9hdCBzR2xvc3NpbmVzcztcIik7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcInNoZWVuR2xvc3NcIiwgXCJzaGVlbkdsb3NzUFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcpKTtcbiAgICAgICAgICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRTaGVlbkdsb3NzaW5lc3MoKTtcIik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLmxpdE9wdGlvbnMudXNlTWV0YWxuZXNzKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwiZmxvYXQgZE1ldGFsbmVzcztcIik7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcIm1ldGFsbmVzc1wiLCBcIm1ldGFsbmVzc1BTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nKSk7XG4gICAgICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0TWV0YWxuZXNzKCk7XCIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5saXRPcHRpb25zLnVzZVNwZWN1bGFyaXR5RmFjdG9yKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwiZmxvYXQgZFNwZWN1bGFyaXR5RmFjdG9yO1wiKTtcbiAgICAgICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwic3BlY3VsYXJpdHlGYWN0b3JcIiwgXCJzcGVjdWxhcml0eUZhY3RvclBTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nKSk7XG4gICAgICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0U3BlY3VsYXJpdHlGYWN0b3IoKTtcIik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLmxpdE9wdGlvbnMudXNlU3BlY3VsYXJDb2xvcikge1xuICAgICAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJzcGVjdWxhclwiLCBcInNwZWN1bGFyUFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcsIG9wdGlvbnMuc3BlY3VsYXJFbmNvZGluZykpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKFwidm9pZCBnZXRTcGVjdWxhcml0eSgpIHsgZFNwZWN1bGFyaXR5ID0gdmVjMygxKTsgfVwiKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwiZ2xvc3NcIiwgXCJnbG9zc1BTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nKSk7XG4gICAgICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRHbG9zc2luZXNzKCk7XCIpO1xuICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0U3BlY3VsYXJpdHkoKTtcIik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwidmVjMyBkU3BlY3VsYXJpdHkgPSB2ZWMzKDAuMCk7XCIpO1xuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwiZmxvYXQgZEdsb3NzaW5lc3MgPSAwLjA7XCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBhb1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMuYW9NYXAgfHwgb3B0aW9ucy5hb1ZlcnRleENvbG9yKSB7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJmbG9hdCBkQW87XCIpO1xuICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcImFvXCIsIFwiYW9QU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZykpO1xuICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0QU8oKTtcIik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGVtaXNzaW9uXG4gICAgICAgICAgICBkZWNsLmFwcGVuZChcInZlYzMgZEVtaXNzaW9uO1wiKTtcbiAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcImVtaXNzaXZlXCIsIFwiZW1pc3NpdmVQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZywgb3B0aW9ucy5lbWlzc2l2ZUVuY29kaW5nKSk7XG4gICAgICAgICAgICBmdW5jLmFwcGVuZChcImdldEVtaXNzaW9uKCk7XCIpO1xuXG4gICAgICAgICAgICAvLyBjbGVhcmNvYXRcbiAgICAgICAgICAgIGlmIChvcHRpb25zLmxpdE9wdGlvbnMudXNlQ2xlYXJDb2F0KSB7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJmbG9hdCBjY1NwZWN1bGFyaXR5O1wiKTtcbiAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcImZsb2F0IGNjR2xvc3NpbmVzcztcIik7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJ2ZWMzIGNjTm9ybWFsVztcIik7XG5cbiAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJjbGVhckNvYXRcIiwgXCJjbGVhckNvYXRQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZykpO1xuICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcImNsZWFyQ29hdEdsb3NzXCIsIFwiY2xlYXJDb2F0R2xvc3NQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZykpO1xuICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcImNsZWFyQ29hdE5vcm1hbFwiLCBcImNsZWFyQ29hdE5vcm1hbFBTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nKSk7XG5cbiAgICAgICAgICAgICAgICBmdW5jLmFwcGVuZChcImdldENsZWFyQ29hdCgpO1wiKTtcbiAgICAgICAgICAgICAgICBmdW5jLmFwcGVuZChcImdldENsZWFyQ29hdEdsb3NzaW5lc3MoKTtcIik7XG4gICAgICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRDbGVhckNvYXROb3JtYWwoKTtcIik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGxpZ2h0bWFwXG4gICAgICAgICAgICBpZiAob3B0aW9ucy5saXRPcHRpb25zLmxpZ2h0TWFwRW5hYmxlZCB8fCBvcHRpb25zLmxpZ2h0TWFwVmVydGV4Q29sb3JzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbGlnaHRtYXBEaXIgPSAob3B0aW9ucy5saXRPcHRpb25zLmRpckxpZ2h0TWFwRW5hYmxlZCAmJiBvcHRpb25zLmxpdE9wdGlvbnMudXNlU3BlY3VsYXIpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0bWFwQ2h1bmtQcm9wTmFtZSA9IGxpZ2h0bWFwRGlyID8gJ2xpZ2h0bWFwRGlyUFMnIDogJ2xpZ2h0bWFwU2luZ2xlUFMnO1xuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwidmVjMyBkTGlnaHRtYXA7XCIpO1xuICAgICAgICAgICAgICAgIGlmIChsaWdodG1hcERpcikge1xuICAgICAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcInZlYzMgZExpZ2h0bWFwRGlyO1wiKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwibGlnaHRcIiwgbGlnaHRtYXBDaHVua1Byb3BOYW1lLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZywgb3B0aW9ucy5saWdodE1hcEVuY29kaW5nKSk7XG4gICAgICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRMaWdodE1hcCgpO1wiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gb25seSBhZGQgdGhlIGxlZ2FjeSBjaHVuayBpZiBpdCdzIHJlZmVyZW5jZWRcbiAgICAgICAgICAgIGlmIChjb2RlLmNvZGUuaW5kZXhPZigndGV4dHVyZTJEU1JHQicpICE9PSAtMSB8fFxuICAgICAgICAgICAgICAgIGNvZGUuY29kZS5pbmRleE9mKCd0ZXh0dXJlMkRSR0JNJykgIT09IC0xIHx8XG4gICAgICAgICAgICAgICAgY29kZS5jb2RlLmluZGV4T2YoJ3RleHR1cmUyRFJHQkUnKSAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdTaGFkZXIgY2h1bmsgbWFjcm8gJHRleHR1cmUyRFNBTVBMRShYWFgpIGlzIGRlcHJlY2F0ZWQuIFBsZWFzZSB1c2UgJERFQ09ERSh0ZXh0dXJlMkQoWFhYKSkgaW5zdGVhZC4nKTtcbiAgICAgICAgICAgICAgICBjb2RlLnByZXBlbmQobGl0U2hhZGVyLmNodW5rcy50ZXh0dXJlU2FtcGxlUFMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBhbGwgb3RoZXIgcGFzc2VzIHJlcXVpcmUgb25seSBvcGFjaXR5XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5saXRPcHRpb25zLmFscGhhVGVzdCkge1xuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwiZmxvYXQgZEFscGhhO1wiKTtcbiAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJvcGFjaXR5XCIsIFwib3BhY2l0eVBTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nKSk7XG4gICAgICAgICAgICAgICAgY29kZS5hcHBlbmQobGl0U2hhZGVyLmNodW5rcy5hbHBoYVRlc3RQUyk7XG4gICAgICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRPcGFjaXR5KCk7XCIpO1xuICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiYWxwaGFUZXN0KGRBbHBoYSk7XCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChjb25zdCB0ZXh0dXJlIGluIHRleHR1cmVNYXBwaW5nKSB7XG4gICAgICAgICAgICBkZWNsLmFwcGVuZChgdW5pZm9ybSBzYW1wbGVyMkQgJHt0ZXh0dXJlTWFwcGluZ1t0ZXh0dXJlXX07YCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBkZWNsLmFwcGVuZCgnLy8tLS0tLS0tLSBmcm9udGVuZCBkZWNsIGJlZ2luJywgZGVjbC5jb2RlLCAnLy8tLS0tLS0tLSBmcm9udGVuZCBkZWNsIGVuZCcpO1xuICAgICAgICAvLyBjb2RlLmFwcGVuZCgnLy8tLS0tLS0tLSBmcm9udGVuZCBjb2RlIGJlZ2luJywgY29kZS5jb2RlLCAnLy8tLS0tLS0tLSBmcm9udGVuZCBjb2RlIGVuZCcpO1xuICAgICAgICAvLyBmdW5jLmFwcGVuZCgnLy8tLS0tLS0tLSBmcm9udGVuZCBmdW5jIGJlZ2luXFxuJHtmdW5jfS8vLS0tLS0tLS0gZnJvbnRlbmQgZnVuYyBlbmRcXG5gO1xuXG4gICAgICAgIC8vIGZvcm1hdCBmdW5jXG4gICAgICAgIGZ1bmMuY29kZSA9IGBcXG4ke2Z1bmMuY29kZS5zcGxpdCgnXFxuJykubWFwKGwgPT4gYCAgICAke2x9YCkuam9pbignXFxuJyl9XFxuXFxuYDtcblxuICAgICAgICBsaXRTaGFkZXIuZ2VuZXJhdGVGcmFnbWVudFNoYWRlcihkZWNsLmNvZGUsIGNvZGUuY29kZSwgZnVuYy5jb2RlLCBsaWdodGluZ1V2KTtcblxuICAgICAgICByZXR1cm4gbGl0U2hhZGVyLmdldERlZmluaXRpb24oKTtcbiAgICB9XG59O1xuXG5leHBvcnQgeyBfbWF0VGV4MkQsIHN0YW5kYXJkIH07XG4iXSwibmFtZXMiOlsiX21hdFRleDJEIiwic3RhbmRhcmQiLCJvcHRpb25zQ29udGV4dCIsIlN0YW5kYXJkTWF0ZXJpYWxPcHRpb25zIiwib3B0aW9uc0NvbnRleHRNaW4iLCJnZW5lcmF0ZUtleSIsIm9wdGlvbnMiLCJidWlsZFByb3BlcnRpZXNMaXN0IiwicHJvcHMiLCJwcm9wIiwiaGFzT3duUHJvcGVydHkiLCJwdXNoIiwic29ydCIsInByb3BzTWluIiwia2V5IiwiaSIsImxlbmd0aCIsImNodW5rcyIsInAiLCJsaXRPcHRpb25zIiwibSIsImlzQ2x1c3RlcmVkIiwiY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkIiwibGlnaHRzIiwibGlnaHQiLCJfdHlwZSIsIkxJR0hUVFlQRV9ESVJFQ1RJT05BTCIsImhhc2hDb2RlIiwiX2dldFV2U291cmNlRXhwcmVzc2lvbiIsInRyYW5zZm9ybVByb3BOYW1lIiwidVZQcm9wTmFtZSIsInRyYW5zZm9ybUlkIiwidXZDaGFubmVsIiwiaXNNYWluUGFzcyIsIlNoYWRlclBhc3MiLCJpc0ZvcndhcmQiLCJwYXNzIiwiZXhwcmVzc2lvbiIsIm5pbmVTbGljZWRNb2RlIiwiU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VEIiwiU1BSSVRFX1JFTkRFUk1PREVfVElMRUQiLCJoZWlnaHRNYXAiLCJfYWRkTWFwRGVmIiwibmFtZSIsImVuYWJsZWQiLCJfYWRkTWFwRGVmcyIsImZsb2F0IiwiY29sb3IiLCJ2ZXJ0ZXgiLCJtYXAiLCJpbnZlcnQiLCJfYWRkTWFwIiwicHJvcE5hbWUiLCJjaHVua05hbWUiLCJtYXBwaW5nIiwiZW5jb2RpbmciLCJtYXBQcm9wTmFtZSIsImlkZW50aWZpZXJQcm9wTmFtZSIsImNoYW5uZWxQcm9wTmFtZSIsInZlcnRleENvbG9yQ2hhbm5lbFByb3BOYW1lIiwidGludFByb3BOYW1lIiwidmVydGV4Q29sb3JQcm9wTmFtZSIsImRldGFpbE1vZGVQcm9wTmFtZSIsImludmVydE5hbWUiLCJ0aW50T3B0aW9uIiwidmVydGV4Q29sb3JPcHRpb24iLCJ0ZXh0dXJlT3B0aW9uIiwidGV4dHVyZUlkZW50aWZpZXIiLCJkZXRhaWxNb2RlT3B0aW9uIiwic3ViQ29kZSIsInV2IiwicmVwbGFjZSIsInNlYXJjaCIsInNhbXBsZXJOYW1lIiwiYWxpYXMiLCJDaHVua1V0aWxzIiwiZGVjb2RlRnVuYyIsImdhbW1hIiwiaW5kZXhPZiIsImRlY29kZVRhYmxlIiwibGluZWFyIiwic3JnYiIsInJnYm0iLCJyZ2JlIiwiaXNGbG9hdFRpbnQiLCJpc1ZlY1RpbnQiLCJpbnZlcnRPcHRpb24iLCJfY29ycmVjdENoYW5uZWwiLCJjaGFuIiwic3Vic3RyaW5nIiwic3RyIiwiY2hyIiwiY2hhckF0IiwiYWRkTGVuIiwiY3JlYXRlU2hhZGVyRGVmaW5pdGlvbiIsImRldmljZSIsImxpdFNoYWRlciIsIkxpdFNoYWRlciIsInVzZVV2IiwidXNlVW5tb2RpZmllZFV2IiwibWFwVHJhbnNmb3JtcyIsIm1heFV2U2V0cyIsInRleHR1cmVNYXBwaW5nIiwibW5hbWUiLCJjbmFtZSIsInRuYW1lIiwidW5hbWUiLCJNYXRoIiwibWluIiwidXZTZXQiLCJpZCIsImZvcmNlVXYxIiwidW5kZWZpbmVkIiwiZ2VuZXJhdGVWZXJ0ZXhTaGFkZXIiLCJzaGFkaW5nTW9kZWwiLCJTUEVDVUxBUl9QSE9ORyIsImZyZXNuZWxNb2RlbCIsImFtYmllbnRTSCIsIkZSRVNORUxfU0NITElDSyIsImRlY2wiLCJDaHVua0J1aWxkZXIiLCJjb2RlIiwiZnVuYyIsImxpZ2h0aW5nVXYiLCJhcHBlbmQiLCJibGVuZFR5cGUiLCJCTEVORF9OT05FIiwiYWxwaGFUZXN0IiwiYWxwaGFUb0NvdmVyYWdlIiwiYWxwaGFUZXN0UFMiLCJuZWVkc05vcm1hbCIsIm5vcm1hbE1hcCIsImNsZWFyQ29hdE5vcm1hbE1hcCIsInBhY2tlZE5vcm1hbCIsIm5vcm1hbFhZUFMiLCJub3JtYWxYWVpQUyIsImhhc1RhbmdlbnRzIiwiYmFzZU5hbWUiLCJuZWVkc1NjZW5lQ29sb3IiLCJuZWVkc1NjcmVlblNpemUiLCJuZWVkc1RyYW5zZm9ybXMiLCJkaWZmdXNlRGV0YWlsIiwiZGlmZnVzZURldGFpbEVuY29kaW5nIiwiZGlmZnVzZUVuY29kaW5nIiwidXNlUmVmcmFjdGlvbiIsInVzZUlyaWRlc2NlbmNlIiwibGlnaHRpbmciLCJ1c2VTcGVjdWxhciIsInJlZmxlY3Rpb25zIiwidXNlU2hlZW4iLCJzaGVlbkVuY29kaW5nIiwidXNlTWV0YWxuZXNzIiwidXNlU3BlY3VsYXJpdHlGYWN0b3IiLCJ1c2VTcGVjdWxhckNvbG9yIiwic3BlY3VsYXJFbmNvZGluZyIsImFvTWFwIiwiYW9WZXJ0ZXhDb2xvciIsImVtaXNzaXZlRW5jb2RpbmciLCJ1c2VDbGVhckNvYXQiLCJsaWdodE1hcEVuYWJsZWQiLCJsaWdodE1hcFZlcnRleENvbG9ycyIsImxpZ2h0bWFwRGlyIiwiZGlyTGlnaHRNYXBFbmFibGVkIiwibGlnaHRtYXBDaHVua1Byb3BOYW1lIiwibGlnaHRNYXBFbmNvZGluZyIsIkRlYnVnIiwiZGVwcmVjYXRlZCIsInByZXBlbmQiLCJ0ZXh0dXJlU2FtcGxlUFMiLCJ0ZXh0dXJlIiwic3BsaXQiLCJsIiwiam9pbiIsImdlbmVyYXRlRnJhZ21lbnRTaGFkZXIiLCJnZXREZWZpbml0aW9uIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7OztBQWNNQSxNQUFBQSxTQUFTLEdBQUcsR0FBRTtBQUVwQixNQUFNQyxRQUFRLEdBQUc7QUFDYjtFQUNBQyxjQUFjLEVBQUUsSUFBSUMsdUJBQXVCLEVBQUU7RUFDN0NDLGlCQUFpQixFQUFFLElBQUlELHVCQUF1QixFQUFFO0FBRWhEO0VBQ0FFLFdBQVcsRUFBRSxVQUFVQyxPQUFPLEVBQUU7QUFDNUIsSUFBQSxNQUFNQyxtQkFBbUIsR0FBRyxTQUF0QkEsbUJBQW1CLENBQWFELE9BQU8sRUFBRTtNQUMzQyxNQUFNRSxLQUFLLEdBQUcsRUFBRSxDQUFBO0FBQ2hCLE1BQUEsS0FBSyxNQUFNQyxJQUFJLElBQUlILE9BQU8sRUFBRTtRQUN4QixJQUFJQSxPQUFPLENBQUNJLGNBQWMsQ0FBQ0QsSUFBSSxDQUFDLElBQUlBLElBQUksS0FBSyxRQUFRLElBQUlBLElBQUksS0FBSyxRQUFRLEVBQ3RFRCxLQUFLLENBQUNHLElBQUksQ0FBQ0YsSUFBSSxDQUFDLENBQUE7QUFDeEIsT0FBQTtNQUNBLE9BQU9ELEtBQUssQ0FBQ0ksSUFBSSxFQUFFLENBQUE7S0FDdEIsQ0FBQTtBQUNELElBQUEsSUFBSUosS0FBSyxDQUFBO0FBQ1QsSUFBQSxJQUFJRixPQUFPLEtBQUssSUFBSSxDQUFDRixpQkFBaUIsRUFBRTtBQUNwQyxNQUFBLElBQUksQ0FBQyxJQUFJLENBQUNTLFFBQVEsRUFBRSxJQUFJLENBQUNBLFFBQVEsR0FBR04sbUJBQW1CLENBQUNELE9BQU8sQ0FBQyxDQUFBO01BQ2hFRSxLQUFLLEdBQUcsSUFBSSxDQUFDSyxRQUFRLENBQUE7QUFDekIsS0FBQyxNQUFNLElBQUlQLE9BQU8sS0FBSyxJQUFJLENBQUNKLGNBQWMsRUFBRTtBQUN4QyxNQUFBLElBQUksQ0FBQyxJQUFJLENBQUNNLEtBQUssRUFBRSxJQUFJLENBQUNBLEtBQUssR0FBR0QsbUJBQW1CLENBQUNELE9BQU8sQ0FBQyxDQUFBO01BQzFERSxLQUFLLEdBQUcsSUFBSSxDQUFDQSxLQUFLLENBQUE7QUFDdEIsS0FBQyxNQUFNO0FBQ0hBLE1BQUFBLEtBQUssR0FBR0QsbUJBQW1CLENBQUNELE9BQU8sQ0FBQyxDQUFBO0FBQ3hDLEtBQUE7SUFFQSxJQUFJUSxHQUFHLEdBQUcsVUFBVSxDQUFBO0FBRXBCLElBQUEsS0FBSyxJQUFJQyxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdQLEtBQUssQ0FBQ1EsTUFBTSxFQUFFRCxDQUFDLEVBQUUsRUFBRTtNQUNuQyxJQUFJVCxPQUFPLENBQUNFLEtBQUssQ0FBQ08sQ0FBQyxDQUFDLENBQUMsRUFDakJELEdBQUcsSUFBSU4sS0FBSyxDQUFDTyxDQUFDLENBQUMsR0FBR1QsT0FBTyxDQUFDRSxLQUFLLENBQUNPLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDM0MsS0FBQTtJQUVBLElBQUlULE9BQU8sQ0FBQ1csTUFBTSxFQUFFO01BQ2hCLE1BQU1BLE1BQU0sR0FBRyxFQUFFLENBQUE7QUFDakIsTUFBQSxLQUFLLE1BQU1DLENBQUMsSUFBSVosT0FBTyxDQUFDVyxNQUFNLEVBQUU7UUFDNUIsSUFBSVgsT0FBTyxDQUFDVyxNQUFNLENBQUNQLGNBQWMsQ0FBQ1EsQ0FBQyxDQUFDLEVBQUU7VUFDbENELE1BQU0sQ0FBQ04sSUFBSSxDQUFDTyxDQUFDLEdBQUdaLE9BQU8sQ0FBQ1csTUFBTSxDQUFDQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ3RDLFNBQUE7QUFDSixPQUFBO01BQ0FELE1BQU0sQ0FBQ0wsSUFBSSxFQUFFLENBQUE7QUFDYkUsTUFBQUEsR0FBRyxJQUFJRyxNQUFNLENBQUE7QUFDakIsS0FBQTtJQUVBLElBQUlYLE9BQU8sQ0FBQ2EsVUFBVSxFQUFFO0FBRXBCLE1BQUEsS0FBSyxNQUFNQyxDQUFDLElBQUlkLE9BQU8sQ0FBQ2EsVUFBVSxFQUFFO0FBRWhDO1FBQ0EsSUFBSUMsQ0FBQyxLQUFLLFFBQVEsRUFBRTtBQUNoQixVQUFBLE1BQU1DLFdBQVcsR0FBR2YsT0FBTyxDQUFDYSxVQUFVLENBQUNHLHdCQUF3QixDQUFBO0FBQy9ELFVBQUEsS0FBSyxJQUFJUCxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdULE9BQU8sQ0FBQ2EsVUFBVSxDQUFDSSxNQUFNLENBQUNQLE1BQU0sRUFBRUQsQ0FBQyxFQUFFLEVBQUU7WUFDdkQsTUFBTVMsS0FBSyxHQUFHbEIsT0FBTyxDQUFDYSxVQUFVLENBQUNJLE1BQU0sQ0FBQ1IsQ0FBQyxDQUFDLENBQUE7WUFDMUMsSUFBSSxDQUFDTSxXQUFXLElBQUlHLEtBQUssQ0FBQ0MsS0FBSyxLQUFLQyxxQkFBcUIsRUFBRTtjQUN2RFosR0FBRyxJQUFJVSxLQUFLLENBQUNWLEdBQUcsQ0FBQTtBQUNwQixhQUFBO0FBQ0osV0FBQTtBQUNKLFNBQUMsTUFBTTtVQUNIQSxHQUFHLElBQUlNLENBQUMsR0FBR2QsT0FBTyxDQUFDYSxVQUFVLENBQUNDLENBQUMsQ0FBQyxDQUFBO0FBQ3BDLFNBQUE7QUFDSixPQUFBO0FBQ0osS0FBQTtJQUVBLE9BQU9PLFFBQVEsQ0FBQ2IsR0FBRyxDQUFDLENBQUE7R0FDdkI7QUFFRDs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSWMsRUFBQUEsc0JBQXNCLEVBQUUsVUFBVUMsaUJBQWlCLEVBQUVDLFVBQVUsRUFBRXhCLE9BQU8sRUFBRTtBQUN0RSxJQUFBLE1BQU15QixXQUFXLEdBQUd6QixPQUFPLENBQUN1QixpQkFBaUIsQ0FBQyxDQUFBO0FBQzlDLElBQUEsTUFBTUcsU0FBUyxHQUFHMUIsT0FBTyxDQUFDd0IsVUFBVSxDQUFDLENBQUE7SUFDckMsTUFBTUcsVUFBVSxHQUFHQyxVQUFVLENBQUNDLFNBQVMsQ0FBQzdCLE9BQU8sQ0FBQzhCLElBQUksQ0FBQyxDQUFBO0FBRXJELElBQUEsSUFBSUMsVUFBVSxDQUFBO0lBQ2QsSUFBSUosVUFBVSxJQUFJM0IsT0FBTyxDQUFDYSxVQUFVLENBQUNtQixjQUFjLEtBQUtDLHdCQUF3QixFQUFFO0FBQzlFRixNQUFBQSxVQUFVLEdBQUcsY0FBYyxDQUFBO0tBQzlCLE1BQU0sSUFBSUosVUFBVSxJQUFJM0IsT0FBTyxDQUFDYSxVQUFVLENBQUNtQixjQUFjLEtBQUtFLHVCQUF1QixFQUFFO0FBQ3BGSCxNQUFBQSxVQUFVLEdBQUcsY0FBYyxDQUFBO0FBQy9CLEtBQUMsTUFBTTtNQUNILElBQUlOLFdBQVcsS0FBSyxDQUFDLEVBQUU7UUFDbkJNLFVBQVUsR0FBRyxLQUFLLEdBQUdMLFNBQVMsQ0FBQTtBQUNsQyxPQUFDLE1BQU07QUFDSDtBQUNBSyxRQUFBQSxVQUFVLEdBQUcsS0FBSyxHQUFHTCxTQUFTLEdBQUcsR0FBRyxHQUFHRCxXQUFXLENBQUE7QUFDdEQsT0FBQTs7QUFFQTtBQUNBLE1BQUEsSUFBSXpCLE9BQU8sQ0FBQ21DLFNBQVMsSUFBSVosaUJBQWlCLEtBQUssb0JBQW9CLEVBQUU7QUFDakVRLFFBQUFBLFVBQVUsSUFBSSxjQUFjLENBQUE7QUFDaEMsT0FBQTtBQUNKLEtBQUE7QUFFQSxJQUFBLE9BQU9BLFVBQVUsQ0FBQTtHQUNwQjtBQUVESyxFQUFBQSxVQUFVLEVBQUUsVUFBVUMsSUFBSSxFQUFFQyxPQUFPLEVBQUU7SUFDakMsT0FBT0EsT0FBTyxHQUFJLENBQVVELFFBQUFBLEVBQUFBLElBQUssSUFBRyxHQUFJLENBQUEsT0FBQSxFQUFTQSxJQUFLLENBQUcsRUFBQSxDQUFBLENBQUE7R0FDNUQ7RUFFREUsV0FBVyxFQUFFLFVBQVVDLEtBQUssRUFBRUMsS0FBSyxFQUFFQyxNQUFNLEVBQUVDLEdBQUcsRUFBRUMsTUFBTSxFQUFFO0FBQ3RELElBQUEsT0FBTyxJQUFJLENBQUNSLFVBQVUsQ0FBQyxVQUFVLEVBQUVJLEtBQUssQ0FBQyxHQUNsQyxJQUFJLENBQUNKLFVBQVUsQ0FBQyxVQUFVLEVBQUVLLEtBQUssQ0FBQyxHQUNsQyxJQUFJLENBQUNMLFVBQVUsQ0FBQyxXQUFXLEVBQUVNLE1BQU0sQ0FBQyxHQUNwQyxJQUFJLENBQUNOLFVBQVUsQ0FBQyxZQUFZLEVBQUVPLEdBQUcsQ0FBQyxHQUNsQyxJQUFJLENBQUNQLFVBQVUsQ0FBQyxXQUFXLEVBQUVRLE1BQU0sQ0FBQyxDQUFBO0dBQzlDO0FBRUQ7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lDLEVBQUFBLE9BQU8sRUFBRSxVQUFVQyxRQUFRLEVBQUVDLFNBQVMsRUFBRS9DLE9BQU8sRUFBRVcsTUFBTSxFQUFFcUMsT0FBTyxFQUFFQyxRQUFRLEdBQUcsSUFBSSxFQUFFO0FBQy9FLElBQUEsTUFBTUMsV0FBVyxHQUFHSixRQUFRLEdBQUcsS0FBSyxDQUFBO0FBQ3BDLElBQUEsTUFBTXRCLFVBQVUsR0FBRzBCLFdBQVcsR0FBRyxJQUFJLENBQUE7QUFDckMsSUFBQSxNQUFNQyxrQkFBa0IsR0FBR0QsV0FBVyxHQUFHLFlBQVksQ0FBQTtBQUNyRCxJQUFBLE1BQU0zQixpQkFBaUIsR0FBRzJCLFdBQVcsR0FBRyxXQUFXLENBQUE7QUFDbkQsSUFBQSxNQUFNRSxlQUFlLEdBQUdGLFdBQVcsR0FBRyxTQUFTLENBQUE7QUFDL0MsSUFBQSxNQUFNRywwQkFBMEIsR0FBR1AsUUFBUSxHQUFHLG9CQUFvQixDQUFBO0FBQ2xFLElBQUEsTUFBTVEsWUFBWSxHQUFHUixRQUFRLEdBQUcsTUFBTSxDQUFBO0FBQ3RDLElBQUEsTUFBTVMsbUJBQW1CLEdBQUdULFFBQVEsR0FBRyxhQUFhLENBQUE7QUFDcEQsSUFBQSxNQUFNVSxrQkFBa0IsR0FBR1YsUUFBUSxHQUFHLE1BQU0sQ0FBQTtBQUM1QyxJQUFBLE1BQU1XLFVBQVUsR0FBR1gsUUFBUSxHQUFHLFFBQVEsQ0FBQTtBQUV0QyxJQUFBLE1BQU1ZLFVBQVUsR0FBRzFELE9BQU8sQ0FBQ3NELFlBQVksQ0FBQyxDQUFBO0FBQ3hDLElBQUEsTUFBTUssaUJBQWlCLEdBQUczRCxPQUFPLENBQUN1RCxtQkFBbUIsQ0FBQyxDQUFBO0FBQ3RELElBQUEsTUFBTUssYUFBYSxHQUFHNUQsT0FBTyxDQUFDa0QsV0FBVyxDQUFDLENBQUE7QUFDMUMsSUFBQSxNQUFNVyxpQkFBaUIsR0FBRzdELE9BQU8sQ0FBQ21ELGtCQUFrQixDQUFDLENBQUE7QUFDckQsSUFBQSxNQUFNVyxnQkFBZ0IsR0FBRzlELE9BQU8sQ0FBQ3dELGtCQUFrQixDQUFDLENBQUE7QUFFcEQsSUFBQSxJQUFJTyxPQUFPLEdBQUdwRCxNQUFNLENBQUNvQyxTQUFTLENBQUMsQ0FBQTtBQUUvQixJQUFBLElBQUlhLGFBQWEsRUFBRTtNQUNmLE1BQU1JLEVBQUUsR0FBRyxJQUFJLENBQUMxQyxzQkFBc0IsQ0FBQ0MsaUJBQWlCLEVBQUVDLFVBQVUsRUFBRXhCLE9BQU8sQ0FBQyxDQUFBO0FBRTlFK0QsTUFBQUEsT0FBTyxHQUFHQSxPQUFPLENBQUNFLE9BQU8sQ0FBQyxPQUFPLEVBQUVELEVBQUUsQ0FBQyxDQUFDQyxPQUFPLENBQUMsT0FBTyxFQUFFakUsT0FBTyxDQUFDb0QsZUFBZSxDQUFDLENBQUMsQ0FBQTtNQUVqRixJQUFJSixPQUFPLElBQUllLE9BQU8sQ0FBQ0csTUFBTSxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFO0FBQ2hELFFBQUEsSUFBSUMsV0FBVyxHQUFHLFVBQVUsR0FBR2pCLFdBQVcsQ0FBQTtBQUMxQyxRQUFBLE1BQU1rQixLQUFLLEdBQUdwQixPQUFPLENBQUNhLGlCQUFpQixDQUFDLENBQUE7QUFDeEMsUUFBQSxJQUFJTyxLQUFLLEVBQUU7QUFDUEQsVUFBQUEsV0FBVyxHQUFHQyxLQUFLLENBQUE7QUFDdkIsU0FBQyxNQUFNO0FBQ0hwQixVQUFBQSxPQUFPLENBQUNhLGlCQUFpQixDQUFDLEdBQUdNLFdBQVcsQ0FBQTtBQUM1QyxTQUFBO1FBQ0FKLE9BQU8sR0FBR0EsT0FBTyxDQUFDRSxPQUFPLENBQUMsWUFBWSxFQUFFRSxXQUFXLENBQUMsQ0FBQTtBQUN4RCxPQUFBO0FBRUEsTUFBQSxJQUFJbEIsUUFBUSxFQUFFO0FBQ1YsUUFBQSxJQUFJakQsT0FBTyxDQUFDb0QsZUFBZSxDQUFDLEtBQUssS0FBSyxFQUFFO0FBQ3BDO0FBQ0E7VUFDQVcsT0FBTyxHQUFHQSxPQUFPLENBQUNFLE9BQU8sQ0FBQyxXQUFXLEVBQUUsYUFBYSxDQUFDLENBQUE7QUFDekQsU0FBQyxNQUFNO1VBQ0hGLE9BQU8sR0FBR0EsT0FBTyxDQUFDRSxPQUFPLENBQUMsV0FBVyxFQUFFSSxVQUFVLENBQUNDLFVBQVUsQ0FBRSxDQUFDdEUsT0FBTyxDQUFDYSxVQUFVLENBQUMwRCxLQUFLLElBQUl0QixRQUFRLEtBQUssTUFBTSxHQUFJLFFBQVEsR0FBR0EsUUFBUSxDQUFDLENBQUMsQ0FBQTtBQUMzSSxTQUFBOztBQUVBO0FBQ0EsUUFBQSxJQUFJYyxPQUFPLENBQUNTLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxFQUFFO0FBQ3JDLFVBQUEsTUFBTUMsV0FBVyxHQUFHO0FBQ2hCQyxZQUFBQSxNQUFNLEVBQUUsV0FBVztBQUNuQkMsWUFBQUEsSUFBSSxFQUFFLGVBQWU7QUFDckJDLFlBQUFBLElBQUksRUFBRSxlQUFlO0FBQ3JCQyxZQUFBQSxJQUFJLEVBQUUsZUFBQTtXQUNULENBQUE7QUFFRGQsVUFBQUEsT0FBTyxHQUFHQSxPQUFPLENBQUNFLE9BQU8sQ0FBQyxvQkFBb0IsRUFBRVEsV0FBVyxDQUFDeEIsUUFBUSxDQUFDLElBQUksV0FBVyxDQUFDLENBQUE7QUFDekYsU0FBQTtBQUNKLE9BQUE7QUFDSixLQUFBO0FBRUEsSUFBQSxJQUFJVSxpQkFBaUIsRUFBRTtNQUNuQkksT0FBTyxHQUFHQSxPQUFPLENBQUNFLE9BQU8sQ0FBQyxPQUFPLEVBQUVqRSxPQUFPLENBQUNxRCwwQkFBMEIsQ0FBQyxDQUFDLENBQUE7QUFDM0UsS0FBQTtBQUVBLElBQUEsSUFBSVMsZ0JBQWdCLEVBQUU7TUFDbEJDLE9BQU8sR0FBR0EsT0FBTyxDQUFDRSxPQUFPLENBQUMsZUFBZSxFQUFFSCxnQkFBZ0IsQ0FBQyxDQUFBO0FBQ2hFLEtBQUE7QUFFQSxJQUFBLE1BQU1nQixXQUFXLEdBQUcsQ0FBQyxFQUFFcEIsVUFBVSxHQUFHLENBQUMsQ0FBQyxDQUFBO0FBQ3RDLElBQUEsTUFBTXFCLFNBQVMsR0FBRyxDQUFDLEVBQUVyQixVQUFVLEdBQUcsQ0FBQyxDQUFDLENBQUE7QUFDcEMsSUFBQSxNQUFNc0IsWUFBWSxHQUFHLENBQUMsQ0FBRWhGLE9BQU8sQ0FBQ3lELFVBQVUsQ0FBRSxDQUFBO0FBRTVDTSxJQUFBQSxPQUFPLEdBQUcsSUFBSSxDQUFDeEIsV0FBVyxDQUFDdUMsV0FBVyxFQUFFQyxTQUFTLEVBQUVwQixpQkFBaUIsRUFBRUMsYUFBYSxFQUFFb0IsWUFBWSxDQUFDLEdBQUdqQixPQUFPLENBQUE7QUFDNUcsSUFBQSxPQUFPQSxPQUFPLENBQUNFLE9BQU8sQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUE7R0FDcEM7QUFFRGdCLEVBQUFBLGVBQWUsRUFBRSxVQUFVckUsQ0FBQyxFQUFFc0UsSUFBSSxFQUFFeEYsU0FBUyxFQUFFO0FBQzNDLElBQUEsSUFBSUEsU0FBUyxDQUFDa0IsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFO01BQ2xCLElBQUlsQixTQUFTLENBQUNrQixDQUFDLENBQUMsR0FBR3NFLElBQUksQ0FBQ3hFLE1BQU0sRUFBRTtRQUM1QixPQUFPd0UsSUFBSSxDQUFDQyxTQUFTLENBQUMsQ0FBQyxFQUFFekYsU0FBUyxDQUFDa0IsQ0FBQyxDQUFDLENBQUMsQ0FBQTtPQUN6QyxNQUFNLElBQUlsQixTQUFTLENBQUNrQixDQUFDLENBQUMsR0FBR3NFLElBQUksQ0FBQ3hFLE1BQU0sRUFBRTtRQUNuQyxJQUFJMEUsR0FBRyxHQUFHRixJQUFJLENBQUE7UUFDZCxNQUFNRyxHQUFHLEdBQUdELEdBQUcsQ0FBQ0UsTUFBTSxDQUFDRixHQUFHLENBQUMxRSxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUE7UUFDdEMsTUFBTTZFLE1BQU0sR0FBRzdGLFNBQVMsQ0FBQ2tCLENBQUMsQ0FBQyxHQUFHd0UsR0FBRyxDQUFDMUUsTUFBTSxDQUFBO0FBQ3hDLFFBQUEsS0FBSyxJQUFJRCxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUc4RSxNQUFNLEVBQUU5RSxDQUFDLEVBQUUsRUFBRTJFLEdBQUcsSUFBSUMsR0FBRyxDQUFBO0FBQzNDLFFBQUEsT0FBT0QsR0FBRyxDQUFBO0FBQ2QsT0FBQTtBQUNBLE1BQUEsT0FBT0YsSUFBSSxDQUFBO0FBQ2YsS0FBQTtHQUNIO0FBRUQ7QUFDQU0sRUFBQUEsc0JBQXNCLEVBQUUsVUFBVUMsTUFBTSxFQUFFekYsT0FBTyxFQUFFO0lBQy9DLE1BQU0wRixTQUFTLEdBQUcsSUFBSUMsU0FBUyxDQUFDRixNQUFNLEVBQUV6RixPQUFPLENBQUNhLFVBQVUsQ0FBQyxDQUFBOztBQUUzRDtJQUNBLE1BQU0rRSxLQUFLLEdBQUcsRUFBRSxDQUFBO0lBQ2hCLE1BQU1DLGVBQWUsR0FBRyxFQUFFLENBQUE7SUFDMUIsTUFBTUMsYUFBYSxHQUFHLEVBQUUsQ0FBQTtJQUN4QixNQUFNQyxTQUFTLEdBQUcsQ0FBQyxDQUFBO0lBQ25CLE1BQU1DLGNBQWMsR0FBRyxFQUFFLENBQUE7QUFFekIsSUFBQSxLQUFLLE1BQU1wRixDQUFDLElBQUlsQixTQUFTLEVBQUU7QUFDdkIsTUFBQSxNQUFNdUcsS0FBSyxHQUFHckYsQ0FBQyxHQUFHLEtBQUssQ0FBQTtBQUV2QixNQUFBLElBQUlaLE9BQU8sQ0FBQ1ksQ0FBQyxHQUFHLGFBQWEsQ0FBQyxFQUFFO0FBQzVCLFFBQUEsTUFBTXNGLEtBQUssR0FBR3RGLENBQUMsR0FBRyxvQkFBb0IsQ0FBQTtBQUN0Q1osUUFBQUEsT0FBTyxDQUFDa0csS0FBSyxDQUFDLEdBQUcsSUFBSSxDQUFDakIsZUFBZSxDQUFDckUsQ0FBQyxFQUFFWixPQUFPLENBQUNrRyxLQUFLLENBQUMsRUFBRXhHLFNBQVMsQ0FBQyxDQUFBO0FBQ3ZFLE9BQUE7QUFFQSxNQUFBLElBQUlNLE9BQU8sQ0FBQ2lHLEtBQUssQ0FBQyxFQUFFO0FBQ2hCLFFBQUEsTUFBTUMsS0FBSyxHQUFHRCxLQUFLLEdBQUcsU0FBUyxDQUFBO0FBQy9CLFFBQUEsTUFBTUUsS0FBSyxHQUFHRixLQUFLLEdBQUcsV0FBVyxDQUFBO0FBQ2pDLFFBQUEsTUFBTUcsS0FBSyxHQUFHSCxLQUFLLEdBQUcsSUFBSSxDQUFBO0FBRTFCakcsUUFBQUEsT0FBTyxDQUFDb0csS0FBSyxDQUFDLEdBQUdDLElBQUksQ0FBQ0MsR0FBRyxDQUFDdEcsT0FBTyxDQUFDb0csS0FBSyxDQUFDLEVBQUVMLFNBQVMsR0FBRyxDQUFDLENBQUMsQ0FBQTtBQUN4RC9GLFFBQUFBLE9BQU8sQ0FBQ2tHLEtBQUssQ0FBQyxHQUFHLElBQUksQ0FBQ2pCLGVBQWUsQ0FBQ3JFLENBQUMsRUFBRVosT0FBTyxDQUFDa0csS0FBSyxDQUFDLEVBQUV4RyxTQUFTLENBQUMsQ0FBQTtBQUVuRSxRQUFBLE1BQU02RyxLQUFLLEdBQUd2RyxPQUFPLENBQUNvRyxLQUFLLENBQUMsQ0FBQTtBQUM1QlIsUUFBQUEsS0FBSyxDQUFDVyxLQUFLLENBQUMsR0FBRyxJQUFJLENBQUE7QUFDbkJWLFFBQUFBLGVBQWUsQ0FBQ1UsS0FBSyxDQUFDLEdBQUdWLGVBQWUsQ0FBQ1UsS0FBSyxDQUFDLElBQUt2RyxPQUFPLENBQUNpRyxLQUFLLENBQUMsSUFBSSxDQUFDakcsT0FBTyxDQUFDbUcsS0FBSyxDQUFFLENBQUE7O0FBRXRGO0FBQ0EsUUFBQSxJQUFJbkcsT0FBTyxDQUFDbUcsS0FBSyxDQUFDLEVBQUU7VUFDaEJMLGFBQWEsQ0FBQ3pGLElBQUksQ0FBQztBQUNmZ0MsWUFBQUEsSUFBSSxFQUFFekIsQ0FBQztBQUNQNEYsWUFBQUEsRUFBRSxFQUFFeEcsT0FBTyxDQUFDbUcsS0FBSyxDQUFDO1lBQ2xCbkMsRUFBRSxFQUFFaEUsT0FBTyxDQUFDb0csS0FBSyxDQUFBO0FBQ3JCLFdBQUMsQ0FBQyxDQUFBO0FBQ04sU0FBQTtBQUNKLE9BQUE7QUFDSixLQUFBO0lBRUEsSUFBSXBHLE9BQU8sQ0FBQ3lHLFFBQVEsRUFBRTtBQUNsQmIsTUFBQUEsS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQTtBQUNmQyxNQUFBQSxlQUFlLENBQUMsQ0FBQyxDQUFDLEdBQUlBLGVBQWUsQ0FBQyxDQUFDLENBQUMsS0FBS2EsU0FBUyxHQUFJYixlQUFlLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFBO0FBQ3ZGLEtBQUE7SUFFQUgsU0FBUyxDQUFDaUIsb0JBQW9CLENBQUNmLEtBQUssRUFBRUMsZUFBZSxFQUFFQyxhQUFhLENBQUMsQ0FBQTs7QUFFckU7QUFDQSxJQUFBLElBQUk5RixPQUFPLENBQUNhLFVBQVUsQ0FBQytGLFlBQVksS0FBS0MsY0FBYyxFQUFFO0FBQ3BEN0csTUFBQUEsT0FBTyxDQUFDYSxVQUFVLENBQUNpRyxZQUFZLEdBQUcsQ0FBQyxDQUFBO0FBQ25DOUcsTUFBQUEsT0FBTyxDQUFDYSxVQUFVLENBQUNrRyxTQUFTLEdBQUcsS0FBSyxDQUFBO0FBQ3hDLEtBQUMsTUFBTTtBQUNIL0csTUFBQUEsT0FBTyxDQUFDYSxVQUFVLENBQUNpRyxZQUFZLEdBQUk5RyxPQUFPLENBQUNhLFVBQVUsQ0FBQ2lHLFlBQVksS0FBSyxDQUFDLEdBQUlFLGVBQWUsR0FBR2hILE9BQU8sQ0FBQ2EsVUFBVSxDQUFDaUcsWUFBWSxDQUFBO0FBQ2pJLEtBQUE7QUFFQSxJQUFBLE1BQU1HLElBQUksR0FBRyxJQUFJQyxZQUFZLEVBQUUsQ0FBQTtBQUMvQixJQUFBLE1BQU1DLElBQUksR0FBRyxJQUFJRCxZQUFZLEVBQUUsQ0FBQTtBQUMvQixJQUFBLE1BQU1FLElBQUksR0FBRyxJQUFJRixZQUFZLEVBQUUsQ0FBQTtJQUMvQixJQUFJRyxVQUFVLEdBQUcsRUFBRSxDQUFBOztBQUVuQjtBQUNBLElBQUEsSUFBSXJILE9BQU8sQ0FBQ2EsVUFBVSxDQUFDbUIsY0FBYyxLQUFLRSx1QkFBdUIsRUFBRTtBQUMvRCtFLE1BQUFBLElBQUksQ0FBQ0ssTUFBTSxDQUFFLENBQUEsa0NBQUEsQ0FBbUMsQ0FBQyxDQUFBO0FBQ3JELEtBQUMsTUFBTTtBQUNITCxNQUFBQSxJQUFJLENBQUNLLE1BQU0sQ0FBRSxDQUFBLDBCQUFBLENBQTJCLENBQUMsQ0FBQTtBQUM3QyxLQUFBO0lBRUEsSUFBSTFGLFVBQVUsQ0FBQ0MsU0FBUyxDQUFDN0IsT0FBTyxDQUFDOEIsSUFBSSxDQUFDLEVBQUU7QUFDcEM7TUFDQSxJQUFJOUIsT0FBTyxDQUFDbUMsU0FBUyxFQUFFO0FBQ25CO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQThFLFFBQUFBLElBQUksQ0FBQ0ssTUFBTSxDQUFDLGlCQUFpQixDQUFDLENBQUE7QUFDOUJILFFBQUFBLElBQUksQ0FBQ0csTUFBTSxDQUFDLElBQUksQ0FBQ3pFLE9BQU8sQ0FBQyxRQUFRLEVBQUUsWUFBWSxFQUFFN0MsT0FBTyxFQUFFMEYsU0FBUyxDQUFDL0UsTUFBTSxFQUFFcUYsY0FBYyxDQUFDLENBQUMsQ0FBQTtBQUM1Rm9CLFFBQUFBLElBQUksQ0FBQ0UsTUFBTSxDQUFDLGdCQUFnQixDQUFDLENBQUE7QUFDakMsT0FBQTs7QUFFQTtBQUNBLE1BQUEsSUFBSXRILE9BQU8sQ0FBQ2EsVUFBVSxDQUFDMEcsU0FBUyxLQUFLQyxVQUFVLElBQUl4SCxPQUFPLENBQUNhLFVBQVUsQ0FBQzRHLFNBQVMsSUFBSXpILE9BQU8sQ0FBQ2EsVUFBVSxDQUFDNkcsZUFBZSxFQUFFO0FBQ25IVCxRQUFBQSxJQUFJLENBQUNLLE1BQU0sQ0FBQyxlQUFlLENBQUMsQ0FBQTtBQUM1QkgsUUFBQUEsSUFBSSxDQUFDRyxNQUFNLENBQUMsSUFBSSxDQUFDekUsT0FBTyxDQUFDLFNBQVMsRUFBRSxXQUFXLEVBQUU3QyxPQUFPLEVBQUUwRixTQUFTLENBQUMvRSxNQUFNLEVBQUVxRixjQUFjLENBQUMsQ0FBQyxDQUFBO0FBQzVGb0IsUUFBQUEsSUFBSSxDQUFDRSxNQUFNLENBQUMsZUFBZSxDQUFDLENBQUE7QUFDNUIsUUFBQSxJQUFJdEgsT0FBTyxDQUFDYSxVQUFVLENBQUM0RyxTQUFTLEVBQUU7VUFDOUJOLElBQUksQ0FBQ0csTUFBTSxDQUFDNUIsU0FBUyxDQUFDL0UsTUFBTSxDQUFDZ0gsV0FBVyxDQUFDLENBQUE7QUFDekNQLFVBQUFBLElBQUksQ0FBQ0UsTUFBTSxDQUFDLG9CQUFvQixDQUFDLENBQUE7QUFDckMsU0FBQTtBQUNKLE9BQUMsTUFBTTtBQUNITCxRQUFBQSxJQUFJLENBQUNLLE1BQU0sQ0FBQyxxQkFBcUIsQ0FBQyxDQUFBO0FBQ3RDLE9BQUE7O0FBRUE7TUFDQSxJQUFJNUIsU0FBUyxDQUFDa0MsV0FBVyxFQUFFO0FBQ3ZCLFFBQUEsSUFBSTVILE9BQU8sQ0FBQzZILFNBQVMsSUFBSTdILE9BQU8sQ0FBQzhILGtCQUFrQixFQUFFO0FBQ2pEO0FBQ0FYLFVBQUFBLElBQUksQ0FBQ0csTUFBTSxDQUFDdEgsT0FBTyxDQUFDK0gsWUFBWSxHQUFHckMsU0FBUyxDQUFDL0UsTUFBTSxDQUFDcUgsVUFBVSxHQUFHdEMsU0FBUyxDQUFDL0UsTUFBTSxDQUFDc0gsV0FBVyxDQUFDLENBQUE7QUFFOUYsVUFBQSxJQUFJLENBQUNqSSxPQUFPLENBQUNhLFVBQVUsQ0FBQ3FILFdBQVcsRUFBRTtBQUNqQztZQUNBLE1BQU1DLFFBQVEsR0FBR25JLE9BQU8sQ0FBQzZILFNBQVMsR0FBRyxXQUFXLEdBQUcsb0JBQW9CLENBQUE7QUFDdkVSLFlBQUFBLFVBQVUsR0FBRyxJQUFJLENBQUMvRixzQkFBc0IsQ0FBRSxDQUFFNkcsRUFBQUEsUUFBUyxDQUFVLFNBQUEsQ0FBQSxFQUFHLENBQUVBLEVBQUFBLFFBQVMsQ0FBRyxFQUFBLENBQUEsRUFBRW5JLE9BQU8sQ0FBQyxDQUFBO0FBQzlGLFdBQUE7QUFDSixTQUFBO0FBRUFpSCxRQUFBQSxJQUFJLENBQUNLLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFBO0FBQzdCSCxRQUFBQSxJQUFJLENBQUNHLE1BQU0sQ0FBQyxJQUFJLENBQUN6RSxPQUFPLENBQUMsY0FBYyxFQUFFLG1CQUFtQixFQUFFN0MsT0FBTyxFQUFFMEYsU0FBUyxDQUFDL0UsTUFBTSxFQUFFcUYsY0FBYyxDQUFDLENBQUMsQ0FBQTtBQUN6R21CLFFBQUFBLElBQUksQ0FBQ0csTUFBTSxDQUFDLElBQUksQ0FBQ3pFLE9BQU8sQ0FBQyxRQUFRLEVBQUUsYUFBYSxFQUFFN0MsT0FBTyxFQUFFMEYsU0FBUyxDQUFDL0UsTUFBTSxFQUFFcUYsY0FBYyxDQUFDLENBQUMsQ0FBQTtBQUM3Rm9CLFFBQUFBLElBQUksQ0FBQ0UsTUFBTSxDQUFDLGNBQWMsQ0FBQyxDQUFBO0FBQy9CLE9BQUE7TUFFQSxJQUFJNUIsU0FBUyxDQUFDMEMsZUFBZSxFQUFFO0FBQzNCbkIsUUFBQUEsSUFBSSxDQUFDSyxNQUFNLENBQUMsbUNBQW1DLENBQUMsQ0FBQTtBQUNwRCxPQUFBO01BQ0EsSUFBSTVCLFNBQVMsQ0FBQzJDLGVBQWUsRUFBRTtBQUMzQnBCLFFBQUFBLElBQUksQ0FBQ0ssTUFBTSxDQUFDLDJCQUEyQixDQUFDLENBQUE7QUFDNUMsT0FBQTtNQUNBLElBQUk1QixTQUFTLENBQUM0QyxlQUFlLEVBQUU7QUFDM0JyQixRQUFBQSxJQUFJLENBQUNLLE1BQU0sQ0FBQyxxQ0FBcUMsQ0FBQyxDQUFBO0FBQ2xETCxRQUFBQSxJQUFJLENBQUNLLE1BQU0sQ0FBQyw0QkFBNEIsQ0FBQyxDQUFBO0FBQzdDLE9BQUE7O0FBRUE7QUFDQUwsTUFBQUEsSUFBSSxDQUFDSyxNQUFNLENBQUMsZUFBZSxDQUFDLENBQUE7TUFDNUIsSUFBSXRILE9BQU8sQ0FBQ3VJLGFBQWEsRUFBRTtRQUN2QnBCLElBQUksQ0FBQ0csTUFBTSxDQUFDLElBQUksQ0FBQ3pFLE9BQU8sQ0FBQyxlQUFlLEVBQUUsb0JBQW9CLEVBQUU3QyxPQUFPLEVBQUUwRixTQUFTLENBQUMvRSxNQUFNLEVBQUVxRixjQUFjLEVBQUVoRyxPQUFPLENBQUN3SSxxQkFBcUIsQ0FBQyxDQUFDLENBQUE7QUFDOUksT0FBQTtNQUNBckIsSUFBSSxDQUFDRyxNQUFNLENBQUMsSUFBSSxDQUFDekUsT0FBTyxDQUFDLFNBQVMsRUFBRSxXQUFXLEVBQUU3QyxPQUFPLEVBQUUwRixTQUFTLENBQUMvRSxNQUFNLEVBQUVxRixjQUFjLEVBQUVoRyxPQUFPLENBQUN5SSxlQUFlLENBQUMsQ0FBQyxDQUFBO0FBQ3JIckIsTUFBQUEsSUFBSSxDQUFDRSxNQUFNLENBQUMsY0FBYyxDQUFDLENBQUE7QUFFM0IsTUFBQSxJQUFJdEgsT0FBTyxDQUFDYSxVQUFVLENBQUM2SCxhQUFhLEVBQUU7QUFDbEN6QixRQUFBQSxJQUFJLENBQUNLLE1BQU0sQ0FBQyxzQkFBc0IsQ0FBQyxDQUFBO0FBQ25DSCxRQUFBQSxJQUFJLENBQUNHLE1BQU0sQ0FBQyxJQUFJLENBQUN6RSxPQUFPLENBQUMsWUFBWSxFQUFFLGdCQUFnQixFQUFFN0MsT0FBTyxFQUFFMEYsU0FBUyxDQUFDL0UsTUFBTSxFQUFFcUYsY0FBYyxDQUFDLENBQUMsQ0FBQTtBQUNwR29CLFFBQUFBLElBQUksQ0FBQ0UsTUFBTSxDQUFDLGtCQUFrQixDQUFDLENBQUE7QUFFL0JMLFFBQUFBLElBQUksQ0FBQ0ssTUFBTSxDQUFDLG1CQUFtQixDQUFDLENBQUE7QUFDaENILFFBQUFBLElBQUksQ0FBQ0csTUFBTSxDQUFDLElBQUksQ0FBQ3pFLE9BQU8sQ0FBQyxXQUFXLEVBQUUsYUFBYSxFQUFFN0MsT0FBTyxFQUFFMEYsU0FBUyxDQUFDL0UsTUFBTSxFQUFFcUYsY0FBYyxDQUFDLENBQUMsQ0FBQTtBQUNoR29CLFFBQUFBLElBQUksQ0FBQ0UsTUFBTSxDQUFDLGlCQUFpQixDQUFDLENBQUE7QUFDbEMsT0FBQTtBQUVBLE1BQUEsSUFBSXRILE9BQU8sQ0FBQ2EsVUFBVSxDQUFDOEgsY0FBYyxFQUFFO0FBQ25DMUIsUUFBQUEsSUFBSSxDQUFDSyxNQUFNLENBQUMsMkJBQTJCLENBQUMsQ0FBQTtBQUN4Q0wsUUFBQUEsSUFBSSxDQUFDSyxNQUFNLENBQUMscUJBQXFCLENBQUMsQ0FBQTtBQUNsQ0gsUUFBQUEsSUFBSSxDQUFDRyxNQUFNLENBQUMsSUFBSSxDQUFDekUsT0FBTyxDQUFDLGFBQWEsRUFBRSxlQUFlLEVBQUU3QyxPQUFPLEVBQUUwRixTQUFTLENBQUMvRSxNQUFNLEVBQUVxRixjQUFjLENBQUMsQ0FBQyxDQUFBO0FBQ3BHb0IsUUFBQUEsSUFBSSxDQUFDRSxNQUFNLENBQUMsbUJBQW1CLENBQUMsQ0FBQTtBQUVoQ0wsUUFBQUEsSUFBSSxDQUFDSyxNQUFNLENBQUMsOEJBQThCLENBQUMsQ0FBQTtBQUMzQ0gsUUFBQUEsSUFBSSxDQUFDRyxNQUFNLENBQUMsSUFBSSxDQUFDekUsT0FBTyxDQUFDLHNCQUFzQixFQUFFLHdCQUF3QixFQUFFN0MsT0FBTyxFQUFFMEYsU0FBUyxDQUFDL0UsTUFBTSxFQUFFcUYsY0FBYyxDQUFDLENBQUMsQ0FBQTtBQUN0SG9CLFFBQUFBLElBQUksQ0FBQ0UsTUFBTSxDQUFDLDRCQUE0QixDQUFDLENBQUE7QUFDN0MsT0FBQTs7QUFFQTtBQUNBLE1BQUEsSUFBSzVCLFNBQVMsQ0FBQ2tELFFBQVEsSUFBSTVJLE9BQU8sQ0FBQ2EsVUFBVSxDQUFDZ0ksV0FBVyxJQUFLbkQsU0FBUyxDQUFDb0QsV0FBVyxFQUFFO0FBQ2pGN0IsUUFBQUEsSUFBSSxDQUFDSyxNQUFNLENBQUMsb0JBQW9CLENBQUMsQ0FBQTtBQUNqQ0wsUUFBQUEsSUFBSSxDQUFDSyxNQUFNLENBQUMsb0JBQW9CLENBQUMsQ0FBQTtBQUNqQyxRQUFBLElBQUl0SCxPQUFPLENBQUNhLFVBQVUsQ0FBQ2tJLFFBQVEsRUFBRTtBQUM3QjlCLFVBQUFBLElBQUksQ0FBQ0ssTUFBTSxDQUFDLG9CQUFvQixDQUFDLENBQUE7VUFDakNILElBQUksQ0FBQ0csTUFBTSxDQUFDLElBQUksQ0FBQ3pFLE9BQU8sQ0FBQyxPQUFPLEVBQUUsU0FBUyxFQUFFN0MsT0FBTyxFQUFFMEYsU0FBUyxDQUFDL0UsTUFBTSxFQUFFcUYsY0FBYyxFQUFFaEcsT0FBTyxDQUFDZ0osYUFBYSxDQUFDLENBQUMsQ0FBQTtBQUMvRzVCLFVBQUFBLElBQUksQ0FBQ0UsTUFBTSxDQUFDLGFBQWEsQ0FBQyxDQUFBO0FBRTFCTCxVQUFBQSxJQUFJLENBQUNLLE1BQU0sQ0FBQyxvQkFBb0IsQ0FBQyxDQUFBO0FBQ2pDSCxVQUFBQSxJQUFJLENBQUNHLE1BQU0sQ0FBQyxJQUFJLENBQUN6RSxPQUFPLENBQUMsWUFBWSxFQUFFLGNBQWMsRUFBRTdDLE9BQU8sRUFBRTBGLFNBQVMsQ0FBQy9FLE1BQU0sRUFBRXFGLGNBQWMsQ0FBQyxDQUFDLENBQUE7QUFDbEdvQixVQUFBQSxJQUFJLENBQUNFLE1BQU0sQ0FBQyx1QkFBdUIsQ0FBQyxDQUFBO0FBQ3hDLFNBQUE7QUFDQSxRQUFBLElBQUl0SCxPQUFPLENBQUNhLFVBQVUsQ0FBQ29JLFlBQVksRUFBRTtBQUNqQ2hDLFVBQUFBLElBQUksQ0FBQ0ssTUFBTSxDQUFDLG1CQUFtQixDQUFDLENBQUE7QUFDaENILFVBQUFBLElBQUksQ0FBQ0csTUFBTSxDQUFDLElBQUksQ0FBQ3pFLE9BQU8sQ0FBQyxXQUFXLEVBQUUsYUFBYSxFQUFFN0MsT0FBTyxFQUFFMEYsU0FBUyxDQUFDL0UsTUFBTSxFQUFFcUYsY0FBYyxDQUFDLENBQUMsQ0FBQTtBQUNoR29CLFVBQUFBLElBQUksQ0FBQ0UsTUFBTSxDQUFDLGlCQUFpQixDQUFDLENBQUE7QUFDbEMsU0FBQTtBQUNBLFFBQUEsSUFBSXRILE9BQU8sQ0FBQ2EsVUFBVSxDQUFDcUksb0JBQW9CLEVBQUU7QUFDekNqQyxVQUFBQSxJQUFJLENBQUNLLE1BQU0sQ0FBQywyQkFBMkIsQ0FBQyxDQUFBO0FBQ3hDSCxVQUFBQSxJQUFJLENBQUNHLE1BQU0sQ0FBQyxJQUFJLENBQUN6RSxPQUFPLENBQUMsbUJBQW1CLEVBQUUscUJBQXFCLEVBQUU3QyxPQUFPLEVBQUUwRixTQUFTLENBQUMvRSxNQUFNLEVBQUVxRixjQUFjLENBQUMsQ0FBQyxDQUFBO0FBQ2hIb0IsVUFBQUEsSUFBSSxDQUFDRSxNQUFNLENBQUMseUJBQXlCLENBQUMsQ0FBQTtBQUMxQyxTQUFBO0FBQ0EsUUFBQSxJQUFJdEgsT0FBTyxDQUFDYSxVQUFVLENBQUNzSSxnQkFBZ0IsRUFBRTtVQUNyQ2hDLElBQUksQ0FBQ0csTUFBTSxDQUFDLElBQUksQ0FBQ3pFLE9BQU8sQ0FBQyxVQUFVLEVBQUUsWUFBWSxFQUFFN0MsT0FBTyxFQUFFMEYsU0FBUyxDQUFDL0UsTUFBTSxFQUFFcUYsY0FBYyxFQUFFaEcsT0FBTyxDQUFDb0osZ0JBQWdCLENBQUMsQ0FBQyxDQUFBO0FBQzVILFNBQUMsTUFBTTtBQUNIakMsVUFBQUEsSUFBSSxDQUFDRyxNQUFNLENBQUMsbURBQW1ELENBQUMsQ0FBQTtBQUNwRSxTQUFBO0FBQ0FILFFBQUFBLElBQUksQ0FBQ0csTUFBTSxDQUFDLElBQUksQ0FBQ3pFLE9BQU8sQ0FBQyxPQUFPLEVBQUUsU0FBUyxFQUFFN0MsT0FBTyxFQUFFMEYsU0FBUyxDQUFDL0UsTUFBTSxFQUFFcUYsY0FBYyxDQUFDLENBQUMsQ0FBQTtBQUN4Rm9CLFFBQUFBLElBQUksQ0FBQ0UsTUFBTSxDQUFDLGtCQUFrQixDQUFDLENBQUE7QUFDL0JGLFFBQUFBLElBQUksQ0FBQ0UsTUFBTSxDQUFDLG1CQUFtQixDQUFDLENBQUE7QUFDcEMsT0FBQyxNQUFNO0FBQ0hMLFFBQUFBLElBQUksQ0FBQ0ssTUFBTSxDQUFDLGdDQUFnQyxDQUFDLENBQUE7QUFDN0NMLFFBQUFBLElBQUksQ0FBQ0ssTUFBTSxDQUFDLDBCQUEwQixDQUFDLENBQUE7QUFDM0MsT0FBQTs7QUFFQTtBQUNBLE1BQUEsSUFBSXRILE9BQU8sQ0FBQ3FKLEtBQUssSUFBSXJKLE9BQU8sQ0FBQ3NKLGFBQWEsRUFBRTtBQUN4Q3JDLFFBQUFBLElBQUksQ0FBQ0ssTUFBTSxDQUFDLFlBQVksQ0FBQyxDQUFBO0FBQ3pCSCxRQUFBQSxJQUFJLENBQUNHLE1BQU0sQ0FBQyxJQUFJLENBQUN6RSxPQUFPLENBQUMsSUFBSSxFQUFFLE1BQU0sRUFBRTdDLE9BQU8sRUFBRTBGLFNBQVMsQ0FBQy9FLE1BQU0sRUFBRXFGLGNBQWMsQ0FBQyxDQUFDLENBQUE7QUFDbEZvQixRQUFBQSxJQUFJLENBQUNFLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQTtBQUMzQixPQUFBOztBQUVBO0FBQ0FMLE1BQUFBLElBQUksQ0FBQ0ssTUFBTSxDQUFDLGlCQUFpQixDQUFDLENBQUE7TUFDOUJILElBQUksQ0FBQ0csTUFBTSxDQUFDLElBQUksQ0FBQ3pFLE9BQU8sQ0FBQyxVQUFVLEVBQUUsWUFBWSxFQUFFN0MsT0FBTyxFQUFFMEYsU0FBUyxDQUFDL0UsTUFBTSxFQUFFcUYsY0FBYyxFQUFFaEcsT0FBTyxDQUFDdUosZ0JBQWdCLENBQUMsQ0FBQyxDQUFBO0FBQ3hIbkMsTUFBQUEsSUFBSSxDQUFDRSxNQUFNLENBQUMsZ0JBQWdCLENBQUMsQ0FBQTs7QUFFN0I7QUFDQSxNQUFBLElBQUl0SCxPQUFPLENBQUNhLFVBQVUsQ0FBQzJJLFlBQVksRUFBRTtBQUNqQ3ZDLFFBQUFBLElBQUksQ0FBQ0ssTUFBTSxDQUFDLHNCQUFzQixDQUFDLENBQUE7QUFDbkNMLFFBQUFBLElBQUksQ0FBQ0ssTUFBTSxDQUFDLHFCQUFxQixDQUFDLENBQUE7QUFDbENMLFFBQUFBLElBQUksQ0FBQ0ssTUFBTSxDQUFDLGlCQUFpQixDQUFDLENBQUE7QUFFOUJILFFBQUFBLElBQUksQ0FBQ0csTUFBTSxDQUFDLElBQUksQ0FBQ3pFLE9BQU8sQ0FBQyxXQUFXLEVBQUUsYUFBYSxFQUFFN0MsT0FBTyxFQUFFMEYsU0FBUyxDQUFDL0UsTUFBTSxFQUFFcUYsY0FBYyxDQUFDLENBQUMsQ0FBQTtBQUNoR21CLFFBQUFBLElBQUksQ0FBQ0csTUFBTSxDQUFDLElBQUksQ0FBQ3pFLE9BQU8sQ0FBQyxnQkFBZ0IsRUFBRSxrQkFBa0IsRUFBRTdDLE9BQU8sRUFBRTBGLFNBQVMsQ0FBQy9FLE1BQU0sRUFBRXFGLGNBQWMsQ0FBQyxDQUFDLENBQUE7QUFDMUdtQixRQUFBQSxJQUFJLENBQUNHLE1BQU0sQ0FBQyxJQUFJLENBQUN6RSxPQUFPLENBQUMsaUJBQWlCLEVBQUUsbUJBQW1CLEVBQUU3QyxPQUFPLEVBQUUwRixTQUFTLENBQUMvRSxNQUFNLEVBQUVxRixjQUFjLENBQUMsQ0FBQyxDQUFBO0FBRTVHb0IsUUFBQUEsSUFBSSxDQUFDRSxNQUFNLENBQUMsaUJBQWlCLENBQUMsQ0FBQTtBQUM5QkYsUUFBQUEsSUFBSSxDQUFDRSxNQUFNLENBQUMsMkJBQTJCLENBQUMsQ0FBQTtBQUN4Q0YsUUFBQUEsSUFBSSxDQUFDRSxNQUFNLENBQUMsdUJBQXVCLENBQUMsQ0FBQTtBQUN4QyxPQUFBOztBQUVBO01BQ0EsSUFBSXRILE9BQU8sQ0FBQ2EsVUFBVSxDQUFDNEksZUFBZSxJQUFJekosT0FBTyxDQUFDMEosb0JBQW9CLEVBQUU7QUFDcEUsUUFBQSxNQUFNQyxXQUFXLEdBQUkzSixPQUFPLENBQUNhLFVBQVUsQ0FBQytJLGtCQUFrQixJQUFJNUosT0FBTyxDQUFDYSxVQUFVLENBQUNnSSxXQUFZLENBQUE7QUFDN0YsUUFBQSxNQUFNZ0IscUJBQXFCLEdBQUdGLFdBQVcsR0FBRyxlQUFlLEdBQUcsa0JBQWtCLENBQUE7QUFDaEYxQyxRQUFBQSxJQUFJLENBQUNLLE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQyxDQUFBO0FBQzlCLFFBQUEsSUFBSXFDLFdBQVcsRUFBRTtBQUNiMUMsVUFBQUEsSUFBSSxDQUFDSyxNQUFNLENBQUMsb0JBQW9CLENBQUMsQ0FBQTtBQUNyQyxTQUFBO1FBQ0FILElBQUksQ0FBQ0csTUFBTSxDQUFDLElBQUksQ0FBQ3pFLE9BQU8sQ0FBQyxPQUFPLEVBQUVnSCxxQkFBcUIsRUFBRTdKLE9BQU8sRUFBRTBGLFNBQVMsQ0FBQy9FLE1BQU0sRUFBRXFGLGNBQWMsRUFBRWhHLE9BQU8sQ0FBQzhKLGdCQUFnQixDQUFDLENBQUMsQ0FBQTtBQUM5SDFDLFFBQUFBLElBQUksQ0FBQ0UsTUFBTSxDQUFDLGdCQUFnQixDQUFDLENBQUE7QUFDakMsT0FBQTs7QUFFQTtBQUNBLE1BQUEsSUFBSUgsSUFBSSxDQUFDQSxJQUFJLENBQUMzQyxPQUFPLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQ3pDMkMsSUFBSSxDQUFDQSxJQUFJLENBQUMzQyxPQUFPLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQ3pDMkMsSUFBSSxDQUFDQSxJQUFJLENBQUMzQyxPQUFPLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUU7QUFDM0N1RixRQUFBQSxLQUFLLENBQUNDLFVBQVUsQ0FBQyxxR0FBcUcsQ0FBQyxDQUFBO1FBQ3ZIN0MsSUFBSSxDQUFDOEMsT0FBTyxDQUFDdkUsU0FBUyxDQUFDL0UsTUFBTSxDQUFDdUosZUFBZSxDQUFDLENBQUE7QUFDbEQsT0FBQTtBQUVKLEtBQUMsTUFBTTtBQUNIO0FBQ0EsTUFBQSxJQUFJbEssT0FBTyxDQUFDYSxVQUFVLENBQUM0RyxTQUFTLEVBQUU7QUFDOUJSLFFBQUFBLElBQUksQ0FBQ0ssTUFBTSxDQUFDLGVBQWUsQ0FBQyxDQUFBO0FBQzVCSCxRQUFBQSxJQUFJLENBQUNHLE1BQU0sQ0FBQyxJQUFJLENBQUN6RSxPQUFPLENBQUMsU0FBUyxFQUFFLFdBQVcsRUFBRTdDLE9BQU8sRUFBRTBGLFNBQVMsQ0FBQy9FLE1BQU0sRUFBRXFGLGNBQWMsQ0FBQyxDQUFDLENBQUE7UUFDNUZtQixJQUFJLENBQUNHLE1BQU0sQ0FBQzVCLFNBQVMsQ0FBQy9FLE1BQU0sQ0FBQ2dILFdBQVcsQ0FBQyxDQUFBO0FBQ3pDUCxRQUFBQSxJQUFJLENBQUNFLE1BQU0sQ0FBQyxlQUFlLENBQUMsQ0FBQTtBQUM1QkYsUUFBQUEsSUFBSSxDQUFDRSxNQUFNLENBQUMsb0JBQW9CLENBQUMsQ0FBQTtBQUNyQyxPQUFBO0FBQ0osS0FBQTtBQUVBLElBQUEsS0FBSyxNQUFNNkMsT0FBTyxJQUFJbkUsY0FBYyxFQUFFO01BQ2xDaUIsSUFBSSxDQUFDSyxNQUFNLENBQUUsQ0FBQSxrQkFBQSxFQUFvQnRCLGNBQWMsQ0FBQ21FLE9BQU8sQ0FBRSxDQUFBLENBQUEsQ0FBRSxDQUFDLENBQUE7QUFDaEUsS0FBQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7SUFDQS9DLElBQUksQ0FBQ0QsSUFBSSxHQUFJLENBQUlDLEVBQUFBLEVBQUFBLElBQUksQ0FBQ0QsSUFBSSxDQUFDaUQsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDekgsR0FBRyxDQUFDMEgsQ0FBQyxJQUFLLENBQUEsSUFBQSxFQUFNQSxDQUFFLENBQUEsQ0FBQyxDQUFDLENBQUNDLElBQUksQ0FBQyxJQUFJLENBQUUsQ0FBSyxJQUFBLENBQUEsQ0FBQTtBQUU1RTVFLElBQUFBLFNBQVMsQ0FBQzZFLHNCQUFzQixDQUFDdEQsSUFBSSxDQUFDRSxJQUFJLEVBQUVBLElBQUksQ0FBQ0EsSUFBSSxFQUFFQyxJQUFJLENBQUNELElBQUksRUFBRUUsVUFBVSxDQUFDLENBQUE7SUFFN0UsT0FBTzNCLFNBQVMsQ0FBQzhFLGFBQWEsRUFBRSxDQUFBO0FBQ3BDLEdBQUE7QUFDSjs7OzsifQ==
