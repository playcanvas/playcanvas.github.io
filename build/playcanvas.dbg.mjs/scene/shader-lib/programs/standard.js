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
      if (options.aoDetail) {
        code.append(this._addMap("aoDetail", "aoDetailMapPS", options, litShader.chunks, textureMapping));
      }
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhbmRhcmQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL3Byb2dyYW1zL3N0YW5kYXJkLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGhhc2hDb2RlIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9oYXNoLmpzJztcbmltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbmltcG9ydCB7XG4gICAgQkxFTkRfTk9ORSwgRlJFU05FTF9TQ0hMSUNLLCBMSUdIVFRZUEVfRElSRUNUSU9OQUwsXG4gICAgU1BFQ1VMQVJfUEhPTkcsXG4gICAgU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VELCBTUFJJVEVfUkVOREVSTU9ERV9USUxFRFxufSBmcm9tICcuLi8uLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgU2hhZGVyUGFzcyB9IGZyb20gJy4uLy4uL3NoYWRlci1wYXNzLmpzJztcbmltcG9ydCB7IExpdFNoYWRlciB9IGZyb20gJy4vbGl0LXNoYWRlci5qcyc7XG5pbXBvcnQgeyBDaHVua0J1aWxkZXIgfSBmcm9tICcuLi9jaHVuay1idWlsZGVyLmpzJztcbmltcG9ydCB7IENodW5rVXRpbHMgfSBmcm9tICcuLi9jaHVuay11dGlscy5qcyc7XG5pbXBvcnQgeyBTdGFuZGFyZE1hdGVyaWFsT3B0aW9ucyB9IGZyb20gJy4uLy4uL21hdGVyaWFscy9zdGFuZGFyZC1tYXRlcmlhbC1vcHRpb25zLmpzJztcblxuY29uc3QgX21hdFRleDJEID0gW107XG5cbmNvbnN0IHN0YW5kYXJkID0ge1xuICAgIC8vIFNoYXJlZCBTdGFuZGFyZCBNYXRlcmlhbCBvcHRpb24gc3RydWN0dXJlc1xuICAgIG9wdGlvbnNDb250ZXh0OiBuZXcgU3RhbmRhcmRNYXRlcmlhbE9wdGlvbnMoKSxcbiAgICBvcHRpb25zQ29udGV4dE1pbjogbmV3IFN0YW5kYXJkTWF0ZXJpYWxPcHRpb25zKCksXG5cbiAgICAvKiogQHR5cGUgeyBGdW5jdGlvbiB9ICovXG4gICAgZ2VuZXJhdGVLZXk6IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IGJ1aWxkUHJvcGVydGllc0xpc3QgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICAgICAgY29uc3QgcHJvcHMgPSBbXTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgcHJvcCBpbiBvcHRpb25zKSB7XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMuaGFzT3duUHJvcGVydHkocHJvcCkgJiYgcHJvcCAhPT0gXCJjaHVua3NcIiAmJiBwcm9wICE9PSBcImxpZ2h0c1wiKVxuICAgICAgICAgICAgICAgICAgICBwcm9wcy5wdXNoKHByb3ApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHByb3BzLnNvcnQoKTtcbiAgICAgICAgfTtcbiAgICAgICAgbGV0IHByb3BzO1xuICAgICAgICBpZiAob3B0aW9ucyA9PT0gdGhpcy5vcHRpb25zQ29udGV4dE1pbikge1xuICAgICAgICAgICAgaWYgKCF0aGlzLnByb3BzTWluKSB0aGlzLnByb3BzTWluID0gYnVpbGRQcm9wZXJ0aWVzTGlzdChvcHRpb25zKTtcbiAgICAgICAgICAgIHByb3BzID0gdGhpcy5wcm9wc01pbjtcbiAgICAgICAgfSBlbHNlIGlmIChvcHRpb25zID09PSB0aGlzLm9wdGlvbnNDb250ZXh0KSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMucHJvcHMpIHRoaXMucHJvcHMgPSBidWlsZFByb3BlcnRpZXNMaXN0KG9wdGlvbnMpO1xuICAgICAgICAgICAgcHJvcHMgPSB0aGlzLnByb3BzO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcHJvcHMgPSBidWlsZFByb3BlcnRpZXNMaXN0KG9wdGlvbnMpO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGtleSA9IFwic3RhbmRhcmRcIjtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHByb3BzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAob3B0aW9uc1twcm9wc1tpXV0pXG4gICAgICAgICAgICAgICAga2V5ICs9IHByb3BzW2ldICsgb3B0aW9uc1twcm9wc1tpXV07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy5jaHVua3MpIHtcbiAgICAgICAgICAgIGNvbnN0IGNodW5rcyA9IFtdO1xuICAgICAgICAgICAgZm9yIChjb25zdCBwIGluIG9wdGlvbnMuY2h1bmtzKSB7XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMuY2h1bmtzLmhhc093blByb3BlcnR5KHApKSB7XG4gICAgICAgICAgICAgICAgICAgIGNodW5rcy5wdXNoKHAgKyBvcHRpb25zLmNodW5rc1twXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2h1bmtzLnNvcnQoKTtcbiAgICAgICAgICAgIGtleSArPSBjaHVua3M7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy5saXRPcHRpb25zKSB7XG5cbiAgICAgICAgICAgIGZvciAoY29uc3QgbSBpbiBvcHRpb25zLmxpdE9wdGlvbnMpIHtcblxuICAgICAgICAgICAgICAgIC8vIGhhbmRsZSBsaWdodHMgaW4gYSBjdXN0b20gd2F5XG4gICAgICAgICAgICAgICAgaWYgKG0gPT09ICdsaWdodHMnKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGlzQ2x1c3RlcmVkID0gb3B0aW9ucy5saXRPcHRpb25zLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZDtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBvcHRpb25zLmxpdE9wdGlvbnMubGlnaHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBsaWdodCA9IG9wdGlvbnMubGl0T3B0aW9ucy5saWdodHNbaV07XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWlzQ2x1c3RlcmVkIHx8IGxpZ2h0Ll90eXBlID09PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBrZXkgKz0gbGlnaHQua2V5O1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAga2V5ICs9IG0gKyBvcHRpb25zLmxpdE9wdGlvbnNbbV07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGhhc2hDb2RlKGtleSk7XG4gICAgfSxcblxuICAgIC8vIGdldCB0aGUgdmFsdWUgdG8gcmVwbGFjZSAkVVYgd2l0aCBpbiBNYXAgU2hhZGVyIGZ1bmN0aW9uc1xuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBjb2RlIHdpdGggd2hpY2ggdG8gdG8gcmVwbGFjZSAnJFVWJyBpbiB0aGUgbWFwIHNoYWRlciBmdW5jdGlvbnMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdHJhbnNmb3JtUHJvcE5hbWUgLSBOYW1lIG9mIHRoZSB0cmFuc2Zvcm0gaWQgaW4gdGhlIG9wdGlvbnMgYmxvY2suIFVzdWFsbHkgXCJiYXNlbmFtZVRyYW5zZm9ybVwiLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB1VlByb3BOYW1lIC0gTmFtZSBvZiB0aGUgVVYgY2hhbm5lbCBpbiB0aGUgb3B0aW9ucyBibG9jay4gVXN1YWxseSBcImJhc2VuYW1lVXZcIi5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gb3B0aW9ucyAtIFRoZSBvcHRpb25zIHBhc3NlZCBpbnRvIGNyZWF0ZVNoYWRlckRlZmluaXRpb24uXG4gICAgICogQHJldHVybnMge3N0cmluZ30gVGhlIGNvZGUgdXNlZCB0byByZXBsYWNlIFwiJFVWXCIgaW4gdGhlIHNoYWRlciBjb2RlLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2dldFV2U291cmNlRXhwcmVzc2lvbjogZnVuY3Rpb24gKHRyYW5zZm9ybVByb3BOYW1lLCB1VlByb3BOYW1lLCBvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IHRyYW5zZm9ybUlkID0gb3B0aW9uc1t0cmFuc2Zvcm1Qcm9wTmFtZV07XG4gICAgICAgIGNvbnN0IHV2Q2hhbm5lbCA9IG9wdGlvbnNbdVZQcm9wTmFtZV07XG4gICAgICAgIGNvbnN0IGlzTWFpblBhc3MgPSBvcHRpb25zLmlzRm9yd2FyZFBhc3M7XG5cbiAgICAgICAgbGV0IGV4cHJlc3Npb247XG4gICAgICAgIGlmIChpc01haW5QYXNzICYmIG9wdGlvbnMubGl0T3B0aW9ucy5uaW5lU2xpY2VkTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VEKSB7XG4gICAgICAgICAgICBleHByZXNzaW9uID0gXCJuaW5lU2xpY2VkVXZcIjtcbiAgICAgICAgfSBlbHNlIGlmIChpc01haW5QYXNzICYmIG9wdGlvbnMubGl0T3B0aW9ucy5uaW5lU2xpY2VkTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfVElMRUQpIHtcbiAgICAgICAgICAgIGV4cHJlc3Npb24gPSBcIm5pbmVTbGljZWRVdlwiO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKHRyYW5zZm9ybUlkID09PSAwKSB7XG4gICAgICAgICAgICAgICAgZXhwcmVzc2lvbiA9IFwidlV2XCIgKyB1dkNoYW5uZWw7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIG5vdGU6IGRpZmZlcmVudCBjYXBpdGFsaXphdGlvbiFcbiAgICAgICAgICAgICAgICBleHByZXNzaW9uID0gXCJ2VVZcIiArIHV2Q2hhbm5lbCArIFwiX1wiICsgdHJhbnNmb3JtSWQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGlmIGhlaWdodG1hcCBpcyBlbmFibGVkIGFsbCBtYXBzIGV4Y2VwdCB0aGUgaGVpZ2h0bWFwIGFyZSBvZmZzZXRcbiAgICAgICAgICAgIGlmIChvcHRpb25zLmhlaWdodE1hcCAmJiB0cmFuc2Zvcm1Qcm9wTmFtZSAhPT0gXCJoZWlnaHRNYXBUcmFuc2Zvcm1cIikge1xuICAgICAgICAgICAgICAgIGV4cHJlc3Npb24gKz0gXCIgKyBkVXZPZmZzZXRcIjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBleHByZXNzaW9uO1xuICAgIH0sXG5cbiAgICBfYWRkTWFwRGVmOiBmdW5jdGlvbiAobmFtZSwgZW5hYmxlZCkge1xuICAgICAgICByZXR1cm4gZW5hYmxlZCA/IGAjZGVmaW5lICR7bmFtZX1cXG5gIDogYCN1bmRlZiAke25hbWV9XFxuYDtcbiAgICB9LFxuXG4gICAgX2FkZE1hcERlZnM6IGZ1bmN0aW9uIChmbG9hdCwgY29sb3IsIHZlcnRleCwgbWFwLCBpbnZlcnQpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FkZE1hcERlZihcIk1BUEZMT0FUXCIsIGZsb2F0KSArXG4gICAgICAgICAgICAgICB0aGlzLl9hZGRNYXBEZWYoXCJNQVBDT0xPUlwiLCBjb2xvcikgK1xuICAgICAgICAgICAgICAgdGhpcy5fYWRkTWFwRGVmKFwiTUFQVkVSVEVYXCIsIHZlcnRleCkgK1xuICAgICAgICAgICAgICAgdGhpcy5fYWRkTWFwRGVmKFwiTUFQVEVYVFVSRVwiLCBtYXApICtcbiAgICAgICAgICAgICAgIHRoaXMuX2FkZE1hcERlZihcIk1BUElOVkVSVFwiLCBpbnZlcnQpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBBZGQgY2h1bmsgZm9yIE1hcCBUeXBlcyAodXNlZCBmb3IgYWxsIG1hcHMgZXhjZXB0IE5vcm1hbCkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gcHJvcE5hbWUgLSBUaGUgYmFzZSBuYW1lIG9mIHRoZSBtYXA6IGRpZmZ1c2UgfCBlbWlzc2l2ZSB8IG9wYWNpdHkgfCBsaWdodCB8IGhlaWdodCB8IG1ldGFsbmVzcyB8IHNwZWN1bGFyIHwgZ2xvc3MgfCBhby5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY2h1bmtOYW1lIC0gVGhlIG5hbWUgb2YgdGhlIGNodW5rIHRvIHVzZS4gVXN1YWxseSBcImJhc2VuYW1lUFNcIi5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gb3B0aW9ucyAtIFRoZSBvcHRpb25zIHBhc3NlZCBpbnRvIHRvIGNyZWF0ZVNoYWRlckRlZmluaXRpb24uXG4gICAgICogQHBhcmFtIHtvYmplY3R9IGNodW5rcyAtIFRoZSBzZXQgb2Ygc2hhZGVyIGNodW5rcyB0byBjaG9vc2UgZnJvbS5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gbWFwcGluZyAtIFRoZSBtYXBwaW5nIGJldHdlZW4gY2h1bmsgYW5kIHNhbXBsZXJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gZW5jb2RpbmcgLSBUaGUgdGV4dHVyZSdzIGVuY29kaW5nXG4gICAgICogQHJldHVybnMge3N0cmluZ30gVGhlIHNoYWRlciBjb2RlIHRvIHN1cHBvcnQgdGhpcyBtYXAuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfYWRkTWFwOiBmdW5jdGlvbiAocHJvcE5hbWUsIGNodW5rTmFtZSwgb3B0aW9ucywgY2h1bmtzLCBtYXBwaW5nLCBlbmNvZGluZyA9IG51bGwpIHtcbiAgICAgICAgY29uc3QgbWFwUHJvcE5hbWUgPSBwcm9wTmFtZSArIFwiTWFwXCI7XG4gICAgICAgIGNvbnN0IHVWUHJvcE5hbWUgPSBtYXBQcm9wTmFtZSArIFwiVXZcIjtcbiAgICAgICAgY29uc3QgaWRlbnRpZmllclByb3BOYW1lID0gbWFwUHJvcE5hbWUgKyBcIklkZW50aWZpZXJcIjtcbiAgICAgICAgY29uc3QgdHJhbnNmb3JtUHJvcE5hbWUgPSBtYXBQcm9wTmFtZSArIFwiVHJhbnNmb3JtXCI7XG4gICAgICAgIGNvbnN0IGNoYW5uZWxQcm9wTmFtZSA9IG1hcFByb3BOYW1lICsgXCJDaGFubmVsXCI7XG4gICAgICAgIGNvbnN0IHZlcnRleENvbG9yQ2hhbm5lbFByb3BOYW1lID0gcHJvcE5hbWUgKyBcIlZlcnRleENvbG9yQ2hhbm5lbFwiO1xuICAgICAgICBjb25zdCB0aW50UHJvcE5hbWUgPSBwcm9wTmFtZSArIFwiVGludFwiO1xuICAgICAgICBjb25zdCB2ZXJ0ZXhDb2xvclByb3BOYW1lID0gcHJvcE5hbWUgKyBcIlZlcnRleENvbG9yXCI7XG4gICAgICAgIGNvbnN0IGRldGFpbE1vZGVQcm9wTmFtZSA9IHByb3BOYW1lICsgXCJNb2RlXCI7XG4gICAgICAgIGNvbnN0IGludmVydE5hbWUgPSBwcm9wTmFtZSArIFwiSW52ZXJ0XCI7XG5cbiAgICAgICAgY29uc3QgdGludE9wdGlvbiA9IG9wdGlvbnNbdGludFByb3BOYW1lXTtcbiAgICAgICAgY29uc3QgdmVydGV4Q29sb3JPcHRpb24gPSBvcHRpb25zW3ZlcnRleENvbG9yUHJvcE5hbWVdO1xuICAgICAgICBjb25zdCB0ZXh0dXJlT3B0aW9uID0gb3B0aW9uc1ttYXBQcm9wTmFtZV07XG4gICAgICAgIGNvbnN0IHRleHR1cmVJZGVudGlmaWVyID0gb3B0aW9uc1tpZGVudGlmaWVyUHJvcE5hbWVdO1xuICAgICAgICBjb25zdCBkZXRhaWxNb2RlT3B0aW9uID0gb3B0aW9uc1tkZXRhaWxNb2RlUHJvcE5hbWVdO1xuXG4gICAgICAgIGxldCBzdWJDb2RlID0gY2h1bmtzW2NodW5rTmFtZV07XG5cbiAgICAgICAgaWYgKHRleHR1cmVPcHRpb24pIHtcbiAgICAgICAgICAgIGNvbnN0IHV2ID0gdGhpcy5fZ2V0VXZTb3VyY2VFeHByZXNzaW9uKHRyYW5zZm9ybVByb3BOYW1lLCB1VlByb3BOYW1lLCBvcHRpb25zKTtcblxuICAgICAgICAgICAgc3ViQ29kZSA9IHN1YkNvZGUucmVwbGFjZSgvXFwkVVYvZywgdXYpLnJlcGxhY2UoL1xcJENIL2csIG9wdGlvbnNbY2hhbm5lbFByb3BOYW1lXSk7XG5cbiAgICAgICAgICAgIGlmIChtYXBwaW5nICYmIHN1YkNvZGUuc2VhcmNoKC9cXCRTQU1QTEVSL2cpICE9PSAtMSkge1xuICAgICAgICAgICAgICAgIGxldCBzYW1wbGVyTmFtZSA9IFwidGV4dHVyZV9cIiArIG1hcFByb3BOYW1lO1xuICAgICAgICAgICAgICAgIGNvbnN0IGFsaWFzID0gbWFwcGluZ1t0ZXh0dXJlSWRlbnRpZmllcl07XG4gICAgICAgICAgICAgICAgaWYgKGFsaWFzKSB7XG4gICAgICAgICAgICAgICAgICAgIHNhbXBsZXJOYW1lID0gYWxpYXM7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbWFwcGluZ1t0ZXh0dXJlSWRlbnRpZmllcl0gPSBzYW1wbGVyTmFtZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgc3ViQ29kZSA9IHN1YkNvZGUucmVwbGFjZSgvXFwkU0FNUExFUi9nLCBzYW1wbGVyTmFtZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChlbmNvZGluZykge1xuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zW2NoYW5uZWxQcm9wTmFtZV0gPT09ICdhYWEnKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGNvbXBsZXRlbHkgc2tpcCBkZWNvZGluZyBpZiB0aGUgdXNlciBoYXMgc2VsZWN0ZWQgdGhlIGFscGhhIGNoYW5uZWwgKHNpbmNlIGFscGhhXG4gICAgICAgICAgICAgICAgICAgIC8vIGlzIG5ldmVyIGRlY29kZWQpLlxuICAgICAgICAgICAgICAgICAgICBzdWJDb2RlID0gc3ViQ29kZS5yZXBsYWNlKC9cXCRERUNPREUvZywgJ3Bhc3NUaHJvdWdoJyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgc3ViQ29kZSA9IHN1YkNvZGUucmVwbGFjZSgvXFwkREVDT0RFL2csIENodW5rVXRpbHMuZGVjb2RlRnVuYygoIW9wdGlvbnMubGl0T3B0aW9ucy5nYW1tYSAmJiBlbmNvZGluZyA9PT0gJ3NyZ2InKSA/ICdsaW5lYXInIDogZW5jb2RpbmcpKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBjb250aW51ZSB0byBzdXBwb3J0ICR0ZXh0dXJlMkRTQU1QTEVcbiAgICAgICAgICAgICAgICBpZiAoc3ViQ29kZS5pbmRleE9mKCckdGV4dHVyZTJEU0FNUExFJykpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZGVjb2RlVGFibGUgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsaW5lYXI6ICd0ZXh0dXJlMkQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgc3JnYjogJ3RleHR1cmUyRFNSR0InLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmdibTogJ3RleHR1cmUyRFJHQk0nLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmdiZTogJ3RleHR1cmUyRFJHQkUnXG4gICAgICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICAgICAgc3ViQ29kZSA9IHN1YkNvZGUucmVwbGFjZSgvXFwkdGV4dHVyZTJEU0FNUExFL2csIGRlY29kZVRhYmxlW2VuY29kaW5nXSB8fCAndGV4dHVyZTJEJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHZlcnRleENvbG9yT3B0aW9uKSB7XG4gICAgICAgICAgICBzdWJDb2RlID0gc3ViQ29kZS5yZXBsYWNlKC9cXCRWQy9nLCBvcHRpb25zW3ZlcnRleENvbG9yQ2hhbm5lbFByb3BOYW1lXSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZGV0YWlsTW9kZU9wdGlvbikge1xuICAgICAgICAgICAgc3ViQ29kZSA9IHN1YkNvZGUucmVwbGFjZSgvXFwkREVUQUlMTU9ERS9nLCBkZXRhaWxNb2RlT3B0aW9uKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGlzRmxvYXRUaW50ID0gISEodGludE9wdGlvbiAmIDEpO1xuICAgICAgICBjb25zdCBpc1ZlY1RpbnQgPSAhISh0aW50T3B0aW9uICYgMik7XG4gICAgICAgIGNvbnN0IGludmVydE9wdGlvbiA9ICEhKG9wdGlvbnNbaW52ZXJ0TmFtZV0pO1xuXG4gICAgICAgIHN1YkNvZGUgPSB0aGlzLl9hZGRNYXBEZWZzKGlzRmxvYXRUaW50LCBpc1ZlY1RpbnQsIHZlcnRleENvbG9yT3B0aW9uLCB0ZXh0dXJlT3B0aW9uLCBpbnZlcnRPcHRpb24pICsgc3ViQ29kZTtcbiAgICAgICAgcmV0dXJuIHN1YkNvZGUucmVwbGFjZSgvXFwkL2csIFwiXCIpO1xuICAgIH0sXG5cbiAgICBfY29ycmVjdENoYW5uZWw6IGZ1bmN0aW9uIChwLCBjaGFuLCBfbWF0VGV4MkQpIHtcbiAgICAgICAgaWYgKF9tYXRUZXgyRFtwXSA+IDApIHtcbiAgICAgICAgICAgIGlmIChfbWF0VGV4MkRbcF0gPCBjaGFuLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBjaGFuLnN1YnN0cmluZygwLCBfbWF0VGV4MkRbcF0pO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChfbWF0VGV4MkRbcF0gPiBjaGFuLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGxldCBzdHIgPSBjaGFuO1xuICAgICAgICAgICAgICAgIGNvbnN0IGNociA9IHN0ci5jaGFyQXQoc3RyLmxlbmd0aCAtIDEpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGFkZExlbiA9IF9tYXRUZXgyRFtwXSAtIHN0ci5sZW5ndGg7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhZGRMZW47IGkrKykgc3RyICs9IGNocjtcbiAgICAgICAgICAgICAgICByZXR1cm4gc3RyO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGNoYW47XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS5qcycpLkdyYXBoaWNzRGV2aWNlfSBkZXZpY2UgLSBUaGVcbiAgICAgKiBncmFwaGljcyBkZXZpY2UuXG4gICAgICogQHBhcmFtIHtTdGFuZGFyZE1hdGVyaWFsT3B0aW9uc30gb3B0aW9ucyAtIFRoZSBjcmVhdGUgb3B0aW9ucy5cbiAgICAgKiBAcmV0dXJucyB7b2JqZWN0fSBSZXR1cm5zIHRoZSBjcmVhdGVkIHNoYWRlciBkZWZpbml0aW9uLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBjcmVhdGVTaGFkZXJEZWZpbml0aW9uOiBmdW5jdGlvbiAoZGV2aWNlLCBvcHRpb25zKSB7XG5cbiAgICAgICAgY29uc3Qgc2hhZGVyUGFzc0luZm8gPSBTaGFkZXJQYXNzLmdldChkZXZpY2UpLmdldEJ5SW5kZXgob3B0aW9ucy5wYXNzKTtcbiAgICAgICAgY29uc3QgaXNGb3J3YXJkUGFzcyA9IHNoYWRlclBhc3NJbmZvLmlzRm9yd2FyZDtcbiAgICAgICAgb3B0aW9ucy5pc0ZvcndhcmRQYXNzID0gaXNGb3J3YXJkUGFzcztcblxuICAgICAgICBjb25zdCBsaXRTaGFkZXIgPSBuZXcgTGl0U2hhZGVyKGRldmljZSwgb3B0aW9ucy5saXRPcHRpb25zKTtcblxuICAgICAgICAvLyBnZW5lcmF0ZSB2ZXJ0ZXggc2hhZGVyXG4gICAgICAgIGNvbnN0IHVzZVV2ID0gW107XG4gICAgICAgIGNvbnN0IHVzZVVubW9kaWZpZWRVdiA9IFtdO1xuICAgICAgICBjb25zdCBtYXBUcmFuc2Zvcm1zID0gW107XG4gICAgICAgIGNvbnN0IG1heFV2U2V0cyA9IDI7XG4gICAgICAgIGNvbnN0IHRleHR1cmVNYXBwaW5nID0ge307XG5cbiAgICAgICAgZm9yIChjb25zdCBwIGluIF9tYXRUZXgyRCkge1xuICAgICAgICAgICAgY29uc3QgbW5hbWUgPSBwICsgXCJNYXBcIjtcblxuICAgICAgICAgICAgaWYgKG9wdGlvbnNbcCArIFwiVmVydGV4Q29sb3JcIl0pIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjbmFtZSA9IHAgKyBcIlZlcnRleENvbG9yQ2hhbm5lbFwiO1xuICAgICAgICAgICAgICAgIG9wdGlvbnNbY25hbWVdID0gdGhpcy5fY29ycmVjdENoYW5uZWwocCwgb3B0aW9uc1tjbmFtZV0sIF9tYXRUZXgyRCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zW21uYW1lXSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNuYW1lID0gbW5hbWUgKyBcIkNoYW5uZWxcIjtcbiAgICAgICAgICAgICAgICBjb25zdCB0bmFtZSA9IG1uYW1lICsgXCJUcmFuc2Zvcm1cIjtcbiAgICAgICAgICAgICAgICBjb25zdCB1bmFtZSA9IG1uYW1lICsgXCJVdlwiO1xuXG4gICAgICAgICAgICAgICAgb3B0aW9uc1t1bmFtZV0gPSBNYXRoLm1pbihvcHRpb25zW3VuYW1lXSwgbWF4VXZTZXRzIC0gMSk7XG4gICAgICAgICAgICAgICAgb3B0aW9uc1tjbmFtZV0gPSB0aGlzLl9jb3JyZWN0Q2hhbm5lbChwLCBvcHRpb25zW2NuYW1lXSwgX21hdFRleDJEKTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IHV2U2V0ID0gb3B0aW9uc1t1bmFtZV07XG4gICAgICAgICAgICAgICAgdXNlVXZbdXZTZXRdID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB1c2VVbm1vZGlmaWVkVXZbdXZTZXRdID0gdXNlVW5tb2RpZmllZFV2W3V2U2V0XSB8fCAob3B0aW9uc1ttbmFtZV0gJiYgIW9wdGlvbnNbdG5hbWVdKTtcblxuICAgICAgICAgICAgICAgIC8vIGNyZWF0ZSBtYXAgdHJhbnNmb3Jtc1xuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zW3RuYW1lXSkge1xuICAgICAgICAgICAgICAgICAgICBtYXBUcmFuc2Zvcm1zLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogcCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGlkOiBvcHRpb25zW3RuYW1lXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHV2OiBvcHRpb25zW3VuYW1lXVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy5mb3JjZVV2MSkge1xuICAgICAgICAgICAgdXNlVXZbMV0gPSB0cnVlO1xuICAgICAgICAgICAgdXNlVW5tb2RpZmllZFV2WzFdID0gKHVzZVVubW9kaWZpZWRVdlsxXSAhPT0gdW5kZWZpbmVkKSA/IHVzZVVubW9kaWZpZWRVdlsxXSA6IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBsaXRTaGFkZXIuZ2VuZXJhdGVWZXJ0ZXhTaGFkZXIodXNlVXYsIHVzZVVubW9kaWZpZWRVdiwgbWFwVHJhbnNmb3Jtcyk7XG5cbiAgICAgICAgLy8gaGFuZGxlIGZyYWdtZW50IHNoYWRlclxuICAgICAgICBpZiAob3B0aW9ucy5saXRPcHRpb25zLnNoYWRpbmdNb2RlbCA9PT0gU1BFQ1VMQVJfUEhPTkcpIHtcbiAgICAgICAgICAgIG9wdGlvbnMubGl0T3B0aW9ucy5mcmVzbmVsTW9kZWwgPSAwO1xuICAgICAgICAgICAgb3B0aW9ucy5saXRPcHRpb25zLmFtYmllbnRTSCA9IGZhbHNlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgb3B0aW9ucy5saXRPcHRpb25zLmZyZXNuZWxNb2RlbCA9IChvcHRpb25zLmxpdE9wdGlvbnMuZnJlc25lbE1vZGVsID09PSAwKSA/IEZSRVNORUxfU0NITElDSyA6IG9wdGlvbnMubGl0T3B0aW9ucy5mcmVzbmVsTW9kZWw7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBkZWNsID0gbmV3IENodW5rQnVpbGRlcigpO1xuICAgICAgICBjb25zdCBjb2RlID0gbmV3IENodW5rQnVpbGRlcigpO1xuICAgICAgICBjb25zdCBmdW5jID0gbmV3IENodW5rQnVpbGRlcigpO1xuICAgICAgICBjb25zdCBhcmdzID0gbmV3IENodW5rQnVpbGRlcigpO1xuICAgICAgICBsZXQgbGlnaHRpbmdVdiA9IFwiXCI7XG5cbiAgICAgICAgLy8gZ2xvYmFsIHRleHR1cmUgYmlhcyBmb3Igc3RhbmRhcmQgdGV4dHVyZXNcbiAgICAgICAgaWYgKG9wdGlvbnMubGl0T3B0aW9ucy5uaW5lU2xpY2VkTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfVElMRUQpIHtcbiAgICAgICAgICAgIGRlY2wuYXBwZW5kKGBjb25zdCBmbG9hdCB0ZXh0dXJlQmlhcyA9IC0xMDAwLjA7YCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkZWNsLmFwcGVuZChgdW5pZm9ybSBmbG9hdCB0ZXh0dXJlQmlhcztgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpc0ZvcndhcmRQYXNzKSB7XG4gICAgICAgICAgICAvLyBwYXJhbGxheFxuICAgICAgICAgICAgaWYgKG9wdGlvbnMuaGVpZ2h0TWFwKSB7XG4gICAgICAgICAgICAgICAgLy8gaWYgKCFvcHRpb25zLm5vcm1hbE1hcCkge1xuICAgICAgICAgICAgICAgIC8vICAgICBjb25zdCB0cmFuc2Zvcm1lZEhlaWdodE1hcFV2ID0gdGhpcy5fZ2V0VXZTb3VyY2VFeHByZXNzaW9uKFwiaGVpZ2h0TWFwVHJhbnNmb3JtXCIsIFwiaGVpZ2h0TWFwVXZcIiwgb3B0aW9ucyk7XG4gICAgICAgICAgICAgICAgLy8gICAgIGlmICghb3B0aW9ucy5oYXNUYW5nZW50cykgdGJuID0gdGJuLnJlcGxhY2UoL1xcJFVWL2csIHRyYW5zZm9ybWVkSGVpZ2h0TWFwVXYpO1xuICAgICAgICAgICAgICAgIC8vICAgICBjb2RlICs9IHRibjtcbiAgICAgICAgICAgICAgICAvLyB9XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJ2ZWMyIGRVdk9mZnNldDtcIik7XG4gICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwiaGVpZ2h0XCIsIFwicGFyYWxsYXhQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZykpO1xuICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0UGFyYWxsYXgoKTtcIik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIG9wYWNpdHlcbiAgICAgICAgICAgIGlmIChvcHRpb25zLmxpdE9wdGlvbnMuYmxlbmRUeXBlICE9PSBCTEVORF9OT05FIHx8IG9wdGlvbnMubGl0T3B0aW9ucy5hbHBoYVRlc3QgfHwgb3B0aW9ucy5saXRPcHRpb25zLmFscGhhVG9Db3ZlcmFnZSkge1xuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwiZmxvYXQgZEFscGhhO1wiKTtcbiAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJvcGFjaXR5XCIsIFwib3BhY2l0eVBTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nKSk7XG4gICAgICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRPcGFjaXR5KCk7XCIpO1xuICAgICAgICAgICAgICAgIGFyZ3MuYXBwZW5kKFwiX2xpdFNoYWRlckFyZ3Mub3BhY2l0eSA9IGRBbHBoYTtcIik7XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMubGl0T3B0aW9ucy5hbHBoYVRlc3QpIHtcbiAgICAgICAgICAgICAgICAgICAgY29kZS5hcHBlbmQobGl0U2hhZGVyLmNodW5rcy5hbHBoYVRlc3RQUyk7XG4gICAgICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiYWxwaGFUZXN0KGRBbHBoYSk7XCIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJmbG9hdCBkQWxwaGEgPSAxLjA7XCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBub3JtYWxcbiAgICAgICAgICAgIGlmIChsaXRTaGFkZXIubmVlZHNOb3JtYWwpIHtcbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5ub3JtYWxNYXAgfHwgb3B0aW9ucy5jbGVhckNvYXROb3JtYWxNYXApIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gVE9ETzogbGV0IGVhY2ggbm9ybWFsbWFwIGlucHV0IChub3JtYWxNYXAsIG5vcm1hbERldGFpbE1hcCwgY2xlYXJDb2F0Tm9ybWFsTWFwKSBpbmRlcGVuZGVudGx5IGRlY2lkZSB3aGljaCB1bnBhY2tOb3JtYWwgdG8gdXNlLlxuICAgICAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZChvcHRpb25zLnBhY2tlZE5vcm1hbCA/IGxpdFNoYWRlci5jaHVua3Mubm9ybWFsWFlQUyA6IGxpdFNoYWRlci5jaHVua3Mubm9ybWFsWFlaUFMpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICghb3B0aW9ucy5saXRPcHRpb25zLmhhc1RhbmdlbnRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBUT0RPOiBnZW5lcmFsaXplIHRvIHN1cHBvcnQgZWFjaCBub3JtYWxtYXAgaW5wdXQgKG5vcm1hbE1hcCwgbm9ybWFsRGV0YWlsTWFwLCBjbGVhckNvYXROb3JtYWxNYXApIGluZGVwZW5kZW50bHlcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGJhc2VOYW1lID0gb3B0aW9ucy5ub3JtYWxNYXAgPyBcIm5vcm1hbE1hcFwiIDogXCJjbGVhckNvYXROb3JtYWxNYXBcIjtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpZ2h0aW5nVXYgPSB0aGlzLl9nZXRVdlNvdXJjZUV4cHJlc3Npb24oYCR7YmFzZU5hbWV9VHJhbnNmb3JtYCwgYCR7YmFzZU5hbWV9VXZgLCBvcHRpb25zKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwidmVjMyBkTm9ybWFsVztcIik7XG4gICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwibm9ybWFsRGV0YWlsXCIsIFwibm9ybWFsRGV0YWlsTWFwUFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcpKTtcbiAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJub3JtYWxcIiwgXCJub3JtYWxNYXBQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZykpO1xuICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0Tm9ybWFsKCk7XCIpO1xuICAgICAgICAgICAgICAgIGFyZ3MuYXBwZW5kKFwiX2xpdFNoYWRlckFyZ3Mud29ybGROb3JtYWwgPSBkTm9ybWFsVztcIik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChsaXRTaGFkZXIubmVlZHNTY2VuZUNvbG9yKSB7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJ1bmlmb3JtIHNhbXBsZXIyRCB1U2NlbmVDb2xvck1hcDtcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAobGl0U2hhZGVyLm5lZWRzU2NyZWVuU2l6ZSkge1xuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwidW5pZm9ybSB2ZWM0IHVTY3JlZW5TaXplO1wiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChsaXRTaGFkZXIubmVlZHNUcmFuc2Zvcm1zKSB7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJ1bmlmb3JtIG1hdDQgbWF0cml4X3ZpZXdQcm9qZWN0aW9uO1wiKTtcbiAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcInVuaWZvcm0gbWF0NCBtYXRyaXhfbW9kZWw7XCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBhbGJlZG9cbiAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwidmVjMyBkQWxiZWRvO1wiKTtcbiAgICAgICAgICAgIGlmIChvcHRpb25zLmRpZmZ1c2VEZXRhaWwpIHtcbiAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJkaWZmdXNlRGV0YWlsXCIsIFwiZGlmZnVzZURldGFpbE1hcFBTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nLCBvcHRpb25zLmRpZmZ1c2VEZXRhaWxFbmNvZGluZykpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwiZGlmZnVzZVwiLCBcImRpZmZ1c2VQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZywgb3B0aW9ucy5kaWZmdXNlRW5jb2RpbmcpKTtcbiAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0QWxiZWRvKCk7XCIpO1xuICAgICAgICAgICAgYXJncy5hcHBlbmQoXCJfbGl0U2hhZGVyQXJncy5hbGJlZG8gPSBkQWxiZWRvO1wiKTtcblxuICAgICAgICAgICAgaWYgKG9wdGlvbnMubGl0T3B0aW9ucy51c2VSZWZyYWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJmbG9hdCBkVHJhbnNtaXNzaW9uO1wiKTtcbiAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJyZWZyYWN0aW9uXCIsIFwidHJhbnNtaXNzaW9uUFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcpKTtcbiAgICAgICAgICAgICAgICBmdW5jLmFwcGVuZChcImdldFJlZnJhY3Rpb24oKTtcIik7XG4gICAgICAgICAgICAgICAgYXJncy5hcHBlbmQoXCJfbGl0U2hhZGVyQXJncy50cmFuc21pc3Npb24gPSBkVHJhbnNtaXNzaW9uO1wiKTtcblxuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwiZmxvYXQgZFRoaWNrbmVzcztcIik7XG4gICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwidGhpY2tuZXNzXCIsIFwidGhpY2tuZXNzUFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcpKTtcbiAgICAgICAgICAgICAgICBmdW5jLmFwcGVuZChcImdldFRoaWNrbmVzcygpO1wiKTtcbiAgICAgICAgICAgICAgICBhcmdzLmFwcGVuZChcIl9saXRTaGFkZXJBcmdzLnRoaWNrbmVzcyA9IGRUaGlja25lc3M7XCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAob3B0aW9ucy5saXRPcHRpb25zLnVzZUlyaWRlc2NlbmNlKSB7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJmbG9hdCBkSXJpZGVzY2VuY2U7XCIpO1xuICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcImlyaWRlc2NlbmNlXCIsIFwiaXJpZGVzY2VuY2VQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZykpO1xuICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0SXJpZGVzY2VuY2UoKTtcIik7XG4gICAgICAgICAgICAgICAgYXJncy5hcHBlbmQoXCJfbGl0U2hhZGVyQXJncy5pcmlkZXNjZW5jZS5pbnRlbnNpdHkgPSBkSXJpZGVzY2VuY2U7XCIpO1xuXG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJmbG9hdCBkSXJpZGVzY2VuY2VUaGlja25lc3M7XCIpO1xuICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcImlyaWRlc2NlbmNlVGhpY2tuZXNzXCIsIFwiaXJpZGVzY2VuY2VUaGlja25lc3NQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZykpO1xuICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0SXJpZGVzY2VuY2VUaGlja25lc3MoKTtcIik7XG4gICAgICAgICAgICAgICAgYXJncy5hcHBlbmQoXCJfbGl0U2hhZGVyQXJncy5pcmlkZXNjZW5jZS50aGlja25lc3MgPSBkSXJpZGVzY2VuY2VUaGlja25lc3M7XCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBzcGVjdWxhcml0eSAmIGdsb3NzaW5lc3NcbiAgICAgICAgICAgIGlmICgobGl0U2hhZGVyLmxpZ2h0aW5nICYmIG9wdGlvbnMubGl0T3B0aW9ucy51c2VTcGVjdWxhcikgfHwgbGl0U2hhZGVyLnJlZmxlY3Rpb25zKSB7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJ2ZWMzIGRTcGVjdWxhcml0eTtcIik7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJmbG9hdCBkR2xvc3NpbmVzcztcIik7XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMubGl0T3B0aW9ucy51c2VTaGVlbikge1xuICAgICAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcInZlYzMgc1NwZWN1bGFyaXR5O1wiKTtcbiAgICAgICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwic2hlZW5cIiwgXCJzaGVlblBTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nLCBvcHRpb25zLnNoZWVuRW5jb2RpbmcpKTtcbiAgICAgICAgICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRTaGVlbigpO1wiKTtcbiAgICAgICAgICAgICAgICAgICAgYXJncy5hcHBlbmQoXCJfbGl0U2hhZGVyQXJncy5zaGVlbi5zcGVjdWxhcml0eSA9IHNTcGVjdWxhcml0eTtcIik7XG5cbiAgICAgICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJmbG9hdCBzR2xvc3NpbmVzcztcIik7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcInNoZWVuR2xvc3NcIiwgXCJzaGVlbkdsb3NzUFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcpKTtcbiAgICAgICAgICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRTaGVlbkdsb3NzaW5lc3MoKTtcIik7XG4gICAgICAgICAgICAgICAgICAgIGFyZ3MuYXBwZW5kKFwiX2xpdFNoYWRlckFyZ3Muc2hlZW4uZ2xvc3MgPSBzR2xvc3NpbmVzcztcIik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLmxpdE9wdGlvbnMudXNlTWV0YWxuZXNzKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwiZmxvYXQgZE1ldGFsbmVzcztcIik7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcIm1ldGFsbmVzc1wiLCBcIm1ldGFsbmVzc1BTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nKSk7XG4gICAgICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0TWV0YWxuZXNzKCk7XCIpO1xuICAgICAgICAgICAgICAgICAgICBhcmdzLmFwcGVuZChcIl9saXRTaGFkZXJBcmdzLm1ldGFsbmVzcyA9IGRNZXRhbG5lc3M7XCIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5saXRPcHRpb25zLnVzZVNwZWN1bGFyaXR5RmFjdG9yKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwiZmxvYXQgZFNwZWN1bGFyaXR5RmFjdG9yO1wiKTtcbiAgICAgICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwic3BlY3VsYXJpdHlGYWN0b3JcIiwgXCJzcGVjdWxhcml0eUZhY3RvclBTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nKSk7XG4gICAgICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0U3BlY3VsYXJpdHlGYWN0b3IoKTtcIik7XG4gICAgICAgICAgICAgICAgICAgIGFyZ3MuYXBwZW5kKFwiX2xpdFNoYWRlckFyZ3Muc3BlY3VsYXJpdHlGYWN0b3IgPSBkU3BlY3VsYXJpdHlGYWN0b3I7XCIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5saXRPcHRpb25zLnVzZVNwZWN1bGFyQ29sb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwic3BlY3VsYXJcIiwgXCJzcGVjdWxhclBTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nLCBvcHRpb25zLnNwZWN1bGFyRW5jb2RpbmcpKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZChcInZvaWQgZ2V0U3BlY3VsYXJpdHkoKSB7IGRTcGVjdWxhcml0eSA9IHZlYzMoMSk7IH1cIik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcImdsb3NzXCIsIFwiZ2xvc3NQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZykpO1xuICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0R2xvc3NpbmVzcygpO1wiKTtcbiAgICAgICAgICAgICAgICBmdW5jLmFwcGVuZChcImdldFNwZWN1bGFyaXR5KCk7XCIpO1xuICAgICAgICAgICAgICAgIGFyZ3MuYXBwZW5kKFwiX2xpdFNoYWRlckFyZ3Muc3BlY3VsYXJpdHkgPSBkU3BlY3VsYXJpdHk7XCIpO1xuICAgICAgICAgICAgICAgIGFyZ3MuYXBwZW5kKFwiX2xpdFNoYWRlckFyZ3MuZ2xvc3MgPSBkR2xvc3NpbmVzcztcIik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwidmVjMyBkU3BlY3VsYXJpdHkgPSB2ZWMzKDAuMCk7XCIpO1xuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwiZmxvYXQgZEdsb3NzaW5lc3MgPSAwLjA7XCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBhb1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMuYW9EZXRhaWwpIHtcbiAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJhb0RldGFpbFwiLCBcImFvRGV0YWlsTWFwUFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChvcHRpb25zLmFvTWFwIHx8IG9wdGlvbnMuYW9WZXJ0ZXhDb2xvcikge1xuICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwiZmxvYXQgZEFvO1wiKTtcbiAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJhb1wiLCBcImFvUFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcpKTtcbiAgICAgICAgICAgICAgICBmdW5jLmFwcGVuZChcImdldEFPKCk7XCIpO1xuICAgICAgICAgICAgICAgIGFyZ3MuYXBwZW5kKFwiX2xpdFNoYWRlckFyZ3MuYW8gPSBkQW87XCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBlbWlzc2lvblxuICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJ2ZWMzIGRFbWlzc2lvbjtcIik7XG4gICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJlbWlzc2l2ZVwiLCBcImVtaXNzaXZlUFNcIiwgb3B0aW9ucywgbGl0U2hhZGVyLmNodW5rcywgdGV4dHVyZU1hcHBpbmcsIG9wdGlvbnMuZW1pc3NpdmVFbmNvZGluZykpO1xuICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRFbWlzc2lvbigpO1wiKTtcbiAgICAgICAgICAgIGFyZ3MuYXBwZW5kKFwiX2xpdFNoYWRlckFyZ3MuZW1pc3Npb24gPSBkRW1pc3Npb247XCIpO1xuXG4gICAgICAgICAgICAvLyBjbGVhcmNvYXRcbiAgICAgICAgICAgIGlmIChvcHRpb25zLmxpdE9wdGlvbnMudXNlQ2xlYXJDb2F0KSB7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJmbG9hdCBjY1NwZWN1bGFyaXR5O1wiKTtcbiAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcImZsb2F0IGNjR2xvc3NpbmVzcztcIik7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJ2ZWMzIGNjTm9ybWFsVztcIik7XG5cbiAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJjbGVhckNvYXRcIiwgXCJjbGVhckNvYXRQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZykpO1xuICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcImNsZWFyQ29hdEdsb3NzXCIsIFwiY2xlYXJDb2F0R2xvc3NQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZykpO1xuICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKHRoaXMuX2FkZE1hcChcImNsZWFyQ29hdE5vcm1hbFwiLCBcImNsZWFyQ29hdE5vcm1hbFBTXCIsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nKSk7XG5cbiAgICAgICAgICAgICAgICBmdW5jLmFwcGVuZChcImdldENsZWFyQ29hdCgpO1wiKTtcbiAgICAgICAgICAgICAgICBmdW5jLmFwcGVuZChcImdldENsZWFyQ29hdEdsb3NzaW5lc3MoKTtcIik7XG4gICAgICAgICAgICAgICAgZnVuYy5hcHBlbmQoXCJnZXRDbGVhckNvYXROb3JtYWwoKTtcIik7XG5cbiAgICAgICAgICAgICAgICBhcmdzLmFwcGVuZChcIl9saXRTaGFkZXJBcmdzLmNsZWFyY29hdC5zcGVjdWxhcml0eSA9IGNjU3BlY3VsYXJpdHk7XCIpO1xuICAgICAgICAgICAgICAgIGFyZ3MuYXBwZW5kKFwiX2xpdFNoYWRlckFyZ3MuY2xlYXJjb2F0Lmdsb3NzID0gY2NHbG9zc2luZXNzO1wiKTtcbiAgICAgICAgICAgICAgICBhcmdzLmFwcGVuZChcIl9saXRTaGFkZXJBcmdzLmNsZWFyY29hdC53b3JsZE5vcm1hbCA9IGNjTm9ybWFsVztcIik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGxpZ2h0bWFwXG4gICAgICAgICAgICBpZiAob3B0aW9ucy5saWdodE1hcCB8fCBvcHRpb25zLmxpZ2h0VmVydGV4Q29sb3IpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBsaWdodG1hcERpciA9IChvcHRpb25zLmRpckxpZ2h0TWFwICYmIG9wdGlvbnMubGl0T3B0aW9ucy51c2VTcGVjdWxhcik7XG4gICAgICAgICAgICAgICAgY29uc3QgbGlnaHRtYXBDaHVua1Byb3BOYW1lID0gbGlnaHRtYXBEaXIgPyAnbGlnaHRtYXBEaXJQUycgOiAnbGlnaHRtYXBTaW5nbGVQUyc7XG4gICAgICAgICAgICAgICAgZGVjbC5hcHBlbmQoXCJ2ZWMzIGRMaWdodG1hcDtcIik7XG4gICAgICAgICAgICAgICAgaWYgKGxpZ2h0bWFwRGlyKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlY2wuYXBwZW5kKFwidmVjMyBkTGlnaHRtYXBEaXI7XCIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb2RlLmFwcGVuZCh0aGlzLl9hZGRNYXAoXCJsaWdodFwiLCBsaWdodG1hcENodW5rUHJvcE5hbWUsIG9wdGlvbnMsIGxpdFNoYWRlci5jaHVua3MsIHRleHR1cmVNYXBwaW5nLCBvcHRpb25zLmxpZ2h0TWFwRW5jb2RpbmcpKTtcbiAgICAgICAgICAgICAgICBmdW5jLmFwcGVuZChcImdldExpZ2h0TWFwKCk7XCIpO1xuICAgICAgICAgICAgICAgIGFyZ3MuYXBwZW5kKFwiX2xpdFNoYWRlckFyZ3MubGlnaHRtYXAgPSBkTGlnaHRtYXA7XCIpO1xuICAgICAgICAgICAgICAgIGlmIChsaWdodG1hcERpcikge1xuICAgICAgICAgICAgICAgICAgICBhcmdzLmFwcGVuZChcIl9saXRTaGFkZXJBcmdzLmxpZ2h0bWFwRGlyID0gZExpZ2h0bWFwRGlyO1wiKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIG9ubHkgYWRkIHRoZSBsZWdhY3kgY2h1bmsgaWYgaXQncyByZWZlcmVuY2VkXG4gICAgICAgICAgICBpZiAoY29kZS5jb2RlLmluZGV4T2YoJ3RleHR1cmUyRFNSR0InKSAhPT0gLTEgfHxcbiAgICAgICAgICAgICAgICBjb2RlLmNvZGUuaW5kZXhPZigndGV4dHVyZTJEUkdCTScpICE9PSAtMSB8fFxuICAgICAgICAgICAgICAgIGNvZGUuY29kZS5pbmRleE9mKCd0ZXh0dXJlMkRSR0JFJykgIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgnU2hhZGVyIGNodW5rIG1hY3JvICR0ZXh0dXJlMkRTQU1QTEUoWFhYKSBpcyBkZXByZWNhdGVkLiBQbGVhc2UgdXNlICRERUNPREUodGV4dHVyZTJEKFhYWCkpIGluc3RlYWQuJyk7XG4gICAgICAgICAgICAgICAgY29kZS5wcmVwZW5kKGxpdFNoYWRlci5jaHVua3MudGV4dHVyZVNhbXBsZVBTKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gYWxsIG90aGVyIHBhc3NlcyByZXF1aXJlIG9ubHkgb3BhY2l0eVxuICAgICAgICAgICAgaWYgKG9wdGlvbnMubGl0T3B0aW9ucy5hbHBoYVRlc3QpIHtcbiAgICAgICAgICAgICAgICBkZWNsLmFwcGVuZChcImZsb2F0IGRBbHBoYTtcIik7XG4gICAgICAgICAgICAgICAgY29kZS5hcHBlbmQodGhpcy5fYWRkTWFwKFwib3BhY2l0eVwiLCBcIm9wYWNpdHlQU1wiLCBvcHRpb25zLCBsaXRTaGFkZXIuY2h1bmtzLCB0ZXh0dXJlTWFwcGluZykpO1xuICAgICAgICAgICAgICAgIGNvZGUuYXBwZW5kKGxpdFNoYWRlci5jaHVua3MuYWxwaGFUZXN0UFMpO1xuICAgICAgICAgICAgICAgIGZ1bmMuYXBwZW5kKFwiZ2V0T3BhY2l0eSgpO1wiKTtcbiAgICAgICAgICAgICAgICBmdW5jLmFwcGVuZChcImFscGhhVGVzdChkQWxwaGEpO1wiKTtcbiAgICAgICAgICAgICAgICBhcmdzLmFwcGVuZChcIl9saXRTaGFkZXJBcmdzLm9wYWNpdHkgPSBkQWxwaGE7XCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZGVjbC5hcHBlbmQobGl0U2hhZGVyLmNodW5rcy5saXRTaGFkZXJBcmdzUFMpO1xuICAgICAgICBjb2RlLmFwcGVuZChgTGl0U2hhZGVyQXJndW1lbnRzIGV2YWx1YXRlRnJvbnRlbmQoKSB7IExpdFNoYWRlckFyZ3VtZW50cyBfbGl0U2hhZGVyQXJnczsgXFxuJHtmdW5jLmNvZGV9XFxuJHthcmdzLmNvZGV9XFxuIHJldHVybiBfbGl0U2hhZGVyQXJncztcXG4gfVxcbmApO1xuICAgICAgICBmdW5jLmNvZGUgPSBgTGl0U2hhZGVyQXJndW1lbnRzIGxpdFNoYWRlckFyZ3MgPSBldmFsdWF0ZUZyb250ZW5kKCk7YDtcblxuICAgICAgICBmb3IgKGNvbnN0IHRleHR1cmUgaW4gdGV4dHVyZU1hcHBpbmcpIHtcbiAgICAgICAgICAgIGRlY2wuYXBwZW5kKGB1bmlmb3JtIHNhbXBsZXIyRCAke3RleHR1cmVNYXBwaW5nW3RleHR1cmVdfTtgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGRlY2wuYXBwZW5kKCcvLy0tLS0tLS0tIGZyb250ZW5kIGRlY2wgYmVnaW4nLCBkZWNsLmNvZGUsICcvLy0tLS0tLS0tIGZyb250ZW5kIGRlY2wgZW5kJyk7XG4gICAgICAgIC8vIGNvZGUuYXBwZW5kKCcvLy0tLS0tLS0tIGZyb250ZW5kIGNvZGUgYmVnaW4nLCBjb2RlLmNvZGUsICcvLy0tLS0tLS0tIGZyb250ZW5kIGNvZGUgZW5kJyk7XG4gICAgICAgIC8vIGZ1bmMuYXBwZW5kKCcvLy0tLS0tLS0tIGZyb250ZW5kIGZ1bmMgYmVnaW5cXG4ke2Z1bmN9Ly8tLS0tLS0tLSBmcm9udGVuZCBmdW5jIGVuZFxcbmA7XG5cbiAgICAgICAgLy8gZm9ybWF0IGZ1bmNcbiAgICAgICAgZnVuYy5jb2RlID0gYFxcbiR7ZnVuYy5jb2RlLnNwbGl0KCdcXG4nKS5tYXAobCA9PiBgICAgICR7bH1gKS5qb2luKCdcXG4nKX1cXG5cXG5gO1xuXG4gICAgICAgIGxpdFNoYWRlci5nZW5lcmF0ZUZyYWdtZW50U2hhZGVyKGRlY2wuY29kZSwgY29kZS5jb2RlLCBmdW5jLmNvZGUsIGxpZ2h0aW5nVXYpO1xuXG4gICAgICAgIHJldHVybiBsaXRTaGFkZXIuZ2V0RGVmaW5pdGlvbigpO1xuICAgIH1cbn07XG5cbmV4cG9ydCB7IF9tYXRUZXgyRCwgc3RhbmRhcmQgfTtcbiJdLCJuYW1lcyI6WyJfbWF0VGV4MkQiLCJzdGFuZGFyZCIsIm9wdGlvbnNDb250ZXh0IiwiU3RhbmRhcmRNYXRlcmlhbE9wdGlvbnMiLCJvcHRpb25zQ29udGV4dE1pbiIsImdlbmVyYXRlS2V5Iiwib3B0aW9ucyIsImJ1aWxkUHJvcGVydGllc0xpc3QiLCJwcm9wcyIsInByb3AiLCJoYXNPd25Qcm9wZXJ0eSIsInB1c2giLCJzb3J0IiwicHJvcHNNaW4iLCJrZXkiLCJpIiwibGVuZ3RoIiwiY2h1bmtzIiwicCIsImxpdE9wdGlvbnMiLCJtIiwiaXNDbHVzdGVyZWQiLCJjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQiLCJsaWdodHMiLCJsaWdodCIsIl90eXBlIiwiTElHSFRUWVBFX0RJUkVDVElPTkFMIiwiaGFzaENvZGUiLCJfZ2V0VXZTb3VyY2VFeHByZXNzaW9uIiwidHJhbnNmb3JtUHJvcE5hbWUiLCJ1VlByb3BOYW1lIiwidHJhbnNmb3JtSWQiLCJ1dkNoYW5uZWwiLCJpc01haW5QYXNzIiwiaXNGb3J3YXJkUGFzcyIsImV4cHJlc3Npb24iLCJuaW5lU2xpY2VkTW9kZSIsIlNQUklURV9SRU5ERVJNT0RFX1NMSUNFRCIsIlNQUklURV9SRU5ERVJNT0RFX1RJTEVEIiwiaGVpZ2h0TWFwIiwiX2FkZE1hcERlZiIsIm5hbWUiLCJlbmFibGVkIiwiX2FkZE1hcERlZnMiLCJmbG9hdCIsImNvbG9yIiwidmVydGV4IiwibWFwIiwiaW52ZXJ0IiwiX2FkZE1hcCIsInByb3BOYW1lIiwiY2h1bmtOYW1lIiwibWFwcGluZyIsImVuY29kaW5nIiwibWFwUHJvcE5hbWUiLCJpZGVudGlmaWVyUHJvcE5hbWUiLCJjaGFubmVsUHJvcE5hbWUiLCJ2ZXJ0ZXhDb2xvckNoYW5uZWxQcm9wTmFtZSIsInRpbnRQcm9wTmFtZSIsInZlcnRleENvbG9yUHJvcE5hbWUiLCJkZXRhaWxNb2RlUHJvcE5hbWUiLCJpbnZlcnROYW1lIiwidGludE9wdGlvbiIsInZlcnRleENvbG9yT3B0aW9uIiwidGV4dHVyZU9wdGlvbiIsInRleHR1cmVJZGVudGlmaWVyIiwiZGV0YWlsTW9kZU9wdGlvbiIsInN1YkNvZGUiLCJ1diIsInJlcGxhY2UiLCJzZWFyY2giLCJzYW1wbGVyTmFtZSIsImFsaWFzIiwiQ2h1bmtVdGlscyIsImRlY29kZUZ1bmMiLCJnYW1tYSIsImluZGV4T2YiLCJkZWNvZGVUYWJsZSIsImxpbmVhciIsInNyZ2IiLCJyZ2JtIiwicmdiZSIsImlzRmxvYXRUaW50IiwiaXNWZWNUaW50IiwiaW52ZXJ0T3B0aW9uIiwiX2NvcnJlY3RDaGFubmVsIiwiY2hhbiIsInN1YnN0cmluZyIsInN0ciIsImNociIsImNoYXJBdCIsImFkZExlbiIsImNyZWF0ZVNoYWRlckRlZmluaXRpb24iLCJkZXZpY2UiLCJzaGFkZXJQYXNzSW5mbyIsIlNoYWRlclBhc3MiLCJnZXQiLCJnZXRCeUluZGV4IiwicGFzcyIsImlzRm9yd2FyZCIsImxpdFNoYWRlciIsIkxpdFNoYWRlciIsInVzZVV2IiwidXNlVW5tb2RpZmllZFV2IiwibWFwVHJhbnNmb3JtcyIsIm1heFV2U2V0cyIsInRleHR1cmVNYXBwaW5nIiwibW5hbWUiLCJjbmFtZSIsInRuYW1lIiwidW5hbWUiLCJNYXRoIiwibWluIiwidXZTZXQiLCJpZCIsImZvcmNlVXYxIiwidW5kZWZpbmVkIiwiZ2VuZXJhdGVWZXJ0ZXhTaGFkZXIiLCJzaGFkaW5nTW9kZWwiLCJTUEVDVUxBUl9QSE9ORyIsImZyZXNuZWxNb2RlbCIsImFtYmllbnRTSCIsIkZSRVNORUxfU0NITElDSyIsImRlY2wiLCJDaHVua0J1aWxkZXIiLCJjb2RlIiwiZnVuYyIsImFyZ3MiLCJsaWdodGluZ1V2IiwiYXBwZW5kIiwiYmxlbmRUeXBlIiwiQkxFTkRfTk9ORSIsImFscGhhVGVzdCIsImFscGhhVG9Db3ZlcmFnZSIsImFscGhhVGVzdFBTIiwibmVlZHNOb3JtYWwiLCJub3JtYWxNYXAiLCJjbGVhckNvYXROb3JtYWxNYXAiLCJwYWNrZWROb3JtYWwiLCJub3JtYWxYWVBTIiwibm9ybWFsWFlaUFMiLCJoYXNUYW5nZW50cyIsImJhc2VOYW1lIiwibmVlZHNTY2VuZUNvbG9yIiwibmVlZHNTY3JlZW5TaXplIiwibmVlZHNUcmFuc2Zvcm1zIiwiZGlmZnVzZURldGFpbCIsImRpZmZ1c2VEZXRhaWxFbmNvZGluZyIsImRpZmZ1c2VFbmNvZGluZyIsInVzZVJlZnJhY3Rpb24iLCJ1c2VJcmlkZXNjZW5jZSIsImxpZ2h0aW5nIiwidXNlU3BlY3VsYXIiLCJyZWZsZWN0aW9ucyIsInVzZVNoZWVuIiwic2hlZW5FbmNvZGluZyIsInVzZU1ldGFsbmVzcyIsInVzZVNwZWN1bGFyaXR5RmFjdG9yIiwidXNlU3BlY3VsYXJDb2xvciIsInNwZWN1bGFyRW5jb2RpbmciLCJhb0RldGFpbCIsImFvTWFwIiwiYW9WZXJ0ZXhDb2xvciIsImVtaXNzaXZlRW5jb2RpbmciLCJ1c2VDbGVhckNvYXQiLCJsaWdodE1hcCIsImxpZ2h0VmVydGV4Q29sb3IiLCJsaWdodG1hcERpciIsImRpckxpZ2h0TWFwIiwibGlnaHRtYXBDaHVua1Byb3BOYW1lIiwibGlnaHRNYXBFbmNvZGluZyIsIkRlYnVnIiwiZGVwcmVjYXRlZCIsInByZXBlbmQiLCJ0ZXh0dXJlU2FtcGxlUFMiLCJsaXRTaGFkZXJBcmdzUFMiLCJ0ZXh0dXJlIiwic3BsaXQiLCJsIiwiam9pbiIsImdlbmVyYXRlRnJhZ21lbnRTaGFkZXIiLCJnZXREZWZpbml0aW9uIl0sIm1hcHBpbmdzIjoiOzs7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
