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
    const isMainPass = options.isForwardPass;
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
    const shaderPassInfo = ShaderPass.get(device).getByIndex(options.pass);
    const isForwardPass = shaderPassInfo.isForward;
    options.isForwardPass = isForwardPass;
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
    if (isForwardPass) {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhbmRhcmQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL3Byb2dyYW1zL3N0YW5kYXJkLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGhhc2hDb2RlIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9oYXNoLmpzJztcbmltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbmltcG9ydCB7XG4gICAgQkxFTkRfTk9ORSwgRlJFU05FTF9TQ0hMSUNLLCBMSUdIVFRZUEVfRElSRUNUSU9OQUwsXG4gICAgU1BFQ1VMQVJfUEhPTkcsXG4gICAgU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VELCBTUFJJVEVfUkVOREVSTU9ERV9USUxFRFxufSBmcm9tICcuLi8uLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgU2hhZGVyUGFzcyB9IGZyb20gJy4uLy4uL3NoYWRlci1wYXNzLmpzJztcbmltcG9ydCB7IExpdFNoYWRlciB9IGZyb20gJy4vbGl0LXNoYWRlci5qcyc7XG5pbXBvcnQgeyBDaHVua0J1aWxkZXIgfSBmcm9tICcuLi9jaHVuay1idWlsZGVyLmpzJztcbmltcG9ydCB7IENodW5rVXRpbHMgfSBmcm9tICcuLi9jaHVuay11dGlscy5qcyc7XG5pbXBvcnQgeyBTdGFuZGFyZE1hdGVyaWFsT3B0aW9ucyB9IGZyb20gJy4uLy4uL21hdGVyaWFscy9zdGFuZGFyZC1tYXRlcmlhbC1vcHRpb25zLmpzJztcblxuY29uc3QgX21hdFRleDJEID0gW107XG5cbmNvbnN0IHN0YW5kYXJkID0ge1xuICAgIC8vIFNoYXJlZCBTdGFuZGFyZCBNYXRlcmlhbCBvcHRpb24gc3RydWN0dXJlc1xuICAgIG9wdGlvbnNDb250ZXh0OiBuZXcgU3RhbmRhcmRNYXRlcmlhbE9wdGlvbnMoKSxcbiAgICBvcHRpb25zQ29udGV4dE1pbjogbmV3IFN0YW5kYXJkTWF0ZXJpYWxPcHRpb25zKCksXG5cbiAgICAvKiogQHR5cGUgeyBGdW5jdGlvbiB9ICovXG4gICAgZ2VuZXJhdGVLZXk6IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IGJ1aWxkUHJvcGVydGllc0xpc3QgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICAgICAgY29uc3QgcHJvcHMgPSBbXTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgcHJvcCBpbiBvcHRpb25zKSB7XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMuaGFzT3duUHJvcGVydHkocHJvcCkgJiYgcHJvcCAhPT0gXCJjaHVua3NcIiAmJiBwcm9wICE9PSBcImxpZ2h0c1wiKVxuICAgICAgICAgICAgICAgICAgICBwcm9wcy5wdXNoKHByb3ApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHByb3BzLnNvcnQoKTtcbiAgICAgICAgfTtcbiAgICAgICAgbGV0IHByb3BzO1xuICAgICAgICBpZiAob3B0aW9ucyA9PT0gdGhpcy5vcHRpb25zQ29udGV4dE1pbikge1xuICAgICAgICAgICAgaWYgKCF0aGlzLnByb3BzTWluKSB0aGlzLnByb3BzTWluID0gYnVpbGRQcm9wZXJ0aWVzTGlzdChvcHRpb25zKTtcbiAgICAgICAgICAgIHByb3BzID0gdGhpcy5wcm9wc01pbjtcbiAgICAgICAgfSBlbHNlIGlmIChvcHRpb25zID09PSB0aGlzLm9wdGlvbnNDb250ZXh0KSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMucHJvcHMpIHRoaXMucHJvcHMgPSBidWlsZFByb3BlcnRpZXNMaXN0KG9wdGlvbnMpO1xuICAgICAgICAgICAgcHJvcHMgPSB0aGlzLnByb3BzO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcHJvcHMgPSBidWlsZFByb3BlcnRpZXNMaXN0KG9wdGlvbnMpO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGtleSA9IFwic3RhbmRhcmRcIjtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHByb3BzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAob3B0aW9uc1twcm9wc1tpXV0pXG4gICAgICAgICAgICAgICAga2V5ICs9IHByb3BzW2ldICsgb3B0aW9uc1twcm9wc1tpXV07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy5jaHVua3MpIHtcbiAgICAgICAgICAgIGNvbnN0IGNodW5rcyA9IFtdO1xuICAgICAgICAgICAgZm9yIChjb25zdCBwIGluIG9wdGlvbnMuY2h1bmtzKSB7XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMuY2h1bmtzLmhhc093blByb3BlcnR5KHApKSB7XG4gICAgICAgICAgICAgICAgICAgIGNodW5rcy5wdXNoKHAgKyBvcHRpb25zLmNodW5rc1twXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2h1bmtzLnNvcnQoKTtcbiAgICAgICAgICAgIGtleSArPSBjaHVua3M7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy5saXRPcHRpb25zKSB7XG5cbiAgICAgICAgICAgIGZvciAoY29uc3QgbSBpbiBvcHRpb25zLmxpdE9wdGlvbnMpIHtcblxuICAgICAgICAgICAgICAgIC8vIGhhbmRsZSBsaWdodHMgaW4gYSBjdXN0b20gd2F5XG4gICAgICAgICAgICAgICAgaWYgKG0gPT09ICdsaWdodHMnKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGlzQ2x1c3RlcmVkID0gb3B0aW9ucy5saXRPcHRpb25zLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZDtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBvcHRpb25zLmxpdE9wdGlvbnMubGlnaHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBsaWdodCA9IG9wdGlvbnMubGl0T3B0aW9ucy5saWdodHNbaV07XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWlzQ2x1c3RlcmVkIHx8IGxpZ2h0Ll90eXBlID09PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBrZXkgKz0gbGlnaHQua2V5O1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAga2V5ICs9IG0gKyBvcHRpb25zLmxpdE9wdGlvbnNbbV07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGhhc2hDb2RlKGtleSk7XG4gICAgfSxcblxuICAgIC8vIGdldCB0aGUgdmFsdWUgdG8gcmVwbGFjZSAkVVYgd2l0aCBpbiBNYXAgU2hhZGVyIGZ1bmN0aW9uc1xuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBjb2RlIHdpdGggd2hpY2ggdG8gdG8gcmVwbGFjZSAnJFVWJyBpbiB0aGUgbWFwIHNoYWRlciBmdW5jdGlvbnMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdHJhbnNmb3JtUHJvcE5hbWUgLSBOYW1lIG9mIHRoZSB0cmFuc2Zvcm0gaWQgaW4gdGhlIG9wdGlvbnMgYmxvY2suIFVzdWFsbHkgXCJiYXNlbmFtZVRyYW5zZm9ybVwiLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB1VlByb3BOYW1lIC0gTmFtZSBvZiB0aGUgVVYgY2hhbm5lbCBpbiB0aGUgb3B0aW9ucyBibG9jay4gVXN1YWxseSBcImJhc2VuYW1lVXZcIi5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gb3B0aW9ucyAtIFRoZSBvcHRpb25zIHBhc3NlZCBpbnRvIGNyZWF0ZVNoYWRlckRlZmluaXRpb24uXG4gICAgICogQHJldHVybnMge3N0cmluZ30gVGhlIGNvZGUgdXNlZCB0byByZXBsYWNlIFwiJFVWXCIgaW4gdGhlIHNoYWRlciBjb2RlLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2dldFV2U291cmNlRXhwcmVzc2lvbjogZnVuY3Rpb24gKHRyYW5zZm9ybVByb3BOYW1lLCB1VlByb3BOYW1lLCBvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IHRyYW5zZm9ybUlkID0gb3B0aW9uc1t0cmFuc2Zvcm1Qcm9wTmFtZV07XG4gICAgICAgIGNvbnN0IHV2Q2hhbm5lbCA9IG9wdGlvbnNbdVZQcm9wTmFtZV07XG4gICAgICAgIGNvbnN0IGlzTWFpblBhc3MgPSBvcHRpb25zLmlzRm9yd2FyZFBhc3M7XG5cbiAgICAgICAgbGV0IGV4cHJlc3Npb247XG4gICAgICAgIGlmIChpc01haW5QYXNzICYmIG9wdGlvbnMubGl0T3B0aW9ucy5uaW5lU2xpY2VkTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VEKSB7XG4gICAgICAgICAgICBleHByZXNzaW9uID0gXCJuaW5lU2xpY2VkVXZcIjtcbiAgICAgICAgfSBlbHNlIGlmIChpc01haW5QYXNzICYmIG9wdGlvbnMubGl0T3B0aW9ucy5uaW5lU2xpY2VkTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfVElMRUQpIHtcbiAgICAgICAgICAgIGV4cHJlc3Npb24gPSBcIm5pbmVTbGljZWRVdlwiO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKHRyYW5zZm9ybUlkID09PSAwKSB7XG4gICAgICAgICAgICAgICAgZXhwcmVzc2lvbiA9IFwidlV2XCIgKyB1dkNoYW5uZWw7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIG5vdGU6IGRpZmZlcmVudCBjYXBpdGFsaXphdGlvbiFcbiAgICAgICAgICAgICAgICBleHByZXNzaW9uID0gXCJ2VVZcIiArIHV2Q2hhbm5lbCArIFwiX1wiICsgdHJhbnNmb3JtSWQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGlmIGhlaWdodG1hcCBpcyBlbmFibGVkIGFsbCBtYXBzIGV4Y2VwdCB0aGUgaGVpZ2h0bWFwIGFyZSBvZmZzZXRcbiAgICAgICAgICAgIGlmIChvcHRpb25zLmhlaWdodE1hcCAmJiB0cmFuc2Zvcm1Qcm9wTmFtZSAhPT0gXCJoZWlnaHRNYXBUcmFuc2Zvcm1cIikge1xuICAgICAgICAgICAgICAgIGV4cHJlc3Npb24gKz0gXCIgKyBkVXZPZmZzZXRcIjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBleHByZXNzaW9uO1xuICAgIH0sXG5cbiAgICBfYWRkTWFwRGVmOiBmdW5jdGlvbiAobmFtZSwgZW5hYmxlZCkge1xuICAgICAgICByZXR1cm4gZW5hYmxlZCA/IGAjZGVmaW5lICR7bmFtZX1cXG5gIDogYCN1bmRlZiAke25hbWV9XFxuYDtcbiAgICB9LFxuXG4gICAgX2FkZE1hcERlZnM6IGZ1bmN0aW9uIChmbG9hdCwgY29sb3IsIHZlcnRleCwgbWFwLCBpbnZlcnQpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FkZE1hcERlZihcIk1BUEZMT0FUXCIsIGZsb2F0KSArXG4gICAgICAgICAgICAgICB0aGlzLl9hZGRNYXBEZWYoXCJNQVBDT0xPUlwiLCBjb2xvcikgK1xuICAgICAgICAgICAgICAgdGhpcy5fYWRkTWFwRGVmKFwiTUFQVkVSVEVYXCIsIHZlcnRleCkgK1xuICAgICAgICAgICAgICAgdGhpcy5fYWRkTWFwRGVmKFwiTUFQVEVYVFVSRVwiLCBtYXApICtcbiAgICAgICAgICAgICAgIHRoaXMuX2FkZE1hcERlZihcIk1BUElOVkVSVFwiLCBpbnZlcnQpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBBZGQgY2h1bmsgZm9yIE1hcCBUeXBlcyAodXNlZCBmb3IgYWxsIG1hcHMgZXhjZXB0IE5vcm1hbCkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gcHJvcE5hbWUgLSBUaGUgYmFzZSBuYW1lIG9mIHRoZSBtYXA6IGRpZmZ1c2UgfCBlbWlzc2l2ZSB8IG9wYWNpdHkgfCBsaWdodCB8IGhlaWdodCB8IG1ldGFsbmVzcyB8IHNwZWN1bGFyIHwgZ2xvc3MgfCBhby5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY2h1bmtOYW1lIC0gVGhlIG5hbWUgb2YgdGhlIGNodW5rIHRvIHVzZS4gVXN1YWxseSBcImJhc2VuYW1lUFNcIi5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gb3B0aW9ucyAtIFRoZSBvcHRpb25zIHBhc3NlZCBpbnRvIHRvIGNyZWF0ZVNoYWRlckRlZmluaXRpb24uXG4gICAgICogQHBhcmFtIHtvYmplY3R9IGNodW5rcyAtIFRoZSBzZXQgb2Ygc2hhZGVyIGNodW5rcyB0byBjaG9vc2UgZnJvbS5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gbWFwcGluZyAtIFRoZSBtYXBwaW5nIGJldHdlZW4gY2h1bmsgYW5kIHNhbXBsZXJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gZW5jb2RpbmcgLSBUaGUgdGV4dHVyZSdzIGVuY29kaW5nXG4gICAgICogQHJldHVybnMge3N0cmluZ30gVGhlIHNoYWRlciBjb2RlIHRvIHN1cHBvcnQgdGhpcyBtYXAuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfYWRkTWFwOiBmdW5jdGlvbiAocHJvcE5hbWUsIGNodW5rTmFtZSwgb3B0aW9ucywgY2h1bmtzLCBtYXBwaW5nLCBlbmNvZGluZyA9IG51bGwpIHtcbiAgICAgICAgY29uc3QgbWFwUHJvcE5hbWUgPSBwcm9wTmFtZSArIFwiTWFwXCI7XG4gICAgICAgIGNvbnN0IHVWUHJvcE5hbWUgPSBtYXBQcm9wTmFtZSArIFwiVXZcIjtcbiAgICAgICAgY29uc3QgaWRlbnRpZmllclByb3BOYW1lID0gbWFwUHJvcE5hbWUgKyBcIklkZW50aWZpZXJcIjtcbiAgICAgICAgY29uc3QgdHJhbnNmb3JtUHJvcE5hbWUgPSBtYXBQcm9wTmFtZSArIFwiVHJhbnNmb3JtXCI7XG4gICAgICAgIGNvbnN0IGNoYW5uZWxQcm9wTmFtZSA9IG1hcFByb3BOYW1lICsgXCJDaGFubmVsXCI7XG4gICAgICAgIGNvbnN0IHZlcnRleENvbG9yQ2hhbm5lbFByb3BOYW1lID0gcHJvcE5hbWUgKyBcIlZlcnRleENvbG9yQ2hhbm5lbFwiO1xuICAgICAgICBjb25zdCB0aW50UHJvcE5hbWUgPSBwcm9wTmFtZSArIFwiVGludFwiO1xuICAgICAgICBjb25zdCB2ZXJ0ZXhDb2xvclByb3BOYW1lID0gcHJvcE5hbWUgKyBcIlZlcnRleENvbG9yXCI7XG4gICAgICAgIGNvbnN0IGRldGFpbE1vZGVQcm9wTmFtZSA9IHByb3BOYW1lICsgXCJNb2RlXCI7XG4gICAgICAgIGNvbnN0IGludmVydE5hbWUgPSBwcm9wTmFtZSArIFwiSW52ZXJ0XCI7XG5cbiAgICAgICAgY29uc3QgdGludE9wdGlvbiA9IG9wdGlvbnNbdGludFByb3BOYW1lXTtcbiAgICAgICAgY29uc3QgdmVydGV4Q29sb3JPcHRpb24gPSBvcHRpb25zW3ZlcnRleENvbG9yUHJvcE5hbWVdO1xuICAgICAgICBjb25zdCB0ZXh0dXJlT3B0aW9uID0gb3B0aW9uc1ttYXBQcm9wTmFtZV07XG4gICAgICAgIGNvbnN0IHRleHR1cmVJZGVudGlmaWVyID0gb3B0aW9uc1tpZGVudGlmaWVyUHJvcE5hbWVdO1xuICAgICAgICBjb25zdCBkZXRhaWxNb2RlT3B0aW9uID0gb3B0aW9uc1tkZXRhaWxNb2RlUHJvcE5hbWVdO1xuXG4gICAgICAgIGxldCBzdWJDb2RlID0gY2h1bmtzW2NodW5rTmFtZV07XG5cbiAgICAgICAgaWYgKHRleHR1cmVPcHRpb24pIHtcbiAgICAgICAgICAgIGNvbnN0IHV2ID0gdGhpcy5fZ2V0VXZTb3VyY2VFeHByZXNzaW9uKHRyYW5zZm9ybVByb3BOYW1lLCB1VlByb3BOYW1lLCBvcHRpb25zKTtcblxuICAgICAgICAgICAgc3ViQ29kZSA9IHN1YkNvZGUucmVwbGFjZSgvXFwkVVYvZywgdXYpLnJlcGxhY2UoL1xcJENIL2csIG9wdGlvbnNbY2hhbm5lbFByb3BOYW1lXSk7XG5cbiAgICAgICAgICAgIGlmIChtYXBwaW5nICYmIHN1YkNvZGUuc2VhcmNoKC9cXCRTQU1QTEVSL2cpICE9PSAtMSkge1xuICAgICAgICAgICAgICAgIGxldCBzYW1wbGVyTmFtZSA9IFwidGV4dHVyZV9cIiArIG1hcFByb3BOYW1lO1xuICAgICAgICAgICAgICAgIGNvbnN0IGFsaWFzID0gbWFwcGluZ1t0ZXh0dXJlSWRlbnRpZmllcl07XG4gICAgICAgICAgICAgICAgaWYgKGFsaWFzKSB7XG4gICAgICAgICAgICAgICAgICAgIHNhbXBsZXJOYW1lID0gYWxpYXM7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbWFwcGluZ1t0ZXh0dXJlSWRlbnRpZmllcl0gPSBzYW1wbGVyTmFtZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgc3ViQ29kZSA9IHN1YkNvZGUucmVwbGFjZSgvXFwkU0FNUExFUi9nLCBzYW1wbGVyTmFtZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChlbmNvZGluZykge1xuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zW2NoYW5uZWxQcm9wTmFtZV0gPT09ICdhYWEnKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGNvbXBsZXRlbHkgc2tpcCBkZWNvZGluZyBpZiB0aGUgdXNlciBoYXMgc2VsZWN0ZWQgdGhlIGFscGhhIGNoYW5uZWwgKHNpbmNlIGFscGhhXG4gICAgICAgICAgICAgICAgICAgIC8vIGlzIG5ldmVyIGRlY29kZWQpLlxuICAgICAgICAgICAgICAgICAgICBzdWJDb2RlID0gc3ViQ29kZS5yZXBsYWNlKC9cXCRERUNPREUvZywgJ3Bhc3NUaHJvdWdoJyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgc3ViQ29kZSA9IHN1YkNvZGUucmVwbGFjZSgvXFwkREVDT0RFL2csIENodW5rVXRpbHMuZGVjb2RlRnVuYygoIW9wdGlvbnMubGl0T3B0aW9ucy5nYW1tYSAmJiBlbmNvZGluZyA9PT0gJ3NyZ2InKSA/ICdsaW5lYXInIDogZW5jb2RpbmcpKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBjb250aW51ZSB0byBzdXBwb3J0ICR0ZXh0dXJlMkRTQU1QTEVcbiAgICAgICAgICAgICAgICBpZiAoc3ViQ29kZS5pbmRleE9mKCckdGV4dHVyZTJEU0FNUExFJykpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZGVjb2RlVGFibGUgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsaW5lYXI6ICd0ZXh0dXJlMkQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgc3JnYjogJ3RleHR1cmUyRFNSR0InLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmdibTogJ3RleHR1cmUyRFJHQk0nLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmdiZTogJ3RleHR1cmUyRFJHQkUnXG4gICAgICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICAgICAgc3ViQ29kZSA9IHN1YkNvZGUucmVwbGFjZSgvXFwkdGV4dHVyZTJEU0FNUExFL2csIGRlY29kZVRhYmxlW2VuY29kaW5nXSB8fCAndGV4dHVyZTJEJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHZlcnRleENvbG9yT3B0aW9uKSB7XG4gICAgICAgICAgICBzdWJDb2RlID0gc3ViQ29kZS5yZXBsYWNlKC9cXCRWQy9nLCBvcHRpb25zW3ZlcnRleENvbG9yQ2hhbm5lbFByb3BOYW1lXSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZGV0YWlsTW9kZU9wdGlvbikge1xuICAgICAgICAgICAgc3ViQ29kZSA9IHN1YkNvZGUucmVwbGFjZSgvXFwkREVUQUlMTU9ERS9nLCBkZXRhaWxNb2RlT3B0aW9uKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGlzRmxvYXRUaW50ID0gISEodGludE9wdGlvbiAmIDEpO1xuICAgICAgICBjb25zdCBpc1ZlY1RpbnQgPSAhISh0aW50T3B0aW9uICYgMik7XG4gICAgICAgIGNvbnN0IGludmVydE9wdGlvbiA9ICEhKG9wdGlvbnNbaW52ZXJ0TmFtZV0pO1xuXG4gICAgICAgIHN1YkNvZGUgPSB0aGlzLl9hZGRNYXBEZWZzKGlzRmxvYXRUaW50LCBpc1ZlY1RpbnQsIHZlcnRleENvbG9yT3B0aW9uLCB0ZXh0dXJlT3B0aW9uLCBpbnZlcnRPcHRpb24pICsgc3ViQ29kZTtcbiAgICAgICAgcmV0dXJuIHN1YkNvZGUucmVwbGFjZSgvXFwkL2csIFwiXCIpO1xuICAgIH0sXG5cbiAgICBfY29ycmVjdENoYW5uZWw6IGZ1bmN0aW9uIChwLCBjaGFuLCBfbWF0VGV4MkQpIHtcbiAgICAgICAgaWYgKF9tYXRUZXgyRFtwXSA+IDApIHtcbiAgICAgICAgICAgIGlmIChfbWF0VGV4MkRbcF0gPCBjaGFuLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBjaGFuLnN1YnN0cmluZygwLCBfbWF0VGV4MkRbcF0pO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChfbWF0VGV4MkRbcF0gPiBjaGFuLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGxldCBzdHIgPSBjaGFuO1xuICAgICAgICAgICAgICAgIGNvbnN0IGNociA9IHN0ci5jaGFyQXQoc3RyLmxlbmd0aCAtIDEpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGFkZExlbiA9IF9tYXRUZXgyRFtwXSAtIHN0ci5sZW5ndGg7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhZGRMZW47IGkrKykgc3RyICs9IGNocjtcbiAgICAgICAgICAgICAgICByZXR1cm4gc3RyO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGNoYW47XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS5qcycpLkdyYXBoaWNzRGV2aWNlfSBkZXZpY2UgLSBUaGVcbiAgICAgKiBncmFwaGljcyBkZXZpY2UuXG4gICAgICogQHBhcmFtIHtTdGFuZGFyZE1hdGVyaWFsT3B0aW9uc30gb3B0aW9ucyAtIFRoZSBjcmVhdGUgb3B0aW9ucy5cbiAgICAgKiBAcmV0dXJucyB7b2JqZWN0fSBSZXR1cm5zIHRoZSBjcmVhdGVkIHNoYWRlciBkZWZpbml0aW9uLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBjcmVhdGVTaGFkZXJEZWZpbml0aW9uOiBmdW5jdGlvbiAoZGV2aWNlLCBvcHRpb25zKSB7XG5cbiAgICAgICAgY29uc3Qgc2hhZGVyUGFzc0luZm8gPSBTaGFkZXJQYXNzLmdldChkZXZpY2UpLmdldEJ5SW5kZXgob3B0aW9ucy5wYXNzKTtcbiAgICAgICAgY29uc3QgaXNGb3J3YXJkUGFzcyA9IHNoYWRlclBhc3NJbmZvLmlzRm9yd2FyZDtcbiAgICAgICAgb3B0aW9ucy5pc0ZvcndhcmRQYXNzID0gaXNGb3J3YXJkUGFzcztcblxuICAgICAgICBjb25zdCBsaXRTaGFkZXIgPSBuZXcgTGl0U2hhZGVyKGRldmljZSwgb3B0aW9ucy5saXRPcHRpb25zKTtcblxuICAgICAgICAvLyBnZW5lcmF0ZSB2ZXJ0ZXggc2hhZGVyXG4gICAgICAgIGNvbnN0IHVzZVV2ID0gW107XG4gICAgICAgIGNvbnN0IHVzZVVubW9kaWZpZWRVdiA9IFtdO1xuICAgICAgICBjb25zdCBtYXBUcmFuc2Zvcm1zID0gW107XG4gICAgICAgIGNvbnN0IG1heFV2U2V0cyA9IDI7XG4gICAgICAgIGNvbnN0IHRleHR1cmVNYXBwaW5nID0ge307XG5cbiAgICAgICAgZm9yIChjb25zdCBwIGluIF9tYXRUZXgyRCkge1xuICAgICAgICAgICAgY29uc3QgbW5hbWUgPSBwICsgXCJNYXBcIjtcblxuICAgICAgICAgICAgaWYgKG9wdGlvbnNbcCArIFwiVmVydGV4Q29sb3JcIl0pIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjbmFtZSA9IHAgKyBcIlZlcnRleENvbG9yQ2hhbm5lbFwiO1xuICAgICAgICAgICAgICAgIG9wdGlvbnNbY25hbWVdID0gdGhpcy5fY29ycmVjdENoYW5uZWwocCwgb3B0aW9uc1tjbmFtZV0sIF9tYXRUZXgyRCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zW21uYW1lXSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNuYW1lID0gbW5hbWUgKyBcIkNoYW5uZWxcIjtcbiAgICAgICAgICAgICAgICBjb25zdCB0bmFtZSA9IG1uYW1lICsgXCJUcmFuc2Zvcm1cIjtcbiAgICAgICAgICAgICAgICBjb25zdCB1bmFtZSA9IG1uYW1lICsgXCJVdlwiO1xuXG4gICAgICAgICAgICAgICAgb3B0aW9uc1t1bmFtZV0gPSBNYXRoLm1pbihvcHRpb25zW3VuYW1lXSwgbWF4VXZTZXRzIC0gMSk7XG4gICAgICAgICAgICAgICAgb3B0aW9uc1tjbmFtZV0gPSB0aGlzLl9jb3JyZWN0Q2hhbm5lbChwLCBvcHRpb25zW2NuYW1lXSwgX21hdFRleDJEKTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IHV2U2V0ID0gb3B0aW9uc1t1bmFtZV07XG4gICAgICAgICAgICAgICAgdXNlVXZbdXZTZXRdID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB1c2VVbm1vZGlmaWVkVXZbdXZTZXRdID0gdXNlVW5tb2RpZmllZFV2W3V2U2V0XSB8fCAob3B0aW9uc1ttbmFtZV0gJiYgIW9wdGlvbnNbdG5hbWVdKTtcblxuICAgICAgICAgICAgICAgIC8vIGNyZWF0ZSBtYXAgdHJhbnNmb3Jtc1xuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zW3RuYW1lXSkge1xuICAgICAgICAgICAgICAgICAgICBtYXBUcmFuc2Zvcm1zLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogcCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGlkOiBvcHRpb25zW3RuYW1lXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHV2OiBvcHRpb25zW3VuYW1lXVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy5mb3JjZVV2MSkge1xuICAgICAgICAgICAgdXNlVXZbMV0gPSB0cnVlO1xuICAgICAgICAgICAgdXNlVW5tb2RpZmllZFV2WzFdID0gKHVzZVVubW9kaWZpZWRVdlsxXSAhPT0gdW5kZWZpbmVkKSA/IHVzZVVubW9kaWZpZWRVdlsxXSA6IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBsaXRTaGFkZXIuZ2VuZXJhdGVWZXJ0ZXhTaGFkZXIodXNlVXYsIHVzZVVubW9kaWZpZWRVdiwgbWFwVHJhbnNmb3Jtcyk7XG5cbiAgICAgICAgLy8gaGFuZGxlIGZyYWdtZW50IHNoYWRlclxuICAgICAgICBpZiAob3B0aW9ucy5saXRPcHRpb25zLnNoYWRpbmdNb2RlbCA9PT0gU1BFQ1VMQVJfUEhPTkcpIHtcbiAgICAgICAgICAgIG9wdGlvbnMubGl0T3B0aW9ucy5mcmVzbmVsTW9kZWwgPSAwO1xuICAgICAgICAgICAgb3B0aW9ucy5saXRPcHRpb25zLmFtYmllbnRTSCA9IGZhbHNlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgb3B0aW9ucy5saXRPcHRpb25zLmZyZXNuZWxNb2RlbCA9IChvcHRpb25zLmxpdE9wdGlvbnMuZnJlc25lbE1vZGVsID09PSAwKSA/IEZSRVNORUxfU0NITElDSyA6IG9wdGlvbnMubGl0T3B0aW9ucy5mcmVzbmVsTW9kZWw7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBkZWNsID0gbmV3IENodW5rQnVpbGRlcigpO1xuICAgICAgICBjb25zdCBjb2RlID0gbmV3IENodW5rQnVpbGRlcigpO1xuICAgICAgICBjb25zdCBmdW5jID0gbmV3IENodW5rQnVpbGRlcigpO1xuICAgICAgICBjb25zdCBhcmdzID0gbmV3IENodW5rQnVpbGRlcigpO1xuICAgICAgICBsZXQgbGlnaHRpbmdVdiA9IFwiXCI7XG5cbiAgICAgICAgLy8gZ2xvYmFsIHRleHR1cmUgYmlhcyBmb3Igc3RhbmRhcmQgdGV4dHVyZXNcbiAgICAgICAgaWYgKG9wdGlvbnMubGl0T3B0aW9ucy5uaW5lU2xpY2VkTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfVElMRUQpIHtcbiAgICAgICAgICAgIGRlY2wuYXBwZW5kKGBjb25zdCBmbG9hdCB0ZXh0dXJlQmlhcyA9IC0xMDAwLjA7YCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkZWNsLmFwcGVuZChgdW5pZm9ybSBmbG9hdCB0ZXh0dXJlQmlhcztgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpc0ZvcndhcmRQYXNzKSB7XG4gICAgICAgICAgICAvLyBwYXJhbGxheFxuICAgICAgICAgICAgaWYgKG9wdGlvbnMuaGVpZ2h0TWFwKSB7XG4gICAgICAgICAgICAgICAgLy8gaWYgKCFvcHRpb25zLm5vcm1hbE1hcCkge1xuICAgICAgICAgICAgICAgIC8vICAgICBjb25zdCB0cmFuc2Zvcm1lZEhlaWdodE1hcFV2ID0gdGhpcy5fZ2V0VXZTb3VyY2VFeHByZXNzaW9uKFwiaGVpZ2h0TWFwVHJhbnNmb3JtXCIsIFwiaGVpZ2h0TWFwVXZcIiwgb3B0aW9ucyk7XG4gICAgICAgICAgICAgICAgLy8gICAgIGlmICghb3B0aW9ucy5oYXNUYW5nZW50cykgdGJuID0gdGJuLnJlcGxhY2UoL1xcJFVWL2csIHRyYW5zZm9ybWVkSGVpZ2h0TWFwVXYpO1xuICAgICAgICAgICAgICAgIC8vICAgICBjb2RlICs9IHRibjtcbiAgICAgICAgICAgICAgICAvLyB9XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJ2ZWMyIGRVdk9mZnNldDtcIik7XG4gICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwiaGVpZ2h0XCIsIFwicGFyYWxsYXhQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZykpO1xuICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0UGFyYWxsYXgoKTtcIik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIG9wYWNpdHlcbiAgICAgICAgICAgIGlmIChvcHRpb25zLmxpdE9wdGlvbnMuYmxlbmRUeXBlICE9PSBCTEVORF9OT05FIHx8IG9wdGlvbnMubGl0T3B0aW9ucy5hbHBoYVRlc3QgfHwgb3B0aW9ucy5saXRPcHRpb25zLmFscGhhVG9Db3ZlcmFnZSkge1xuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwiZmxvYXQgZEFscGhhO1wiKTtcbiAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJvcGFjaXR5XCIsIFwib3BhY2l0eVBTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nKSk7XG4gICAgICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRPcGFjaXR5KCk7XCIpO1xuICAgICAgICAgICAgICAgIGFyZ3MuYXBwZW5kKFwiX2xpdFNoYWRlckFyZ3Mub3BhY2l0eSA9IGRBbHBoYTtcIik7XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMubGl0T3B0aW9ucy5hbHBoYVRlc3QpIHtcbiAgICAgICAgICAgICAgICAgICAgY29kZS5hcHBlbmQobGl0U2hhZGVyLmNodW5rcy5hbHBoYVRlc3RQUyk7XG4gICAgICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiYWxwaGFUZXN0KGRBbHBoYSk7XCIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJmbG9hdCBkQWxwaGEgPSAxLjA7XCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBub3JtYWxcbiAgICAgICAgICAgIGlmIChsaXRTaGFkZXIubmVlZHNOb3JtYWwpIHtcbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5ub3JtYWxNYXAgfHwgb3B0aW9ucy5jbGVhckNvYXROb3JtYWxNYXApIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gVE9ETzogbGV0IGVhY2ggbm9ybWFsbWFwIGlucHV0IChub3JtYWxNYXAsIG5vcm1hbERldGFpbE1hcCwgY2xlYXJDb2F0Tm9ybWFsTWFwKSBpbmRlcGVuZGVudGx5IGRlY2lkZSB3aGljaCB1bnBhY2tOb3JtYWwgdG8gdXNlLlxuICAgICAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZChvcHRpb25zLnBhY2tlZE5vcm1hbCA/IGxpdFNoYWRlci5jaHVua3Mubm9ybWFsWFlQUyA6IGxpdFNoYWRlci5jaHVua3Mubm9ybWFsWFlaUFMpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICghb3B0aW9ucy5saXRPcHRpb25zLmhhc1RhbmdlbnRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBUT0RPOiBnZW5lcmFsaXplIHRvIHN1cHBvcnQgZWFjaCBub3JtYWxtYXAgaW5wdXQgKG5vcm1hbE1hcCwgbm9ybWFsRGV0YWlsTWFwLCBjbGVhckNvYXROb3JtYWxNYXApIGluZGVwZW5kZW50bHlcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGJhc2VOYW1lID0gb3B0aW9ucy5ub3JtYWxNYXAgPyBcIm5vcm1hbE1hcFwiIDogXCJjbGVhckNvYXROb3JtYWxNYXBcIjtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpZ2h0aW5nVXYgPSB0aGlzLl9nZXRVdlNvdXJjZUV4cHJlc3Npb24oYCR7YmFzZU5hbWV9VHJhbnNmb3JtYCwgYCR7YmFzZU5hbWV9VXZgLCBvcHRpb25zKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwidmVjMyBkTm9ybWFsVztcIik7XG4gICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwibm9ybWFsRGV0YWlsXCIsIFwibm9ybWFsRGV0YWlsTWFwUFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcpKTtcbiAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJub3JtYWxcIiwgXCJub3JtYWxNYXBQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZykpO1xuICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0Tm9ybWFsKCk7XCIpO1xuICAgICAgICAgICAgICAgIGFyZ3MuYXBwZW5kKFwiX2xpdFNoYWRlckFyZ3Mud29ybGROb3JtYWwgPSBkTm9ybWFsVztcIik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChsaXRTaGFkZXIubmVlZHNTY2VuZUNvbG9yKSB7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJ1bmlmb3JtIHNhbXBsZXIyRCB1U2NlbmVDb2xvck1hcDtcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAobGl0U2hhZGVyLm5lZWRzU2NyZWVuU2l6ZSkge1xuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwidW5pZm9ybSB2ZWM0IHVTY3JlZW5TaXplO1wiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChsaXRTaGFkZXIubmVlZHNUcmFuc2Zvcm1zKSB7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJ1bmlmb3JtIG1hdDQgbWF0cml4X3ZpZXdQcm9qZWN0aW9uO1wiKTtcbiAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcInVuaWZvcm0gbWF0NCBtYXRyaXhfbW9kZWw7XCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBhbGJlZG9cbiAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwidmVjMyBkQWxiZWRvO1wiKTtcbiAgICAgICAgICAgIGlmIChvcHRpb25zLmRpZmZ1c2VEZXRhaWwpIHtcbiAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJkaWZmdXNlRGV0YWlsXCIsIFwiZGlmZnVzZURldGFpbE1hcFBTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nLCBvcHRpb25zLmRpZmZ1c2VEZXRhaWxFbmNvZGluZykpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwiZGlmZnVzZVwiLCBcImRpZmZ1c2VQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZywgb3B0aW9ucy5kaWZmdXNlRW5jb2RpbmcpKTtcbiAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0QWxiZWRvKCk7XCIpO1xuICAgICAgICAgICAgYXJncy5hcHBlbmQoXCJfbGl0U2hhZGVyQXJncy5hbGJlZG8gPSBkQWxiZWRvO1wiKTtcblxuICAgICAgICAgICAgaWYgKG9wdGlvbnMubGl0T3B0aW9ucy51c2VSZWZyYWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJmbG9hdCBkVHJhbnNtaXNzaW9uO1wiKTtcbiAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJyZWZyYWN0aW9uXCIsIFwidHJhbnNtaXNzaW9uUFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcpKTtcbiAgICAgICAgICAgICAgICBmdW5jLmFwcGVuZChcImdldFJlZnJhY3Rpb24oKTtcIik7XG4gICAgICAgICAgICAgICAgYXJncy5hcHBlbmQoXCJfbGl0U2hhZGVyQXJncy50cmFuc21pc3Npb24gPSBkVHJhbnNtaXNzaW9uO1wiKTtcblxuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwiZmxvYXQgZFRoaWNrbmVzcztcIik7XG4gICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwidGhpY2tuZXNzXCIsIFwidGhpY2tuZXNzUFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcpKTtcbiAgICAgICAgICAgICAgICBmdW5jLmFwcGVuZChcImdldFRoaWNrbmVzcygpO1wiKTtcbiAgICAgICAgICAgICAgICBhcmdzLmFwcGVuZChcIl9saXRTaGFkZXJBcmdzLnRoaWNrbmVzcyA9IGRUaGlja25lc3M7XCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAob3B0aW9ucy5saXRPcHRpb25zLnVzZUlyaWRlc2NlbmNlKSB7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJmbG9hdCBkSXJpZGVzY2VuY2U7XCIpO1xuICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcImlyaWRlc2NlbmNlXCIsIFwiaXJpZGVzY2VuY2VQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZykpO1xuICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0SXJpZGVzY2VuY2UoKTtcIik7XG4gICAgICAgICAgICAgICAgYXJncy5hcHBlbmQoXCJfbGl0U2hhZGVyQXJncy5pcmlkZXNjZW5jZS5pbnRlbnNpdHkgPSBkSXJpZGVzY2VuY2U7XCIpO1xuXG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJmbG9hdCBkSXJpZGVzY2VuY2VUaGlja25lc3M7XCIpO1xuICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcImlyaWRlc2NlbmNlVGhpY2tuZXNzXCIsIFwiaXJpZGVzY2VuY2VUaGlja25lc3NQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZykpO1xuICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0SXJpZGVzY2VuY2VUaGlja25lc3MoKTtcIik7XG4gICAgICAgICAgICAgICAgYXJncy5hcHBlbmQoXCJfbGl0U2hhZGVyQXJncy5pcmlkZXNjZW5jZS50aGlja25lc3MgPSBkSXJpZGVzY2VuY2VUaGlja25lc3M7XCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBzcGVjdWxhcml0eSAmIGdsb3NzaW5lc3NcbiAgICAgICAgICAgIGlmICgobGl0U2hhZGVyLmxpZ2h0aW5nICYmIG9wdGlvbnMubGl0T3B0aW9ucy51c2VTcGVjdWxhcikgfHwgbGl0U2hhZGVyLnJlZmxlY3Rpb25zKSB7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJ2ZWMzIGRTcGVjdWxhcml0eTtcIik7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJmbG9hdCBkR2xvc3NpbmVzcztcIik7XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMubGl0T3B0aW9ucy51c2VTaGVlbikge1xuICAgICAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcInZlYzMgc1NwZWN1bGFyaXR5O1wiKTtcbiAgICAgICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwic2hlZW5cIiwgXCJzaGVlblBTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nLCBvcHRpb25zLnNoZWVuRW5jb2RpbmcpKTtcbiAgICAgICAgICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRTaGVlbigpO1wiKTtcbiAgICAgICAgICAgICAgICAgICAgYXJncy5hcHBlbmQoXCJfbGl0U2hhZGVyQXJncy5zaGVlbi5zcGVjdWxhcml0eSA9IHNTcGVjdWxhcml0eTtcIik7XG5cbiAgICAgICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJmbG9hdCBzR2xvc3NpbmVzcztcIik7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcInNoZWVuR2xvc3NcIiwgXCJzaGVlbkdsb3NzUFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcpKTtcbiAgICAgICAgICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRTaGVlbkdsb3NzaW5lc3MoKTtcIik7XG4gICAgICAgICAgICAgICAgICAgIGFyZ3MuYXBwZW5kKFwiX2xpdFNoYWRlckFyZ3Muc2hlZW4uZ2xvc3MgPSBzR2xvc3NpbmVzcztcIik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLmxpdE9wdGlvbnMudXNlTWV0YWxuZXNzKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwiZmxvYXQgZE1ldGFsbmVzcztcIik7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcIm1ldGFsbmVzc1wiLCBcIm1ldGFsbmVzc1BTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nKSk7XG4gICAgICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0TWV0YWxuZXNzKCk7XCIpO1xuICAgICAgICAgICAgICAgICAgICBhcmdzLmFwcGVuZChcIl9saXRTaGFkZXJBcmdzLm1ldGFsbmVzcyA9IGRNZXRhbG5lc3M7XCIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5saXRPcHRpb25zLnVzZVNwZWN1bGFyaXR5RmFjdG9yKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwiZmxvYXQgZFNwZWN1bGFyaXR5RmFjdG9yO1wiKTtcbiAgICAgICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwic3BlY3VsYXJpdHlGYWN0b3JcIiwgXCJzcGVjdWxhcml0eUZhY3RvclBTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nKSk7XG4gICAgICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0U3BlY3VsYXJpdHlGYWN0b3IoKTtcIik7XG4gICAgICAgICAgICAgICAgICAgIGFyZ3MuYXBwZW5kKFwiX2xpdFNoYWRlckFyZ3Muc3BlY3VsYXJpdHlGYWN0b3IgPSBkU3BlY3VsYXJpdHlGYWN0b3I7XCIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5saXRPcHRpb25zLnVzZVNwZWN1bGFyQ29sb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwic3BlY3VsYXJcIiwgXCJzcGVjdWxhclBTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nLCBvcHRpb25zLnNwZWN1bGFyRW5jb2RpbmcpKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZChcInZvaWQgZ2V0U3BlY3VsYXJpdHkoKSB7IGRTcGVjdWxhcml0eSA9IHZlYzMoMSk7IH1cIik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcImdsb3NzXCIsIFwiZ2xvc3NQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZykpO1xuICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0R2xvc3NpbmVzcygpO1wiKTtcbiAgICAgICAgICAgICAgICBmdW5jLmFwcGVuZChcImdldFNwZWN1bGFyaXR5KCk7XCIpO1xuICAgICAgICAgICAgICAgIGFyZ3MuYXBwZW5kKFwiX2xpdFNoYWRlckFyZ3Muc3BlY3VsYXJpdHkgPSBkU3BlY3VsYXJpdHk7XCIpO1xuICAgICAgICAgICAgICAgIGFyZ3MuYXBwZW5kKFwiX2xpdFNoYWRlckFyZ3MuZ2xvc3MgPSBkR2xvc3NpbmVzcztcIik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwidmVjMyBkU3BlY3VsYXJpdHkgPSB2ZWMzKDAuMCk7XCIpO1xuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwiZmxvYXQgZEdsb3NzaW5lc3MgPSAwLjA7XCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBhb1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMuYW9NYXAgfHwgb3B0aW9ucy5hb1ZlcnRleENvbG9yKSB7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJmbG9hdCBkQW87XCIpO1xuICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcImFvXCIsIFwiYW9QU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZykpO1xuICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0QU8oKTtcIik7XG4gICAgICAgICAgICAgICAgYXJncy5hcHBlbmQoXCJfbGl0U2hhZGVyQXJncy5hbyA9IGRBbztcIik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGVtaXNzaW9uXG4gICAgICAgICAgICBkZWNsLmFwcGVuZChcInZlYzMgZEVtaXNzaW9uO1wiKTtcbiAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcImVtaXNzaXZlXCIsIFwiZW1pc3NpdmVQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZywgb3B0aW9ucy5lbWlzc2l2ZUVuY29kaW5nKSk7XG4gICAgICAgICAgICBmdW5jLmFwcGVuZChcImdldEVtaXNzaW9uKCk7XCIpO1xuICAgICAgICAgICAgYXJncy5hcHBlbmQoXCJfbGl0U2hhZGVyQXJncy5lbWlzc2lvbiA9IGRFbWlzc2lvbjtcIik7XG5cbiAgICAgICAgICAgIC8vIGNsZWFyY29hdFxuICAgICAgICAgICAgaWYgKG9wdGlvbnMubGl0T3B0aW9ucy51c2VDbGVhckNvYXQpIHtcbiAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcImZsb2F0IGNjU3BlY3VsYXJpdHk7XCIpO1xuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwiZmxvYXQgY2NHbG9zc2luZXNzO1wiKTtcbiAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcInZlYzMgY2NOb3JtYWxXO1wiKTtcblxuICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcImNsZWFyQ29hdFwiLCBcImNsZWFyQ29hdFBTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nKSk7XG4gICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwiY2xlYXJDb2F0R2xvc3NcIiwgXCJjbGVhckNvYXRHbG9zc1BTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nKSk7XG4gICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwiY2xlYXJDb2F0Tm9ybWFsXCIsIFwiY2xlYXJDb2F0Tm9ybWFsUFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcpKTtcblxuICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0Q2xlYXJDb2F0KCk7XCIpO1xuICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0Q2xlYXJDb2F0R2xvc3NpbmVzcygpO1wiKTtcbiAgICAgICAgICAgICAgICBmdW5jLmFwcGVuZChcImdldENsZWFyQ29hdE5vcm1hbCgpO1wiKTtcblxuICAgICAgICAgICAgICAgIGFyZ3MuYXBwZW5kKFwiX2xpdFNoYWRlckFyZ3MuY2xlYXJjb2F0LnNwZWN1bGFyaXR5ID0gY2NTcGVjdWxhcml0eTtcIik7XG4gICAgICAgICAgICAgICAgYXJncy5hcHBlbmQoXCJfbGl0U2hhZGVyQXJncy5jbGVhcmNvYXQuZ2xvc3MgPSBjY0dsb3NzaW5lc3M7XCIpO1xuICAgICAgICAgICAgICAgIGFyZ3MuYXBwZW5kKFwiX2xpdFNoYWRlckFyZ3MuY2xlYXJjb2F0LndvcmxkTm9ybWFsID0gY2NOb3JtYWxXO1wiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gbGlnaHRtYXBcbiAgICAgICAgICAgIGlmIChvcHRpb25zLmxpZ2h0TWFwIHx8IG9wdGlvbnMubGlnaHRWZXJ0ZXhDb2xvcikge1xuICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0bWFwRGlyID0gKG9wdGlvbnMuZGlyTGlnaHRNYXAgJiYgb3B0aW9ucy5saXRPcHRpb25zLnVzZVNwZWN1bGFyKTtcbiAgICAgICAgICAgICAgICBjb25zdCBsaWdodG1hcENodW5rUHJvcE5hbWUgPSBsaWdodG1hcERpciA/ICdsaWdodG1hcERpclBTJyA6ICdsaWdodG1hcFNpbmdsZVBTJztcbiAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcInZlYzMgZExpZ2h0bWFwO1wiKTtcbiAgICAgICAgICAgICAgICBpZiAobGlnaHRtYXBEaXIpIHtcbiAgICAgICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJ2ZWMzIGRMaWdodG1hcERpcjtcIik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcImxpZ2h0XCIsIGxpZ2h0bWFwQ2h1bmtQcm9wTmFtZSwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcsIG9wdGlvbnMubGlnaHRNYXBFbmNvZGluZykpO1xuICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0TGlnaHRNYXAoKTtcIik7XG4gICAgICAgICAgICAgICAgYXJncy5hcHBlbmQoXCJfbGl0U2hhZGVyQXJncy5saWdodG1hcCA9IGRMaWdodG1hcDtcIik7XG4gICAgICAgICAgICAgICAgaWYgKGxpZ2h0bWFwRGlyKSB7XG4gICAgICAgICAgICAgICAgICAgIGFyZ3MuYXBwZW5kKFwiX2xpdFNoYWRlckFyZ3MubGlnaHRtYXBEaXIgPSBkTGlnaHRtYXBEaXI7XCIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gb25seSBhZGQgdGhlIGxlZ2FjeSBjaHVuayBpZiBpdCdzIHJlZmVyZW5jZWRcbiAgICAgICAgICAgIGlmIChjb2RlLmNvZGUuaW5kZXhPZigndGV4dHVyZTJEU1JHQicpICE9PSAtMSB8fFxuICAgICAgICAgICAgICAgIGNvZGUuY29kZS5pbmRleE9mKCd0ZXh0dXJlMkRSR0JNJykgIT09IC0xIHx8XG4gICAgICAgICAgICAgICAgY29kZS5jb2RlLmluZGV4T2YoJ3RleHR1cmUyRFJHQkUnKSAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdTaGFkZXIgY2h1bmsgbWFjcm8gJHRleHR1cmUyRFNBTVBMRShYWFgpIGlzIGRlcHJlY2F0ZWQuIFBsZWFzZSB1c2UgJERFQ09ERSh0ZXh0dXJlMkQoWFhYKSkgaW5zdGVhZC4nKTtcbiAgICAgICAgICAgICAgICBjb2RlLnByZXBlbmQobGl0U2hhZGVyLmNodW5rcy50ZXh0dXJlU2FtcGxlUFMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBhbGwgb3RoZXIgcGFzc2VzIHJlcXVpcmUgb25seSBvcGFjaXR5XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5saXRPcHRpb25zLmFscGhhVGVzdCkge1xuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwiZmxvYXQgZEFscGhhO1wiKTtcbiAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJvcGFjaXR5XCIsIFwib3BhY2l0eVBTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nKSk7XG4gICAgICAgICAgICAgICAgY29kZS5hcHBlbmQobGl0U2hhZGVyLmNodW5rcy5hbHBoYVRlc3RQUyk7XG4gICAgICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRPcGFjaXR5KCk7XCIpO1xuICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiYWxwaGFUZXN0KGRBbHBoYSk7XCIpO1xuICAgICAgICAgICAgICAgIGFyZ3MuYXBwZW5kKFwiX2xpdFNoYWRlckFyZ3Mub3BhY2l0eSA9IGRBbHBoYTtcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBkZWNsLmFwcGVuZChsaXRTaGFkZXIuY2h1bmtzLmxpdFNoYWRlckFyZ3NQUyk7XG4gICAgICAgIGNvZGUuYXBwZW5kKGBMaXRTaGFkZXJBcmd1bWVudHMgZXZhbHVhdGVGcm9udGVuZCgpIHsgTGl0U2hhZGVyQXJndW1lbnRzIF9saXRTaGFkZXJBcmdzOyBcXG4ke2Z1bmMuY29kZX1cXG4ke2FyZ3MuY29kZX1cXG4gcmV0dXJuIF9saXRTaGFkZXJBcmdzO1xcbiB9XFxuYCk7XG4gICAgICAgIGZ1bmMuY29kZSA9IGBMaXRTaGFkZXJBcmd1bWVudHMgbGl0U2hhZGVyQXJncyA9IGV2YWx1YXRlRnJvbnRlbmQoKTtgO1xuXG4gICAgICAgIGZvciAoY29uc3QgdGV4dHVyZSBpbiB0ZXh0dXJlTWFwcGluZykge1xuICAgICAgICAgICAgZGVjbC5hcHBlbmQoYHVuaWZvcm0gc2FtcGxlcjJEICR7dGV4dHVyZU1hcHBpbmdbdGV4dHVyZV19O2ApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZGVjbC5hcHBlbmQoJy8vLS0tLS0tLS0gZnJvbnRlbmQgZGVjbCBiZWdpbicsIGRlY2wuY29kZSwgJy8vLS0tLS0tLS0gZnJvbnRlbmQgZGVjbCBlbmQnKTtcbiAgICAgICAgLy8gY29kZS5hcHBlbmQoJy8vLS0tLS0tLS0gZnJvbnRlbmQgY29kZSBiZWdpbicsIGNvZGUuY29kZSwgJy8vLS0tLS0tLS0gZnJvbnRlbmQgY29kZSBlbmQnKTtcbiAgICAgICAgLy8gZnVuYy5hcHBlbmQoJy8vLS0tLS0tLS0gZnJvbnRlbmQgZnVuYyBiZWdpblxcbiR7ZnVuY30vLy0tLS0tLS0tIGZyb250ZW5kIGZ1bmMgZW5kXFxuYDtcblxuICAgICAgICAvLyBmb3JtYXQgZnVuY1xuICAgICAgICBmdW5jLmNvZGUgPSBgXFxuJHtmdW5jLmNvZGUuc3BsaXQoJ1xcbicpLm1hcChsID0+IGAgICAgJHtsfWApLmpvaW4oJ1xcbicpfVxcblxcbmA7XG5cbiAgICAgICAgbGl0U2hhZGVyLmdlbmVyYXRlRnJhZ21lbnRTaGFkZXIoZGVjbC5jb2RlLCBjb2RlLmNvZGUsIGZ1bmMuY29kZSwgbGlnaHRpbmdVdik7XG5cbiAgICAgICAgcmV0dXJuIGxpdFNoYWRlci5nZXREZWZpbml0aW9uKCk7XG4gICAgfVxufTtcblxuZXhwb3J0IHsgX21hdFRleDJELCBzdGFuZGFyZCB9O1xuIl0sIm5hbWVzIjpbIl9tYXRUZXgyRCIsInN0YW5kYXJkIiwib3B0aW9uc0NvbnRleHQiLCJTdGFuZGFyZE1hdGVyaWFsT3B0aW9ucyIsIm9wdGlvbnNDb250ZXh0TWluIiwiZ2VuZXJhdGVLZXkiLCJvcHRpb25zIiwiYnVpbGRQcm9wZXJ0aWVzTGlzdCIsInByb3BzIiwicHJvcCIsImhhc093blByb3BlcnR5IiwicHVzaCIsInNvcnQiLCJwcm9wc01pbiIsImtleSIsImkiLCJsZW5ndGgiLCJjaHVua3MiLCJwIiwibGl0T3B0aW9ucyIsIm0iLCJpc0NsdXN0ZXJlZCIsImNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCIsImxpZ2h0cyIsImxpZ2h0IiwiX3R5cGUiLCJMSUdIVFRZUEVfRElSRUNUSU9OQUwiLCJoYXNoQ29kZSIsIl9nZXRVdlNvdXJjZUV4cHJlc3Npb24iLCJ0cmFuc2Zvcm1Qcm9wTmFtZSIsInVWUHJvcE5hbWUiLCJ0cmFuc2Zvcm1JZCIsInV2Q2hhbm5lbCIsImlzTWFpblBhc3MiLCJpc0ZvcndhcmRQYXNzIiwiZXhwcmVzc2lvbiIsIm5pbmVTbGljZWRNb2RlIiwiU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VEIiwiU1BSSVRFX1JFTkRFUk1PREVfVElMRUQiLCJoZWlnaHRNYXAiLCJfYWRkTWFwRGVmIiwibmFtZSIsImVuYWJsZWQiLCJfYWRkTWFwRGVmcyIsImZsb2F0IiwiY29sb3IiLCJ2ZXJ0ZXgiLCJtYXAiLCJpbnZlcnQiLCJfYWRkTWFwIiwicHJvcE5hbWUiLCJjaHVua05hbWUiLCJtYXBwaW5nIiwiZW5jb2RpbmciLCJtYXBQcm9wTmFtZSIsImlkZW50aWZpZXJQcm9wTmFtZSIsImNoYW5uZWxQcm9wTmFtZSIsInZlcnRleENvbG9yQ2hhbm5lbFByb3BOYW1lIiwidGludFByb3BOYW1lIiwidmVydGV4Q29sb3JQcm9wTmFtZSIsImRldGFpbE1vZGVQcm9wTmFtZSIsImludmVydE5hbWUiLCJ0aW50T3B0aW9uIiwidmVydGV4Q29sb3JPcHRpb24iLCJ0ZXh0dXJlT3B0aW9uIiwidGV4dHVyZUlkZW50aWZpZXIiLCJkZXRhaWxNb2RlT3B0aW9uIiwic3ViQ29kZSIsInV2IiwicmVwbGFjZSIsInNlYXJjaCIsInNhbXBsZXJOYW1lIiwiYWxpYXMiLCJDaHVua1V0aWxzIiwiZGVjb2RlRnVuYyIsImdhbW1hIiwiaW5kZXhPZiIsImRlY29kZVRhYmxlIiwibGluZWFyIiwic3JnYiIsInJnYm0iLCJyZ2JlIiwiaXNGbG9hdFRpbnQiLCJpc1ZlY1RpbnQiLCJpbnZlcnRPcHRpb24iLCJfY29ycmVjdENoYW5uZWwiLCJjaGFuIiwic3Vic3RyaW5nIiwic3RyIiwiY2hyIiwiY2hhckF0IiwiYWRkTGVuIiwiY3JlYXRlU2hhZGVyRGVmaW5pdGlvbiIsImRldmljZSIsInNoYWRlclBhc3NJbmZvIiwiU2hhZGVyUGFzcyIsImdldCIsImdldEJ5SW5kZXgiLCJwYXNzIiwiaXNGb3J3YXJkIiwibGl0U2hhZGVyIiwiTGl0U2hhZGVyIiwidXNlVXYiLCJ1c2VVbm1vZGlmaWVkVXYiLCJtYXBUcmFuc2Zvcm1zIiwibWF4VXZTZXRzIiwidGV4dHVyZU1hcHBpbmciLCJtbmFtZSIsImNuYW1lIiwidG5hbWUiLCJ1bmFtZSIsIk1hdGgiLCJtaW4iLCJ1dlNldCIsImlkIiwiZm9yY2VVdjEiLCJ1bmRlZmluZWQiLCJnZW5lcmF0ZVZlcnRleFNoYWRlciIsInNoYWRpbmdNb2RlbCIsIlNQRUNVTEFSX1BIT05HIiwiZnJlc25lbE1vZGVsIiwiYW1iaWVudFNIIiwiRlJFU05FTF9TQ0hMSUNLIiwiZGVjbCIsIkNodW5rQnVpbGRlciIsImNvZGUiLCJmdW5jIiwiYXJncyIsImxpZ2h0aW5nVXYiLCJhcHBlbmQiLCJibGVuZFR5cGUiLCJCTEVORF9OT05FIiwiYWxwaGFUZXN0IiwiYWxwaGFUb0NvdmVyYWdlIiwiYWxwaGFUZXN0UFMiLCJuZWVkc05vcm1hbCIsIm5vcm1hbE1hcCIsImNsZWFyQ29hdE5vcm1hbE1hcCIsInBhY2tlZE5vcm1hbCIsIm5vcm1hbFhZUFMiLCJub3JtYWxYWVpQUyIsImhhc1RhbmdlbnRzIiwiYmFzZU5hbWUiLCJuZWVkc1NjZW5lQ29sb3IiLCJuZWVkc1NjcmVlblNpemUiLCJuZWVkc1RyYW5zZm9ybXMiLCJkaWZmdXNlRGV0YWlsIiwiZGlmZnVzZURldGFpbEVuY29kaW5nIiwiZGlmZnVzZUVuY29kaW5nIiwidXNlUmVmcmFjdGlvbiIsInVzZUlyaWRlc2NlbmNlIiwibGlnaHRpbmciLCJ1c2VTcGVjdWxhciIsInJlZmxlY3Rpb25zIiwidXNlU2hlZW4iLCJzaGVlbkVuY29kaW5nIiwidXNlTWV0YWxuZXNzIiwidXNlU3BlY3VsYXJpdHlGYWN0b3IiLCJ1c2VTcGVjdWxhckNvbG9yIiwic3BlY3VsYXJFbmNvZGluZyIsImFvTWFwIiwiYW9WZXJ0ZXhDb2xvciIsImVtaXNzaXZlRW5jb2RpbmciLCJ1c2VDbGVhckNvYXQiLCJsaWdodE1hcCIsImxpZ2h0VmVydGV4Q29sb3IiLCJsaWdodG1hcERpciIsImRpckxpZ2h0TWFwIiwibGlnaHRtYXBDaHVua1Byb3BOYW1lIiwibGlnaHRNYXBFbmNvZGluZyIsIkRlYnVnIiwiZGVwcmVjYXRlZCIsInByZXBlbmQiLCJ0ZXh0dXJlU2FtcGxlUFMiLCJsaXRTaGFkZXJBcmdzUFMiLCJ0ZXh0dXJlIiwic3BsaXQiLCJsIiwiam9pbiIsImdlbmVyYXRlRnJhZ21lbnRTaGFkZXIiLCJnZXREZWZpbml0aW9uIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFjTUEsTUFBQUEsU0FBUyxHQUFHLEdBQUU7QUFFcEIsTUFBTUMsUUFBUSxHQUFHO0FBQ2I7RUFDQUMsY0FBYyxFQUFFLElBQUlDLHVCQUF1QixFQUFFO0VBQzdDQyxpQkFBaUIsRUFBRSxJQUFJRCx1QkFBdUIsRUFBRTtBQUVoRDtBQUNBRSxFQUFBQSxXQUFXLEVBQUUsVUFBVUMsT0FBTyxFQUFFO0FBQzVCLElB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
