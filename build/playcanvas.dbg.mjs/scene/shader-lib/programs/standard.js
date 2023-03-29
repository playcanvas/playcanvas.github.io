/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
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
  /**
   * @param {import('../../../platform/graphics/graphics-device.js').GraphicsDevice} device - The
   * graphics device.
   * @param {StandardMaterialOptions} options - The create options.
   * @returns {object} Returns the created shader definition.
   * @ignore
   */
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
    const args = new ChunkBuilder();
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
        args.append("_litShaderArgs.opacity = dAlpha;");
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
        args.append("_litShaderArgs.worldNormal = dNormalW;");
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
      args.append("_litShaderArgs.albedo = dAlbedo;");
      if (options.litOptions.useRefraction) {
        decl.append("float dTransmission;");
        code.append(this._addMap("refraction", "transmissionPS", options, litShader.chunks, textureMapping));
        func.append("getRefraction();");
        args.append("_litShaderArgs.transmission = dTransmission;");
        decl.append("float dThickness;");
        code.append(this._addMap("thickness", "thicknessPS", options, litShader.chunks, textureMapping));
        func.append("getThickness();");
        args.append("_litShaderArgs.thickness = dThickness;");
      }
      if (options.litOptions.useIridescence) {
        decl.append("float dIridescence;");
        code.append(this._addMap("iridescence", "iridescencePS", options, litShader.chunks, textureMapping));
        func.append("getIridescence();");
        args.append("_litShaderArgs.iridescence.intensity = dIridescence;");
        decl.append("float dIridescenceThickness;");
        code.append(this._addMap("iridescenceThickness", "iridescenceThicknessPS", options, litShader.chunks, textureMapping));
        func.append("getIridescenceThickness();");
        args.append("_litShaderArgs.iridescence.thickness = dIridescenceThickness;");
      }

      // specularity & glossiness
      if (litShader.lighting && options.litOptions.useSpecular || litShader.reflections) {
        decl.append("vec3 dSpecularity;");
        decl.append("float dGlossiness;");
        if (options.litOptions.useSheen) {
          decl.append("vec3 sSpecularity;");
          code.append(this._addMap("sheen", "sheenPS", options, litShader.chunks, textureMapping, options.sheenEncoding));
          func.append("getSheen();");
          args.append("_litShaderArgs.sheen.specularity = sSpecularity;");
          decl.append("float sGlossiness;");
          code.append(this._addMap("sheenGloss", "sheenGlossPS", options, litShader.chunks, textureMapping));
          func.append("getSheenGlossiness();");
          args.append("_litShaderArgs.sheen.gloss = sGlossiness;");
        }
        if (options.litOptions.useMetalness) {
          decl.append("float dMetalness;");
          code.append(this._addMap("metalness", "metalnessPS", options, litShader.chunks, textureMapping));
          func.append("getMetalness();");
          args.append("_litShaderArgs.metalness = dMetalness;");
        }
        if (options.litOptions.useSpecularityFactor) {
          decl.append("float dSpecularityFactor;");
          code.append(this._addMap("specularityFactor", "specularityFactorPS", options, litShader.chunks, textureMapping));
          func.append("getSpecularityFactor();");
          args.append("_litShaderArgs.specularityFactor = dSpecularityFactor;");
        }
        if (options.litOptions.useSpecularColor) {
          code.append(this._addMap("specular", "specularPS", options, litShader.chunks, textureMapping, options.specularEncoding));
        } else {
          code.append("void getSpecularity() { dSpecularity = vec3(1); }");
        }
        code.append(this._addMap("gloss", "glossPS", options, litShader.chunks, textureMapping));
        func.append("getGlossiness();");
        func.append("getSpecularity();");
        args.append("_litShaderArgs.specularity = dSpecularity;");
        args.append("_litShaderArgs.gloss = dGlossiness;");
      } else {
        decl.append("vec3 dSpecularity = vec3(0.0);");
        decl.append("float dGlossiness = 0.0;");
      }

      // ao
      if (options.aoMap || options.aoVertexColor) {
        decl.append("float dAo;");
        code.append(this._addMap("ao", "aoPS", options, litShader.chunks, textureMapping));
        func.append("getAO();");
        args.append("_litShaderArgs.ao = dAo;");
      }

      // emission
      decl.append("vec3 dEmission;");
      code.append(this._addMap("emissive", "emissivePS", options, litShader.chunks, textureMapping, options.emissiveEncoding));
      func.append("getEmission();");
      args.append("_litShaderArgs.emission = dEmission;");

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
        args.append("_litShaderArgs.clearcoat.specularity = ccSpecularity;");
        args.append("_litShaderArgs.clearcoat.gloss = ccGlossiness;");
        args.append("_litShaderArgs.clearcoat.worldNormal = ccNormalW;");
      }

      // lightmap
      if (options.lightMap || options.lightVertexColor) {
        const lightmapDir = options.dirLightMap && options.litOptions.useSpecular;
        const lightmapChunkPropName = lightmapDir ? 'lightmapDirPS' : 'lightmapSinglePS';
        decl.append("vec3 dLightmap;");
        if (lightmapDir) {
          decl.append("vec3 dLightmapDir;");
        }
        code.append(this._addMap("light", lightmapChunkPropName, options, litShader.chunks, textureMapping, options.lightMapEncoding));
        func.append("getLightMap();");
        args.append("_litShaderArgs.lightmap = dLightmap;");
        if (lightmapDir) {
          args.append("_litShaderArgs.lightmapDir = dLightmapDir;");
        }
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
        args.append("_litShaderArgs.opacity = dAlpha;");
      }
    }
    decl.append(litShader.chunks.litShaderArgsPS);
    code.append(`LitShaderArguments evaluateFrontend() { LitShaderArguments _litShaderArgs; \n${func.code}\n${args.code}\n return _litShaderArgs;\n }\n`);
    func.code = `LitShaderArguments litShaderArgs = evaluateFrontend();`;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhbmRhcmQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL3Byb2dyYW1zL3N0YW5kYXJkLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGhhc2hDb2RlIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9oYXNoLmpzJztcbmltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbmltcG9ydCB7XG4gICAgQkxFTkRfTk9ORSwgRlJFU05FTF9TQ0hMSUNLLCBMSUdIVFRZUEVfRElSRUNUSU9OQUwsXG4gICAgU1BFQ1VMQVJfUEhPTkcsXG4gICAgU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VELCBTUFJJVEVfUkVOREVSTU9ERV9USUxFRFxufSBmcm9tICcuLi8uLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgU2hhZGVyUGFzcyB9IGZyb20gJy4uLy4uL3NoYWRlci1wYXNzLmpzJztcbmltcG9ydCB7IExpdFNoYWRlciB9IGZyb20gJy4vbGl0LXNoYWRlci5qcyc7XG5pbXBvcnQgeyBDaHVua0J1aWxkZXIgfSBmcm9tICcuLi9jaHVuay1idWlsZGVyLmpzJztcbmltcG9ydCB7IENodW5rVXRpbHMgfSBmcm9tICcuLi9jaHVuay11dGlscy5qcyc7XG5pbXBvcnQgeyBTdGFuZGFyZE1hdGVyaWFsT3B0aW9ucyB9IGZyb20gJy4uLy4uL21hdGVyaWFscy9zdGFuZGFyZC1tYXRlcmlhbC1vcHRpb25zLmpzJztcblxuY29uc3QgX21hdFRleDJEID0gW107XG5cbmNvbnN0IHN0YW5kYXJkID0ge1xuICAgIC8vIFNoYXJlZCBTdGFuZGFyZCBNYXRlcmlhbCBvcHRpb24gc3RydWN0dXJlc1xuICAgIG9wdGlvbnNDb250ZXh0OiBuZXcgU3RhbmRhcmRNYXRlcmlhbE9wdGlvbnMoKSxcbiAgICBvcHRpb25zQ29udGV4dE1pbjogbmV3IFN0YW5kYXJkTWF0ZXJpYWxPcHRpb25zKCksXG5cbiAgICAvKiogQHR5cGUgeyBGdW5jdGlvbiB9ICovXG4gICAgZ2VuZXJhdGVLZXk6IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IGJ1aWxkUHJvcGVydGllc0xpc3QgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICAgICAgY29uc3QgcHJvcHMgPSBbXTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgcHJvcCBpbiBvcHRpb25zKSB7XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMuaGFzT3duUHJvcGVydHkocHJvcCkgJiYgcHJvcCAhPT0gXCJjaHVua3NcIiAmJiBwcm9wICE9PSBcImxpZ2h0c1wiKVxuICAgICAgICAgICAgICAgICAgICBwcm9wcy5wdXNoKHByb3ApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHByb3BzLnNvcnQoKTtcbiAgICAgICAgfTtcbiAgICAgICAgbGV0IHByb3BzO1xuICAgICAgICBpZiAob3B0aW9ucyA9PT0gdGhpcy5vcHRpb25zQ29udGV4dE1pbikge1xuICAgICAgICAgICAgaWYgKCF0aGlzLnByb3BzTWluKSB0aGlzLnByb3BzTWluID0gYnVpbGRQcm9wZXJ0aWVzTGlzdChvcHRpb25zKTtcbiAgICAgICAgICAgIHByb3BzID0gdGhpcy5wcm9wc01pbjtcbiAgICAgICAgfSBlbHNlIGlmIChvcHRpb25zID09PSB0aGlzLm9wdGlvbnNDb250ZXh0KSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMucHJvcHMpIHRoaXMucHJvcHMgPSBidWlsZFByb3BlcnRpZXNMaXN0KG9wdGlvbnMpO1xuICAgICAgICAgICAgcHJvcHMgPSB0aGlzLnByb3BzO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcHJvcHMgPSBidWlsZFByb3BlcnRpZXNMaXN0KG9wdGlvbnMpO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGtleSA9IFwic3RhbmRhcmRcIjtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHByb3BzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAob3B0aW9uc1twcm9wc1tpXV0pXG4gICAgICAgICAgICAgICAga2V5ICs9IHByb3BzW2ldICsgb3B0aW9uc1twcm9wc1tpXV07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy5jaHVua3MpIHtcbiAgICAgICAgICAgIGNvbnN0IGNodW5rcyA9IFtdO1xuICAgICAgICAgICAgZm9yIChjb25zdCBwIGluIG9wdGlvbnMuY2h1bmtzKSB7XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMuY2h1bmtzLmhhc093blByb3BlcnR5KHApKSB7XG4gICAgICAgICAgICAgICAgICAgIGNodW5rcy5wdXNoKHAgKyBvcHRpb25zLmNodW5rc1twXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2h1bmtzLnNvcnQoKTtcbiAgICAgICAgICAgIGtleSArPSBjaHVua3M7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy5saXRPcHRpb25zKSB7XG5cbiAgICAgICAgICAgIGZvciAoY29uc3QgbSBpbiBvcHRpb25zLmxpdE9wdGlvbnMpIHtcblxuICAgICAgICAgICAgICAgIC8vIGhhbmRsZSBsaWdodHMgaW4gYSBjdXN0b20gd2F5XG4gICAgICAgICAgICAgICAgaWYgKG0gPT09ICdsaWdodHMnKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGlzQ2x1c3RlcmVkID0gb3B0aW9ucy5saXRPcHRpb25zLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZDtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBvcHRpb25zLmxpdE9wdGlvbnMubGlnaHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBsaWdodCA9IG9wdGlvbnMubGl0T3B0aW9ucy5saWdodHNbaV07XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWlzQ2x1c3RlcmVkIHx8IGxpZ2h0Ll90eXBlID09PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBrZXkgKz0gbGlnaHQua2V5O1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAga2V5ICs9IG0gKyBvcHRpb25zLmxpdE9wdGlvbnNbbV07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGhhc2hDb2RlKGtleSk7XG4gICAgfSxcblxuICAgIC8vIGdldCB0aGUgdmFsdWUgdG8gcmVwbGFjZSAkVVYgd2l0aCBpbiBNYXAgU2hhZGVyIGZ1bmN0aW9uc1xuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBjb2RlIHdpdGggd2hpY2ggdG8gdG8gcmVwbGFjZSAnJFVWJyBpbiB0aGUgbWFwIHNoYWRlciBmdW5jdGlvbnMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdHJhbnNmb3JtUHJvcE5hbWUgLSBOYW1lIG9mIHRoZSB0cmFuc2Zvcm0gaWQgaW4gdGhlIG9wdGlvbnMgYmxvY2suIFVzdWFsbHkgXCJiYXNlbmFtZVRyYW5zZm9ybVwiLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB1VlByb3BOYW1lIC0gTmFtZSBvZiB0aGUgVVYgY2hhbm5lbCBpbiB0aGUgb3B0aW9ucyBibG9jay4gVXN1YWxseSBcImJhc2VuYW1lVXZcIi5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gb3B0aW9ucyAtIFRoZSBvcHRpb25zIHBhc3NlZCBpbnRvIGNyZWF0ZVNoYWRlckRlZmluaXRpb24uXG4gICAgICogQHJldHVybnMge3N0cmluZ30gVGhlIGNvZGUgdXNlZCB0byByZXBsYWNlIFwiJFVWXCIgaW4gdGhlIHNoYWRlciBjb2RlLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2dldFV2U291cmNlRXhwcmVzc2lvbjogZnVuY3Rpb24gKHRyYW5zZm9ybVByb3BOYW1lLCB1VlByb3BOYW1lLCBvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IHRyYW5zZm9ybUlkID0gb3B0aW9uc1t0cmFuc2Zvcm1Qcm9wTmFtZV07XG4gICAgICAgIGNvbnN0IHV2Q2hhbm5lbCA9IG9wdGlvbnNbdVZQcm9wTmFtZV07XG4gICAgICAgIGNvbnN0IGlzTWFpblBhc3MgPSBTaGFkZXJQYXNzLmlzRm9yd2FyZChvcHRpb25zLnBhc3MpO1xuXG4gICAgICAgIGxldCBleHByZXNzaW9uO1xuICAgICAgICBpZiAoaXNNYWluUGFzcyAmJiBvcHRpb25zLmxpdE9wdGlvbnMubmluZVNsaWNlZE1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1NMSUNFRCkge1xuICAgICAgICAgICAgZXhwcmVzc2lvbiA9IFwibmluZVNsaWNlZFV2XCI7XG4gICAgICAgIH0gZWxzZSBpZiAoaXNNYWluUGFzcyAmJiBvcHRpb25zLmxpdE9wdGlvbnMubmluZVNsaWNlZE1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1RJTEVEKSB7XG4gICAgICAgICAgICBleHByZXNzaW9uID0gXCJuaW5lU2xpY2VkVXZcIjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmICh0cmFuc2Zvcm1JZCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIGV4cHJlc3Npb24gPSBcInZVdlwiICsgdXZDaGFubmVsO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBub3RlOiBkaWZmZXJlbnQgY2FwaXRhbGl6YXRpb24hXG4gICAgICAgICAgICAgICAgZXhwcmVzc2lvbiA9IFwidlVWXCIgKyB1dkNoYW5uZWwgKyBcIl9cIiArIHRyYW5zZm9ybUlkO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBpZiBoZWlnaHRtYXAgaXMgZW5hYmxlZCBhbGwgbWFwcyBleGNlcHQgdGhlIGhlaWdodG1hcCBhcmUgb2Zmc2V0XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5oZWlnaHRNYXAgJiYgdHJhbnNmb3JtUHJvcE5hbWUgIT09IFwiaGVpZ2h0TWFwVHJhbnNmb3JtXCIpIHtcbiAgICAgICAgICAgICAgICBleHByZXNzaW9uICs9IFwiICsgZFV2T2Zmc2V0XCI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZXhwcmVzc2lvbjtcbiAgICB9LFxuXG4gICAgX2FkZE1hcERlZjogZnVuY3Rpb24gKG5hbWUsIGVuYWJsZWQpIHtcbiAgICAgICAgcmV0dXJuIGVuYWJsZWQgPyBgI2RlZmluZSAke25hbWV9XFxuYCA6IGAjdW5kZWYgJHtuYW1lfVxcbmA7XG4gICAgfSxcblxuICAgIF9hZGRNYXBEZWZzOiBmdW5jdGlvbiAoZmxvYXQsIGNvbG9yLCB2ZXJ0ZXgsIG1hcCwgaW52ZXJ0KSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hZGRNYXBEZWYoXCJNQVBGTE9BVFwiLCBmbG9hdCkgK1xuICAgICAgICAgICAgICAgdGhpcy5fYWRkTWFwRGVmKFwiTUFQQ09MT1JcIiwgY29sb3IpICtcbiAgICAgICAgICAgICAgIHRoaXMuX2FkZE1hcERlZihcIk1BUFZFUlRFWFwiLCB2ZXJ0ZXgpICtcbiAgICAgICAgICAgICAgIHRoaXMuX2FkZE1hcERlZihcIk1BUFRFWFRVUkVcIiwgbWFwKSArXG4gICAgICAgICAgICAgICB0aGlzLl9hZGRNYXBEZWYoXCJNQVBJTlZFUlRcIiwgaW52ZXJ0KTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQWRkIGNodW5rIGZvciBNYXAgVHlwZXMgKHVzZWQgZm9yIGFsbCBtYXBzIGV4Y2VwdCBOb3JtYWwpLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHByb3BOYW1lIC0gVGhlIGJhc2UgbmFtZSBvZiB0aGUgbWFwOiBkaWZmdXNlIHwgZW1pc3NpdmUgfCBvcGFjaXR5IHwgbGlnaHQgfCBoZWlnaHQgfCBtZXRhbG5lc3MgfCBzcGVjdWxhciB8IGdsb3NzIHwgYW8uXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGNodW5rTmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBjaHVuayB0byB1c2UuIFVzdWFsbHkgXCJiYXNlbmFtZVBTXCIuXG4gICAgICogQHBhcmFtIHtvYmplY3R9IG9wdGlvbnMgLSBUaGUgb3B0aW9ucyBwYXNzZWQgaW50byB0byBjcmVhdGVTaGFkZXJEZWZpbml0aW9uLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBjaHVua3MgLSBUaGUgc2V0IG9mIHNoYWRlciBjaHVua3MgdG8gY2hvb3NlIGZyb20uXG4gICAgICogQHBhcmFtIHtvYmplY3R9IG1hcHBpbmcgLSBUaGUgbWFwcGluZyBiZXR3ZWVuIGNodW5rIGFuZCBzYW1wbGVyXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGVuY29kaW5nIC0gVGhlIHRleHR1cmUncyBlbmNvZGluZ1xuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IFRoZSBzaGFkZXIgY29kZSB0byBzdXBwb3J0IHRoaXMgbWFwLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2FkZE1hcDogZnVuY3Rpb24gKHByb3BOYW1lLCBjaHVua05hbWUsIG9wdGlvbnMsIGNodW5rcywgbWFwcGluZywgZW5jb2RpbmcgPSBudWxsKSB7XG4gICAgICAgIGNvbnN0IG1hcFByb3BOYW1lID0gcHJvcE5hbWUgKyBcIk1hcFwiO1xuICAgICAgICBjb25zdCB1VlByb3BOYW1lID0gbWFwUHJvcE5hbWUgKyBcIlV2XCI7XG4gICAgICAgIGNvbnN0IGlkZW50aWZpZXJQcm9wTmFtZSA9IG1hcFByb3BOYW1lICsgXCJJZGVudGlmaWVyXCI7XG4gICAgICAgIGNvbnN0IHRyYW5zZm9ybVByb3BOYW1lID0gbWFwUHJvcE5hbWUgKyBcIlRyYW5zZm9ybVwiO1xuICAgICAgICBjb25zdCBjaGFubmVsUHJvcE5hbWUgPSBtYXBQcm9wTmFtZSArIFwiQ2hhbm5lbFwiO1xuICAgICAgICBjb25zdCB2ZXJ0ZXhDb2xvckNoYW5uZWxQcm9wTmFtZSA9IHByb3BOYW1lICsgXCJWZXJ0ZXhDb2xvckNoYW5uZWxcIjtcbiAgICAgICAgY29uc3QgdGludFByb3BOYW1lID0gcHJvcE5hbWUgKyBcIlRpbnRcIjtcbiAgICAgICAgY29uc3QgdmVydGV4Q29sb3JQcm9wTmFtZSA9IHByb3BOYW1lICsgXCJWZXJ0ZXhDb2xvclwiO1xuICAgICAgICBjb25zdCBkZXRhaWxNb2RlUHJvcE5hbWUgPSBwcm9wTmFtZSArIFwiTW9kZVwiO1xuICAgICAgICBjb25zdCBpbnZlcnROYW1lID0gcHJvcE5hbWUgKyBcIkludmVydFwiO1xuXG4gICAgICAgIGNvbnN0IHRpbnRPcHRpb24gPSBvcHRpb25zW3RpbnRQcm9wTmFtZV07XG4gICAgICAgIGNvbnN0IHZlcnRleENvbG9yT3B0aW9uID0gb3B0aW9uc1t2ZXJ0ZXhDb2xvclByb3BOYW1lXTtcbiAgICAgICAgY29uc3QgdGV4dHVyZU9wdGlvbiA9IG9wdGlvbnNbbWFwUHJvcE5hbWVdO1xuICAgICAgICBjb25zdCB0ZXh0dXJlSWRlbnRpZmllciA9IG9wdGlvbnNbaWRlbnRpZmllclByb3BOYW1lXTtcbiAgICAgICAgY29uc3QgZGV0YWlsTW9kZU9wdGlvbiA9IG9wdGlvbnNbZGV0YWlsTW9kZVByb3BOYW1lXTtcblxuICAgICAgICBsZXQgc3ViQ29kZSA9IGNodW5rc1tjaHVua05hbWVdO1xuXG4gICAgICAgIGlmICh0ZXh0dXJlT3B0aW9uKSB7XG4gICAgICAgICAgICBjb25zdCB1diA9IHRoaXMuX2dldFV2U291cmNlRXhwcmVzc2lvbih0cmFuc2Zvcm1Qcm9wTmFtZSwgdVZQcm9wTmFtZSwgb3B0aW9ucyk7XG5cbiAgICAgICAgICAgIHN1YkNvZGUgPSBzdWJDb2RlLnJlcGxhY2UoL1xcJFVWL2csIHV2KS5yZXBsYWNlKC9cXCRDSC9nLCBvcHRpb25zW2NoYW5uZWxQcm9wTmFtZV0pO1xuXG4gICAgICAgICAgICBpZiAobWFwcGluZyAmJiBzdWJDb2RlLnNlYXJjaCgvXFwkU0FNUExFUi9nKSAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICBsZXQgc2FtcGxlck5hbWUgPSBcInRleHR1cmVfXCIgKyBtYXBQcm9wTmFtZTtcbiAgICAgICAgICAgICAgICBjb25zdCBhbGlhcyA9IG1hcHBpbmdbdGV4dHVyZUlkZW50aWZpZXJdO1xuICAgICAgICAgICAgICAgIGlmIChhbGlhcykge1xuICAgICAgICAgICAgICAgICAgICBzYW1wbGVyTmFtZSA9IGFsaWFzO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIG1hcHBpbmdbdGV4dHVyZUlkZW50aWZpZXJdID0gc2FtcGxlck5hbWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHN1YkNvZGUgPSBzdWJDb2RlLnJlcGxhY2UoL1xcJFNBTVBMRVIvZywgc2FtcGxlck5hbWUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoZW5jb2RpbmcpIHtcbiAgICAgICAgICAgICAgICBpZiAob3B0aW9uc1tjaGFubmVsUHJvcE5hbWVdID09PSAnYWFhJykge1xuICAgICAgICAgICAgICAgICAgICAvLyBjb21wbGV0ZWx5IHNraXAgZGVjb2RpbmcgaWYgdGhlIHVzZXIgaGFzIHNlbGVjdGVkIHRoZSBhbHBoYSBjaGFubmVsIChzaW5jZSBhbHBoYVxuICAgICAgICAgICAgICAgICAgICAvLyBpcyBuZXZlciBkZWNvZGVkKS5cbiAgICAgICAgICAgICAgICAgICAgc3ViQ29kZSA9IHN1YkNvZGUucmVwbGFjZSgvXFwkREVDT0RFL2csICdwYXNzVGhyb3VnaCcpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHN1YkNvZGUgPSBzdWJDb2RlLnJlcGxhY2UoL1xcJERFQ09ERS9nLCBDaHVua1V0aWxzLmRlY29kZUZ1bmMoKCFvcHRpb25zLmxpdE9wdGlvbnMuZ2FtbWEgJiYgZW5jb2RpbmcgPT09ICdzcmdiJykgPyAnbGluZWFyJyA6IGVuY29kaW5nKSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gY29udGludWUgdG8gc3VwcG9ydCAkdGV4dHVyZTJEU0FNUExFXG4gICAgICAgICAgICAgICAgaWYgKHN1YkNvZGUuaW5kZXhPZignJHRleHR1cmUyRFNBTVBMRScpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGRlY29kZVRhYmxlID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGluZWFyOiAndGV4dHVyZTJEJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNyZ2I6ICd0ZXh0dXJlMkRTUkdCJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJnYm06ICd0ZXh0dXJlMkRSR0JNJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJnYmU6ICd0ZXh0dXJlMkRSR0JFJ1xuICAgICAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgICAgIHN1YkNvZGUgPSBzdWJDb2RlLnJlcGxhY2UoL1xcJHRleHR1cmUyRFNBTVBMRS9nLCBkZWNvZGVUYWJsZVtlbmNvZGluZ10gfHwgJ3RleHR1cmUyRCcpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh2ZXJ0ZXhDb2xvck9wdGlvbikge1xuICAgICAgICAgICAgc3ViQ29kZSA9IHN1YkNvZGUucmVwbGFjZSgvXFwkVkMvZywgb3B0aW9uc1t2ZXJ0ZXhDb2xvckNoYW5uZWxQcm9wTmFtZV0pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGRldGFpbE1vZGVPcHRpb24pIHtcbiAgICAgICAgICAgIHN1YkNvZGUgPSBzdWJDb2RlLnJlcGxhY2UoL1xcJERFVEFJTE1PREUvZywgZGV0YWlsTW9kZU9wdGlvbik7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBpc0Zsb2F0VGludCA9ICEhKHRpbnRPcHRpb24gJiAxKTtcbiAgICAgICAgY29uc3QgaXNWZWNUaW50ID0gISEodGludE9wdGlvbiAmIDIpO1xuICAgICAgICBjb25zdCBpbnZlcnRPcHRpb24gPSAhIShvcHRpb25zW2ludmVydE5hbWVdKTtcblxuICAgICAgICBzdWJDb2RlID0gdGhpcy5fYWRkTWFwRGVmcyhpc0Zsb2F0VGludCwgaXNWZWNUaW50LCB2ZXJ0ZXhDb2xvck9wdGlvbiwgdGV4dHVyZU9wdGlvbiwgaW52ZXJ0T3B0aW9uKSArIHN1YkNvZGU7XG4gICAgICAgIHJldHVybiBzdWJDb2RlLnJlcGxhY2UoL1xcJC9nLCBcIlwiKTtcbiAgICB9LFxuXG4gICAgX2NvcnJlY3RDaGFubmVsOiBmdW5jdGlvbiAocCwgY2hhbiwgX21hdFRleDJEKSB7XG4gICAgICAgIGlmIChfbWF0VGV4MkRbcF0gPiAwKSB7XG4gICAgICAgICAgICBpZiAoX21hdFRleDJEW3BdIDwgY2hhbi5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gY2hhbi5zdWJzdHJpbmcoMCwgX21hdFRleDJEW3BdKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoX21hdFRleDJEW3BdID4gY2hhbi5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBsZXQgc3RyID0gY2hhbjtcbiAgICAgICAgICAgICAgICBjb25zdCBjaHIgPSBzdHIuY2hhckF0KHN0ci5sZW5ndGggLSAxKTtcbiAgICAgICAgICAgICAgICBjb25zdCBhZGRMZW4gPSBfbWF0VGV4MkRbcF0gLSBzdHIubGVuZ3RoO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYWRkTGVuOyBpKyspIHN0ciArPSBjaHI7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHN0cjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBjaGFuO1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9ncmFwaGljcy1kZXZpY2UuanMnKS5HcmFwaGljc0RldmljZX0gZGV2aWNlIC0gVGhlXG4gICAgICogZ3JhcGhpY3MgZGV2aWNlLlxuICAgICAqIEBwYXJhbSB7U3RhbmRhcmRNYXRlcmlhbE9wdGlvbnN9IG9wdGlvbnMgLSBUaGUgY3JlYXRlIG9wdGlvbnMuXG4gICAgICogQHJldHVybnMge29iamVjdH0gUmV0dXJucyB0aGUgY3JlYXRlZCBzaGFkZXIgZGVmaW5pdGlvbi5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgY3JlYXRlU2hhZGVyRGVmaW5pdGlvbjogZnVuY3Rpb24gKGRldmljZSwgb3B0aW9ucykge1xuICAgICAgICBjb25zdCBsaXRTaGFkZXIgPSBuZXcgTGl0U2hhZGVyKGRldmljZSwgb3B0aW9ucy5saXRPcHRpb25zKTtcblxuICAgICAgICAvLyBnZW5lcmF0ZSB2ZXJ0ZXggc2hhZGVyXG4gICAgICAgIGNvbnN0IHVzZVV2ID0gW107XG4gICAgICAgIGNvbnN0IHVzZVVubW9kaWZpZWRVdiA9IFtdO1xuICAgICAgICBjb25zdCBtYXBUcmFuc2Zvcm1zID0gW107XG4gICAgICAgIGNvbnN0IG1heFV2U2V0cyA9IDI7XG4gICAgICAgIGNvbnN0IHRleHR1cmVNYXBwaW5nID0ge307XG5cbiAgICAgICAgZm9yIChjb25zdCBwIGluIF9tYXRUZXgyRCkge1xuICAgICAgICAgICAgY29uc3QgbW5hbWUgPSBwICsgXCJNYXBcIjtcblxuICAgICAgICAgICAgaWYgKG9wdGlvbnNbcCArIFwiVmVydGV4Q29sb3JcIl0pIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjbmFtZSA9IHAgKyBcIlZlcnRleENvbG9yQ2hhbm5lbFwiO1xuICAgICAgICAgICAgICAgIG9wdGlvbnNbY25hbWVdID0gdGhpcy5fY29ycmVjdENoYW5uZWwocCwgb3B0aW9uc1tjbmFtZV0sIF9tYXRUZXgyRCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zW21uYW1lXSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNuYW1lID0gbW5hbWUgKyBcIkNoYW5uZWxcIjtcbiAgICAgICAgICAgICAgICBjb25zdCB0bmFtZSA9IG1uYW1lICsgXCJUcmFuc2Zvcm1cIjtcbiAgICAgICAgICAgICAgICBjb25zdCB1bmFtZSA9IG1uYW1lICsgXCJVdlwiO1xuXG4gICAgICAgICAgICAgICAgb3B0aW9uc1t1bmFtZV0gPSBNYXRoLm1pbihvcHRpb25zW3VuYW1lXSwgbWF4VXZTZXRzIC0gMSk7XG4gICAgICAgICAgICAgICAgb3B0aW9uc1tjbmFtZV0gPSB0aGlzLl9jb3JyZWN0Q2hhbm5lbChwLCBvcHRpb25zW2NuYW1lXSwgX21hdFRleDJEKTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IHV2U2V0ID0gb3B0aW9uc1t1bmFtZV07XG4gICAgICAgICAgICAgICAgdXNlVXZbdXZTZXRdID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB1c2VVbm1vZGlmaWVkVXZbdXZTZXRdID0gdXNlVW5tb2RpZmllZFV2W3V2U2V0XSB8fCAob3B0aW9uc1ttbmFtZV0gJiYgIW9wdGlvbnNbdG5hbWVdKTtcblxuICAgICAgICAgICAgICAgIC8vIGNyZWF0ZSBtYXAgdHJhbnNmb3Jtc1xuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zW3RuYW1lXSkge1xuICAgICAgICAgICAgICAgICAgICBtYXBUcmFuc2Zvcm1zLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogcCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGlkOiBvcHRpb25zW3RuYW1lXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHV2OiBvcHRpb25zW3VuYW1lXVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy5mb3JjZVV2MSkge1xuICAgICAgICAgICAgdXNlVXZbMV0gPSB0cnVlO1xuICAgICAgICAgICAgdXNlVW5tb2RpZmllZFV2WzFdID0gKHVzZVVubW9kaWZpZWRVdlsxXSAhPT0gdW5kZWZpbmVkKSA/IHVzZVVubW9kaWZpZWRVdlsxXSA6IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBsaXRTaGFkZXIuZ2VuZXJhdGVWZXJ0ZXhTaGFkZXIodXNlVXYsIHVzZVVubW9kaWZpZWRVdiwgbWFwVHJhbnNmb3Jtcyk7XG5cbiAgICAgICAgLy8gaGFuZGxlIGZyYWdtZW50IHNoYWRlclxuICAgICAgICBpZiAob3B0aW9ucy5saXRPcHRpb25zLnNoYWRpbmdNb2RlbCA9PT0gU1BFQ1VMQVJfUEhPTkcpIHtcbiAgICAgICAgICAgIG9wdGlvbnMubGl0T3B0aW9ucy5mcmVzbmVsTW9kZWwgPSAwO1xuICAgICAgICAgICAgb3B0aW9ucy5saXRPcHRpb25zLmFtYmllbnRTSCA9IGZhbHNlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgb3B0aW9ucy5saXRPcHRpb25zLmZyZXNuZWxNb2RlbCA9IChvcHRpb25zLmxpdE9wdGlvbnMuZnJlc25lbE1vZGVsID09PSAwKSA/IEZSRVNORUxfU0NITElDSyA6IG9wdGlvbnMubGl0T3B0aW9ucy5mcmVzbmVsTW9kZWw7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBkZWNsID0gbmV3IENodW5rQnVpbGRlcigpO1xuICAgICAgICBjb25zdCBjb2RlID0gbmV3IENodW5rQnVpbGRlcigpO1xuICAgICAgICBjb25zdCBmdW5jID0gbmV3IENodW5rQnVpbGRlcigpO1xuICAgICAgICBjb25zdCBhcmdzID0gbmV3IENodW5rQnVpbGRlcigpO1xuICAgICAgICBsZXQgbGlnaHRpbmdVdiA9IFwiXCI7XG5cbiAgICAgICAgLy8gZ2xvYmFsIHRleHR1cmUgYmlhcyBmb3Igc3RhbmRhcmQgdGV4dHVyZXNcbiAgICAgICAgaWYgKG9wdGlvbnMubGl0T3B0aW9ucy5uaW5lU2xpY2VkTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfVElMRUQpIHtcbiAgICAgICAgICAgIGRlY2wuYXBwZW5kKGBjb25zdCBmbG9hdCB0ZXh0dXJlQmlhcyA9IC0xMDAwLjA7YCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkZWNsLmFwcGVuZChgdW5pZm9ybSBmbG9hdCB0ZXh0dXJlQmlhcztgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChTaGFkZXJQYXNzLmlzRm9yd2FyZChvcHRpb25zLnBhc3MpKSB7XG4gICAgICAgICAgICAvLyBwYXJhbGxheFxuICAgICAgICAgICAgaWYgKG9wdGlvbnMuaGVpZ2h0TWFwKSB7XG4gICAgICAgICAgICAgICAgLy8gaWYgKCFvcHRpb25zLm5vcm1hbE1hcCkge1xuICAgICAgICAgICAgICAgIC8vICAgICBjb25zdCB0cmFuc2Zvcm1lZEhlaWdodE1hcFV2ID0gdGhpcy5fZ2V0VXZTb3VyY2VFeHByZXNzaW9uKFwiaGVpZ2h0TWFwVHJhbnNmb3JtXCIsIFwiaGVpZ2h0TWFwVXZcIiwgb3B0aW9ucyk7XG4gICAgICAgICAgICAgICAgLy8gICAgIGlmICghb3B0aW9ucy5oYXNUYW5nZW50cykgdGJuID0gdGJuLnJlcGxhY2UoL1xcJFVWL2csIHRyYW5zZm9ybWVkSGVpZ2h0TWFwVXYpO1xuICAgICAgICAgICAgICAgIC8vICAgICBjb2RlICs9IHRibjtcbiAgICAgICAgICAgICAgICAvLyB9XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJ2ZWMyIGRVdk9mZnNldDtcIik7XG4gICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwiaGVpZ2h0XCIsIFwicGFyYWxsYXhQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZykpO1xuICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0UGFyYWxsYXgoKTtcIik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIG9wYWNpdHlcbiAgICAgICAgICAgIGlmIChvcHRpb25zLmxpdE9wdGlvbnMuYmxlbmRUeXBlICE9PSBCTEVORF9OT05FIHx8IG9wdGlvbnMubGl0T3B0aW9ucy5hbHBoYVRlc3QgfHwgb3B0aW9ucy5saXRPcHRpb25zLmFscGhhVG9Db3ZlcmFnZSkge1xuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwiZmxvYXQgZEFscGhhO1wiKTtcbiAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJvcGFjaXR5XCIsIFwib3BhY2l0eVBTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nKSk7XG4gICAgICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRPcGFjaXR5KCk7XCIpO1xuICAgICAgICAgICAgICAgIGFyZ3MuYXBwZW5kKFwiX2xpdFNoYWRlckFyZ3Mub3BhY2l0eSA9IGRBbHBoYTtcIik7XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMubGl0T3B0aW9ucy5hbHBoYVRlc3QpIHtcbiAgICAgICAgICAgICAgICAgICAgY29kZS5hcHBlbmQobGl0U2hhZGVyLmNodW5rcy5hbHBoYVRlc3RQUyk7XG4gICAgICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiYWxwaGFUZXN0KGRBbHBoYSk7XCIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJmbG9hdCBkQWxwaGEgPSAxLjA7XCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBub3JtYWxcbiAgICAgICAgICAgIGlmIChsaXRTaGFkZXIubmVlZHNOb3JtYWwpIHtcbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5ub3JtYWxNYXAgfHwgb3B0aW9ucy5jbGVhckNvYXROb3JtYWxNYXApIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gVE9ETzogbGV0IGVhY2ggbm9ybWFsbWFwIGlucHV0IChub3JtYWxNYXAsIG5vcm1hbERldGFpbE1hcCwgY2xlYXJDb2F0Tm9ybWFsTWFwKSBpbmRlcGVuZGVudGx5IGRlY2lkZSB3aGljaCB1bnBhY2tOb3JtYWwgdG8gdXNlLlxuICAgICAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZChvcHRpb25zLnBhY2tlZE5vcm1hbCA/IGxpdFNoYWRlci5jaHVua3Mubm9ybWFsWFlQUyA6IGxpdFNoYWRlci5jaHVua3Mubm9ybWFsWFlaUFMpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICghb3B0aW9ucy5saXRPcHRpb25zLmhhc1RhbmdlbnRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBUT0RPOiBnZW5lcmFsaXplIHRvIHN1cHBvcnQgZWFjaCBub3JtYWxtYXAgaW5wdXQgKG5vcm1hbE1hcCwgbm9ybWFsRGV0YWlsTWFwLCBjbGVhckNvYXROb3JtYWxNYXApIGluZGVwZW5kZW50bHlcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGJhc2VOYW1lID0gb3B0aW9ucy5ub3JtYWxNYXAgPyBcIm5vcm1hbE1hcFwiIDogXCJjbGVhckNvYXROb3JtYWxNYXBcIjtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpZ2h0aW5nVXYgPSB0aGlzLl9nZXRVdlNvdXJjZUV4cHJlc3Npb24oYCR7YmFzZU5hbWV9VHJhbnNmb3JtYCwgYCR7YmFzZU5hbWV9VXZgLCBvcHRpb25zKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwidmVjMyBkTm9ybWFsVztcIik7XG4gICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwibm9ybWFsRGV0YWlsXCIsIFwibm9ybWFsRGV0YWlsTWFwUFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcpKTtcbiAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJub3JtYWxcIiwgXCJub3JtYWxNYXBQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZykpO1xuICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0Tm9ybWFsKCk7XCIpO1xuICAgICAgICAgICAgICAgIGFyZ3MuYXBwZW5kKFwiX2xpdFNoYWRlckFyZ3Mud29ybGROb3JtYWwgPSBkTm9ybWFsVztcIik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChsaXRTaGFkZXIubmVlZHNTY2VuZUNvbG9yKSB7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJ1bmlmb3JtIHNhbXBsZXIyRCB1U2NlbmVDb2xvck1hcDtcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAobGl0U2hhZGVyLm5lZWRzU2NyZWVuU2l6ZSkge1xuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwidW5pZm9ybSB2ZWM0IHVTY3JlZW5TaXplO1wiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChsaXRTaGFkZXIubmVlZHNUcmFuc2Zvcm1zKSB7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJ1bmlmb3JtIG1hdDQgbWF0cml4X3ZpZXdQcm9qZWN0aW9uO1wiKTtcbiAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcInVuaWZvcm0gbWF0NCBtYXRyaXhfbW9kZWw7XCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBhbGJlZG9cbiAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwidmVjMyBkQWxiZWRvO1wiKTtcbiAgICAgICAgICAgIGlmIChvcHRpb25zLmRpZmZ1c2VEZXRhaWwpIHtcbiAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJkaWZmdXNlRGV0YWlsXCIsIFwiZGlmZnVzZURldGFpbE1hcFBTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nLCBvcHRpb25zLmRpZmZ1c2VEZXRhaWxFbmNvZGluZykpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwiZGlmZnVzZVwiLCBcImRpZmZ1c2VQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZywgb3B0aW9ucy5kaWZmdXNlRW5jb2RpbmcpKTtcbiAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0QWxiZWRvKCk7XCIpO1xuICAgICAgICAgICAgYXJncy5hcHBlbmQoXCJfbGl0U2hhZGVyQXJncy5hbGJlZG8gPSBkQWxiZWRvO1wiKTtcblxuICAgICAgICAgICAgaWYgKG9wdGlvbnMubGl0T3B0aW9ucy51c2VSZWZyYWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJmbG9hdCBkVHJhbnNtaXNzaW9uO1wiKTtcbiAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJyZWZyYWN0aW9uXCIsIFwidHJhbnNtaXNzaW9uUFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcpKTtcbiAgICAgICAgICAgICAgICBmdW5jLmFwcGVuZChcImdldFJlZnJhY3Rpb24oKTtcIik7XG4gICAgICAgICAgICAgICAgYXJncy5hcHBlbmQoXCJfbGl0U2hhZGVyQXJncy50cmFuc21pc3Npb24gPSBkVHJhbnNtaXNzaW9uO1wiKTtcblxuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwiZmxvYXQgZFRoaWNrbmVzcztcIik7XG4gICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwidGhpY2tuZXNzXCIsIFwidGhpY2tuZXNzUFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcpKTtcbiAgICAgICAgICAgICAgICBmdW5jLmFwcGVuZChcImdldFRoaWNrbmVzcygpO1wiKTtcbiAgICAgICAgICAgICAgICBhcmdzLmFwcGVuZChcIl9saXRTaGFkZXJBcmdzLnRoaWNrbmVzcyA9IGRUaGlja25lc3M7XCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAob3B0aW9ucy5saXRPcHRpb25zLnVzZUlyaWRlc2NlbmNlKSB7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJmbG9hdCBkSXJpZGVzY2VuY2U7XCIpO1xuICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcImlyaWRlc2NlbmNlXCIsIFwiaXJpZGVzY2VuY2VQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZykpO1xuICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0SXJpZGVzY2VuY2UoKTtcIik7XG4gICAgICAgICAgICAgICAgYXJncy5hcHBlbmQoXCJfbGl0U2hhZGVyQXJncy5pcmlkZXNjZW5jZS5pbnRlbnNpdHkgPSBkSXJpZGVzY2VuY2U7XCIpO1xuXG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJmbG9hdCBkSXJpZGVzY2VuY2VUaGlja25lc3M7XCIpO1xuICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcImlyaWRlc2NlbmNlVGhpY2tuZXNzXCIsIFwiaXJpZGVzY2VuY2VUaGlja25lc3NQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZykpO1xuICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0SXJpZGVzY2VuY2VUaGlja25lc3MoKTtcIik7XG4gICAgICAgICAgICAgICAgYXJncy5hcHBlbmQoXCJfbGl0U2hhZGVyQXJncy5pcmlkZXNjZW5jZS50aGlja25lc3MgPSBkSXJpZGVzY2VuY2VUaGlja25lc3M7XCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBzcGVjdWxhcml0eSAmIGdsb3NzaW5lc3NcbiAgICAgICAgICAgIGlmICgobGl0U2hhZGVyLmxpZ2h0aW5nICYmIG9wdGlvbnMubGl0T3B0aW9ucy51c2VTcGVjdWxhcikgfHwgbGl0U2hhZGVyLnJlZmxlY3Rpb25zKSB7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJ2ZWMzIGRTcGVjdWxhcml0eTtcIik7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJmbG9hdCBkR2xvc3NpbmVzcztcIik7XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMubGl0T3B0aW9ucy51c2VTaGVlbikge1xuICAgICAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcInZlYzMgc1NwZWN1bGFyaXR5O1wiKTtcbiAgICAgICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwic2hlZW5cIiwgXCJzaGVlblBTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nLCBvcHRpb25zLnNoZWVuRW5jb2RpbmcpKTtcbiAgICAgICAgICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRTaGVlbigpO1wiKTtcbiAgICAgICAgICAgICAgICAgICAgYXJncy5hcHBlbmQoXCJfbGl0U2hhZGVyQXJncy5zaGVlbi5zcGVjdWxhcml0eSA9IHNTcGVjdWxhcml0eTtcIik7XG5cbiAgICAgICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJmbG9hdCBzR2xvc3NpbmVzcztcIik7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcInNoZWVuR2xvc3NcIiwgXCJzaGVlbkdsb3NzUFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcpKTtcbiAgICAgICAgICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRTaGVlbkdsb3NzaW5lc3MoKTtcIik7XG4gICAgICAgICAgICAgICAgICAgIGFyZ3MuYXBwZW5kKFwiX2xpdFNoYWRlckFyZ3Muc2hlZW4uZ2xvc3MgPSBzR2xvc3NpbmVzcztcIik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLmxpdE9wdGlvbnMudXNlTWV0YWxuZXNzKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwiZmxvYXQgZE1ldGFsbmVzcztcIik7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcIm1ldGFsbmVzc1wiLCBcIm1ldGFsbmVzc1BTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nKSk7XG4gICAgICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0TWV0YWxuZXNzKCk7XCIpO1xuICAgICAgICAgICAgICAgICAgICBhcmdzLmFwcGVuZChcIl9saXRTaGFkZXJBcmdzLm1ldGFsbmVzcyA9IGRNZXRhbG5lc3M7XCIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5saXRPcHRpb25zLnVzZVNwZWN1bGFyaXR5RmFjdG9yKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwiZmxvYXQgZFNwZWN1bGFyaXR5RmFjdG9yO1wiKTtcbiAgICAgICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwic3BlY3VsYXJpdHlGYWN0b3JcIiwgXCJzcGVjdWxhcml0eUZhY3RvclBTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nKSk7XG4gICAgICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0U3BlY3VsYXJpdHlGYWN0b3IoKTtcIik7XG4gICAgICAgICAgICAgICAgICAgIGFyZ3MuYXBwZW5kKFwiX2xpdFNoYWRlckFyZ3Muc3BlY3VsYXJpdHlGYWN0b3IgPSBkU3BlY3VsYXJpdHlGYWN0b3I7XCIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5saXRPcHRpb25zLnVzZVNwZWN1bGFyQ29sb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwic3BlY3VsYXJcIiwgXCJzcGVjdWxhclBTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nLCBvcHRpb25zLnNwZWN1bGFyRW5jb2RpbmcpKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZChcInZvaWQgZ2V0U3BlY3VsYXJpdHkoKSB7IGRTcGVjdWxhcml0eSA9IHZlYzMoMSk7IH1cIik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcImdsb3NzXCIsIFwiZ2xvc3NQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZykpO1xuICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0R2xvc3NpbmVzcygpO1wiKTtcbiAgICAgICAgICAgICAgICBmdW5jLmFwcGVuZChcImdldFNwZWN1bGFyaXR5KCk7XCIpO1xuICAgICAgICAgICAgICAgIGFyZ3MuYXBwZW5kKFwiX2xpdFNoYWRlckFyZ3Muc3BlY3VsYXJpdHkgPSBkU3BlY3VsYXJpdHk7XCIpO1xuICAgICAgICAgICAgICAgIGFyZ3MuYXBwZW5kKFwiX2xpdFNoYWRlckFyZ3MuZ2xvc3MgPSBkR2xvc3NpbmVzcztcIik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwidmVjMyBkU3BlY3VsYXJpdHkgPSB2ZWMzKDAuMCk7XCIpO1xuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwiZmxvYXQgZEdsb3NzaW5lc3MgPSAwLjA7XCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBhb1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMuYW9NYXAgfHwgb3B0aW9ucy5hb1ZlcnRleENvbG9yKSB7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJmbG9hdCBkQW87XCIpO1xuICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcImFvXCIsIFwiYW9QU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZykpO1xuICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0QU8oKTtcIik7XG4gICAgICAgICAgICAgICAgYXJncy5hcHBlbmQoXCJfbGl0U2hhZGVyQXJncy5hbyA9IGRBbztcIik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGVtaXNzaW9uXG4gICAgICAgICAgICBkZWNsLmFwcGVuZChcInZlYzMgZEVtaXNzaW9uO1wiKTtcbiAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcImVtaXNzaXZlXCIsIFwiZW1pc3NpdmVQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZywgb3B0aW9ucy5lbWlzc2l2ZUVuY29kaW5nKSk7XG4gICAgICAgICAgICBmdW5jLmFwcGVuZChcImdldEVtaXNzaW9uKCk7XCIpO1xuICAgICAgICAgICAgYXJncy5hcHBlbmQoXCJfbGl0U2hhZGVyQXJncy5lbWlzc2lvbiA9IGRFbWlzc2lvbjtcIik7XG5cbiAgICAgICAgICAgIC8vIGNsZWFyY29hdFxuICAgICAgICAgICAgaWYgKG9wdGlvbnMubGl0T3B0aW9ucy51c2VDbGVhckNvYXQpIHtcbiAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcImZsb2F0IGNjU3BlY3VsYXJpdHk7XCIpO1xuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwiZmxvYXQgY2NHbG9zc2luZXNzO1wiKTtcbiAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcInZlYzMgY2NOb3JtYWxXO1wiKTtcblxuICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcImNsZWFyQ29hdFwiLCBcImNsZWFyQ29hdFBTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nKSk7XG4gICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwiY2xlYXJDb2F0R2xvc3NcIiwgXCJjbGVhckNvYXRHbG9zc1BTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nKSk7XG4gICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwiY2xlYXJDb2F0Tm9ybWFsXCIsIFwiY2xlYXJDb2F0Tm9ybWFsUFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcpKTtcblxuICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0Q2xlYXJDb2F0KCk7XCIpO1xuICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0Q2xlYXJDb2F0R2xvc3NpbmVzcygpO1wiKTtcbiAgICAgICAgICAgICAgICBmdW5jLmFwcGVuZChcImdldENsZWFyQ29hdE5vcm1hbCgpO1wiKTtcblxuICAgICAgICAgICAgICAgIGFyZ3MuYXBwZW5kKFwiX2xpdFNoYWRlckFyZ3MuY2xlYXJjb2F0LnNwZWN1bGFyaXR5ID0gY2NTcGVjdWxhcml0eTtcIik7XG4gICAgICAgICAgICAgICAgYXJncy5hcHBlbmQoXCJfbGl0U2hhZGVyQXJncy5jbGVhcmNvYXQuZ2xvc3MgPSBjY0dsb3NzaW5lc3M7XCIpO1xuICAgICAgICAgICAgICAgIGFyZ3MuYXBwZW5kKFwiX2xpdFNoYWRlckFyZ3MuY2xlYXJjb2F0LndvcmxkTm9ybWFsID0gY2NOb3JtYWxXO1wiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gbGlnaHRtYXBcbiAgICAgICAgICAgIGlmIChvcHRpb25zLmxpZ2h0TWFwIHx8IG9wdGlvbnMubGlnaHRWZXJ0ZXhDb2xvcikge1xuICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0bWFwRGlyID0gKG9wdGlvbnMuZGlyTGlnaHRNYXAgJiYgb3B0aW9ucy5saXRPcHRpb25zLnVzZVNwZWN1bGFyKTtcbiAgICAgICAgICAgICAgICBjb25zdCBsaWdodG1hcENodW5rUHJvcE5hbWUgPSBsaWdodG1hcERpciA/ICdsaWdodG1hcERpclBTJyA6ICdsaWdodG1hcFNpbmdsZVBTJztcbiAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcInZlYzMgZExpZ2h0bWFwO1wiKTtcbiAgICAgICAgICAgICAgICBpZiAobGlnaHRtYXBEaXIpIHtcbiAgICAgICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJ2ZWMzIGRMaWdodG1hcERpcjtcIik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcImxpZ2h0XCIsIGxpZ2h0bWFwQ2h1bmtQcm9wTmFtZSwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcsIG9wdGlvbnMubGlnaHRNYXBFbmNvZGluZykpO1xuICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0TGlnaHRNYXAoKTtcIik7XG4gICAgICAgICAgICAgICAgYXJncy5hcHBlbmQoXCJfbGl0U2hhZGVyQXJncy5saWdodG1hcCA9IGRMaWdodG1hcDtcIik7XG4gICAgICAgICAgICAgICAgaWYgKGxpZ2h0bWFwRGlyKSB7XG4gICAgICAgICAgICAgICAgICAgIGFyZ3MuYXBwZW5kKFwiX2xpdFNoYWRlckFyZ3MubGlnaHRtYXBEaXIgPSBkTGlnaHRtYXBEaXI7XCIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gb25seSBhZGQgdGhlIGxlZ2FjeSBjaHVuayBpZiBpdCdzIHJlZmVyZW5jZWRcbiAgICAgICAgICAgIGlmIChjb2RlLmNvZGUuaW5kZXhPZigndGV4dHVyZTJEU1JHQicpICE9PSAtMSB8fFxuICAgICAgICAgICAgICAgIGNvZGUuY29kZS5pbmRleE9mKCd0ZXh0dXJlMkRSR0JNJykgIT09IC0xIHx8XG4gICAgICAgICAgICAgICAgY29kZS5jb2RlLmluZGV4T2YoJ3RleHR1cmUyRFJHQkUnKSAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdTaGFkZXIgY2h1bmsgbWFjcm8gJHRleHR1cmUyRFNBTVBMRShYWFgpIGlzIGRlcHJlY2F0ZWQuIFBsZWFzZSB1c2UgJERFQ09ERSh0ZXh0dXJlMkQoWFhYKSkgaW5zdGVhZC4nKTtcbiAgICAgICAgICAgICAgICBjb2RlLnByZXBlbmQobGl0U2hhZGVyLmNodW5rcy50ZXh0dXJlU2FtcGxlUFMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBhbGwgb3RoZXIgcGFzc2VzIHJlcXVpcmUgb25seSBvcGFjaXR5XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5saXRPcHRpb25zLmFscGhhVGVzdCkge1xuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwiZmxvYXQgZEFscGhhO1wiKTtcbiAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJvcGFjaXR5XCIsIFwib3BhY2l0eVBTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nKSk7XG4gICAgICAgICAgICAgICAgY29kZS5hcHBlbmQobGl0U2hhZGVyLmNodW5rcy5hbHBoYVRlc3RQUyk7XG4gICAgICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRPcGFjaXR5KCk7XCIpO1xuICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiYWxwaGFUZXN0KGRBbHBoYSk7XCIpO1xuICAgICAgICAgICAgICAgIGFyZ3MuYXBwZW5kKFwiX2xpdFNoYWRlckFyZ3Mub3BhY2l0eSA9IGRBbHBoYTtcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBkZWNsLmFwcGVuZChsaXRTaGFkZXIuY2h1bmtzLmxpdFNoYWRlckFyZ3NQUyk7XG4gICAgICAgIGNvZGUuYXBwZW5kKGBMaXRTaGFkZXJBcmd1bWVudHMgZXZhbHVhdGVGcm9udGVuZCgpIHsgTGl0U2hhZGVyQXJndW1lbnRzIF9saXRTaGFkZXJBcmdzOyBcXG4ke2Z1bmMuY29kZX1cXG4ke2FyZ3MuY29kZX1cXG4gcmV0dXJuIF9saXRTaGFkZXJBcmdzO1xcbiB9XFxuYCk7XG4gICAgICAgIGZ1bmMuY29kZSA9IGBMaXRTaGFkZXJBcmd1bWVudHMgbGl0U2hhZGVyQXJncyA9IGV2YWx1YXRlRnJvbnRlbmQoKTtgO1xuXG4gICAgICAgIGZvciAoY29uc3QgdGV4dHVyZSBpbiB0ZXh0dXJlTWFwcGluZykge1xuICAgICAgICAgICAgZGVjbC5hcHBlbmQoYHVuaWZvcm0gc2FtcGxlcjJEICR7dGV4dHVyZU1hcHBpbmdbdGV4dHVyZV19O2ApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZGVjbC5hcHBlbmQoJy8vLS0tLS0tLS0gZnJvbnRlbmQgZGVjbCBiZWdpbicsIGRlY2wuY29kZSwgJy8vLS0tLS0tLS0gZnJvbnRlbmQgZGVjbCBlbmQnKTtcbiAgICAgICAgLy8gY29kZS5hcHBlbmQoJy8vLS0tLS0tLS0gZnJvbnRlbmQgY29kZSBiZWdpbicsIGNvZGUuY29kZSwgJy8vLS0tLS0tLS0gZnJvbnRlbmQgY29kZSBlbmQnKTtcbiAgICAgICAgLy8gZnVuYy5hcHBlbmQoJy8vLS0tLS0tLS0gZnJvbnRlbmQgZnVuYyBiZWdpblxcbiR7ZnVuY30vLy0tLS0tLS0tIGZyb250ZW5kIGZ1bmMgZW5kXFxuYDtcblxuICAgICAgICAvLyBmb3JtYXQgZnVuY1xuICAgICAgICBmdW5jLmNvZGUgPSBgXFxuJHtmdW5jLmNvZGUuc3BsaXQoJ1xcbicpLm1hcChsID0+IGAgICAgJHtsfWApLmpvaW4oJ1xcbicpfVxcblxcbmA7XG5cbiAgICAgICAgbGl0U2hhZGVyLmdlbmVyYXRlRnJhZ21lbnRTaGFkZXIoZGVjbC5jb2RlLCBjb2RlLmNvZGUsIGZ1bmMuY29kZSwgbGlnaHRpbmdVdik7XG5cbiAgICAgICAgcmV0dXJuIGxpdFNoYWRlci5nZXREZWZpbml0aW9uKCk7XG4gICAgfVxufTtcblxuZXhwb3J0IHsgX21hdFRleDJELCBzdGFuZGFyZCB9O1xuIl0sIm5hbWVzIjpbIl9tYXRUZXgyRCIsInN0YW5kYXJkIiwib3B0aW9uc0NvbnRleHQiLCJTdGFuZGFyZE1hdGVyaWFsT3B0aW9ucyIsIm9wdGlvbnNDb250ZXh0TWluIiwiZ2VuZXJhdGVLZXkiLCJvcHRpb25zIiwiYnVpbGRQcm9wZXJ0aWVzTGlzdCIsInByb3BzIiwicHJvcCIsImhhc093blByb3BlcnR5IiwicHVzaCIsInNvcnQiLCJwcm9wc01pbiIsImtleSIsImkiLCJsZW5ndGgiLCJjaHVua3MiLCJwIiwibGl0T3B0aW9ucyIsIm0iLCJpc0NsdXN0ZXJlZCIsImNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCIsImxpZ2h0cyIsImxpZ2h0IiwiX3R5cGUiLCJMSUdIVFRZUEVfRElSRUNUSU9OQUwiLCJoYXNoQ29kZSIsIl9nZXRVdlNvdXJjZUV4cHJlc3Npb24iLCJ0cmFuc2Zvcm1Qcm9wTmFtZSIsInVWUHJvcE5hbWUiLCJ0cmFuc2Zvcm1JZCIsInV2Q2hhbm5lbCIsImlzTWFpblBhc3MiLCJTaGFkZXJQYXNzIiwiaXNGb3J3YXJkIiwicGFzcyIsImV4cHJlc3Npb24iLCJuaW5lU2xpY2VkTW9kZSIsIlNQUklURV9SRU5ERVJNT0RFX1NMSUNFRCIsIlNQUklURV9SRU5ERVJNT0RFX1RJTEVEIiwiaGVpZ2h0TWFwIiwiX2FkZE1hcERlZiIsIm5hbWUiLCJlbmFibGVkIiwiX2FkZE1hcERlZnMiLCJmbG9hdCIsImNvbG9yIiwidmVydGV4IiwibWFwIiwiaW52ZXJ0IiwiX2FkZE1hcCIsInByb3BOYW1lIiwiY2h1bmtOYW1lIiwibWFwcGluZyIsImVuY29kaW5nIiwibWFwUHJvcE5hbWUiLCJpZGVudGlmaWVyUHJvcE5hbWUiLCJjaGFubmVsUHJvcE5hbWUiLCJ2ZXJ0ZXhDb2xvckNoYW5uZWxQcm9wTmFtZSIsInRpbnRQcm9wTmFtZSIsInZlcnRleENvbG9yUHJvcE5hbWUiLCJkZXRhaWxNb2RlUHJvcE5hbWUiLCJpbnZlcnROYW1lIiwidGludE9wdGlvbiIsInZlcnRleENvbG9yT3B0aW9uIiwidGV4dHVyZU9wdGlvbiIsInRleHR1cmVJZGVudGlmaWVyIiwiZGV0YWlsTW9kZU9wdGlvbiIsInN1YkNvZGUiLCJ1diIsInJlcGxhY2UiLCJzZWFyY2giLCJzYW1wbGVyTmFtZSIsImFsaWFzIiwiQ2h1bmtVdGlscyIsImRlY29kZUZ1bmMiLCJnYW1tYSIsImluZGV4T2YiLCJkZWNvZGVUYWJsZSIsImxpbmVhciIsInNyZ2IiLCJyZ2JtIiwicmdiZSIsImlzRmxvYXRUaW50IiwiaXNWZWNUaW50IiwiaW52ZXJ0T3B0aW9uIiwiX2NvcnJlY3RDaGFubmVsIiwiY2hhbiIsInN1YnN0cmluZyIsInN0ciIsImNociIsImNoYXJBdCIsImFkZExlbiIsImNyZWF0ZVNoYWRlckRlZmluaXRpb24iLCJkZXZpY2UiLCJsaXRTaGFkZXIiLCJMaXRTaGFkZXIiLCJ1c2VVdiIsInVzZVVubW9kaWZpZWRVdiIsIm1hcFRyYW5zZm9ybXMiLCJtYXhVdlNldHMiLCJ0ZXh0dXJlTWFwcGluZyIsIm1uYW1lIiwiY25hbWUiLCJ0bmFtZSIsInVuYW1lIiwiTWF0aCIsIm1pbiIsInV2U2V0IiwiaWQiLCJmb3JjZVV2MSIsInVuZGVmaW5lZCIsImdlbmVyYXRlVmVydGV4U2hhZGVyIiwic2hhZGluZ01vZGVsIiwiU1BFQ1VMQVJfUEhPTkciLCJmcmVzbmVsTW9kZWwiLCJhbWJpZW50U0giLCJGUkVTTkVMX1NDSExJQ0siLCJkZWNsIiwiQ2h1bmtCdWlsZGVyIiwiY29kZSIsImZ1bmMiLCJhcmdzIiwibGlnaHRpbmdVdiIsImFwcGVuZCIsImJsZW5kVHlwZSIsIkJMRU5EX05PTkUiLCJhbHBoYVRlc3QiLCJhbHBoYVRvQ292ZXJhZ2UiLCJhbHBoYVRlc3RQUyIsIm5lZWRzTm9ybWFsIiwibm9ybWFsTWFwIiwiY2xlYXJDb2F0Tm9ybWFsTWFwIiwicGFja2VkTm9ybWFsIiwibm9ybWFsWFlQUyIsIm5vcm1hbFhZWlBTIiwiaGFzVGFuZ2VudHMiLCJiYXNlTmFtZSIsIm5lZWRzU2NlbmVDb2xvciIsIm5lZWRzU2NyZWVuU2l6ZSIsIm5lZWRzVHJhbnNmb3JtcyIsImRpZmZ1c2VEZXRhaWwiLCJkaWZmdXNlRGV0YWlsRW5jb2RpbmciLCJkaWZmdXNlRW5jb2RpbmciLCJ1c2VSZWZyYWN0aW9uIiwidXNlSXJpZGVzY2VuY2UiLCJsaWdodGluZyIsInVzZVNwZWN1bGFyIiwicmVmbGVjdGlvbnMiLCJ1c2VTaGVlbiIsInNoZWVuRW5jb2RpbmciLCJ1c2VNZXRhbG5lc3MiLCJ1c2VTcGVjdWxhcml0eUZhY3RvciIsInVzZVNwZWN1bGFyQ29sb3IiLCJzcGVjdWxhckVuY29kaW5nIiwiYW9NYXAiLCJhb1ZlcnRleENvbG9yIiwiZW1pc3NpdmVFbmNvZGluZyIsInVzZUNsZWFyQ29hdCIsImxpZ2h0TWFwIiwibGlnaHRWZXJ0ZXhDb2xvciIsImxpZ2h0bWFwRGlyIiwiZGlyTGlnaHRNYXAiLCJsaWdodG1hcENodW5rUHJvcE5hbWUiLCJsaWdodE1hcEVuY29kaW5nIiwiRGVidWciLCJkZXByZWNhdGVkIiwicHJlcGVuZCIsInRleHR1cmVTYW1wbGVQUyIsImxpdFNoYWRlckFyZ3NQUyIsInRleHR1cmUiLCJzcGxpdCIsImwiLCJqb2luIiwiZ2VuZXJhdGVGcmFnbWVudFNoYWRlciIsImdldERlZmluaXRpb24iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7O0FBY01BLE1BQUFBLFNBQVMsR0FBRyxHQUFFO0FBRXBCLE1BQU1DLFFBQVEsR0FBRztBQUNiO0VBQ0FDLGNBQWMsRUFBRSxJQUFJQyx1QkFBdUIsRUFBRTtFQUM3Q0MsaUJBQWlCLEVBQUUsSUFBSUQsdUJBQXVCLEVBQUU7QUFFaEQ7RUFDQUUsV0FBVyxFQUFFLFVBQVVDLE9BQU8sRUFBRTtBQUM1QixJQUFBLE1BQU1DLG1CQUFtQixHQUFHLFNBQXRCQSxtQkFBbUIsQ0FBYUQsT0FBTyxFQUFFO01BQzNDLE1BQU1FLEtBQUssR0FBRyxFQUFFLENBQUE7QUFDaEIsTUFBQSxLQUFLLE1BQU1DLElBQUksSUFBSUgsT0FBTyxFQUFFO1FBQ3hCLElBQUlBLE9BQU8sQ0FBQ0ksY0FBYyxDQUFDRCxJQUFJLENBQUMsSUFBSUEsSUFBSSxLQUFLLFFBQVEsSUFBSUEsSUFBSSxLQUFLLFFB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
