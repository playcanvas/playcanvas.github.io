/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { SEMANTIC_POSITION, SEMANTIC_ATTR12, SEMANTIC_ATTR13, SEMANTIC_ATTR14, SEMANTIC_ATTR15, SEMANTIC_NORMAL, SEMANTIC_TANGENT, SEMANTIC_COLOR, SEMANTIC_ATTR8, SEMANTIC_ATTR9, SEMANTIC_ATTR10, SEMANTIC_ATTR11, SEMANTIC_BLENDWEIGHT, SEMANTIC_BLENDINDICES, PIXELFORMAT_R8_G8_B8_A8, SHADERTAG_MATERIAL, SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD1 } from '../../constants.js';
import { shaderChunks } from '../chunks/chunks.js';
import { ChunkUtils } from '../chunk-utils.js';
import { SPRITE_RENDERMODE_SLICED, SPRITE_RENDERMODE_TILED, LIGHTTYPE_SPOT, LIGHTSHAPE_SPHERE, LIGHTSHAPE_DISK, LIGHTSHAPE_RECT, SHADER_DEPTH, SHADOW_VSM32, SHADOW_PCF3, LIGHTTYPE_OMNI, SHADOW_VSM8, LIGHTTYPE_DIRECTIONAL, SHADOW_PCF5, LIGHTSHAPE_PUNCTUAL, FRESNEL_SCHLICK, SPECOCC_GLOSSDEPENDENT, SPECOCC_AO, SHADOW_VSM16, SPECULAR_PHONG, shadowTypeToString, LIGHTFALLOFF_LINEAR, BLEND_NORMAL, BLEND_PREMULTIPLIED, BLEND_ADDITIVEALPHA, SHADER_PICK } from '../../../scene/constants.js';
import { LightsBuffer } from '../../../scene/lighting/lights-buffer.js';
import { ShaderPass } from '../../../scene/shader-pass.js';
import { skinCode, vertexIntro, fragmentIntro, begin, end, gammaCode, tonemapCode, fogCode } from './common.js';
import { validateUserChunks } from '../chunks/chunk-validation.js';

const builtinAttributes = {
  vertex_normal: SEMANTIC_NORMAL,
  vertex_tangent: SEMANTIC_TANGENT,
  vertex_texCoord0: SEMANTIC_TEXCOORD0,
  vertex_texCoord1: SEMANTIC_TEXCOORD1,
  vertex_color: SEMANTIC_COLOR,
  vertex_boneWeights: SEMANTIC_BLENDWEIGHT,
  vertex_boneIndices: SEMANTIC_BLENDINDICES
};
const builtinVaryings = {
  vVertexColor: "vec4",
  vPositionW: "vec3",
  vNormalV: "vec3",
  vNormalW: "vec3",
  vTangentW: "vec3",
  vBinormalW: "vec3",
  vObjectSpaceUpW: "vec3",
  vUv0: "vec2",
  vUv1: "vec2"
};

class LitShader {
  constructor(device, options) {
    this.device = device;
    this.options = options;
    this.attributes = {
      vertex_position: SEMANTIC_POSITION
    };

    if (options.chunks) {
      this.chunks = {};
      const userChunks = options.chunks;
      validateUserChunks(options.chunks);

      for (const chunkName in shaderChunks) {
        if (userChunks.hasOwnProperty(chunkName)) {
          const chunk = userChunks[chunkName];

          for (const a in builtinAttributes) {
            if (builtinAttributes.hasOwnProperty(a) && chunk.indexOf(a) >= 0) {
              this.attributes[a] = builtinAttributes[a];
            }
          }

          this.chunks[chunkName] = chunk;
        } else {
          this.chunks[chunkName] = shaderChunks[chunkName];
        }
      }
    } else {
      this.chunks = shaderChunks;
    }

    this.lighting = options.lights.length > 0 || !!options.dirLightMap || !!options.clusteredLightingEnabled;
    this.reflections = !!options.reflectionSource;
    if (!options.useSpecular) options.specularMap = options.glossMap = null;
    this.shadowPass = ShaderPass.isShadow(options.pass);
    this.needsNormal = this.lighting || this.reflections || options.useSpecular || options.ambientSH || options.heightMap || options.enableGGXSpecular || options.clusteredLightingEnabled && !this.shadowPass || options.clearCoatNormalMap;
    this.needsSceneColor = options.useDynamicRefraction;
    this.needsScreenSize = options.useDynamicRefraction;
    this.needsTransforms = options.useDynamicRefraction;
    this.varyings = "";
    this.vshader = null;
    this.frontendDecl = null;
    this.frontendCode = null;
    this.frontendFunc = null;
    this.lightingUv = null;
    this.defines = [];
    this.fshader = null;
  }

  _vsAddBaseCode(code, chunks, options) {
    code += chunks.baseVS;

    if (options.nineSlicedMode === SPRITE_RENDERMODE_SLICED || options.nineSlicedMode === SPRITE_RENDERMODE_TILED) {
      code += chunks.baseNineSlicedVS;
    }

    return code;
  }

  _vsAddTransformCode(code, device, chunks, options) {
    code += this.chunks.transformVS;
    return code;
  }

  _setMapTransform(codes, name, id, uv) {
    const checkId = id + uv * 100;

    if (!codes[3][checkId]) {
      const varName = `texture_${name}MapTransform`;
      codes[0] += `uniform vec3 ${varName}0;\n`;
      codes[0] += `uniform vec3 ${varName}1;\n`;
      codes[1] += `varying vec2 vUV${uv}_${id};\n`;
      codes[2] += `   vUV${uv}_${id} = vec2(dot(vec3(uv${uv}, 1), ${varName}0), dot(vec3(uv${uv}, 1), ${varName}1));\n`;
      codes[3][checkId] = true;
    }

    return codes;
  }

  _fsGetBaseCode() {
    const options = this.options;
    const chunks = this.chunks;
    let result = this.chunks.basePS;

    if (options.nineSlicedMode === SPRITE_RENDERMODE_SLICED) {
      result += chunks.baseNineSlicedPS;
    } else if (options.nineSlicedMode === SPRITE_RENDERMODE_TILED) {
      result += chunks.baseNineSlicedTiledPS;
    }

    return result;
  }

  _fsGetStartCode(code, device, chunks, options) {
    let result = chunks.startPS;

    if (options.nineSlicedMode === SPRITE_RENDERMODE_SLICED) {
      result += chunks.startNineSlicedPS;
    } else if (options.nineSlicedMode === SPRITE_RENDERMODE_TILED) {
      result += chunks.startNineSlicedTiledPS;
    }

    return result;
  }

  _directionalShadowMapProjection(light, shadowCoordArgs, shadowParamArg, lightIndex, coordsFunctionName) {
    let code = "";

    if (light.numCascades > 1) {
      code += `getShadowCascadeMatrix(light${lightIndex}_shadowMatrixPalette, light${lightIndex}_shadowCascadeDistances, light${lightIndex}_shadowCascadeCount);\n`;
      shadowCoordArgs = `(cascadeShadowMat, ${shadowParamArg});\n`;
    }

    code += coordsFunctionName + shadowCoordArgs;
    code += `fadeShadow(light${lightIndex}_shadowCascadeDistances);\n`;
    return code;
  }

  _nonPointShadowMapProjection(device, light, shadowMatArg, shadowParamArg, lightIndex) {
    const shadowCoordArgs = `(${shadowMatArg}, ${shadowParamArg});\n`;

    if (!light._normalOffsetBias || light._isVsm) {
      if (light._type === LIGHTTYPE_SPOT) {
        if (light._isPcf && (device.webgl2 || device.extStandardDerivatives)) {
          return "       getShadowCoordPerspZbuffer" + shadowCoordArgs;
        }

        return "       getShadowCoordPersp" + shadowCoordArgs;
      }

      return this._directionalShadowMapProjection(light, shadowCoordArgs, shadowParamArg, lightIndex, "getShadowCoordOrtho");
    }

    if (light._type === LIGHTTYPE_SPOT) {
      if (light._isPcf && (device.webgl2 || device.extStandardDerivatives)) {
        return "       getShadowCoordPerspZbufferNormalOffset" + shadowCoordArgs;
      }

      return "       getShadowCoordPerspNormalOffset" + shadowCoordArgs;
    }

    return this._directionalShadowMapProjection(light, shadowCoordArgs, shadowParamArg, lightIndex, "getShadowCoordOrthoNormalOffset");
  }

  _getLightSourceShapeString(shape) {
    switch (shape) {
      case LIGHTSHAPE_RECT:
        return 'Rect';

      case LIGHTSHAPE_DISK:
        return 'Disk';

      case LIGHTSHAPE_SPHERE:
        return 'Sphere';

      default:
        return '';
    }
  }

  generateVertexShader(useUv, useUnmodifiedUv, mapTransforms) {
    const device = this.device;
    const options = this.options;
    const chunks = this.chunks;
    let code = '';
    let codeBody = '';
    code = this._vsAddBaseCode(code, chunks, options);
    codeBody += "   vPositionW    = getWorldPosition();\n";

    if (this.options.pass === SHADER_DEPTH) {
      code += 'varying float vDepth;\n';
      code += '#ifndef VIEWMATRIX\n';
      code += '#define VIEWMATRIX\n';
      code += 'uniform mat4 matrix_view;\n';
      code += '#endif\n';
      code += '#ifndef CAMERAPLANES\n';
      code += '#define CAMERAPLANES\n';
      code += 'uniform vec4 camera_params;\n\n';
      code += '#endif\n';
      codeBody += "    vDepth = -(matrix_view * vec4(vPositionW,1.0)).z * camera_params.x;\n";
    }

    if (this.options.useInstancing) {
      this.attributes.instance_line1 = SEMANTIC_ATTR12;
      this.attributes.instance_line2 = SEMANTIC_ATTR13;
      this.attributes.instance_line3 = SEMANTIC_ATTR14;
      this.attributes.instance_line4 = SEMANTIC_ATTR15;
      code += chunks.instancingVS;
    }

    if (this.needsNormal) {
      this.attributes.vertex_normal = SEMANTIC_NORMAL;
      codeBody += "   vNormalW = getNormal();\n";

      if (options.reflectionSource === 'sphereMap' && device.fragmentUniformsCount <= 16) {
        code += chunks.viewNormalVS;
        codeBody += "   vNormalV    = getViewNormal();\n";
      }

      if (options.hasTangents && (options.heightMap || options.normalMap || options.enableGGXSpecular)) {
        this.attributes.vertex_tangent = SEMANTIC_TANGENT;
        code += chunks.tangentBinormalVS;
        codeBody += "   vTangentW   = getTangent();\n";
        codeBody += "   vBinormalW  = getBinormal();\n";
      } else if (options.enableGGXSpecular) {
        code += chunks.tangentBinormalVS;
        codeBody += "   vObjectSpaceUpW  = getObjectSpaceUp();\n";
      }
    }

    const maxUvSets = 2;

    for (let i = 0; i < maxUvSets; i++) {
      if (useUv[i]) {
        this.attributes["vertex_texCoord" + i] = "TEXCOORD" + i;
        code += chunks["uv" + i + "VS"];
        codeBody += "   vec2 uv" + i + " = getUv" + i + "();\n";
      }

      if (useUnmodifiedUv[i]) {
        codeBody += "   vUv" + i + " = uv" + i + ";\n";
      }
    }

    const codes = [code, this.varyings, codeBody, []];
    mapTransforms.forEach(mapTransform => {
      this._setMapTransform(codes, mapTransform.name, mapTransform.id, mapTransform.uv);
    });
    code = codes[0];
    this.varyings = codes[1];
    codeBody = codes[2];

    if (options.vertexColors) {
      this.attributes.vertex_color = SEMANTIC_COLOR;
      codeBody += "   vVertexColor = vertex_color;\n";
    }

    if (options.msdf && options.msdfTextAttribute) {
      this.attributes.vertex_outlineParameters = SEMANTIC_ATTR8;
      this.attributes.vertex_shadowParameters = SEMANTIC_ATTR9;
      codeBody += "    unpackMsdfParams();\n";
      code += chunks.msdfVS;
    }

    if (options.useMorphPosition || options.useMorphNormal) {
      if (options.useMorphTextureBased) {
        code += "#define MORPHING_TEXTURE_BASED\n";

        if (options.useMorphPosition) {
          code += "#define MORPHING_TEXTURE_BASED_POSITION\n";
        }

        if (options.useMorphNormal) {
          code += "#define MORPHING_TEXTURE_BASED_NORMAL\n";
        }

        this.attributes.morph_vertex_id = SEMANTIC_ATTR15;
        code += "attribute float morph_vertex_id;\n";
      } else {
        code += "#define MORPHING\n";

        if (options.useMorphPosition) {
          this.attributes.morph_pos0 = SEMANTIC_ATTR8;
          this.attributes.morph_pos1 = SEMANTIC_ATTR9;
          this.attributes.morph_pos2 = SEMANTIC_ATTR10;
          this.attributes.morph_pos3 = SEMANTIC_ATTR11;
          code += "#define MORPHING_POS03\n";
          code += "attribute vec3 morph_pos0;\n";
          code += "attribute vec3 morph_pos1;\n";
          code += "attribute vec3 morph_pos2;\n";
          code += "attribute vec3 morph_pos3;\n";
        } else if (options.useMorphNormal) {
          this.attributes.morph_nrm0 = SEMANTIC_ATTR8;
          this.attributes.morph_nrm1 = SEMANTIC_ATTR9;
          this.attributes.morph_nrm2 = SEMANTIC_ATTR10;
          this.attributes.morph_nrm3 = SEMANTIC_ATTR11;
          code += "#define MORPHING_NRM03\n";
          code += "attribute vec3 morph_nrm0;\n";
          code += "attribute vec3 morph_nrm1;\n";
          code += "attribute vec3 morph_nrm2;\n";
          code += "attribute vec3 morph_nrm3;\n";
        }

        if (!options.useMorphNormal) {
          this.attributes.morph_pos4 = SEMANTIC_ATTR12;
          this.attributes.morph_pos5 = SEMANTIC_ATTR13;
          this.attributes.morph_pos6 = SEMANTIC_ATTR14;
          this.attributes.morph_pos7 = SEMANTIC_ATTR15;
          code += "#define MORPHING_POS47\n";
          code += "attribute vec3 morph_pos4;\n";
          code += "attribute vec3 morph_pos5;\n";
          code += "attribute vec3 morph_pos6;\n";
          code += "attribute vec3 morph_pos7;\n";
        } else {
          this.attributes.morph_nrm4 = SEMANTIC_ATTR12;
          this.attributes.morph_nrm5 = SEMANTIC_ATTR13;
          this.attributes.morph_nrm6 = SEMANTIC_ATTR14;
          this.attributes.morph_nrm7 = SEMANTIC_ATTR15;
          code += "#define MORPHING_NRM47\n";
          code += "attribute vec3 morph_nrm4;\n";
          code += "attribute vec3 morph_nrm5;\n";
          code += "attribute vec3 morph_nrm6;\n";
          code += "attribute vec3 morph_nrm7;\n";
        }
      }
    }

    if (options.skin) {
      this.attributes.vertex_boneWeights = SEMANTIC_BLENDWEIGHT;
      this.attributes.vertex_boneIndices = SEMANTIC_BLENDINDICES;
      code += skinCode(device, chunks);
      code += "#define SKIN\n";
    } else if (options.useInstancing) {
      code += "#define INSTANCING\n";
    }

    if (options.screenSpace) {
      code += "#define SCREENSPACE\n";
    }

    if (options.pixelSnap) {
      code += "#define PIXELSNAP\n";
    }

    code = this._vsAddTransformCode(code, device, chunks, options);

    if (this.needsNormal) {
      code += chunks.normalVS;
    }

    code += "\n";
    code += chunks.startVS;
    code += codeBody;
    code += chunks.endVS;
    code += "}";
    Object.keys(builtinVaryings).forEach(v => {
      if (code.indexOf(v) >= 0) {
        this.varyings += `varying ${builtinVaryings[v]} ${v};\n`;
      }
    });
    const startCode = vertexIntro(device, 'LitShader', this.options.pass, chunks.extensionVS);
    this.vshader = startCode + this.varyings + code;
  }

  _fsGetBeginCode() {
    const device = this.device;
    const chunks = this.chunks;
    const precision = this.options.forceFragmentPrecision;
    let code = fragmentIntro(device, 'LitShader', this.options.pass, chunks.extensionPS, precision);

    for (let i = 0; i < this.defines.length; i++) {
      code += `#define ${this.defines[i]}\n`;
    }

    return code;
  }

  _fsGetPickPassCode() {
    let code = this._fsGetBeginCode();

    code += "uniform vec4 uColor;\n";
    code += this.varyings;
    code += this.frontendDecl;
    code += this.frontendCode;
    code += begin();
    code += this.frontendFunc;
    code += "    gl_FragColor = uColor;\n";
    code += end();
    return code;
  }

  _fsGetDepthPassCode() {
    const chunks = this.chunks;

    let code = this._fsGetBeginCode();

    code += 'varying float vDepth;\n';
    code += this.varyings;
    code += chunks.packDepthPS;
    code += this.frontendDecl;
    code += this.frontendCode;
    code += begin();
    code += this.frontendFunc;
    code += "    gl_FragColor = packFloat(vDepth);\n";
    code += end();
    return code;
  }

  _fsGetShadowPassCode() {
    const device = this.device;
    const options = this.options;
    const chunks = this.chunks;
    const varyings = this.varyings;
    const lightType = ShaderPass.toLightType(options.pass);
    const shadowType = ShaderPass.toShadowType(options.pass);

    let code = this._fsGetBeginCode();

    if (device.extStandardDerivatives && !device.webgl2) {
      code += 'uniform vec2 polygonOffset;\n';
    }

    if (shadowType === SHADOW_VSM32) {
      if (device.textureFloatHighPrecision) {
        code += '#define VSM_EXPONENT 15.0\n\n';
      } else {
        code += '#define VSM_EXPONENT 5.54\n\n';
      }
    } else if (shadowType === SHADOW_VSM16) {
      code += '#define VSM_EXPONENT 5.54\n\n';
    }

    if (lightType !== LIGHTTYPE_DIRECTIONAL) {
      code += 'uniform vec3 view_position;\n';
      code += 'uniform float light_radius;\n';
    }

    code += varyings;
    code += this.frontendDecl;
    code += this.frontendCode;

    if (shadowType === SHADOW_PCF3 && (!device.webgl2 || lightType === LIGHTTYPE_OMNI)) {
      code += chunks.packDepthPS;
    } else if (shadowType === SHADOW_VSM8) {
      code += "vec2 encodeFloatRG( float v ) {\n";
      code += "    vec2 enc = vec2(1.0, 255.0) * v;\n";
      code += "    enc = fract(enc);\n";
      code += "    enc -= enc.yy * vec2(1.0/255.0, 1.0/255.0);\n";
      code += "    return enc;\n";
      code += "}\n\n";
    }

    code += begin();
    code += this.frontendFunc;
    const isVsm = shadowType === SHADOW_VSM8 || shadowType === SHADOW_VSM16 || shadowType === SHADOW_VSM32;
    const applySlopeScaleBias = !device.webgl2 && device.extStandardDerivatives;

    if (lightType === LIGHTTYPE_OMNI || isVsm && lightType !== LIGHTTYPE_DIRECTIONAL) {
      code += "    float depth = min(distance(view_position, vPositionW) / light_radius, 0.99999);\n";
    } else {
      code += "    float depth = gl_FragCoord.z;\n";
    }

    if (applySlopeScaleBias) {
      code += "    float minValue = 2.3374370500153186e-10; //(1.0 / 255.0) / (256.0 * 256.0 * 256.0);\n";
      code += "    depth += polygonOffset.x * max(abs(dFdx(depth)), abs(dFdy(depth))) + minValue * polygonOffset.y;\n";
    }

    if (shadowType === SHADOW_PCF3 && (!device.webgl2 || lightType === LIGHTTYPE_OMNI && !options.clusteredLightingEnabled)) {
      code += "    gl_FragColor = packFloat(depth);\n";
    } else if (shadowType === SHADOW_PCF3 || shadowType === SHADOW_PCF5) {
      code += "    gl_FragColor = vec4(1.0);\n";

      if (options.clusteredLightingEnabled && lightType === LIGHTTYPE_OMNI && device.webgl2) {
        code += "    gl_FragDepth = depth;\n";
      }
    } else if (shadowType === SHADOW_VSM8) {
      code += "    gl_FragColor = vec4(encodeFloatRG(depth), encodeFloatRG(depth*depth));\n";
    } else {
      code += chunks.storeEVSMPS;
    }

    code += end();
    return code;
  }

  _fsGetLitPassCode() {
    const device = this.device;
    const options = this.options;
    const chunks = this.chunks;
    let code = "";

    if (options.opacityFadesSpecular === false) {
      code += 'uniform float material_alphaFade;\n';
    }

    if (options.useSpecular) {
      this.defines.push("LIT_SPECULAR");

      if (this.reflections) {
        this.defines.push("LIT_REFLECTIONS");
      }

      if (options.clearCoat) {
        this.defines.push("LIT_CLEARCOAT");
      }

      if (options.fresnelModel > 0) {
        this.defines.push("LIT_SPECULAR_FRESNEL");
      }

      if (options.conserveEnergy) {
        this.defines.push("LIT_CONSERVE_ENERGY");
      }

      if (options.sheen) {
        this.defines.push("LIT_SHEEN");
      }

      if (options.iridescence) {
        this.defines.push("LIT_IRIDESCENCE");
      }
    }

    const shadowTypeUsed = [];
    let numShadowLights = 0;
    let shadowedDirectionalLightUsed = false;
    let useVsm = false;
    let usePerspZbufferShadow = false;
    let hasAreaLights = options.lights.some(function (light) {
      return light._shape && light._shape !== LIGHTSHAPE_PUNCTUAL;
    });

    if (options.clusteredLightingEnabled && options.clusteredLightingAreaLightsEnabled) {
      hasAreaLights = true;
    }

    let areaLutsPrecision = 'highp';

    if (device.areaLightLutFormat === PIXELFORMAT_R8_G8_B8_A8) {
      code += "#define AREA_R8_G8_B8_A8_LUTS\n";
      areaLutsPrecision = 'lowp';
    }

    if (hasAreaLights || options.clusteredLightingEnabled) {
      code += "#define AREA_LIGHTS\n";
      code += `uniform ${areaLutsPrecision} sampler2D areaLightsLutTex1;\n`;
      code += `uniform ${areaLutsPrecision} sampler2D areaLightsLutTex2;\n`;
    }

    for (let i = 0; i < options.lights.length; i++) {
      const light = options.lights[i];
      const lightType = light._type;
      if (options.clusteredLightingEnabled && lightType !== LIGHTTYPE_DIRECTIONAL) continue;
      const lightShape = hasAreaLights && light._shape ? light._shape : LIGHTSHAPE_PUNCTUAL;
      code += "uniform vec3 light" + i + "_color;\n";

      if (lightType === LIGHTTYPE_DIRECTIONAL) {
        code += "uniform vec3 light" + i + "_direction;\n";
      } else {
        code += "uniform vec3 light" + i + "_position;\n";
        code += "uniform float light" + i + "_radius;\n";

        if (lightType === LIGHTTYPE_SPOT) {
          code += "uniform vec3 light" + i + "_direction;\n";
          code += "uniform float light" + i + "_innerConeAngle;\n";
          code += "uniform float light" + i + "_outerConeAngle;\n";
        }
      }

      if (lightShape !== LIGHTSHAPE_PUNCTUAL) {
        if (lightType === LIGHTTYPE_DIRECTIONAL) {
          code += "uniform vec3 light" + i + "_position;\n";
        }

        code += "uniform vec3 light" + i + "_halfWidth;\n";
        code += "uniform vec3 light" + i + "_halfHeight;\n";
      }

      if (light.castShadows && !options.noShadow) {
        code += "uniform mat4 light" + i + "_shadowMatrix;\n";
        code += "uniform float light" + i + "_shadowIntensity;\n";

        if (lightType === LIGHTTYPE_DIRECTIONAL) {
          code += "uniform mat4 light" + i + "_shadowMatrixPalette[4];\n";
          code += "uniform float light" + i + "_shadowCascadeDistances[4];\n";
          code += "uniform float light" + i + "_shadowCascadeCount;\n";
        }

        if (lightType !== LIGHTTYPE_DIRECTIONAL) {
          code += "uniform vec4 light" + i + "_shadowParams;\n";
        } else {
          shadowedDirectionalLightUsed = true;
          code += "uniform vec3 light" + i + "_shadowParams;\n";
        }

        if (lightType === LIGHTTYPE_OMNI) {
          code += "uniform samplerCube light" + i + "_shadowMap;\n";
        } else {
          if (light._isPcf && device.webgl2) {
            code += "uniform sampler2DShadow light" + i + "_shadowMap;\n";
          } else {
            code += "uniform sampler2D light" + i + "_shadowMap;\n";
          }
        }

        numShadowLights++;
        shadowTypeUsed[light._shadowType] = true;
        if (light._isVsm) useVsm = true;
        if (light._isPcf && (device.webgl2 || device.extStandardDerivatives) && lightType === LIGHTTYPE_SPOT) usePerspZbufferShadow = true;
      }

      if (light._cookie) {
        if (light._cookie._cubemap) {
          if (lightType === LIGHTTYPE_OMNI) {
            code += "uniform samplerCube light" + i + "_cookie;\n";
            code += "uniform float light" + i + "_cookieIntensity;\n";
            if (!light.castShadows || options.noShadow) code += "uniform mat4 light" + i + "_shadowMatrix;\n";
          }
        } else {
          if (lightType === LIGHTTYPE_SPOT) {
            code += "uniform sampler2D light" + i + "_cookie;\n";
            code += "uniform float light" + i + "_cookieIntensity;\n";
            if (!light.castShadows || options.noShadow) code += "uniform mat4 light" + i + "_shadowMatrix;\n";

            if (light._cookieTransform) {
              code += "uniform vec4 light" + i + "_cookieMatrix;\n";
              code += "uniform vec2 light" + i + "_cookieOffset;\n";
            }
          }
        }
      }
    }

    code += "\n";
    const hasTBN = this.needsNormal && (options.normalMap || options.clearCoatNormalMap || options.enableGGXSpecular && !options.heightMap);

    if (hasTBN) {
      if (options.hasTangents) {
        code += options.fastTbn ? chunks.TBNfastPS : chunks.TBNPS;
      } else {
        if (device.extStandardDerivatives && (options.normalMap || options.clearCoatNormalMap)) {
          code += chunks.TBNderivativePS.replace(/\$UV/g, this.lightingUv);
        } else {
          code += chunks.TBNObjectSpacePS;
        }
      }
    }

    code += chunks.sphericalPS;
    code += chunks.decodePS;
    code += gammaCode(options.gamma, chunks);
    code += tonemapCode(options.toneMap, chunks);
    code += fogCode(options.fog, chunks);
    code += this.frontendCode;

    if (options.useCubeMapRotation) {
      code += "#define CUBEMAP_ROTATION\n";
    }

    if (this.needsNormal) {
      code += chunks.cubeMapRotatePS;
      code += options.cubeMapProjection > 0 ? chunks.cubeMapProjectBoxPS : chunks.cubeMapProjectNonePS;
      code += options.skyboxIntensity ? chunks.envMultiplyPS : chunks.envConstPS;
    }

    if (this.lighting && options.useSpecular || this.reflections) {
      if (options.useMetalness) {
        code += chunks.metalnessModulatePS;
      }

      if (options.fresnelModel === FRESNEL_SCHLICK) {
        code += chunks.fresnelSchlickPS;
      }

      if (options.iridescence) {
        code += chunks.iridescenceDiffractionPS;
      }
    }

    const useAo = options.aoMap || options.aoVertexColor;

    if (useAo) {
      code += chunks.aoDiffuseOccPS;

      switch (options.occludeSpecular) {
        case SPECOCC_AO:
          code += options.occludeSpecularFloat ? chunks.aoSpecOccSimplePS : chunks.aoSpecOccConstSimplePS;
          break;

        case SPECOCC_GLOSSDEPENDENT:
          code += options.occludeSpecularFloat ? chunks.aoSpecOccPS : chunks.aoSpecOccConstPS;
          break;
      }
    }

    if (options.reflectionSource === 'envAtlasHQ') {
      code += options.fixSeams ? chunks.fixCubemapSeamsStretchPS : chunks.fixCubemapSeamsNonePS;
      code += chunks.envAtlasPS;
      code += chunks.reflectionEnvHQPS.replace(/\$DECODE/g, ChunkUtils.decodeFunc(options.reflectionEncoding));
    } else if (options.reflectionSource === 'envAtlas') {
      code += chunks.envAtlasPS;
      code += chunks.reflectionEnvPS.replace(/\$DECODE/g, ChunkUtils.decodeFunc(options.reflectionEncoding));
    } else if (options.reflectionSource === 'cubeMap') {
      code += options.fixSeams ? chunks.fixCubemapSeamsStretchPS : chunks.fixCubemapSeamsNonePS;
      code += chunks.reflectionCubePS.replace(/\$DECODE/g, ChunkUtils.decodeFunc(options.reflectionEncoding));
    } else if (options.reflectionSource === 'sphereMap') {
      const scode = device.fragmentUniformsCount > 16 ? chunks.reflectionSpherePS : chunks.reflectionSphereLowPS;
      code += scode.replace(/\$DECODE/g, ChunkUtils.decodeFunc(options.reflectionEncoding));
    }

    if (this.reflections) {
      if (options.clearCoat) {
        code += chunks.reflectionCCPS;
      }

      if (options.sheen) {
        code += chunks.reflectionSheenPS;
      }
    }

    if (options.refraction) {
      if (options.useDynamicRefraction) {
        code += chunks.refractionDynamicPS;
      } else if (this.reflections) {
        code += chunks.refractionCubePS;
      }
    }

    if (options.sheen) {
      code += chunks.lightSheenPS;
    }

    if (options.clusteredLightingEnabled) {
      code += chunks.clusteredLightUtilsPS;
      if (options.clusteredLightingCookiesEnabled) code += chunks.clusteredLightCookiesPS;

      if (options.clusteredLightingShadowsEnabled && !options.noShadow) {
        shadowTypeUsed[SHADOW_PCF3] = true;
        shadowTypeUsed[SHADOW_PCF5] = true;
      }

      usePerspZbufferShadow = true;
    }

    if (numShadowLights > 0 || options.clusteredLightingEnabled) {
      if (shadowedDirectionalLightUsed) {
        code += chunks.shadowCascadesPS;
      }

      if (shadowTypeUsed[SHADOW_PCF3]) {
        code += chunks.shadowStandardPS;
      }

      if (shadowTypeUsed[SHADOW_PCF5] && device.webgl2) {
        code += chunks.shadowStandardGL2PS;
      }

      if (useVsm) {
        code += chunks.shadowVSM_commonPS;

        if (shadowTypeUsed[SHADOW_VSM8]) {
          code += chunks.shadowVSM8PS;
        }

        if (shadowTypeUsed[SHADOW_VSM16]) {
          code += device.extTextureHalfFloatLinear ? chunks.shadowEVSMPS.replace(/\$/g, "16") : chunks.shadowEVSMnPS.replace(/\$/g, "16");
        }

        if (shadowTypeUsed[SHADOW_VSM32]) {
          code += device.extTextureFloatLinear ? chunks.shadowEVSMPS.replace(/\$/g, "32") : chunks.shadowEVSMnPS.replace(/\$/g, "32");
        }
      }

      if (!(device.webgl2 || device.extStandardDerivatives)) {
        code += chunks.biasConstPS;
      }

      code += chunks.shadowCoordPS + chunks.shadowCommonPS;
      if (usePerspZbufferShadow) code += chunks.shadowCoordPerspZbufferPS;
    }

    if (options.enableGGXSpecular) code += "uniform float material_anisotropy;\n";

    if (this.lighting) {
      code += chunks.lightDiffuseLambertPS;
      if (hasAreaLights || options.clusteredLightingEnabled) code += chunks.ltc;
    }

    code += '\n';
    let useOldAmbient = false;

    if (options.useSpecular) {
      if (this.lighting) {
        code += options.shadingModel === SPECULAR_PHONG ? chunks.lightSpecularPhongPS : options.enableGGXSpecular ? chunks.lightSpecularAnisoGGXPS : chunks.lightSpecularBlinnPS;
      }

      if (!options.fresnelModel && !this.reflections && !options.diffuseMap) {
        code += "    uniform vec3 material_ambient;\n";
        code += "#define LIT_OLD_AMBIENT";
        useOldAmbient = true;
      }
    }

    code += chunks.combinePS;

    if (options.lightMap || options.lightVertexColor) {
      code += options.useSpecular && options.dirLightMap ? chunks.lightmapDirAddPS : chunks.lightmapAddPS;
    }

    const addAmbient = !options.lightMap && !options.lightVertexColor || options.lightMapWithoutAmbient;

    if (addAmbient) {
      if (options.ambientSource === 'ambientSH') {
        code += chunks.ambientSHPS;
      } else if (options.ambientSource === 'envAtlas') {
        if (options.reflectionSource !== 'envAtlas' && options.reflectionSource !== 'envAtlasHQ') {
          code += chunks.envAtlasPS;
        }

        code += chunks.ambientEnvPS.replace(/\$DECODE/g, ChunkUtils.decodeFunc(options.ambientEncoding));
      } else {
        code += chunks.ambientConstantPS;
      }
    }

    if (options.ambientTint && !useOldAmbient) {
      code += "uniform vec3 material_ambient;\n";
    }

    if (options.msdf) {
      if (!options.msdfTextAttribute) {
        code += "\n#define UNIFORM_TEXT_PARAMETERS";
      }

      code += chunks.msdfPS;
    }

    if (this.needsNormal) {
      code += chunks.viewDirPS;

      if (options.useSpecular) {
        code += options.enableGGXSpecular ? chunks.reflDirAnisoPS : chunks.reflDirPS;
      }
    }

    let hasPointLights = false;
    let usesLinearFalloff = false;
    let usesInvSquaredFalloff = false;
    let usesSpot = false;
    let usesCookie = false;
    let usesCookieNow;

    if (options.clusteredLightingEnabled && this.lighting) {
      usesSpot = true;
      hasPointLights = true;
      usesLinearFalloff = true;
      usesCookie = true;
      code += chunks.floatUnpackingPS;
      if (options.lightMaskDynamic) code += "\n#define CLUSTER_MESH_DYNAMIC_LIGHTS";
      if (options.clusteredLightingCookiesEnabled) code += "\n#define CLUSTER_COOKIES";

      if (options.clusteredLightingShadowsEnabled && !options.noShadow) {
        code += "\n#define CLUSTER_SHADOWS";
        code += "\n#define CLUSTER_SHADOW_TYPE_" + shadowTypeToString[options.clusteredLightingShadowType];
      }

      if (options.clusteredLightingAreaLightsEnabled) code += "\n#define CLUSTER_AREALIGHTS";
      code += LightsBuffer.shaderDefines;

      if (options.clusteredLightingShadowsEnabled && !options.noShadow) {
        code += chunks.clusteredLightShadowsPS;
      }

      code += chunks.clusteredLightPS;
    }

    if (options.twoSidedLighting) code += "uniform float twoSidedLightingNegScaleFactor;\n";
    code += this._fsGetStartCode(code, device, chunks, options);

    if (this.needsNormal) {
      if (options.twoSidedLighting) {
        code += "    dVertexNormalW = normalize(gl_FrontFacing ? vNormalW * twoSidedLightingNegScaleFactor : -vNormalW * twoSidedLightingNegScaleFactor);\n";
      } else {
        code += "    dVertexNormalW = normalize(vNormalW);\n";
      }

      if ((options.heightMap || options.normalMap) && options.hasTangents) {
        if (options.twoSidedLighting) {
          code += "    dTangentW = gl_FrontFacing ? vTangentW * twoSidedLightingNegScaleFactor : -vTangentW * twoSidedLightingNegScaleFactor;\n";
          code += "    dBinormalW = gl_FrontFacing ? vBinormalW * twoSidedLightingNegScaleFactor : -vBinormalW * twoSidedLightingNegScaleFactor;\n";
        } else {
          code += "    dTangentW = vTangentW;\n";
          code += "    dBinormalW = vBinormalW;\n";
        }
      }

      code += "    getViewDir();\n";

      if (hasTBN) {
        code += "    getTBN();\n";
      }
    }

    code += this.frontendFunc;

    if (this.needsNormal) {
      if (options.useSpecular) {
        code += "    getReflDir();\n";
      }

      if (options.clearCoat) {
        code += "    ccReflDirW = normalize(-reflect(dViewDirW, ccNormalW));\n";
      }
    }

    if (this.lighting && options.useSpecular || this.reflections) {
      if (options.useMetalness) {
        code += "    getMetalnessModulate();\n";
      }

      if (options.iridescence) {
        code += "    getIridescence(saturate(dot(dViewDirW, dNormalW)));\n";
      }
    }

    if (addAmbient) {
      code += "    addAmbient();\n";

      if (options.separateAmbient) {
        code += `
                    vec3 dAmbientLight = dDiffuseLight;
                    dDiffuseLight = vec3(0);
                `;
      }
    }

    if (options.ambientTint && !useOldAmbient) {
      code += "    dDiffuseLight *= material_ambient;\n";
    }

    if (useAo && !options.occludeDirect) {
      code += "    occludeDiffuse();\n";
    }

    if (options.lightMap || options.lightVertexColor) {
      code += "    addLightMap();\n";
    }

    if (this.lighting || this.reflections) {
      if (this.reflections) {
        if (options.clearCoat) {
          code += "    addReflectionCC();\n";

          if (options.fresnelModel > 0) {
            code += "    ccFresnel = getFresnelCC(dot(dViewDirW, ccNormalW), ccGlossiness);\n";
            code += "    ccReflection.rgb *= ccFresnel;\n";
          } else {
            code += "    ccFresnel = 0.0;\n";
          }
        }

        if (options.useSpecularityFactor) {
          code += "    ccReflection.rgb *= dSpecularityFactor;\n";
        }

        if (options.sheen) {
          code += "    addReflectionSheen();\n";
        }

        code += "    addReflection();\n";

        if (options.fresnelModel > 0) {
          code += "    dReflection.rgb *= getFresnel(dot(dViewDirW, dNormalW), dSpecularity);\n";
        } else {
          code += "    dReflection.rgb *= dSpecularity;\n";
        }

        if (options.useSpecularityFactor) {
          code += "    dReflection.rgb *= dSpecularityFactor;\n";
        }
      }

      if (hasAreaLights) {
        code += "    dSpecularLight *= dSpecularity;\n";

        if (options.useSpecular) {
          code += "    calcLTCLightValues();\n";
        }
      }

      for (let i = 0; i < options.lights.length; i++) {
        const light = options.lights[i];
        const lightType = light._type;

        if (options.clusteredLightingEnabled && lightType !== LIGHTTYPE_DIRECTIONAL) {
          continue;
        }

        usesCookieNow = false;
        const lightShape = hasAreaLights && light._shape ? light.shape : LIGHTSHAPE_PUNCTUAL;
        const shapeString = hasAreaLights && light._shape ? this._getLightSourceShapeString(lightShape) : '';

        if (lightShape !== LIGHTSHAPE_PUNCTUAL) {
          code += "    calc" + shapeString + "LightValues(light" + i + "_position, light" + i + "_halfWidth, light" + i + "_halfHeight);\n";
        }

        if (lightType === LIGHTTYPE_DIRECTIONAL) {
          code += "    dLightDirNormW = light" + i + "_direction;\n";
          code += "    dAtten = 1.0;\n";
        } else {
          if (light._cookie) {
            if (lightType === LIGHTTYPE_SPOT && !light._cookie._cubemap) {
              usesCookie = true;
              usesCookieNow = true;
            } else if (lightType === LIGHTTYPE_OMNI && light._cookie._cubemap) {
              usesCookie = true;
              usesCookieNow = true;
            }
          }

          code += "    getLightDirPoint(light" + i + "_position);\n";
          hasPointLights = true;

          if (usesCookieNow) {
            if (lightType === LIGHTTYPE_SPOT) {
              code += "    dAtten3 = getCookie2D" + (light._cookieFalloff ? "" : "Clip") + (light._cookieTransform ? "Xform" : "") + "(light" + i + "_cookie, light" + i + "_shadowMatrix, light" + i + "_cookieIntensity" + (light._cookieTransform ? ", light" + i + "_cookieMatrix, light" + i + "_cookieOffset" : "") + ")." + light._cookieChannel + ";\n";
            } else {
              code += "    dAtten3 = getCookieCube(light" + i + "_cookie, light" + i + "_shadowMatrix, light" + i + "_cookieIntensity)." + light._cookieChannel + ";\n";
            }
          }

          if (lightShape === LIGHTSHAPE_PUNCTUAL) {
            if (light._falloffMode === LIGHTFALLOFF_LINEAR) {
              code += "    dAtten = getFalloffLinear(light" + i + "_radius);\n";
              usesLinearFalloff = true;
            } else {
              code += "    dAtten = getFalloffInvSquared(light" + i + "_radius);\n";
              usesInvSquaredFalloff = true;
            }
          } else {
            code += "    dAtten = getFalloffWindow(light" + i + "_radius);\n";
            usesInvSquaredFalloff = true;
          }

          code += "    if (dAtten > 0.00001) {\n";

          if (lightType === LIGHTTYPE_SPOT) {
            if (!(usesCookieNow && !light._cookieFalloff)) {
              code += "    dAtten *= getSpotEffect(light" + i + "_direction, light" + i + "_innerConeAngle, light" + i + "_outerConeAngle);\n";
              usesSpot = true;
            }
          }
        }

        if (lightShape !== LIGHTSHAPE_PUNCTUAL) {
          if (lightType === LIGHTTYPE_DIRECTIONAL) {
            code += "    dAttenD = getLightDiffuse();\n";
          } else {
            code += "    dAttenD = get" + shapeString + "LightDiffuse() * 16.0;\n";
          }
        } else {
          code += "    dAtten *= getLightDiffuse();\n";
        }

        if (light.castShadows && !options.noShadow) {
          let shadowReadMode = null;
          let evsmExp;

          if (light._shadowType === SHADOW_VSM8) {
            shadowReadMode = "VSM8";
            evsmExp = "0.0";
          } else if (light._shadowType === SHADOW_VSM16) {
            shadowReadMode = "VSM16";
            evsmExp = "5.54";
          } else if (light._shadowType === SHADOW_VSM32) {
            shadowReadMode = "VSM32";

            if (device.textureFloatHighPrecision) {
              evsmExp = "15.0";
            } else {
              evsmExp = "5.54";
            }
          } else if (light._shadowType === SHADOW_PCF5) {
            shadowReadMode = "PCF5x5";
          } else {
            shadowReadMode = "PCF3x3";
          }

          if (shadowReadMode !== null) {
            if (lightType === LIGHTTYPE_OMNI) {
              const shadowCoordArgs = "(light" + i + "_shadowMap, light" + i + "_shadowParams);\n";

              if (light._normalOffsetBias) {
                code += "    normalOffsetPointShadow(light" + i + "_shadowParams);\n";
              }

              code += `    float shadow${i} = getShadowPoint${shadowReadMode}${shadowCoordArgs}`;
              code += `    dAtten *= mix(1.0, shadow${i}, light${i}_shadowIntensity);\n`;
            } else {
              const shadowMatArg = `light${i}_shadowMatrix`;
              const shadowParamArg = `light${i}_shadowParams`;
              code += this._nonPointShadowMapProjection(device, options.lights[i], shadowMatArg, shadowParamArg, i);
              if (lightType === LIGHTTYPE_SPOT) shadowReadMode = "Spot" + shadowReadMode;
              code += `    float shadow${i} = getShadow${shadowReadMode}(light${i}_shadowMap, light${i}_shadowParams${light._isVsm ? ", " + evsmExp : ""});\n`;
              code += `    dAtten *= mix(1.0, shadow${i}, light${i}_shadowIntensity);\n`;
            }
          }
        }

        if (lightShape !== LIGHTSHAPE_PUNCTUAL) {
          if (options.conserveEnergy && options.useSpecular) {
            code += "    dDiffuseLight += mix((dAttenD * dAtten) * light" + i + "_color" + (usesCookieNow ? " * dAtten3" : "") + ", vec3(0), dLTCSpecFres);\n";
          } else {
            code += "    dDiffuseLight += (dAttenD * dAtten) * light" + i + "_color" + (usesCookieNow ? " * dAtten3" : "") + ";\n";
          }
        } else {
          if (hasAreaLights && options.conserveEnergy && options.useSpecular) {
            code += "    dDiffuseLight += mix(dAtten * light" + i + "_color" + (usesCookieNow ? " * dAtten3" : "") + ", vec3(0), dSpecularity);\n";
          } else {
            code += "    dDiffuseLight += dAtten * light" + i + "_color" + (usesCookieNow ? " * dAtten3" : "") + ";\n";
          }
        }

        if (options.useSpecular) {
          code += "    dHalfDirW = normalize(-dLightDirNormW + dViewDirW);\n";
        }

        if (lightShape !== LIGHTSHAPE_PUNCTUAL) {
          if (options.clearCoat) code += "    ccSpecularLight += ccLTCSpecFres * get" + shapeString + "LightSpecularCC() * dAtten * light" + i + "_color" + (usesCookieNow ? " * dAtten3" : "") + ";\n";
          if (options.useSpecular) code += "    dSpecularLight += dLTCSpecFres * get" + shapeString + "LightSpecular() * dAtten * light" + i + "_color" + (usesCookieNow ? " * dAtten3" : "") + ";\n";
        } else {
          var calcFresnel = false;

          if (lightType === LIGHTTYPE_DIRECTIONAL && options.fresnelModel > 0) {
            calcFresnel = true;
          }

          if (options.useSpecular) {
            code += "    dSpecularLight += getLightSpecular(dHalfDirW) * dAtten * light" + i + "_color";
            code += usesCookieNow ? " * dAtten3" : "";
            code += calcFresnel ? " * getFresnel(dot(dViewDirW, dHalfDirW), dSpecularity)" : " * dSpecularity";
            code += ";\n";
          }

          if (options.sheen) {
            code += "    sSpecularLight += getLightSpecularSheen(dHalfDirW) * dAtten * light" + i + "_color";
            code += usesCookieNow ? " * dAtten3" : "";
            code += ";\n";
          }

          if (options.clearCoat) {
            code += "    ccSpecularLight += getLightSpecularCC(dHalfDirW) * dAtten * light" + i + "_color";
            code += usesCookieNow ? " * dAtten3" : "";
            code += calcFresnel ? " * getFresnelCC(dot(dViewDirW, dHalfDirW), ccGlossiness)" : "";
            code += ";\n";
          }
        }

        if (lightType !== LIGHTTYPE_DIRECTIONAL) {
          code += "    }\n";
        }

        code += "\n";
      }

      if (options.clusteredLightingEnabled && this.lighting) {
        usesLinearFalloff = true;
        usesInvSquaredFalloff = true;
        hasPointLights = true;
        code += "    addClusteredLights();\n";
      }

      if (hasAreaLights) {
        if (options.clearCoat) {
          code += "    ccSpecularity = 1.0;\n";
        }

        if (options.useSpecular) {
          code += "    dSpecularity = vec3(1);\n";
        }
      }

      if (options.refraction) {
        code += "    addRefraction();\n";
      }
    }

    code += "\n";

    if (useAo) {
      if (options.occludeDirect) {
        code += "    occludeDiffuse();\n";
      }

      if (options.occludeSpecular === SPECOCC_AO || options.occludeSpecular === SPECOCC_GLOSSDEPENDENT) {
        code += "    occludeSpecular();\n";
      }
    }

    if (options.useSpecularityFactor) {
      code += "    dSpecularLight *= dSpecularityFactor;\n";
    }

    if (options.opacityFadesSpecular === false) {
      if (options.blendType === BLEND_NORMAL || options.blendType === BLEND_PREMULTIPLIED) {
        code += "float specLum = dot((dSpecularLight + dReflection.rgb * dReflection.a), vec3( 0.2126, 0.7152, 0.0722 ));\n";
        code += "#ifdef LIT_CLEARCOAT\n specLum += dot((ccSpecularLight + ccReflection.rgb) * ccSpecularity, vec3( 0.2126, 0.7152, 0.0722 ));\n#endif\n";
        code += "dAlpha = clamp(dAlpha + gammaCorrectInput(specLum), 0.0, 1.0);\n";
      }

      code += "dAlpha *= material_alphaFade;\n";
    }

    code += chunks.endPS;

    if (options.blendType === BLEND_NORMAL || options.blendType === BLEND_ADDITIVEALPHA || options.alphaToCoverage) {
      code += chunks.outputAlphaPS;
    } else if (options.blendType === BLEND_PREMULTIPLIED) {
      code += chunks.outputAlphaPremulPS;
    } else {
      code += chunks.outputAlphaOpaquePS;
    }

    if (options.msdf) {
      code += "    gl_FragColor = applyMsdf(gl_FragColor);\n";
    }

    code += "\n";
    code += end();

    if (hasPointLights) {
      code = chunks.lightDirPointPS + code;
    }

    if (usesLinearFalloff) {
      code = chunks.falloffLinearPS + code;
    }

    if (usesInvSquaredFalloff) {
      code = chunks.falloffInvSquaredPS + code;
    }

    if (usesSpot) {
      code = chunks.spotPS + code;
    }

    if (usesCookie && !options.clusteredLightingEnabled) {
      code = chunks.cookiePS + code;
    }

    let structCode = "";
    if (code.includes("dReflection")) structCode += "vec4 dReflection;\n";
    if (code.includes("dTBN")) structCode += "mat3 dTBN;\n";
    if (code.includes("dVertexNormalW")) structCode += "vec3 dVertexNormalW;\n";
    if (code.includes("dTangentW")) structCode += "vec3 dTangentW;\n";
    if (code.includes("dBinormalW")) structCode += "vec3 dBinormalW;\n";
    if (code.includes("dViewDirW")) structCode += "vec3 dViewDirW;\n";
    if (code.includes("dReflDirW")) structCode += "vec3 dReflDirW;\n";
    if (code.includes("dHalfDirW")) structCode += "vec3 dHalfDirW;\n";
    if (code.includes("dDiffuseLight")) structCode += "vec3 dDiffuseLight;\n";
    if (code.includes("dSpecularLight")) structCode += "vec3 dSpecularLight;\n";
    if (code.includes("dLightDirNormW")) structCode += "vec3 dLightDirNormW;\n";
    if (code.includes("dLightDirW")) structCode += "vec3 dLightDirW;\n";
    if (code.includes("dLightPosW")) structCode += "vec3 dLightPosW;\n";
    if (code.includes("dShadowCoord")) structCode += "vec3 dShadowCoord;\n";
    if (code.includes("dAtten")) structCode += "float dAtten;\n";
    if (code.includes("dAttenD")) structCode += "float dAttenD;\n";
    if (code.includes("dAtten3")) structCode += "vec3 dAtten3;\n";
    if (code.includes("dMsdf")) structCode += "vec4 dMsdf;\n";
    if (code.includes("ccFresnel")) structCode += "float ccFresnel;\n";
    if (code.includes("ccReflection")) structCode += "vec3 ccReflection;\n";
    if (code.includes("ccReflDirW")) structCode += "vec3 ccReflDirW;\n";
    if (code.includes("ccSpecularLight")) structCode += "vec3 ccSpecularLight;\n";
    if (code.includes("ccSpecularityNoFres")) structCode += "float ccSpecularityNoFres;\n";
    if (code.includes("sSpecularLight")) structCode += "vec3 sSpecularLight;\n";
    if (code.includes("sReflection")) structCode += "vec3 sReflection;\n";
    const result = this._fsGetBeginCode() + this.varyings + this._fsGetBaseCode() + (options.detailModes ? chunks.detailModesPS : "") + structCode + this.frontendDecl + code;
    return result;
  }

  generateFragmentShader(frontendDecl, frontendCode, frontendFunc, lightingUv) {
    const options = this.options;
    this.frontendDecl = frontendDecl;
    this.frontendCode = frontendCode;
    this.frontendFunc = frontendFunc;
    this.lightingUv = lightingUv;

    if (options.pass === SHADER_PICK) {
      this.fshader = this._fsGetPickPassCode();
    } else if (options.pass === SHADER_DEPTH) {
      this.fshader = this._fsGetDepthPassCode();
    } else if (this.shadowPass) {
      this.fshader = this._fsGetShadowPassCode();
    } else if (options.customFragmentShader) {
      this.fshader = this._fsGetBeginCode() + options.customFragmentShader;
    } else {
      this.fshader = this._fsGetLitPassCode();
    }
  }

  getDefinition() {
    const result = {
      attributes: this.attributes,
      vshader: this.vshader,
      fshader: this.fshader
    };

    if (ShaderPass.isForward(this.options.pass)) {
      result.tag = SHADERTAG_MATERIAL;
    }

    return result;
  }

}

export { LitShader };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGl0LXNoYWRlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL2dyYXBoaWNzL3Byb2dyYW0tbGliL3Byb2dyYW1zL2xpdC1zaGFkZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtcbiAgICBTRU1BTlRJQ19BVFRSOCwgU0VNQU5USUNfQVRUUjksIFNFTUFOVElDX0FUVFIxMCwgU0VNQU5USUNfQVRUUjExLCBTRU1BTlRJQ19BVFRSMTIsIFNFTUFOVElDX0FUVFIxMywgU0VNQU5USUNfQVRUUjE0LCBTRU1BTlRJQ19BVFRSMTUsXG4gICAgU0VNQU5USUNfQkxFTkRJTkRJQ0VTLCBTRU1BTlRJQ19CTEVORFdFSUdIVCwgU0VNQU5USUNfQ09MT1IsIFNFTUFOVElDX05PUk1BTCwgU0VNQU5USUNfUE9TSVRJT04sIFNFTUFOVElDX1RBTkdFTlQsXG4gICAgU0VNQU5USUNfVEVYQ09PUkQwLCBTRU1BTlRJQ19URVhDT09SRDEsXG4gICAgU0hBREVSVEFHX01BVEVSSUFMLFxuICAgIFBJWEVMRk9STUFUX1I4X0c4X0I4X0E4XG59IGZyb20gJy4uLy4uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBzaGFkZXJDaHVua3MgfSBmcm9tICcuLi9jaHVua3MvY2h1bmtzLmpzJztcbmltcG9ydCB7IENodW5rVXRpbHMgfSBmcm9tICcuLi9jaHVuay11dGlscy5qcyc7XG5cbmltcG9ydCB7XG4gICAgQkxFTkRfQURESVRJVkVBTFBIQSwgQkxFTkRfTk9STUFMLCBCTEVORF9QUkVNVUxUSVBMSUVELFxuICAgIEZSRVNORUxfU0NITElDSyxcbiAgICBMSUdIVEZBTExPRkZfTElORUFSLFxuICAgIExJR0hUU0hBUEVfUFVOQ1RVQUwsIExJR0hUU0hBUEVfUkVDVCwgTElHSFRTSEFQRV9ESVNLLCBMSUdIVFNIQVBFX1NQSEVSRSxcbiAgICBMSUdIVFRZUEVfRElSRUNUSU9OQUwsIExJR0hUVFlQRV9PTU5JLCBMSUdIVFRZUEVfU1BPVCxcbiAgICBTSEFERVJfREVQVEgsIFNIQURFUl9QSUNLLFxuICAgIFNIQURPV19QQ0YzLCBTSEFET1dfUENGNSwgU0hBRE9XX1ZTTTgsIFNIQURPV19WU00xNiwgU0hBRE9XX1ZTTTMyLFxuICAgIFNQRUNPQ0NfQU8sIFNQRUNPQ0NfR0xPU1NERVBFTkRFTlQsXG4gICAgU1BFQ1VMQVJfUEhPTkcsXG4gICAgU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VELCBTUFJJVEVfUkVOREVSTU9ERV9USUxFRCwgc2hhZG93VHlwZVRvU3RyaW5nXG59IGZyb20gJy4uLy4uLy4uL3NjZW5lL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBMaWdodHNCdWZmZXIgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9saWdodGluZy9saWdodHMtYnVmZmVyLmpzJztcbmltcG9ydCB7IFNoYWRlclBhc3MgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9zaGFkZXItcGFzcy5qcyc7XG5cbmltcG9ydCB7IHZlcnRleEludHJvLCBmcmFnbWVudEludHJvLCBiZWdpbiwgZW5kLCBmb2dDb2RlLCBnYW1tYUNvZGUsIHNraW5Db2RlLCB0b25lbWFwQ29kZSB9IGZyb20gJy4vY29tbW9uLmpzJztcbmltcG9ydCB7IHZhbGlkYXRlVXNlckNodW5rcyB9IGZyb20gJy4uL2NodW5rcy9jaHVuay12YWxpZGF0aW9uLmpzJztcblxuY29uc3QgYnVpbHRpbkF0dHJpYnV0ZXMgPSB7XG4gICAgdmVydGV4X25vcm1hbDogU0VNQU5USUNfTk9STUFMLFxuICAgIHZlcnRleF90YW5nZW50OiBTRU1BTlRJQ19UQU5HRU5ULFxuICAgIHZlcnRleF90ZXhDb29yZDA6IFNFTUFOVElDX1RFWENPT1JEMCxcbiAgICB2ZXJ0ZXhfdGV4Q29vcmQxOiBTRU1BTlRJQ19URVhDT09SRDEsXG4gICAgdmVydGV4X2NvbG9yOiBTRU1BTlRJQ19DT0xPUixcbiAgICB2ZXJ0ZXhfYm9uZVdlaWdodHM6IFNFTUFOVElDX0JMRU5EV0VJR0hULFxuICAgIHZlcnRleF9ib25lSW5kaWNlczogU0VNQU5USUNfQkxFTkRJTkRJQ0VTXG59O1xuXG5jb25zdCBidWlsdGluVmFyeWluZ3MgPSB7XG4gICAgdlZlcnRleENvbG9yOiBcInZlYzRcIixcbiAgICB2UG9zaXRpb25XOiBcInZlYzNcIixcbiAgICB2Tm9ybWFsVjogXCJ2ZWMzXCIsXG4gICAgdk5vcm1hbFc6IFwidmVjM1wiLFxuICAgIHZUYW5nZW50VzogXCJ2ZWMzXCIsXG4gICAgdkJpbm9ybWFsVzogXCJ2ZWMzXCIsXG4gICAgdk9iamVjdFNwYWNlVXBXOiBcInZlYzNcIixcbiAgICB2VXYwOiBcInZlYzJcIixcbiAgICB2VXYxOiBcInZlYzJcIlxufTtcblxuY2xhc3MgTGl0U2hhZGVyIHtcbiAgICBjb25zdHJ1Y3RvcihkZXZpY2UsIG9wdGlvbnMpIHtcbiAgICAgICAgdGhpcy5kZXZpY2UgPSBkZXZpY2U7XG4gICAgICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG5cbiAgICAgICAgLy8gcmVzb2x2ZSBjdXN0b20gY2h1bmsgYXR0cmlidXRlc1xuICAgICAgICB0aGlzLmF0dHJpYnV0ZXMgPSB7XG4gICAgICAgICAgICB2ZXJ0ZXhfcG9zaXRpb246IFNFTUFOVElDX1BPU0lUSU9OXG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKG9wdGlvbnMuY2h1bmtzKSB7XG4gICAgICAgICAgICB0aGlzLmNodW5rcyA9IHt9O1xuXG4gICAgICAgICAgICBjb25zdCB1c2VyQ2h1bmtzID0gb3B0aW9ucy5jaHVua3M7XG5cbiAgICAgICAgICAgIC8vICNpZiBfREVCVUdcbiAgICAgICAgICAgIHZhbGlkYXRlVXNlckNodW5rcyhvcHRpb25zLmNodW5rcyk7XG4gICAgICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAgICAgZm9yIChjb25zdCBjaHVua05hbWUgaW4gc2hhZGVyQ2h1bmtzKSB7XG4gICAgICAgICAgICAgICAgaWYgKHVzZXJDaHVua3MuaGFzT3duUHJvcGVydHkoY2h1bmtOYW1lKSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjaHVuayA9IHVzZXJDaHVua3NbY2h1bmtOYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBhIGluIGJ1aWx0aW5BdHRyaWJ1dGVzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYnVpbHRpbkF0dHJpYnV0ZXMuaGFzT3duUHJvcGVydHkoYSkgJiYgY2h1bmsuaW5kZXhPZihhKSA+PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGVzW2FdID0gYnVpbHRpbkF0dHJpYnV0ZXNbYV07XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jaHVua3NbY2h1bmtOYW1lXSA9IGNodW5rO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY2h1bmtzW2NodW5rTmFtZV0gPSBzaGFkZXJDaHVua3NbY2h1bmtOYW1lXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmNodW5rcyA9IHNoYWRlckNodW5rcztcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMubGlnaHRpbmcgPSAob3B0aW9ucy5saWdodHMubGVuZ3RoID4gMCkgfHwgISFvcHRpb25zLmRpckxpZ2h0TWFwIHx8ICEhb3B0aW9ucy5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQ7XG4gICAgICAgIHRoaXMucmVmbGVjdGlvbnMgPSAhIW9wdGlvbnMucmVmbGVjdGlvblNvdXJjZTtcbiAgICAgICAgaWYgKCFvcHRpb25zLnVzZVNwZWN1bGFyKSBvcHRpb25zLnNwZWN1bGFyTWFwID0gb3B0aW9ucy5nbG9zc01hcCA9IG51bGw7XG4gICAgICAgIHRoaXMuc2hhZG93UGFzcyA9IFNoYWRlclBhc3MuaXNTaGFkb3cob3B0aW9ucy5wYXNzKTtcbiAgICAgICAgdGhpcy5uZWVkc05vcm1hbCA9IHRoaXMubGlnaHRpbmcgfHwgdGhpcy5yZWZsZWN0aW9ucyB8fCBvcHRpb25zLnVzZVNwZWN1bGFyIHx8IG9wdGlvbnMuYW1iaWVudFNIIHx8IG9wdGlvbnMuaGVpZ2h0TWFwIHx8IG9wdGlvbnMuZW5hYmxlR0dYU3BlY3VsYXIgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAob3B0aW9ucy5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQgJiYgIXRoaXMuc2hhZG93UGFzcykgfHwgb3B0aW9ucy5jbGVhckNvYXROb3JtYWxNYXA7XG4gICAgICAgIHRoaXMubmVlZHNTY2VuZUNvbG9yID0gb3B0aW9ucy51c2VEeW5hbWljUmVmcmFjdGlvbjtcbiAgICAgICAgdGhpcy5uZWVkc1NjcmVlblNpemUgPSBvcHRpb25zLnVzZUR5bmFtaWNSZWZyYWN0aW9uO1xuICAgICAgICB0aGlzLm5lZWRzVHJhbnNmb3JtcyA9IG9wdGlvbnMudXNlRHluYW1pY1JlZnJhY3Rpb247XG5cbiAgICAgICAgLy8gZ2VuZXJhdGVkIGJ5IHZzaGFkZXJcbiAgICAgICAgdGhpcy52YXJ5aW5ncyA9IFwiXCI7XG4gICAgICAgIHRoaXMudnNoYWRlciA9IG51bGw7XG5cbiAgICAgICAgLy8gc3VwcGxpZWQgYnkgY2FsbGVyXG4gICAgICAgIHRoaXMuZnJvbnRlbmREZWNsID0gbnVsbDtcbiAgICAgICAgdGhpcy5mcm9udGVuZENvZGUgPSBudWxsO1xuICAgICAgICB0aGlzLmZyb250ZW5kRnVuYyA9IG51bGw7XG4gICAgICAgIHRoaXMubGlnaHRpbmdVdiA9IG51bGw7XG5cbiAgICAgICAgLy8gZGVmaW5lcyBzZXQgYnkgdGhlIHNoYWRlciBnZW5lcmF0aW9uXG4gICAgICAgIHRoaXMuZGVmaW5lcyA9IFtdO1xuXG4gICAgICAgIC8vIGdlbmVyYXRlZCBieSBmc2hhZGVyXG4gICAgICAgIHRoaXMuZnNoYWRlciA9IG51bGw7XG4gICAgfVxuXG4gICAgX3ZzQWRkQmFzZUNvZGUoY29kZSwgY2h1bmtzLCBvcHRpb25zKSB7XG4gICAgICAgIGNvZGUgKz0gY2h1bmtzLmJhc2VWUztcbiAgICAgICAgaWYgKG9wdGlvbnMubmluZVNsaWNlZE1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1NMSUNFRCB8fFxuICAgICAgICAgICAgb3B0aW9ucy5uaW5lU2xpY2VkTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfVElMRUQpIHtcbiAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLmJhc2VOaW5lU2xpY2VkVlM7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNvZGU7XG4gICAgfVxuXG4gICAgX3ZzQWRkVHJhbnNmb3JtQ29kZShjb2RlLCBkZXZpY2UsIGNodW5rcywgb3B0aW9ucykge1xuICAgICAgICBjb2RlICs9IHRoaXMuY2h1bmtzLnRyYW5zZm9ybVZTO1xuICAgICAgICByZXR1cm4gY29kZTtcbiAgICB9XG5cbiAgICBfc2V0TWFwVHJhbnNmb3JtKGNvZGVzLCBuYW1lLCBpZCwgdXYpIHtcbiAgICAgICAgY29uc3QgY2hlY2tJZCA9IGlkICsgdXYgKiAxMDA7XG4gICAgICAgIGlmICghY29kZXNbM11bY2hlY2tJZF0pIHtcbiAgICAgICAgICAgIC8vIHVwbG9hZCBhIDN4MiBtYXRyaXggYW5kIG1hbnVhbGx5IHBlcmZvcm0gdGhlIG11bHRpcGxpY2F0aW9uXG4gICAgICAgICAgICBjb25zdCB2YXJOYW1lID0gYHRleHR1cmVfJHtuYW1lfU1hcFRyYW5zZm9ybWA7XG4gICAgICAgICAgICBjb2Rlc1swXSArPSBgdW5pZm9ybSB2ZWMzICR7dmFyTmFtZX0wO1xcbmA7XG4gICAgICAgICAgICBjb2Rlc1swXSArPSBgdW5pZm9ybSB2ZWMzICR7dmFyTmFtZX0xO1xcbmA7XG4gICAgICAgICAgICBjb2Rlc1sxXSArPSBgdmFyeWluZyB2ZWMyIHZVViR7dXZ9XyR7aWR9O1xcbmA7XG4gICAgICAgICAgICBjb2Rlc1syXSArPSBgICAgdlVWJHt1dn1fJHtpZH0gPSB2ZWMyKGRvdCh2ZWMzKHV2JHt1dn0sIDEpLCAke3Zhck5hbWV9MCksIGRvdCh2ZWMzKHV2JHt1dn0sIDEpLCAke3Zhck5hbWV9MSkpO1xcbmA7XG4gICAgICAgICAgICBjb2Rlc1szXVtjaGVja0lkXSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNvZGVzO1xuICAgIH1cblxuICAgIC8vIEFkZCBcIkJhc2VcIiBDb2RlIHNlY3Rpb24gdG8gZnJhZ21lbnQgc2hhZGVyLlxuICAgIF9mc0dldEJhc2VDb2RlKCkge1xuICAgICAgICBjb25zdCBvcHRpb25zID0gdGhpcy5vcHRpb25zO1xuICAgICAgICBjb25zdCBjaHVua3MgPSB0aGlzLmNodW5rcztcbiAgICAgICAgbGV0IHJlc3VsdCA9IHRoaXMuY2h1bmtzLmJhc2VQUztcbiAgICAgICAgaWYgKG9wdGlvbnMubmluZVNsaWNlZE1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1NMSUNFRCkge1xuICAgICAgICAgICAgcmVzdWx0ICs9IGNodW5rcy5iYXNlTmluZVNsaWNlZFBTO1xuICAgICAgICB9IGVsc2UgaWYgKG9wdGlvbnMubmluZVNsaWNlZE1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1RJTEVEKSB7XG4gICAgICAgICAgICByZXN1bHQgKz0gY2h1bmtzLmJhc2VOaW5lU2xpY2VkVGlsZWRQUztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIC8vIEFkZCBcIlN0YXJ0XCIgQ29kZSBzZWN0aW9uIHRvIGZyYWdtZW50IHNoYWRlci5cbiAgICBfZnNHZXRTdGFydENvZGUoY29kZSwgZGV2aWNlLCBjaHVua3MsIG9wdGlvbnMpIHtcbiAgICAgICAgbGV0IHJlc3VsdCA9IGNodW5rcy5zdGFydFBTO1xuICAgICAgICBpZiAob3B0aW9ucy5uaW5lU2xpY2VkTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VEKSB7XG4gICAgICAgICAgICByZXN1bHQgKz0gY2h1bmtzLnN0YXJ0TmluZVNsaWNlZFBTO1xuICAgICAgICB9IGVsc2UgaWYgKG9wdGlvbnMubmluZVNsaWNlZE1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1RJTEVEKSB7XG4gICAgICAgICAgICByZXN1bHQgKz0gY2h1bmtzLnN0YXJ0TmluZVNsaWNlZFRpbGVkUFM7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICAvLyBoYW5kbGVzIGRpcmVjdGlvbmFsIG1hcCBzaGFkb3cgY29vcmRpbmF0ZSBnZW5lcmF0aW9uLCBpbmNsdWRpbmcgY2FzY2FkZWQgc2hhZG93c1xuICAgIF9kaXJlY3Rpb25hbFNoYWRvd01hcFByb2plY3Rpb24obGlnaHQsIHNoYWRvd0Nvb3JkQXJncywgc2hhZG93UGFyYW1BcmcsIGxpZ2h0SW5kZXgsIGNvb3Jkc0Z1bmN0aW9uTmFtZSkge1xuXG4gICAgICAgIC8vIGZvciBzaGFkb3cgY2FzY2FkZXNcbiAgICAgICAgbGV0IGNvZGUgPSBcIlwiO1xuICAgICAgICBpZiAobGlnaHQubnVtQ2FzY2FkZXMgPiAxKSB7XG4gICAgICAgICAgICAvLyBjb21wdXRlIHdoaWNoIGNhc2NhZGUgbWF0cml4IG5lZWRzIHRvIGJlIHVzZWRcbiAgICAgICAgICAgIGNvZGUgKz0gYGdldFNoYWRvd0Nhc2NhZGVNYXRyaXgobGlnaHQke2xpZ2h0SW5kZXh9X3NoYWRvd01hdHJpeFBhbGV0dGUsIGxpZ2h0JHtsaWdodEluZGV4fV9zaGFkb3dDYXNjYWRlRGlzdGFuY2VzLCBsaWdodCR7bGlnaHRJbmRleH1fc2hhZG93Q2FzY2FkZUNvdW50KTtcXG5gO1xuICAgICAgICAgICAgc2hhZG93Q29vcmRBcmdzID0gYChjYXNjYWRlU2hhZG93TWF0LCAke3NoYWRvd1BhcmFtQXJnfSk7XFxuYDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHNoYWRvdyBjb29yZGluYXRlIGdlbmVyYXRpb25cbiAgICAgICAgY29kZSArPSBjb29yZHNGdW5jdGlvbk5hbWUgKyBzaGFkb3dDb29yZEFyZ3M7XG5cbiAgICAgICAgLy8gc3RvcCBzaGFkb3cgYXQgdGhlIGZhciBkaXN0YW5jZVxuICAgICAgICBjb2RlICs9IGBmYWRlU2hhZG93KGxpZ2h0JHtsaWdodEluZGV4fV9zaGFkb3dDYXNjYWRlRGlzdGFuY2VzKTtcXG5gO1xuICAgICAgICByZXR1cm4gY29kZTtcbiAgICB9XG5cbiAgICBfbm9uUG9pbnRTaGFkb3dNYXBQcm9qZWN0aW9uKGRldmljZSwgbGlnaHQsIHNoYWRvd01hdEFyZywgc2hhZG93UGFyYW1BcmcsIGxpZ2h0SW5kZXgpIHtcbiAgICAgICAgY29uc3Qgc2hhZG93Q29vcmRBcmdzID0gYCgke3NoYWRvd01hdEFyZ30sICR7c2hhZG93UGFyYW1Bcmd9KTtcXG5gO1xuICAgICAgICBpZiAoIWxpZ2h0Ll9ub3JtYWxPZmZzZXRCaWFzIHx8IGxpZ2h0Ll9pc1ZzbSkge1xuICAgICAgICAgICAgaWYgKGxpZ2h0Ll90eXBlID09PSBMSUdIVFRZUEVfU1BPVCkge1xuICAgICAgICAgICAgICAgIGlmIChsaWdodC5faXNQY2YgJiYgKGRldmljZS53ZWJnbDIgfHwgZGV2aWNlLmV4dFN0YW5kYXJkRGVyaXZhdGl2ZXMpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBcIiAgICAgICBnZXRTaGFkb3dDb29yZFBlcnNwWmJ1ZmZlclwiICsgc2hhZG93Q29vcmRBcmdzO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gXCIgICAgICAgZ2V0U2hhZG93Q29vcmRQZXJzcFwiICsgc2hhZG93Q29vcmRBcmdzO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2RpcmVjdGlvbmFsU2hhZG93TWFwUHJvamVjdGlvbihsaWdodCwgc2hhZG93Q29vcmRBcmdzLCBzaGFkb3dQYXJhbUFyZywgbGlnaHRJbmRleCwgXCJnZXRTaGFkb3dDb29yZE9ydGhvXCIpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChsaWdodC5fdHlwZSA9PT0gTElHSFRUWVBFX1NQT1QpIHtcbiAgICAgICAgICAgIGlmIChsaWdodC5faXNQY2YgJiYgKGRldmljZS53ZWJnbDIgfHwgZGV2aWNlLmV4dFN0YW5kYXJkRGVyaXZhdGl2ZXMpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFwiICAgICAgIGdldFNoYWRvd0Nvb3JkUGVyc3BaYnVmZmVyTm9ybWFsT2Zmc2V0XCIgKyBzaGFkb3dDb29yZEFyZ3M7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gXCIgICAgICAgZ2V0U2hhZG93Q29vcmRQZXJzcE5vcm1hbE9mZnNldFwiICsgc2hhZG93Q29vcmRBcmdzO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9kaXJlY3Rpb25hbFNoYWRvd01hcFByb2plY3Rpb24obGlnaHQsIHNoYWRvd0Nvb3JkQXJncywgc2hhZG93UGFyYW1BcmcsIGxpZ2h0SW5kZXgsIFwiZ2V0U2hhZG93Q29vcmRPcnRob05vcm1hbE9mZnNldFwiKTtcbiAgICB9XG5cbiAgICBfZ2V0TGlnaHRTb3VyY2VTaGFwZVN0cmluZyhzaGFwZSkge1xuICAgICAgICBzd2l0Y2ggKHNoYXBlKSB7XG4gICAgICAgICAgICBjYXNlIExJR0hUU0hBUEVfUkVDVDpcbiAgICAgICAgICAgICAgICByZXR1cm4gJ1JlY3QnO1xuICAgICAgICAgICAgY2FzZSBMSUdIVFNIQVBFX0RJU0s6XG4gICAgICAgICAgICAgICAgcmV0dXJuICdEaXNrJztcbiAgICAgICAgICAgIGNhc2UgTElHSFRTSEFQRV9TUEhFUkU6XG4gICAgICAgICAgICAgICAgcmV0dXJuICdTcGhlcmUnO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICByZXR1cm4gJyc7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZW5lcmF0ZVZlcnRleFNoYWRlcih1c2VVdiwgdXNlVW5tb2RpZmllZFV2LCBtYXBUcmFuc2Zvcm1zKSB7XG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuICAgICAgICBjb25zdCBvcHRpb25zID0gdGhpcy5vcHRpb25zO1xuICAgICAgICBjb25zdCBjaHVua3MgPSB0aGlzLmNodW5rcztcblxuICAgICAgICBsZXQgY29kZSA9ICcnO1xuICAgICAgICBsZXQgY29kZUJvZHkgPSAnJztcblxuICAgICAgICAvLyBjb2RlICs9IGNodW5rcy5iYXNlVlM7XG4gICAgICAgIGNvZGUgPSB0aGlzLl92c0FkZEJhc2VDb2RlKGNvZGUsIGNodW5rcywgb3B0aW9ucyk7XG5cbiAgICAgICAgY29kZUJvZHkgKz0gXCIgICB2UG9zaXRpb25XICAgID0gZ2V0V29ybGRQb3NpdGlvbigpO1xcblwiO1xuXG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMucGFzcyA9PT0gU0hBREVSX0RFUFRIKSB7XG4gICAgICAgICAgICBjb2RlICs9ICd2YXJ5aW5nIGZsb2F0IHZEZXB0aDtcXG4nO1xuICAgICAgICAgICAgY29kZSArPSAnI2lmbmRlZiBWSUVXTUFUUklYXFxuJztcbiAgICAgICAgICAgIGNvZGUgKz0gJyNkZWZpbmUgVklFV01BVFJJWFxcbic7XG4gICAgICAgICAgICBjb2RlICs9ICd1bmlmb3JtIG1hdDQgbWF0cml4X3ZpZXc7XFxuJztcbiAgICAgICAgICAgIGNvZGUgKz0gJyNlbmRpZlxcbic7XG4gICAgICAgICAgICBjb2RlICs9ICcjaWZuZGVmIENBTUVSQVBMQU5FU1xcbic7XG4gICAgICAgICAgICBjb2RlICs9ICcjZGVmaW5lIENBTUVSQVBMQU5FU1xcbic7XG4gICAgICAgICAgICBjb2RlICs9ICd1bmlmb3JtIHZlYzQgY2FtZXJhX3BhcmFtcztcXG5cXG4nO1xuICAgICAgICAgICAgY29kZSArPSAnI2VuZGlmXFxuJztcbiAgICAgICAgICAgIGNvZGVCb2R5ICs9IFwiICAgIHZEZXB0aCA9IC0obWF0cml4X3ZpZXcgKiB2ZWM0KHZQb3NpdGlvblcsMS4wKSkueiAqIGNhbWVyYV9wYXJhbXMueDtcXG5cIjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMudXNlSW5zdGFuY2luZykge1xuICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGVzLmluc3RhbmNlX2xpbmUxID0gU0VNQU5USUNfQVRUUjEyO1xuICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGVzLmluc3RhbmNlX2xpbmUyID0gU0VNQU5USUNfQVRUUjEzO1xuICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGVzLmluc3RhbmNlX2xpbmUzID0gU0VNQU5USUNfQVRUUjE0O1xuICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGVzLmluc3RhbmNlX2xpbmU0ID0gU0VNQU5USUNfQVRUUjE1O1xuICAgICAgICAgICAgY29kZSArPSBjaHVua3MuaW5zdGFuY2luZ1ZTO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMubmVlZHNOb3JtYWwpIHtcbiAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlcy52ZXJ0ZXhfbm9ybWFsID0gU0VNQU5USUNfTk9STUFMO1xuICAgICAgICAgICAgY29kZUJvZHkgKz0gXCIgICB2Tm9ybWFsVyA9IGdldE5vcm1hbCgpO1xcblwiO1xuXG4gICAgICAgICAgICBpZiAob3B0aW9ucy5yZWZsZWN0aW9uU291cmNlID09PSAnc3BoZXJlTWFwJyAmJiBkZXZpY2UuZnJhZ21lbnRVbmlmb3Jtc0NvdW50IDw9IDE2KSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBjaHVua3Mudmlld05vcm1hbFZTO1xuICAgICAgICAgICAgICAgIGNvZGVCb2R5ICs9IFwiICAgdk5vcm1hbFYgICAgPSBnZXRWaWV3Tm9ybWFsKCk7XFxuXCI7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zLmhhc1RhbmdlbnRzICYmIChvcHRpb25zLmhlaWdodE1hcCB8fCBvcHRpb25zLm5vcm1hbE1hcCB8fCBvcHRpb25zLmVuYWJsZUdHWFNwZWN1bGFyKSkge1xuICAgICAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlcy52ZXJ0ZXhfdGFuZ2VudCA9IFNFTUFOVElDX1RBTkdFTlQ7XG4gICAgICAgICAgICAgICAgY29kZSArPSBjaHVua3MudGFuZ2VudEJpbm9ybWFsVlM7XG4gICAgICAgICAgICAgICAgY29kZUJvZHkgKz0gXCIgICB2VGFuZ2VudFcgICA9IGdldFRhbmdlbnQoKTtcXG5cIjtcbiAgICAgICAgICAgICAgICBjb2RlQm9keSArPSBcIiAgIHZCaW5vcm1hbFcgID0gZ2V0Qmlub3JtYWwoKTtcXG5cIjtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAob3B0aW9ucy5lbmFibGVHR1hTcGVjdWxhcikge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLnRhbmdlbnRCaW5vcm1hbFZTO1xuICAgICAgICAgICAgICAgIGNvZGVCb2R5ICs9IFwiICAgdk9iamVjdFNwYWNlVXBXICA9IGdldE9iamVjdFNwYWNlVXAoKTtcXG5cIjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IG1heFV2U2V0cyA9IDI7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtYXhVdlNldHM7IGkrKykge1xuICAgICAgICAgICAgaWYgKHVzZVV2W2ldKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGVzW1widmVydGV4X3RleENvb3JkXCIgKyBpXSA9IFwiVEVYQ09PUkRcIiArIGk7XG4gICAgICAgICAgICAgICAgY29kZSArPSBjaHVua3NbXCJ1dlwiICsgaSArIFwiVlNcIl07XG4gICAgICAgICAgICAgICAgY29kZUJvZHkgKz0gXCIgICB2ZWMyIHV2XCIgKyBpICsgXCIgPSBnZXRVdlwiICsgaSArIFwiKCk7XFxuXCI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodXNlVW5tb2RpZmllZFV2W2ldKSB7XG4gICAgICAgICAgICAgICAgY29kZUJvZHkgKz0gXCIgICB2VXZcIiArIGkgKyBcIiA9IHV2XCIgKyBpICsgXCI7XFxuXCI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBjb2RlcyA9IFtjb2RlLCB0aGlzLnZhcnlpbmdzLCBjb2RlQm9keSwgW11dO1xuXG4gICAgICAgIG1hcFRyYW5zZm9ybXMuZm9yRWFjaCgobWFwVHJhbnNmb3JtKSA9PiB7XG4gICAgICAgICAgICB0aGlzLl9zZXRNYXBUcmFuc2Zvcm0oY29kZXMsIG1hcFRyYW5zZm9ybS5uYW1lLCBtYXBUcmFuc2Zvcm0uaWQsIG1hcFRyYW5zZm9ybS51dik7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvZGUgPSBjb2Rlc1swXTtcbiAgICAgICAgdGhpcy52YXJ5aW5ncyA9IGNvZGVzWzFdO1xuICAgICAgICBjb2RlQm9keSA9IGNvZGVzWzJdO1xuXG4gICAgICAgIGlmIChvcHRpb25zLnZlcnRleENvbG9ycykge1xuICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGVzLnZlcnRleF9jb2xvciA9IFNFTUFOVElDX0NPTE9SO1xuICAgICAgICAgICAgY29kZUJvZHkgKz0gXCIgICB2VmVydGV4Q29sb3IgPSB2ZXJ0ZXhfY29sb3I7XFxuXCI7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy5tc2RmICYmIG9wdGlvbnMubXNkZlRleHRBdHRyaWJ1dGUpIHtcbiAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlcy52ZXJ0ZXhfb3V0bGluZVBhcmFtZXRlcnMgPSBTRU1BTlRJQ19BVFRSODtcbiAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlcy52ZXJ0ZXhfc2hhZG93UGFyYW1ldGVycyA9IFNFTUFOVElDX0FUVFI5O1xuXG4gICAgICAgICAgICBjb2RlQm9keSArPSBcIiAgICB1bnBhY2tNc2RmUGFyYW1zKCk7XFxuXCI7XG5cbiAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLm1zZGZWUztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIG1vcnBoaW5nXG4gICAgICAgIGlmIChvcHRpb25zLnVzZU1vcnBoUG9zaXRpb24gfHwgb3B0aW9ucy51c2VNb3JwaE5vcm1hbCkge1xuXG4gICAgICAgICAgICBpZiAob3B0aW9ucy51c2VNb3JwaFRleHR1cmVCYXNlZCkge1xuXG4gICAgICAgICAgICAgICAgY29kZSArPSBcIiNkZWZpbmUgTU9SUEhJTkdfVEVYVFVSRV9CQVNFRFxcblwiO1xuXG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMudXNlTW9ycGhQb3NpdGlvbikge1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiI2RlZmluZSBNT1JQSElOR19URVhUVVJFX0JBU0VEX1BPU0lUSU9OXFxuXCI7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMudXNlTW9ycGhOb3JtYWwpIHtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiNkZWZpbmUgTU9SUEhJTkdfVEVYVFVSRV9CQVNFRF9OT1JNQUxcXG5cIjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyB2ZXJ0ZXggaWRzIGF0dHJpYnV0ZXNcbiAgICAgICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXMubW9ycGhfdmVydGV4X2lkID0gU0VNQU5USUNfQVRUUjE1O1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJhdHRyaWJ1dGUgZmxvYXQgbW9ycGhfdmVydGV4X2lkO1xcblwiO1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgLy8gc2V0IHVwIDggc2xvdHMgZm9yIG1vcnBoaW5nLiB0aGVzZSBhcmUgc3VwcG9ydGVkIGNvbWJpbmF0aW9uczogUFBQUFBQUFAsIE5OTk5OTk5OLCBQUFBQTk5OTlxuICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIjZGVmaW5lIE1PUlBISU5HXFxuXCI7XG5cbiAgICAgICAgICAgICAgICAvLyBmaXJzdCA0IHNsb3RzIGFyZSBlaXRoZXIgcG9zaXRpb24gb3Igbm9ybWFsXG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMudXNlTW9ycGhQb3NpdGlvbikge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXMubW9ycGhfcG9zMCA9IFNFTUFOVElDX0FUVFI4O1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXMubW9ycGhfcG9zMSA9IFNFTUFOVElDX0FUVFI5O1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXMubW9ycGhfcG9zMiA9IFNFTUFOVElDX0FUVFIxMDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGVzLm1vcnBoX3BvczMgPSBTRU1BTlRJQ19BVFRSMTE7XG5cbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiNkZWZpbmUgTU9SUEhJTkdfUE9TMDNcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcImF0dHJpYnV0ZSB2ZWMzIG1vcnBoX3BvczA7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJhdHRyaWJ1dGUgdmVjMyBtb3JwaF9wb3MxO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiYXR0cmlidXRlIHZlYzMgbW9ycGhfcG9zMjtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcImF0dHJpYnV0ZSB2ZWMzIG1vcnBoX3BvczM7XFxuXCI7XG5cbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKG9wdGlvbnMudXNlTW9ycGhOb3JtYWwpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGVzLm1vcnBoX25ybTAgPSBTRU1BTlRJQ19BVFRSODtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGVzLm1vcnBoX25ybTEgPSBTRU1BTlRJQ19BVFRSOTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGVzLm1vcnBoX25ybTIgPSBTRU1BTlRJQ19BVFRSMTA7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlcy5tb3JwaF9ucm0zID0gU0VNQU5USUNfQVRUUjExO1xuXG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIjZGVmaW5lIE1PUlBISU5HX05STTAzXFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJhdHRyaWJ1dGUgdmVjMyBtb3JwaF9ucm0wO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiYXR0cmlidXRlIHZlYzMgbW9ycGhfbnJtMTtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcImF0dHJpYnV0ZSB2ZWMzIG1vcnBoX25ybTI7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJhdHRyaWJ1dGUgdmVjMyBtb3JwaF9ucm0zO1xcblwiO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIG5leHQgNCBzbG90cyBhcmUgZWl0aGVyIHBvc2l0aW9uIG9yIG5vcm1hbFxuICAgICAgICAgICAgICAgIGlmICghb3B0aW9ucy51c2VNb3JwaE5vcm1hbCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXMubW9ycGhfcG9zNCA9IFNFTUFOVElDX0FUVFIxMjtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGVzLm1vcnBoX3BvczUgPSBTRU1BTlRJQ19BVFRSMTM7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlcy5tb3JwaF9wb3M2ID0gU0VNQU5USUNfQVRUUjE0O1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXMubW9ycGhfcG9zNyA9IFNFTUFOVElDX0FUVFIxNTtcblxuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiI2RlZmluZSBNT1JQSElOR19QT1M0N1xcblwiO1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiYXR0cmlidXRlIHZlYzMgbW9ycGhfcG9zNDtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcImF0dHJpYnV0ZSB2ZWMzIG1vcnBoX3BvczU7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJhdHRyaWJ1dGUgdmVjMyBtb3JwaF9wb3M2O1xcblwiO1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiYXR0cmlidXRlIHZlYzMgbW9ycGhfcG9zNztcXG5cIjtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXMubW9ycGhfbnJtNCA9IFNFTUFOVElDX0FUVFIxMjtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGVzLm1vcnBoX25ybTUgPSBTRU1BTlRJQ19BVFRSMTM7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlcy5tb3JwaF9ucm02ID0gU0VNQU5USUNfQVRUUjE0O1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXMubW9ycGhfbnJtNyA9IFNFTUFOVElDX0FUVFIxNTtcblxuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiI2RlZmluZSBNT1JQSElOR19OUk00N1xcblwiO1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiYXR0cmlidXRlIHZlYzMgbW9ycGhfbnJtNDtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcImF0dHJpYnV0ZSB2ZWMzIG1vcnBoX25ybTU7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJhdHRyaWJ1dGUgdmVjMyBtb3JwaF9ucm02O1xcblwiO1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiYXR0cmlidXRlIHZlYzMgbW9ycGhfbnJtNztcXG5cIjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy5za2luKSB7XG4gICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXMudmVydGV4X2JvbmVXZWlnaHRzID0gU0VNQU5USUNfQkxFTkRXRUlHSFQ7XG4gICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXMudmVydGV4X2JvbmVJbmRpY2VzID0gU0VNQU5USUNfQkxFTkRJTkRJQ0VTO1xuICAgICAgICAgICAgY29kZSArPSBza2luQ29kZShkZXZpY2UsIGNodW5rcyk7XG4gICAgICAgICAgICBjb2RlICs9IFwiI2RlZmluZSBTS0lOXFxuXCI7XG4gICAgICAgIH0gZWxzZSBpZiAob3B0aW9ucy51c2VJbnN0YW5jaW5nKSB7XG4gICAgICAgICAgICBjb2RlICs9IFwiI2RlZmluZSBJTlNUQU5DSU5HXFxuXCI7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9wdGlvbnMuc2NyZWVuU3BhY2UpIHtcbiAgICAgICAgICAgIGNvZGUgKz0gXCIjZGVmaW5lIFNDUkVFTlNQQUNFXFxuXCI7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9wdGlvbnMucGl4ZWxTbmFwKSB7XG4gICAgICAgICAgICBjb2RlICs9IFwiI2RlZmluZSBQSVhFTFNOQVBcXG5cIjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvZGUgPSB0aGlzLl92c0FkZFRyYW5zZm9ybUNvZGUoY29kZSwgZGV2aWNlLCBjaHVua3MsIG9wdGlvbnMpO1xuXG4gICAgICAgIGlmICh0aGlzLm5lZWRzTm9ybWFsKSB7XG4gICAgICAgICAgICBjb2RlICs9IGNodW5rcy5ub3JtYWxWUztcbiAgICAgICAgfVxuXG4gICAgICAgIGNvZGUgKz0gXCJcXG5cIjtcbiAgICAgICAgY29kZSArPSBjaHVua3Muc3RhcnRWUztcbiAgICAgICAgY29kZSArPSBjb2RlQm9keTtcbiAgICAgICAgY29kZSArPSBjaHVua3MuZW5kVlM7XG4gICAgICAgIGNvZGUgKz0gXCJ9XCI7XG5cbiAgICAgICAgLy8gYnVpbGQgdmFyeWluZ3NcbiAgICAgICAgT2JqZWN0LmtleXMoYnVpbHRpblZhcnlpbmdzKS5mb3JFYWNoKCh2KSA9PiB7XG4gICAgICAgICAgICBpZiAoY29kZS5pbmRleE9mKHYpID49IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLnZhcnlpbmdzICs9IGB2YXJ5aW5nICR7YnVpbHRpblZhcnlpbmdzW3ZdfSAke3Z9O1xcbmA7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IHN0YXJ0Q29kZSA9IHZlcnRleEludHJvKGRldmljZSwgJ0xpdFNoYWRlcicsIHRoaXMub3B0aW9ucy5wYXNzLCBjaHVua3MuZXh0ZW5zaW9uVlMpO1xuICAgICAgICB0aGlzLnZzaGFkZXIgPSBzdGFydENvZGUgKyB0aGlzLnZhcnlpbmdzICsgY29kZTtcbiAgICB9XG5cbiAgICBfZnNHZXRCZWdpbkNvZGUoKSB7XG5cbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG4gICAgICAgIGNvbnN0IGNodW5rcyA9IHRoaXMuY2h1bmtzO1xuXG4gICAgICAgIGNvbnN0IHByZWNpc2lvbiA9IHRoaXMub3B0aW9ucy5mb3JjZUZyYWdtZW50UHJlY2lzaW9uO1xuICAgICAgICBsZXQgY29kZSA9IGZyYWdtZW50SW50cm8oZGV2aWNlLCAnTGl0U2hhZGVyJywgdGhpcy5vcHRpb25zLnBhc3MsIGNodW5rcy5leHRlbnNpb25QUywgcHJlY2lzaW9uKTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuZGVmaW5lcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29kZSArPSBgI2RlZmluZSAke3RoaXMuZGVmaW5lc1tpXX1cXG5gO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGNvZGU7XG4gICAgfVxuXG4gICAgX2ZzR2V0UGlja1Bhc3NDb2RlKCkge1xuICAgICAgICBsZXQgY29kZSA9IHRoaXMuX2ZzR2V0QmVnaW5Db2RlKCk7XG4gICAgICAgIGNvZGUgKz0gXCJ1bmlmb3JtIHZlYzQgdUNvbG9yO1xcblwiO1xuICAgICAgICBjb2RlICs9IHRoaXMudmFyeWluZ3M7XG4gICAgICAgIGNvZGUgKz0gdGhpcy5mcm9udGVuZERlY2w7XG4gICAgICAgIGNvZGUgKz0gdGhpcy5mcm9udGVuZENvZGU7XG4gICAgICAgIGNvZGUgKz0gYmVnaW4oKTtcbiAgICAgICAgY29kZSArPSB0aGlzLmZyb250ZW5kRnVuYztcbiAgICAgICAgY29kZSArPSBcIiAgICBnbF9GcmFnQ29sb3IgPSB1Q29sb3I7XFxuXCI7XG4gICAgICAgIGNvZGUgKz0gZW5kKCk7XG4gICAgICAgIHJldHVybiBjb2RlO1xuICAgIH1cblxuICAgIF9mc0dldERlcHRoUGFzc0NvZGUoKSB7XG4gICAgICAgIGNvbnN0IGNodW5rcyA9IHRoaXMuY2h1bmtzO1xuXG4gICAgICAgIGxldCBjb2RlID0gdGhpcy5fZnNHZXRCZWdpbkNvZGUoKTtcblxuICAgICAgICBjb2RlICs9ICd2YXJ5aW5nIGZsb2F0IHZEZXB0aDtcXG4nO1xuICAgICAgICBjb2RlICs9IHRoaXMudmFyeWluZ3M7XG4gICAgICAgIGNvZGUgKz0gY2h1bmtzLnBhY2tEZXB0aFBTO1xuICAgICAgICBjb2RlICs9IHRoaXMuZnJvbnRlbmREZWNsO1xuICAgICAgICBjb2RlICs9IHRoaXMuZnJvbnRlbmRDb2RlO1xuICAgICAgICBjb2RlICs9IGJlZ2luKCk7XG4gICAgICAgIGNvZGUgKz0gdGhpcy5mcm9udGVuZEZ1bmM7XG4gICAgICAgIGNvZGUgKz0gXCIgICAgZ2xfRnJhZ0NvbG9yID0gcGFja0Zsb2F0KHZEZXB0aCk7XFxuXCI7XG4gICAgICAgIGNvZGUgKz0gZW5kKCk7XG5cbiAgICAgICAgcmV0dXJuIGNvZGU7XG4gICAgfVxuXG4gICAgX2ZzR2V0U2hhZG93UGFzc0NvZGUoKSB7XG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuICAgICAgICBjb25zdCBvcHRpb25zID0gdGhpcy5vcHRpb25zO1xuICAgICAgICBjb25zdCBjaHVua3MgPSB0aGlzLmNodW5rcztcbiAgICAgICAgY29uc3QgdmFyeWluZ3MgPSB0aGlzLnZhcnlpbmdzO1xuXG4gICAgICAgIGNvbnN0IGxpZ2h0VHlwZSA9IFNoYWRlclBhc3MudG9MaWdodFR5cGUob3B0aW9ucy5wYXNzKTtcbiAgICAgICAgY29uc3Qgc2hhZG93VHlwZSA9IFNoYWRlclBhc3MudG9TaGFkb3dUeXBlKG9wdGlvbnMucGFzcyk7XG5cbiAgICAgICAgbGV0IGNvZGUgPSB0aGlzLl9mc0dldEJlZ2luQ29kZSgpO1xuXG4gICAgICAgIGlmIChkZXZpY2UuZXh0U3RhbmRhcmREZXJpdmF0aXZlcyAmJiAhZGV2aWNlLndlYmdsMikge1xuICAgICAgICAgICAgY29kZSArPSAndW5pZm9ybSB2ZWMyIHBvbHlnb25PZmZzZXQ7XFxuJztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzaGFkb3dUeXBlID09PSBTSEFET1dfVlNNMzIpIHtcbiAgICAgICAgICAgIGlmIChkZXZpY2UudGV4dHVyZUZsb2F0SGlnaFByZWNpc2lvbikge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gJyNkZWZpbmUgVlNNX0VYUE9ORU5UIDE1LjBcXG5cXG4nO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb2RlICs9ICcjZGVmaW5lIFZTTV9FWFBPTkVOVCA1LjU0XFxuXFxuJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChzaGFkb3dUeXBlID09PSBTSEFET1dfVlNNMTYpIHtcbiAgICAgICAgICAgIGNvZGUgKz0gJyNkZWZpbmUgVlNNX0VYUE9ORU5UIDUuNTRcXG5cXG4nO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGxpZ2h0VHlwZSAhPT0gTElHSFRUWVBFX0RJUkVDVElPTkFMKSB7XG4gICAgICAgICAgICBjb2RlICs9ICd1bmlmb3JtIHZlYzMgdmlld19wb3NpdGlvbjtcXG4nO1xuICAgICAgICAgICAgY29kZSArPSAndW5pZm9ybSBmbG9hdCBsaWdodF9yYWRpdXM7XFxuJztcbiAgICAgICAgfVxuXG4gICAgICAgIGNvZGUgKz0gdmFyeWluZ3M7XG4gICAgICAgIGNvZGUgKz0gdGhpcy5mcm9udGVuZERlY2w7XG4gICAgICAgIGNvZGUgKz0gdGhpcy5mcm9udGVuZENvZGU7XG5cbiAgICAgICAgaWYgKHNoYWRvd1R5cGUgPT09IFNIQURPV19QQ0YzICYmICghZGV2aWNlLndlYmdsMiB8fCBsaWdodFR5cGUgPT09IExJR0hUVFlQRV9PTU5JKSkge1xuICAgICAgICAgICAgY29kZSArPSBjaHVua3MucGFja0RlcHRoUFM7XG4gICAgICAgIH0gZWxzZSBpZiAoc2hhZG93VHlwZSA9PT0gU0hBRE9XX1ZTTTgpIHtcbiAgICAgICAgICAgIGNvZGUgKz0gXCJ2ZWMyIGVuY29kZUZsb2F0UkcoIGZsb2F0IHYgKSB7XFxuXCI7XG4gICAgICAgICAgICBjb2RlICs9IFwiICAgIHZlYzIgZW5jID0gdmVjMigxLjAsIDI1NS4wKSAqIHY7XFxuXCI7XG4gICAgICAgICAgICBjb2RlICs9IFwiICAgIGVuYyA9IGZyYWN0KGVuYyk7XFxuXCI7XG4gICAgICAgICAgICBjb2RlICs9IFwiICAgIGVuYyAtPSBlbmMueXkgKiB2ZWMyKDEuMC8yNTUuMCwgMS4wLzI1NS4wKTtcXG5cIjtcbiAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgcmV0dXJuIGVuYztcXG5cIjtcbiAgICAgICAgICAgIGNvZGUgKz0gXCJ9XFxuXFxuXCI7XG4gICAgICAgIH1cblxuICAgICAgICBjb2RlICs9IGJlZ2luKCk7XG5cbiAgICAgICAgY29kZSArPSB0aGlzLmZyb250ZW5kRnVuYztcblxuICAgICAgICBjb25zdCBpc1ZzbSA9IHNoYWRvd1R5cGUgPT09IFNIQURPV19WU004IHx8IHNoYWRvd1R5cGUgPT09IFNIQURPV19WU00xNiB8fCBzaGFkb3dUeXBlID09PSBTSEFET1dfVlNNMzI7XG4gICAgICAgIGNvbnN0IGFwcGx5U2xvcGVTY2FsZUJpYXMgPSAhZGV2aWNlLndlYmdsMiAmJiBkZXZpY2UuZXh0U3RhbmRhcmREZXJpdmF0aXZlcztcblxuICAgICAgICBpZiAobGlnaHRUeXBlID09PSBMSUdIVFRZUEVfT01OSSB8fCAoaXNWc20gJiYgbGlnaHRUeXBlICE9PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwpKSB7XG4gICAgICAgICAgICBjb2RlICs9IFwiICAgIGZsb2F0IGRlcHRoID0gbWluKGRpc3RhbmNlKHZpZXdfcG9zaXRpb24sIHZQb3NpdGlvblcpIC8gbGlnaHRfcmFkaXVzLCAwLjk5OTk5KTtcXG5cIjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZmxvYXQgZGVwdGggPSBnbF9GcmFnQ29vcmQuejtcXG5cIjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChhcHBseVNsb3BlU2NhbGVCaWFzKSB7XG4gICAgICAgICAgICBjb2RlICs9IFwiICAgIGZsb2F0IG1pblZhbHVlID0gMi4zMzc0MzcwNTAwMTUzMTg2ZS0xMDsgLy8oMS4wIC8gMjU1LjApIC8gKDI1Ni4wICogMjU2LjAgKiAyNTYuMCk7XFxuXCI7XG4gICAgICAgICAgICBjb2RlICs9IFwiICAgIGRlcHRoICs9IHBvbHlnb25PZmZzZXQueCAqIG1heChhYnMoZEZkeChkZXB0aCkpLCBhYnMoZEZkeShkZXB0aCkpKSArIG1pblZhbHVlICogcG9seWdvbk9mZnNldC55O1xcblwiO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHNoYWRvd1R5cGUgPT09IFNIQURPV19QQ0YzICYmICghZGV2aWNlLndlYmdsMiB8fCAobGlnaHRUeXBlID09PSBMSUdIVFRZUEVfT01OSSAmJiAhb3B0aW9ucy5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpKSkge1xuICAgICAgICAgICAgY29kZSArPSBcIiAgICBnbF9GcmFnQ29sb3IgPSBwYWNrRmxvYXQoZGVwdGgpO1xcblwiO1xuICAgICAgICB9IGVsc2UgaWYgKHNoYWRvd1R5cGUgPT09IFNIQURPV19QQ0YzIHx8IHNoYWRvd1R5cGUgPT09IFNIQURPV19QQ0Y1KSB7XG4gICAgICAgICAgICBjb2RlICs9IFwiICAgIGdsX0ZyYWdDb2xvciA9IHZlYzQoMS4wKTtcXG5cIjsgLy8ganVzdCB0aGUgc2ltcGxlc3QgY29kZSwgY29sb3IgaXMgbm90IHdyaXR0ZW4gYW55d2F5XG5cbiAgICAgICAgICAgIC8vIGNsdXN0ZXJlZCBvbW5pIGxpZ2h0IGlzIHVzaW5nIHNoYWRvdyBzYW1wbGVyIGFuZCBuZWVkcyB0byB3cml0ZSBjdXN0b20gZGVwdGhcbiAgICAgICAgICAgIGlmIChvcHRpb25zLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCAmJiBsaWdodFR5cGUgPT09IExJR0hUVFlQRV9PTU5JICYmIGRldmljZS53ZWJnbDIpIHtcbiAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGdsX0ZyYWdEZXB0aCA9IGRlcHRoO1xcblwiO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKHNoYWRvd1R5cGUgPT09IFNIQURPV19WU004KSB7XG4gICAgICAgICAgICBjb2RlICs9IFwiICAgIGdsX0ZyYWdDb2xvciA9IHZlYzQoZW5jb2RlRmxvYXRSRyhkZXB0aCksIGVuY29kZUZsb2F0UkcoZGVwdGgqZGVwdGgpKTtcXG5cIjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLnN0b3JlRVZTTVBTO1xuICAgICAgICB9XG5cbiAgICAgICAgY29kZSArPSBlbmQoKTtcblxuICAgICAgICByZXR1cm4gY29kZTtcbiAgICB9XG5cbiAgICAvLyB0aGUgYmlnIG9uZVxuICAgIF9mc0dldExpdFBhc3NDb2RlKCkge1xuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmRldmljZTtcbiAgICAgICAgY29uc3Qgb3B0aW9ucyA9IHRoaXMub3B0aW9ucztcbiAgICAgICAgY29uc3QgY2h1bmtzID0gdGhpcy5jaHVua3M7XG5cbiAgICAgICAgbGV0IGNvZGUgPSBcIlwiO1xuXG4gICAgICAgIGlmIChvcHRpb25zLm9wYWNpdHlGYWRlc1NwZWN1bGFyID09PSBmYWxzZSkge1xuICAgICAgICAgICAgY29kZSArPSAndW5pZm9ybSBmbG9hdCBtYXRlcmlhbF9hbHBoYUZhZGU7XFxuJztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLnVzZVNwZWN1bGFyKSB7XG4gICAgICAgICAgICB0aGlzLmRlZmluZXMucHVzaChcIkxJVF9TUEVDVUxBUlwiKTtcblxuICAgICAgICAgICAgaWYgKHRoaXMucmVmbGVjdGlvbnMpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmRlZmluZXMucHVzaChcIkxJVF9SRUZMRUNUSU9OU1wiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG9wdGlvbnMuY2xlYXJDb2F0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kZWZpbmVzLnB1c2goXCJMSVRfQ0xFQVJDT0FUXCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAob3B0aW9ucy5mcmVzbmVsTW9kZWwgPiAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kZWZpbmVzLnB1c2goXCJMSVRfU1BFQ1VMQVJfRlJFU05FTFwiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gZW5hYmxlIGNvbnNlcnZlIGVuZXJneSBwYXRoIGluIGNsdXN0ZXJlZCBjaHVua1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMuY29uc2VydmVFbmVyZ3kpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmRlZmluZXMucHVzaChcIkxJVF9DT05TRVJWRV9FTkVSR1lcIik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zLnNoZWVuKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kZWZpbmVzLnB1c2goXCJMSVRfU0hFRU5cIik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zLmlyaWRlc2NlbmNlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kZWZpbmVzLnB1c2goXCJMSVRfSVJJREVTQ0VOQ0VcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBGUkFHTUVOVCBTSEFERVIgSU5QVVRTOiBVTklGT1JNU1xuICAgICAgICBjb25zdCBzaGFkb3dUeXBlVXNlZCA9IFtdO1xuICAgICAgICBsZXQgbnVtU2hhZG93TGlnaHRzID0gMDtcbiAgICAgICAgbGV0IHNoYWRvd2VkRGlyZWN0aW9uYWxMaWdodFVzZWQgPSBmYWxzZTtcbiAgICAgICAgbGV0IHVzZVZzbSA9IGZhbHNlO1xuICAgICAgICBsZXQgdXNlUGVyc3BaYnVmZmVyU2hhZG93ID0gZmFsc2U7XG5cbiAgICAgICAgbGV0IGhhc0FyZWFMaWdodHMgPSBvcHRpb25zLmxpZ2h0cy5zb21lKGZ1bmN0aW9uIChsaWdodCkge1xuICAgICAgICAgICAgcmV0dXJuIGxpZ2h0Ll9zaGFwZSAmJiBsaWdodC5fc2hhcGUgIT09IExJR0hUU0hBUEVfUFVOQ1RVQUw7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIGlmIGNsdXN0ZXJlZCBsaWdodGluZyBoYXMgYXJlYSBsaWdodHMgZW5hYmxlZCwgaXQgYWx3YXlzIHJ1bnMgaW4gJ2FyZWEgbGlnaHRzIG1vZGUnXG4gICAgICAgIC8vIFRPRE86IG1heWJlIHdlIHNob3VsZCBhbHdheXMgdXNlIGl0IGFuZCByZW1vdmUgdGhlIG90aGVyIHdheT9cbiAgICAgICAgaWYgKG9wdGlvbnMuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkICYmIG9wdGlvbnMuY2x1c3RlcmVkTGlnaHRpbmdBcmVhTGlnaHRzRW5hYmxlZCkge1xuICAgICAgICAgICAgaGFzQXJlYUxpZ2h0cyA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgYXJlYUx1dHNQcmVjaXNpb24gPSAnaGlnaHAnO1xuICAgICAgICBpZiAoZGV2aWNlLmFyZWFMaWdodEx1dEZvcm1hdCA9PT0gUElYRUxGT1JNQVRfUjhfRzhfQjhfQTgpIHtcbiAgICAgICAgICAgIC8vIHVzZSBvZmZzZXQgYW5kIHNjYWxlIGZvciByZ2I4IGZvcm1hdCBsdXRzXG4gICAgICAgICAgICBjb2RlICs9IFwiI2RlZmluZSBBUkVBX1I4X0c4X0I4X0E4X0xVVFNcXG5cIjtcbiAgICAgICAgICAgIGFyZWFMdXRzUHJlY2lzaW9uID0gJ2xvd3AnO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGhhc0FyZWFMaWdodHMgfHwgb3B0aW9ucy5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpIHtcbiAgICAgICAgICAgIGNvZGUgKz0gXCIjZGVmaW5lIEFSRUFfTElHSFRTXFxuXCI7XG4gICAgICAgICAgICBjb2RlICs9IGB1bmlmb3JtICR7YXJlYUx1dHNQcmVjaXNpb259IHNhbXBsZXIyRCBhcmVhTGlnaHRzTHV0VGV4MTtcXG5gO1xuICAgICAgICAgICAgY29kZSArPSBgdW5pZm9ybSAke2FyZWFMdXRzUHJlY2lzaW9ufSBzYW1wbGVyMkQgYXJlYUxpZ2h0c0x1dFRleDI7XFxuYDtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgb3B0aW9ucy5saWdodHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxpZ2h0ID0gb3B0aW9ucy5saWdodHNbaV07XG4gICAgICAgICAgICBjb25zdCBsaWdodFR5cGUgPSBsaWdodC5fdHlwZTtcblxuICAgICAgICAgICAgLy8gc2tpcCB1bmlmb3JtIGdlbmVyYXRpb24gZm9yIGxvY2FsIGxpZ2h0cyBpZiBjbHVzdGVyZWQgbGlnaHRpbmcgaXMgZW5hYmxlZFxuICAgICAgICAgICAgaWYgKG9wdGlvbnMuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkICYmIGxpZ2h0VHlwZSAhPT0gTElHSFRUWVBFX0RJUkVDVElPTkFMKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICBjb25zdCBsaWdodFNoYXBlID0gKGhhc0FyZWFMaWdodHMgJiYgbGlnaHQuX3NoYXBlKSA/IGxpZ2h0Ll9zaGFwZSA6IExJR0hUU0hBUEVfUFVOQ1RVQUw7XG5cbiAgICAgICAgICAgIGNvZGUgKz0gXCJ1bmlmb3JtIHZlYzMgbGlnaHRcIiArIGkgKyBcIl9jb2xvcjtcXG5cIjtcbiAgICAgICAgICAgIGlmIChsaWdodFR5cGUgPT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCkge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJ1bmlmb3JtIHZlYzMgbGlnaHRcIiArIGkgKyBcIl9kaXJlY3Rpb247XFxuXCI7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJ1bmlmb3JtIHZlYzMgbGlnaHRcIiArIGkgKyBcIl9wb3NpdGlvbjtcXG5cIjtcbiAgICAgICAgICAgICAgICBjb2RlICs9IFwidW5pZm9ybSBmbG9hdCBsaWdodFwiICsgaSArIFwiX3JhZGl1cztcXG5cIjtcbiAgICAgICAgICAgICAgICBpZiAobGlnaHRUeXBlID09PSBMSUdIVFRZUEVfU1BPVCkge1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwidW5pZm9ybSB2ZWMzIGxpZ2h0XCIgKyBpICsgXCJfZGlyZWN0aW9uO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwidW5pZm9ybSBmbG9hdCBsaWdodFwiICsgaSArIFwiX2lubmVyQ29uZUFuZ2xlO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwidW5pZm9ybSBmbG9hdCBsaWdodFwiICsgaSArIFwiX291dGVyQ29uZUFuZ2xlO1xcblwiO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChsaWdodFNoYXBlICE9PSBMSUdIVFNIQVBFX1BVTkNUVUFMKSB7XG4gICAgICAgICAgICAgICAgaWYgKGxpZ2h0VHlwZSA9PT0gTElHSFRUWVBFX0RJUkVDVElPTkFMKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJ1bmlmb3JtIHZlYzMgbGlnaHRcIiArIGkgKyBcIl9wb3NpdGlvbjtcXG5cIjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29kZSArPSBcInVuaWZvcm0gdmVjMyBsaWdodFwiICsgaSArIFwiX2hhbGZXaWR0aDtcXG5cIjtcbiAgICAgICAgICAgICAgICBjb2RlICs9IFwidW5pZm9ybSB2ZWMzIGxpZ2h0XCIgKyBpICsgXCJfaGFsZkhlaWdodDtcXG5cIjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChsaWdodC5jYXN0U2hhZG93cyAmJiAhb3B0aW9ucy5ub1NoYWRvdykge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJ1bmlmb3JtIG1hdDQgbGlnaHRcIiArIGkgKyBcIl9zaGFkb3dNYXRyaXg7XFxuXCI7XG4gICAgICAgICAgICAgICAgY29kZSArPSBcInVuaWZvcm0gZmxvYXQgbGlnaHRcIiArIGkgKyBcIl9zaGFkb3dJbnRlbnNpdHk7XFxuXCI7XG5cbiAgICAgICAgICAgICAgICAvLyBkaXJlY3Rpb25hbCAoY2FzY2FkZWQpIHNoYWRvd3NcbiAgICAgICAgICAgICAgICBpZiAobGlnaHRUeXBlID09PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwpIHtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcInVuaWZvcm0gbWF0NCBsaWdodFwiICsgaSArIFwiX3NoYWRvd01hdHJpeFBhbGV0dGVbNF07XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJ1bmlmb3JtIGZsb2F0IGxpZ2h0XCIgKyBpICsgXCJfc2hhZG93Q2FzY2FkZURpc3RhbmNlc1s0XTtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcInVuaWZvcm0gZmxvYXQgbGlnaHRcIiArIGkgKyBcIl9zaGFkb3dDYXNjYWRlQ291bnQ7XFxuXCI7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGxpZ2h0VHlwZSAhPT0gTElHSFRUWVBFX0RJUkVDVElPTkFMKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJ1bmlmb3JtIHZlYzQgbGlnaHRcIiArIGkgKyBcIl9zaGFkb3dQYXJhbXM7XFxuXCI7IC8vIFdpZHRoLCBoZWlnaHQsIGJpYXMsIHJhZGl1c1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHNoYWRvd2VkRGlyZWN0aW9uYWxMaWdodFVzZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwidW5pZm9ybSB2ZWMzIGxpZ2h0XCIgKyBpICsgXCJfc2hhZG93UGFyYW1zO1xcblwiOyAvLyBXaWR0aCwgaGVpZ2h0LCBiaWFzXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChsaWdodFR5cGUgPT09IExJR0hUVFlQRV9PTU5JKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJ1bmlmb3JtIHNhbXBsZXJDdWJlIGxpZ2h0XCIgKyBpICsgXCJfc2hhZG93TWFwO1xcblwiO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChsaWdodC5faXNQY2YgJiYgZGV2aWNlLndlYmdsMikge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcInVuaWZvcm0gc2FtcGxlcjJEU2hhZG93IGxpZ2h0XCIgKyBpICsgXCJfc2hhZG93TWFwO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcInVuaWZvcm0gc2FtcGxlcjJEIGxpZ2h0XCIgKyBpICsgXCJfc2hhZG93TWFwO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIG51bVNoYWRvd0xpZ2h0cysrO1xuICAgICAgICAgICAgICAgIHNoYWRvd1R5cGVVc2VkW2xpZ2h0Ll9zaGFkb3dUeXBlXSA9IHRydWU7XG4gICAgICAgICAgICAgICAgaWYgKGxpZ2h0Ll9pc1ZzbSkgdXNlVnNtID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBpZiAobGlnaHQuX2lzUGNmICYmIChkZXZpY2Uud2ViZ2wyIHx8IGRldmljZS5leHRTdGFuZGFyZERlcml2YXRpdmVzKSAmJiBsaWdodFR5cGUgPT09IExJR0hUVFlQRV9TUE9UKSB1c2VQZXJzcFpidWZmZXJTaGFkb3cgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGxpZ2h0Ll9jb29raWUpIHtcbiAgICAgICAgICAgICAgICBpZiAobGlnaHQuX2Nvb2tpZS5fY3ViZW1hcCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAobGlnaHRUeXBlID09PSBMSUdIVFRZUEVfT01OSSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcInVuaWZvcm0gc2FtcGxlckN1YmUgbGlnaHRcIiArIGkgKyBcIl9jb29raWU7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwidW5pZm9ybSBmbG9hdCBsaWdodFwiICsgaSArIFwiX2Nvb2tpZUludGVuc2l0eTtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghbGlnaHQuY2FzdFNoYWRvd3MgfHwgb3B0aW9ucy5ub1NoYWRvdykgY29kZSArPSBcInVuaWZvcm0gbWF0NCBsaWdodFwiICsgaSArIFwiX3NoYWRvd01hdHJpeDtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChsaWdodFR5cGUgPT09IExJR0hUVFlQRV9TUE9UKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwidW5pZm9ybSBzYW1wbGVyMkQgbGlnaHRcIiArIGkgKyBcIl9jb29raWU7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwidW5pZm9ybSBmbG9hdCBsaWdodFwiICsgaSArIFwiX2Nvb2tpZUludGVuc2l0eTtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghbGlnaHQuY2FzdFNoYWRvd3MgfHwgb3B0aW9ucy5ub1NoYWRvdykgY29kZSArPSBcInVuaWZvcm0gbWF0NCBsaWdodFwiICsgaSArIFwiX3NoYWRvd01hdHJpeDtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsaWdodC5fY29va2llVHJhbnNmb3JtKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcInVuaWZvcm0gdmVjNCBsaWdodFwiICsgaSArIFwiX2Nvb2tpZU1hdHJpeDtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwidW5pZm9ybSB2ZWMyIGxpZ2h0XCIgKyBpICsgXCJfY29va2llT2Zmc2V0O1xcblwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29kZSArPSBcIlxcblwiOyAvLyBFbmQgb2YgdW5pZm9ybSBkZWNsYXJhdGlvbnNcblxuICAgICAgICAvLyBUQk5cbiAgICAgICAgY29uc3QgaGFzVEJOID0gdGhpcy5uZWVkc05vcm1hbCAmJiAob3B0aW9ucy5ub3JtYWxNYXAgfHwgb3B0aW9ucy5jbGVhckNvYXROb3JtYWxNYXAgfHwgKG9wdGlvbnMuZW5hYmxlR0dYU3BlY3VsYXIgJiYgIW9wdGlvbnMuaGVpZ2h0TWFwKSk7XG5cbiAgICAgICAgaWYgKGhhc1RCTikge1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMuaGFzVGFuZ2VudHMpIHtcbiAgICAgICAgICAgICAgICBjb2RlICs9IG9wdGlvbnMuZmFzdFRibiA/IGNodW5rcy5UQk5mYXN0UFMgOiBjaHVua3MuVEJOUFM7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChkZXZpY2UuZXh0U3RhbmRhcmREZXJpdmF0aXZlcyAmJiAob3B0aW9ucy5ub3JtYWxNYXAgfHwgb3B0aW9ucy5jbGVhckNvYXROb3JtYWxNYXApKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLlRCTmRlcml2YXRpdmVQUy5yZXBsYWNlKC9cXCRVVi9nLCB0aGlzLmxpZ2h0aW5nVXYpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLlRCTk9iamVjdFNwYWNlUFM7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gRklYTUU6IG9ubHkgYWRkIHRoZXNlIHdoZW4gbmVlZGVkXG4gICAgICAgIGNvZGUgKz0gY2h1bmtzLnNwaGVyaWNhbFBTO1xuICAgICAgICBjb2RlICs9IGNodW5rcy5kZWNvZGVQUztcbiAgICAgICAgY29kZSArPSBnYW1tYUNvZGUob3B0aW9ucy5nYW1tYSwgY2h1bmtzKTtcbiAgICAgICAgY29kZSArPSB0b25lbWFwQ29kZShvcHRpb25zLnRvbmVNYXAsIGNodW5rcyk7XG4gICAgICAgIGNvZGUgKz0gZm9nQ29kZShvcHRpb25zLmZvZywgY2h1bmtzKTtcblxuXG4gICAgICAgIC8vIGZyb250ZW5kXG4gICAgICAgIGNvZGUgKz0gdGhpcy5mcm9udGVuZENvZGU7XG5cbiAgICAgICAgaWYgKG9wdGlvbnMudXNlQ3ViZU1hcFJvdGF0aW9uKSB7XG4gICAgICAgICAgICBjb2RlICs9IFwiI2RlZmluZSBDVUJFTUFQX1JPVEFUSU9OXFxuXCI7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5uZWVkc05vcm1hbCkge1xuICAgICAgICAgICAgY29kZSArPSBjaHVua3MuY3ViZU1hcFJvdGF0ZVBTO1xuICAgICAgICAgICAgY29kZSArPSBvcHRpb25zLmN1YmVNYXBQcm9qZWN0aW9uID4gMCA/IGNodW5rcy5jdWJlTWFwUHJvamVjdEJveFBTIDogY2h1bmtzLmN1YmVNYXBQcm9qZWN0Tm9uZVBTO1xuICAgICAgICAgICAgY29kZSArPSBvcHRpb25zLnNreWJveEludGVuc2l0eSA/IGNodW5rcy5lbnZNdWx0aXBseVBTIDogY2h1bmtzLmVudkNvbnN0UFM7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoKHRoaXMubGlnaHRpbmcgJiYgb3B0aW9ucy51c2VTcGVjdWxhcikgfHwgdGhpcy5yZWZsZWN0aW9ucykge1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMudXNlTWV0YWxuZXNzKSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBjaHVua3MubWV0YWxuZXNzTW9kdWxhdGVQUztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG9wdGlvbnMuZnJlc25lbE1vZGVsID09PSBGUkVTTkVMX1NDSExJQ0spIHtcbiAgICAgICAgICAgICAgICBjb2RlICs9IGNodW5rcy5mcmVzbmVsU2NobGlja1BTO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAob3B0aW9ucy5pcmlkZXNjZW5jZSkge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLmlyaWRlc2NlbmNlRGlmZnJhY3Rpb25QUztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHVzZUFvID0gb3B0aW9ucy5hb01hcCB8fCBvcHRpb25zLmFvVmVydGV4Q29sb3I7XG5cbiAgICAgICAgaWYgKHVzZUFvKSB7XG4gICAgICAgICAgICBjb2RlICs9IGNodW5rcy5hb0RpZmZ1c2VPY2NQUztcbiAgICAgICAgICAgIHN3aXRjaCAob3B0aW9ucy5vY2NsdWRlU3BlY3VsYXIpIHtcbiAgICAgICAgICAgICAgICBjYXNlIFNQRUNPQ0NfQU86XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gb3B0aW9ucy5vY2NsdWRlU3BlY3VsYXJGbG9hdCA/IGNodW5rcy5hb1NwZWNPY2NTaW1wbGVQUyA6IGNodW5rcy5hb1NwZWNPY2NDb25zdFNpbXBsZVBTO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIFNQRUNPQ0NfR0xPU1NERVBFTkRFTlQ6XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gb3B0aW9ucy5vY2NsdWRlU3BlY3VsYXJGbG9hdCA/IGNodW5rcy5hb1NwZWNPY2NQUyA6IGNodW5rcy5hb1NwZWNPY2NDb25zdFBTO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLnJlZmxlY3Rpb25Tb3VyY2UgPT09ICdlbnZBdGxhc0hRJykge1xuICAgICAgICAgICAgY29kZSArPSBvcHRpb25zLmZpeFNlYW1zID8gY2h1bmtzLmZpeEN1YmVtYXBTZWFtc1N0cmV0Y2hQUyA6IGNodW5rcy5maXhDdWJlbWFwU2VhbXNOb25lUFM7XG4gICAgICAgICAgICBjb2RlICs9IGNodW5rcy5lbnZBdGxhc1BTO1xuICAgICAgICAgICAgY29kZSArPSBjaHVua3MucmVmbGVjdGlvbkVudkhRUFMucmVwbGFjZSgvXFwkREVDT0RFL2csIENodW5rVXRpbHMuZGVjb2RlRnVuYyhvcHRpb25zLnJlZmxlY3Rpb25FbmNvZGluZykpO1xuICAgICAgICB9IGVsc2UgaWYgKG9wdGlvbnMucmVmbGVjdGlvblNvdXJjZSA9PT0gJ2VudkF0bGFzJykge1xuICAgICAgICAgICAgY29kZSArPSBjaHVua3MuZW52QXRsYXNQUztcbiAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLnJlZmxlY3Rpb25FbnZQUy5yZXBsYWNlKC9cXCRERUNPREUvZywgQ2h1bmtVdGlscy5kZWNvZGVGdW5jKG9wdGlvbnMucmVmbGVjdGlvbkVuY29kaW5nKSk7XG4gICAgICAgIH0gZWxzZSBpZiAob3B0aW9ucy5yZWZsZWN0aW9uU291cmNlID09PSAnY3ViZU1hcCcpIHtcbiAgICAgICAgICAgIGNvZGUgKz0gb3B0aW9ucy5maXhTZWFtcyA/IGNodW5rcy5maXhDdWJlbWFwU2VhbXNTdHJldGNoUFMgOiBjaHVua3MuZml4Q3ViZW1hcFNlYW1zTm9uZVBTO1xuICAgICAgICAgICAgY29kZSArPSBjaHVua3MucmVmbGVjdGlvbkN1YmVQUy5yZXBsYWNlKC9cXCRERUNPREUvZywgQ2h1bmtVdGlscy5kZWNvZGVGdW5jKG9wdGlvbnMucmVmbGVjdGlvbkVuY29kaW5nKSk7XG4gICAgICAgIH0gZWxzZSBpZiAob3B0aW9ucy5yZWZsZWN0aW9uU291cmNlID09PSAnc3BoZXJlTWFwJykge1xuICAgICAgICAgICAgY29uc3Qgc2NvZGUgPSBkZXZpY2UuZnJhZ21lbnRVbmlmb3Jtc0NvdW50ID4gMTYgPyBjaHVua3MucmVmbGVjdGlvblNwaGVyZVBTIDogY2h1bmtzLnJlZmxlY3Rpb25TcGhlcmVMb3dQUztcbiAgICAgICAgICAgIGNvZGUgKz0gc2NvZGUucmVwbGFjZSgvXFwkREVDT0RFL2csIENodW5rVXRpbHMuZGVjb2RlRnVuYyhvcHRpb25zLnJlZmxlY3Rpb25FbmNvZGluZykpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMucmVmbGVjdGlvbnMpIHtcbiAgICAgICAgICAgIGlmIChvcHRpb25zLmNsZWFyQ29hdCkge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLnJlZmxlY3Rpb25DQ1BTO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKG9wdGlvbnMuc2hlZW4pIHtcbiAgICAgICAgICAgICAgICBjb2RlICs9IGNodW5rcy5yZWZsZWN0aW9uU2hlZW5QUztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLnJlZnJhY3Rpb24pIHtcbiAgICAgICAgICAgIGlmIChvcHRpb25zLnVzZUR5bmFtaWNSZWZyYWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBjaHVua3MucmVmcmFjdGlvbkR5bmFtaWNQUztcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5yZWZsZWN0aW9ucykge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLnJlZnJhY3Rpb25DdWJlUFM7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy5zaGVlbikge1xuICAgICAgICAgICAgY29kZSArPSBjaHVua3MubGlnaHRTaGVlblBTO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gY2x1c3RlcmVkIGxpZ2h0aW5nXG4gICAgICAgIGlmIChvcHRpb25zLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCkge1xuXG4gICAgICAgICAgICAvLyBpbmNsdWRlIHRoaXMgYmVmb3JlIHNoYWRvdyAvIGNvb2tpZSBjb2RlXG4gICAgICAgICAgICBjb2RlICs9IGNodW5rcy5jbHVzdGVyZWRMaWdodFV0aWxzUFM7XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5jbHVzdGVyZWRMaWdodGluZ0Nvb2tpZXNFbmFibGVkKVxuICAgICAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLmNsdXN0ZXJlZExpZ2h0Q29va2llc1BTO1xuXG4gICAgICAgICAgICAvLyBpbmNsdWRlIHNoYWRvdyBjaHVua3MgY2x1c3RlcmVkIGxpZ2h0cyBzdXBwb3J0XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5jbHVzdGVyZWRMaWdodGluZ1NoYWRvd3NFbmFibGVkICYmICFvcHRpb25zLm5vU2hhZG93KSB7XG4gICAgICAgICAgICAgICAgc2hhZG93VHlwZVVzZWRbU0hBRE9XX1BDRjNdID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBzaGFkb3dUeXBlVXNlZFtTSEFET1dfUENGNV0gPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdXNlUGVyc3BaYnVmZmVyU2hhZG93ID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChudW1TaGFkb3dMaWdodHMgPiAwIHx8IG9wdGlvbnMuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkKSB7XG4gICAgICAgICAgICBpZiAoc2hhZG93ZWREaXJlY3Rpb25hbExpZ2h0VXNlZCkge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLnNoYWRvd0Nhc2NhZGVzUFM7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoc2hhZG93VHlwZVVzZWRbU0hBRE9XX1BDRjNdKSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBjaHVua3Muc2hhZG93U3RhbmRhcmRQUztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzaGFkb3dUeXBlVXNlZFtTSEFET1dfUENGNV0gJiYgZGV2aWNlLndlYmdsMikge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLnNoYWRvd1N0YW5kYXJkR0wyUFM7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodXNlVnNtKSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBjaHVua3Muc2hhZG93VlNNX2NvbW1vblBTO1xuICAgICAgICAgICAgICAgIGlmIChzaGFkb3dUeXBlVXNlZFtTSEFET1dfVlNNOF0pIHtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBjaHVua3Muc2hhZG93VlNNOFBTO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoc2hhZG93VHlwZVVzZWRbU0hBRE9XX1ZTTTE2XSkge1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IGRldmljZS5leHRUZXh0dXJlSGFsZkZsb2F0TGluZWFyID8gY2h1bmtzLnNoYWRvd0VWU01QUy5yZXBsYWNlKC9cXCQvZywgXCIxNlwiKSA6IGNodW5rcy5zaGFkb3dFVlNNblBTLnJlcGxhY2UoL1xcJC9nLCBcIjE2XCIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoc2hhZG93VHlwZVVzZWRbU0hBRE9XX1ZTTTMyXSkge1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IGRldmljZS5leHRUZXh0dXJlRmxvYXRMaW5lYXIgPyBjaHVua3Muc2hhZG93RVZTTVBTLnJlcGxhY2UoL1xcJC9nLCBcIjMyXCIpIDogY2h1bmtzLnNoYWRvd0VWU01uUFMucmVwbGFjZSgvXFwkL2csIFwiMzJcIik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIShkZXZpY2Uud2ViZ2wyIHx8IGRldmljZS5leHRTdGFuZGFyZERlcml2YXRpdmVzKSkge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLmJpYXNDb25zdFBTO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBvdGhlcndpc2UgYmlhcyBpcyBhcHBsaWVkIG9uIHJlbmRlclxuICAgICAgICAgICAgY29kZSArPSBjaHVua3Muc2hhZG93Q29vcmRQUyArIGNodW5rcy5zaGFkb3dDb21tb25QUztcbiAgICAgICAgICAgIGlmICh1c2VQZXJzcFpidWZmZXJTaGFkb3cpIGNvZGUgKz0gY2h1bmtzLnNoYWRvd0Nvb3JkUGVyc3BaYnVmZmVyUFM7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy5lbmFibGVHR1hTcGVjdWxhcikgY29kZSArPSBcInVuaWZvcm0gZmxvYXQgbWF0ZXJpYWxfYW5pc290cm9weTtcXG5cIjtcblxuICAgICAgICBpZiAodGhpcy5saWdodGluZykge1xuICAgICAgICAgICAgY29kZSArPSBjaHVua3MubGlnaHREaWZmdXNlTGFtYmVydFBTO1xuICAgICAgICAgICAgaWYgKGhhc0FyZWFMaWdodHMgfHwgb3B0aW9ucy5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpIGNvZGUgKz0gY2h1bmtzLmx0YztcbiAgICAgICAgfVxuXG4gICAgICAgIGNvZGUgKz0gJ1xcbic7XG5cbiAgICAgICAgbGV0IHVzZU9sZEFtYmllbnQgPSBmYWxzZTtcbiAgICAgICAgaWYgKG9wdGlvbnMudXNlU3BlY3VsYXIpIHtcblxuICAgICAgICAgICAgaWYgKHRoaXMubGlnaHRpbmcpIHtcbiAgICAgICAgICAgICAgICBjb2RlICs9IG9wdGlvbnMuc2hhZGluZ01vZGVsID09PSBTUEVDVUxBUl9QSE9ORyA/IGNodW5rcy5saWdodFNwZWN1bGFyUGhvbmdQUyA6IChvcHRpb25zLmVuYWJsZUdHWFNwZWN1bGFyID8gY2h1bmtzLmxpZ2h0U3BlY3VsYXJBbmlzb0dHWFBTIDogY2h1bmtzLmxpZ2h0U3BlY3VsYXJCbGlublBTKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFvcHRpb25zLmZyZXNuZWxNb2RlbCAmJiAhdGhpcy5yZWZsZWN0aW9ucyAmJiAhb3B0aW9ucy5kaWZmdXNlTWFwKSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICB1bmlmb3JtIHZlYzMgbWF0ZXJpYWxfYW1iaWVudDtcXG5cIjtcbiAgICAgICAgICAgICAgICBjb2RlICs9IFwiI2RlZmluZSBMSVRfT0xEX0FNQklFTlRcIjtcbiAgICAgICAgICAgICAgICB1c2VPbGRBbWJpZW50ID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvZGUgKz0gY2h1bmtzLmNvbWJpbmVQUztcblxuICAgICAgICAvLyBsaWdodG1hcCBzdXBwb3J0XG4gICAgICAgIGlmIChvcHRpb25zLmxpZ2h0TWFwIHx8IG9wdGlvbnMubGlnaHRWZXJ0ZXhDb2xvcikge1xuICAgICAgICAgICAgY29kZSArPSAob3B0aW9ucy51c2VTcGVjdWxhciAmJiBvcHRpb25zLmRpckxpZ2h0TWFwKSA/IGNodW5rcy5saWdodG1hcERpckFkZFBTIDogY2h1bmtzLmxpZ2h0bWFwQWRkUFM7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBhZGRBbWJpZW50ID0gKCFvcHRpb25zLmxpZ2h0TWFwICYmICFvcHRpb25zLmxpZ2h0VmVydGV4Q29sb3IpIHx8IG9wdGlvbnMubGlnaHRNYXBXaXRob3V0QW1iaWVudDtcblxuICAgICAgICBpZiAoYWRkQW1iaWVudCkge1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMuYW1iaWVudFNvdXJjZSA9PT0gJ2FtYmllbnRTSCcpIHtcbiAgICAgICAgICAgICAgICBjb2RlICs9IGNodW5rcy5hbWJpZW50U0hQUztcbiAgICAgICAgICAgIH0gZWxzZSBpZiAob3B0aW9ucy5hbWJpZW50U291cmNlID09PSAnZW52QXRsYXMnKSB7XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMucmVmbGVjdGlvblNvdXJjZSAhPT0gJ2VudkF0bGFzJyAmJiBvcHRpb25zLnJlZmxlY3Rpb25Tb3VyY2UgIT09ICdlbnZBdGxhc0hRJykge1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IGNodW5rcy5lbnZBdGxhc1BTO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb2RlICs9IGNodW5rcy5hbWJpZW50RW52UFMucmVwbGFjZSgvXFwkREVDT0RFL2csIENodW5rVXRpbHMuZGVjb2RlRnVuYyhvcHRpb25zLmFtYmllbnRFbmNvZGluZykpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb2RlICs9IGNodW5rcy5hbWJpZW50Q29uc3RhbnRQUztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLmFtYmllbnRUaW50ICYmICF1c2VPbGRBbWJpZW50KSB7XG4gICAgICAgICAgICBjb2RlICs9IFwidW5pZm9ybSB2ZWMzIG1hdGVyaWFsX2FtYmllbnQ7XFxuXCI7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy5tc2RmKSB7XG4gICAgICAgICAgICBpZiAoIW9wdGlvbnMubXNkZlRleHRBdHRyaWJ1dGUpIHtcbiAgICAgICAgICAgICAgICBjb2RlICs9IFwiXFxuI2RlZmluZSBVTklGT1JNX1RFWFRfUEFSQU1FVEVSU1wiO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29kZSArPSBjaHVua3MubXNkZlBTO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMubmVlZHNOb3JtYWwpIHtcbiAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLnZpZXdEaXJQUztcbiAgICAgICAgICAgIGlmIChvcHRpb25zLnVzZVNwZWN1bGFyKSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSAob3B0aW9ucy5lbmFibGVHR1hTcGVjdWxhcikgPyBjaHVua3MucmVmbERpckFuaXNvUFMgOiBjaHVua3MucmVmbERpclBTO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGhhc1BvaW50TGlnaHRzID0gZmFsc2U7XG4gICAgICAgIGxldCB1c2VzTGluZWFyRmFsbG9mZiA9IGZhbHNlO1xuICAgICAgICBsZXQgdXNlc0ludlNxdWFyZWRGYWxsb2ZmID0gZmFsc2U7XG4gICAgICAgIGxldCB1c2VzU3BvdCA9IGZhbHNlO1xuICAgICAgICBsZXQgdXNlc0Nvb2tpZSA9IGZhbHNlO1xuICAgICAgICBsZXQgdXNlc0Nvb2tpZU5vdztcblxuICAgICAgICAvLyBjbHVzdGVyZWQgbGlnaHRpbmdcbiAgICAgICAgaWYgKG9wdGlvbnMuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkICYmIHRoaXMubGlnaHRpbmcpIHtcblxuICAgICAgICAgICAgdXNlc1Nwb3QgPSB0cnVlO1xuICAgICAgICAgICAgaGFzUG9pbnRMaWdodHMgPSB0cnVlO1xuICAgICAgICAgICAgdXNlc0xpbmVhckZhbGxvZmYgPSB0cnVlO1xuICAgICAgICAgICAgdXNlc0Nvb2tpZSA9IHRydWU7XG5cbiAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLmZsb2F0VW5wYWNraW5nUFM7XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zLmxpZ2h0TWFza0R5bmFtaWMpXG4gICAgICAgICAgICAgICAgY29kZSArPSBcIlxcbiNkZWZpbmUgQ0xVU1RFUl9NRVNIX0RZTkFNSUNfTElHSFRTXCI7XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zLmNsdXN0ZXJlZExpZ2h0aW5nQ29va2llc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgY29kZSArPSBcIlxcbiNkZWZpbmUgQ0xVU1RFUl9DT09LSUVTXCI7XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5jbHVzdGVyZWRMaWdodGluZ1NoYWRvd3NFbmFibGVkICYmICFvcHRpb25zLm5vU2hhZG93KSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBcIlxcbiNkZWZpbmUgQ0xVU1RFUl9TSEFET1dTXCI7XG4gICAgICAgICAgICAgICAgY29kZSArPSBcIlxcbiNkZWZpbmUgQ0xVU1RFUl9TSEFET1dfVFlQRV9cIiArIHNoYWRvd1R5cGVUb1N0cmluZ1tvcHRpb25zLmNsdXN0ZXJlZExpZ2h0aW5nU2hhZG93VHlwZV07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zLmNsdXN0ZXJlZExpZ2h0aW5nQXJlYUxpZ2h0c0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgY29kZSArPSBcIlxcbiNkZWZpbmUgQ0xVU1RFUl9BUkVBTElHSFRTXCI7XG5cbiAgICAgICAgICAgIGNvZGUgKz0gTGlnaHRzQnVmZmVyLnNoYWRlckRlZmluZXM7XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zLmNsdXN0ZXJlZExpZ2h0aW5nU2hhZG93c0VuYWJsZWQgJiYgIW9wdGlvbnMubm9TaGFkb3cpIHtcbiAgICAgICAgICAgICAgICBjb2RlICs9IGNodW5rcy5jbHVzdGVyZWRMaWdodFNoYWRvd3NQUztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29kZSArPSBjaHVua3MuY2x1c3RlcmVkTGlnaHRQUztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLnR3b1NpZGVkTGlnaHRpbmcpIGNvZGUgKz0gXCJ1bmlmb3JtIGZsb2F0IHR3b1NpZGVkTGlnaHRpbmdOZWdTY2FsZUZhY3RvcjtcXG5cIjtcblxuICAgICAgICAvLyBGUkFHTUVOVCBTSEFERVIgQk9EWVxuXG4gICAgICAgIGNvZGUgKz0gdGhpcy5fZnNHZXRTdGFydENvZGUoY29kZSwgZGV2aWNlLCBjaHVua3MsIG9wdGlvbnMpO1xuXG4gICAgICAgIGlmICh0aGlzLm5lZWRzTm9ybWFsKSB7XG4gICAgICAgICAgICBpZiAob3B0aW9ucy50d29TaWRlZExpZ2h0aW5nKSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBkVmVydGV4Tm9ybWFsVyA9IG5vcm1hbGl6ZShnbF9Gcm9udEZhY2luZyA/IHZOb3JtYWxXICogdHdvU2lkZWRMaWdodGluZ05lZ1NjYWxlRmFjdG9yIDogLXZOb3JtYWxXICogdHdvU2lkZWRMaWdodGluZ05lZ1NjYWxlRmFjdG9yKTtcXG5cIjtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBkVmVydGV4Tm9ybWFsVyA9IG5vcm1hbGl6ZSh2Tm9ybWFsVyk7XFxuXCI7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICgob3B0aW9ucy5oZWlnaHRNYXAgfHwgb3B0aW9ucy5ub3JtYWxNYXApICYmIG9wdGlvbnMuaGFzVGFuZ2VudHMpIHtcbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy50d29TaWRlZExpZ2h0aW5nKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZFRhbmdlbnRXID0gZ2xfRnJvbnRGYWNpbmcgPyB2VGFuZ2VudFcgKiB0d29TaWRlZExpZ2h0aW5nTmVnU2NhbGVGYWN0b3IgOiAtdlRhbmdlbnRXICogdHdvU2lkZWRMaWdodGluZ05lZ1NjYWxlRmFjdG9yO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGRCaW5vcm1hbFcgPSBnbF9Gcm9udEZhY2luZyA/IHZCaW5vcm1hbFcgKiB0d29TaWRlZExpZ2h0aW5nTmVnU2NhbGVGYWN0b3IgOiAtdkJpbm9ybWFsVyAqIHR3b1NpZGVkTGlnaHRpbmdOZWdTY2FsZUZhY3RvcjtcXG5cIjtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGRUYW5nZW50VyA9IHZUYW5nZW50VztcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBkQmlub3JtYWxXID0gdkJpbm9ybWFsVztcXG5cIjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZ2V0Vmlld0RpcigpO1xcblwiO1xuICAgICAgICAgICAgaWYgKGhhc1RCTikge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZ2V0VEJOKCk7XFxuXCI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpbnZva2UgZnJvbnRlbmQgZnVuY3Rpb25zXG4gICAgICAgIGNvZGUgKz0gdGhpcy5mcm9udGVuZEZ1bmM7XG5cbiAgICAgICAgLy8gdHJhbnNmb3JtIHRhbmdlbnQgc3BhY2Ugbm9ybWFscyB0byB3b3JsZCBzcGFjZVxuICAgICAgICBpZiAodGhpcy5uZWVkc05vcm1hbCkge1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMudXNlU3BlY3VsYXIpIHtcbiAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGdldFJlZmxEaXIoKTtcXG5cIjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG9wdGlvbnMuY2xlYXJDb2F0KSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBjY1JlZmxEaXJXID0gbm9ybWFsaXplKC1yZWZsZWN0KGRWaWV3RGlyVywgY2NOb3JtYWxXKSk7XFxuXCI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoKHRoaXMubGlnaHRpbmcgJiYgb3B0aW9ucy51c2VTcGVjdWxhcikgfHwgdGhpcy5yZWZsZWN0aW9ucykge1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMudXNlTWV0YWxuZXNzKSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBnZXRNZXRhbG5lc3NNb2R1bGF0ZSgpO1xcblwiO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAob3B0aW9ucy5pcmlkZXNjZW5jZSkge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZ2V0SXJpZGVzY2VuY2Uoc2F0dXJhdGUoZG90KGRWaWV3RGlyVywgZE5vcm1hbFcpKSk7XFxuXCI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoYWRkQW1iaWVudCkge1xuICAgICAgICAgICAgY29kZSArPSBcIiAgICBhZGRBbWJpZW50KCk7XFxuXCI7XG5cbiAgICAgICAgICAgIC8vIG1vdmUgYW1iaWVudCBjb2xvciBvdXQgb2YgZGlmZnVzZSAodXNlZCBieSBMaWdodG1hcHBlciwgdG8gbXVsdGlwbHkgYW1iaWVudCBjb2xvciBieSBhY2N1bXVsYXRlZCBBTylcbiAgICAgICAgICAgIGlmIChvcHRpb25zLnNlcGFyYXRlQW1iaWVudCkge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gYFxuICAgICAgICAgICAgICAgICAgICB2ZWMzIGRBbWJpZW50TGlnaHQgPSBkRGlmZnVzZUxpZ2h0O1xuICAgICAgICAgICAgICAgICAgICBkRGlmZnVzZUxpZ2h0ID0gdmVjMygwKTtcbiAgICAgICAgICAgICAgICBgO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdGlvbnMuYW1iaWVudFRpbnQgJiYgIXVzZU9sZEFtYmllbnQpIHtcbiAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZERpZmZ1c2VMaWdodCAqPSBtYXRlcmlhbF9hbWJpZW50O1xcblwiO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHVzZUFvICYmICFvcHRpb25zLm9jY2x1ZGVEaXJlY3QpIHtcbiAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgb2NjbHVkZURpZmZ1c2UoKTtcXG5cIjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLmxpZ2h0TWFwIHx8IG9wdGlvbnMubGlnaHRWZXJ0ZXhDb2xvcikge1xuICAgICAgICAgICAgY29kZSArPSBcIiAgICBhZGRMaWdodE1hcCgpO1xcblwiO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMubGlnaHRpbmcgfHwgdGhpcy5yZWZsZWN0aW9ucykge1xuICAgICAgICAgICAgaWYgKHRoaXMucmVmbGVjdGlvbnMpIHtcbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5jbGVhckNvYXQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBhZGRSZWZsZWN0aW9uQ0MoKTtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMuZnJlc25lbE1vZGVsID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBjY0ZyZXNuZWwgPSBnZXRGcmVzbmVsQ0MoZG90KGRWaWV3RGlyVywgY2NOb3JtYWxXKSwgY2NHbG9zc2luZXNzKTtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgY2NSZWZsZWN0aW9uLnJnYiAqPSBjY0ZyZXNuZWw7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIH0gIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBjY0ZyZXNuZWwgPSAwLjA7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMudXNlU3BlY3VsYXJpdHlGYWN0b3IpIHtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBjY1JlZmxlY3Rpb24ucmdiICo9IGRTcGVjdWxhcml0eUZhY3RvcjtcXG5cIjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5zaGVlbikge1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGFkZFJlZmxlY3Rpb25TaGVlbigpO1xcblwiO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIEZyZXNuZWwgaGFzIHRvIGJlIGFwcGxpZWQgdG8gcmVmbGVjdGlvbnNcbiAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGFkZFJlZmxlY3Rpb24oKTtcXG5cIjtcblxuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLmZyZXNuZWxNb2RlbCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBkUmVmbGVjdGlvbi5yZ2IgKj0gZ2V0RnJlc25lbChkb3QoZFZpZXdEaXJXLCBkTm9ybWFsVyksIGRTcGVjdWxhcml0eSk7XFxuXCI7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBkUmVmbGVjdGlvbi5yZ2IgKj0gZFNwZWN1bGFyaXR5O1xcblwiO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy51c2VTcGVjdWxhcml0eUZhY3Rvcikge1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGRSZWZsZWN0aW9uLnJnYiAqPSBkU3BlY3VsYXJpdHlGYWN0b3I7XFxuXCI7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoaGFzQXJlYUxpZ2h0cykge1xuICAgICAgICAgICAgICAgIC8vIHNwZWN1bGFyIGhhcyB0byBiZSBhY2N1bXVsYXRlZCBkaWZmZXJlbnRseSBpZiB3ZSB3YW50IGFyZWEgbGlnaHRzIHRvIGxvb2sgY29ycmVjdFxuICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZFNwZWN1bGFyTGlnaHQgKj0gZFNwZWN1bGFyaXR5O1xcblwiO1xuICAgICAgICAgICAgICAgIC8vIGNvZGUgKz0gXCIgICAgZmxvYXQgcm91Z2huZXNzID0gbWF4KCgxLjAgLSBkR2xvc3NpbmVzcykgKiAoMS4wIC0gZEdsb3NzaW5lc3MpLCAwLjAwMSk7XFxuXCI7XG5cbiAgICAgICAgICAgICAgICAvLyBldmFsdWF0ZSBtYXRlcmlhbCBiYXNlZCBhcmVhIGxpZ2h0cyBkYXRhLCBzaGFyZWQgYnkgYWxsIGFyZWEgbGlnaHRzXG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMudXNlU3BlY3VsYXIpIHtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBjYWxjTFRDTGlnaHRWYWx1ZXMoKTtcXG5cIjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgb3B0aW9ucy5saWdodHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBsaWdodCA9IG9wdGlvbnMubGlnaHRzW2ldO1xuICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0VHlwZSA9IGxpZ2h0Ll90eXBlO1xuXG4gICAgICAgICAgICAgICAgLy8gaWYgY2x1c3RlcmVkIGxpZ2h0cyBhcmUgdXNlZCwgc2tpcCBub3JtYWwgbGlnaHRzIG90aGVyIHRoYW4gZGlyZWN0aW9uYWxcbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQgJiYgbGlnaHRUeXBlICE9PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwpIHtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gVGhlIGZvbGxvd2luZyBjb2RlIGlzIG5vdCBkZWNvdXBsZWQgdG8gc2VwYXJhdGUgc2hhZGVyIGZpbGVzLCBiZWNhdXNlIG1vc3Qgb2YgaXQgY2FuIGJlIGFjdHVhbGx5IGNoYW5nZWQgdG8gYWNoaWV2ZSBkaWZmZXJlbnQgYmVoYXZpb3JzIGxpa2U6XG4gICAgICAgICAgICAgICAgLy8gLSBkaWZmZXJlbnQgZmFsbG9mZnNcbiAgICAgICAgICAgICAgICAvLyAtIGRpZmZlcmVudCBzaGFkb3cgY29vcmRzIChvbW5pIHNoYWRvd3Mgd2lsbCB1c2UgZHJhc3RpY2FsbHkgZGlmZmVyZW50IGdlblNoYWRvd0Nvb3JkKVxuICAgICAgICAgICAgICAgIC8vIC0gZGlmZmVyZW50IHNoYWRvdyBmaWx0ZXIgbW9kZXNcbiAgICAgICAgICAgICAgICAvLyAtIGRpZmZlcmVudCBsaWdodCBzb3VyY2Ugc2hhcGVzXG5cbiAgICAgICAgICAgICAgICAvLyBnZXRMaWdodERpZmZ1c2UgYW5kIGdldExpZ2h0U3BlY3VsYXIgaXMgQlJERiBpdHNlbGYuXG5cbiAgICAgICAgICAgICAgICB1c2VzQ29va2llTm93ID0gZmFsc2U7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBsaWdodFNoYXBlID0gKGhhc0FyZWFMaWdodHMgJiYgbGlnaHQuX3NoYXBlKSA/IGxpZ2h0LnNoYXBlIDogTElHSFRTSEFQRV9QVU5DVFVBTDtcbiAgICAgICAgICAgICAgICBjb25zdCBzaGFwZVN0cmluZyA9IChoYXNBcmVhTGlnaHRzICYmIGxpZ2h0Ll9zaGFwZSkgPyB0aGlzLl9nZXRMaWdodFNvdXJjZVNoYXBlU3RyaW5nKGxpZ2h0U2hhcGUpIDogJyc7XG5cbiAgICAgICAgICAgICAgICBpZiAobGlnaHRTaGFwZSAhPT0gTElHSFRTSEFQRV9QVU5DVFVBTCkge1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGNhbGNcIiArIHNoYXBlU3RyaW5nICsgXCJMaWdodFZhbHVlcyhsaWdodFwiICsgaSArIFwiX3Bvc2l0aW9uLCBsaWdodFwiICsgaSArIFwiX2hhbGZXaWR0aCwgbGlnaHRcIiArIGkgKyBcIl9oYWxmSGVpZ2h0KTtcXG5cIjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAobGlnaHRUeXBlID09PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gZGlyZWN0aW9uYWxcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBkTGlnaHREaXJOb3JtVyA9IGxpZ2h0XCIgKyBpICsgXCJfZGlyZWN0aW9uO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGRBdHRlbiA9IDEuMDtcXG5cIjtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChsaWdodC5fY29va2llKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobGlnaHRUeXBlID09PSBMSUdIVFRZUEVfU1BPVCAmJiAhbGlnaHQuX2Nvb2tpZS5fY3ViZW1hcCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVzZXNDb29raWUgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVzZXNDb29raWVOb3cgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChsaWdodFR5cGUgPT09IExJR0hUVFlQRV9PTU5JICYmIGxpZ2h0Ll9jb29raWUuX2N1YmVtYXApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB1c2VzQ29va2llID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB1c2VzQ29va2llTm93ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZ2V0TGlnaHREaXJQb2ludChsaWdodFwiICsgaSArIFwiX3Bvc2l0aW9uKTtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgaGFzUG9pbnRMaWdodHMgPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICh1c2VzQ29va2llTm93KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobGlnaHRUeXBlID09PSBMSUdIVFRZUEVfU1BPVCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZEF0dGVuMyA9IGdldENvb2tpZTJEXCIgKyAobGlnaHQuX2Nvb2tpZUZhbGxvZmYgPyBcIlwiIDogXCJDbGlwXCIpICsgKGxpZ2h0Ll9jb29raWVUcmFuc2Zvcm0gPyBcIlhmb3JtXCIgOiBcIlwiKSArIFwiKGxpZ2h0XCIgKyBpICsgXCJfY29va2llLCBsaWdodFwiICsgaSArIFwiX3NoYWRvd01hdHJpeCwgbGlnaHRcIiArIGkgKyBcIl9jb29raWVJbnRlbnNpdHlcIiArIChsaWdodC5fY29va2llVHJhbnNmb3JtID8gXCIsIGxpZ2h0XCIgKyBpICsgXCJfY29va2llTWF0cml4LCBsaWdodFwiICsgaSArIFwiX2Nvb2tpZU9mZnNldFwiIDogXCJcIikgKyBcIikuXCIgKyBsaWdodC5fY29va2llQ2hhbm5lbCArIFwiO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGRBdHRlbjMgPSBnZXRDb29raWVDdWJlKGxpZ2h0XCIgKyBpICsgXCJfY29va2llLCBsaWdodFwiICsgaSArIFwiX3NoYWRvd01hdHJpeCwgbGlnaHRcIiArIGkgKyBcIl9jb29raWVJbnRlbnNpdHkpLlwiICsgbGlnaHQuX2Nvb2tpZUNoYW5uZWwgKyBcIjtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmIChsaWdodFNoYXBlID09PSBMSUdIVFNIQVBFX1BVTkNUVUFMKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobGlnaHQuX2ZhbGxvZmZNb2RlID09PSBMSUdIVEZBTExPRkZfTElORUFSKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBkQXR0ZW4gPSBnZXRGYWxsb2ZmTGluZWFyKGxpZ2h0XCIgKyBpICsgXCJfcmFkaXVzKTtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB1c2VzTGluZWFyRmFsbG9mZiA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZEF0dGVuID0gZ2V0RmFsbG9mZkludlNxdWFyZWQobGlnaHRcIiArIGkgKyBcIl9yYWRpdXMpO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVzZXNJbnZTcXVhcmVkRmFsbG9mZiA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBub24gcHVuY3R1YWwgbGlnaHRzIG9ubHkgZ2V0cyB0aGUgcmFuZ2Ugd2luZG93IGhlcmVcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZEF0dGVuID0gZ2V0RmFsbG9mZldpbmRvdyhsaWdodFwiICsgaSArIFwiX3JhZGl1cyk7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgICAgICB1c2VzSW52U3F1YXJlZEZhbGxvZmYgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBpZiAoZEF0dGVuID4gMC4wMDAwMSkge1xcblwiOyAvLyBCUkFOQ0ggU1RBUlRcblxuICAgICAgICAgICAgICAgICAgICBpZiAobGlnaHRUeXBlID09PSBMSUdIVFRZUEVfU1BPVCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCEodXNlc0Nvb2tpZU5vdyAmJiAhbGlnaHQuX2Nvb2tpZUZhbGxvZmYpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBkQXR0ZW4gKj0gZ2V0U3BvdEVmZmVjdChsaWdodFwiICsgaSArIFwiX2RpcmVjdGlvbiwgbGlnaHRcIiArIGkgKyBcIl9pbm5lckNvbmVBbmdsZSwgbGlnaHRcIiArIGkgKyBcIl9vdXRlckNvbmVBbmdsZSk7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdXNlc1Nwb3QgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gZGlmZnVzZSBsaWdodGluZyAtIExUQyBsaWdodHMgZG8gbm90IG1peCBkaWZmdXNlIGxpZ2h0aW5nIGludG8gYXR0ZW51YXRpb24gdGhhdCBhZmZlY3RzIHNwZWN1bGFyXG4gICAgICAgICAgICAgICAgaWYgKGxpZ2h0U2hhcGUgIT09IExJR0hUU0hBUEVfUFVOQ1RVQUwpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGxpZ2h0VHlwZSA9PT0gTElHSFRUWVBFX0RJUkVDVElPTkFMKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBOQjogQSBiZXR0ZXIgYXByb3hpbWF0aW9uIHBlcmhhcHMgdXNpbmcgd3JhcCBsaWdodGluZyBjb3VsZCBiZSBpbXBsZW1lbnRlZCBoZXJlXG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGRBdHRlbkQgPSBnZXRMaWdodERpZmZ1c2UoKTtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIDE2LjAgaXMgYSBjb25zdGFudCB0aGF0IGlzIGluIGdldEZhbGxvZmZJbnZTcXVhcmVkKClcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZEF0dGVuRCA9IGdldFwiICsgc2hhcGVTdHJpbmcgKyBcIkxpZ2h0RGlmZnVzZSgpICogMTYuMDtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZEF0dGVuICo9IGdldExpZ2h0RGlmZnVzZSgpO1xcblwiO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChsaWdodC5jYXN0U2hhZG93cyAmJiAhb3B0aW9ucy5ub1NoYWRvdykge1xuICAgICAgICAgICAgICAgICAgICBsZXQgc2hhZG93UmVhZE1vZGUgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICBsZXQgZXZzbUV4cDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGxpZ2h0Ll9zaGFkb3dUeXBlID09PSBTSEFET1dfVlNNOCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2hhZG93UmVhZE1vZGUgPSBcIlZTTThcIjtcbiAgICAgICAgICAgICAgICAgICAgICAgIGV2c21FeHAgPSBcIjAuMFwiO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGxpZ2h0Ll9zaGFkb3dUeXBlID09PSBTSEFET1dfVlNNMTYpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNoYWRvd1JlYWRNb2RlID0gXCJWU00xNlwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgZXZzbUV4cCA9IFwiNS41NFwiO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGxpZ2h0Ll9zaGFkb3dUeXBlID09PSBTSEFET1dfVlNNMzIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNoYWRvd1JlYWRNb2RlID0gXCJWU00zMlwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGRldmljZS50ZXh0dXJlRmxvYXRIaWdoUHJlY2lzaW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZXZzbUV4cCA9IFwiMTUuMFwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBldnNtRXhwID0gXCI1LjU0XCI7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobGlnaHQuX3NoYWRvd1R5cGUgPT09IFNIQURPV19QQ0Y1KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzaGFkb3dSZWFkTW9kZSA9IFwiUENGNXg1XCI7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzaGFkb3dSZWFkTW9kZSA9IFwiUENGM3gzXCI7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAoc2hhZG93UmVhZE1vZGUgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsaWdodFR5cGUgPT09IExJR0hUVFlQRV9PTU5JKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2hhZG93Q29vcmRBcmdzID0gXCIobGlnaHRcIiArIGkgKyBcIl9zaGFkb3dNYXAsIGxpZ2h0XCIgKyBpICsgXCJfc2hhZG93UGFyYW1zKTtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobGlnaHQuX25vcm1hbE9mZnNldEJpYXMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBub3JtYWxPZmZzZXRQb2ludFNoYWRvdyhsaWdodFwiICsgaSArIFwiX3NoYWRvd1BhcmFtcyk7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gYCAgICBmbG9hdCBzaGFkb3cke2l9ID0gZ2V0U2hhZG93UG9pbnQke3NoYWRvd1JlYWRNb2RlfSR7c2hhZG93Q29vcmRBcmdzfWA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSBgICAgIGRBdHRlbiAqPSBtaXgoMS4wLCBzaGFkb3cke2l9LCBsaWdodCR7aX1fc2hhZG93SW50ZW5zaXR5KTtcXG5gO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzaGFkb3dNYXRBcmcgPSBgbGlnaHQke2l9X3NoYWRvd01hdHJpeGA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2hhZG93UGFyYW1BcmcgPSBgbGlnaHQke2l9X3NoYWRvd1BhcmFtc2A7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSB0aGlzLl9ub25Qb2ludFNoYWRvd01hcFByb2plY3Rpb24oZGV2aWNlLCBvcHRpb25zLmxpZ2h0c1tpXSwgc2hhZG93TWF0QXJnLCBzaGFkb3dQYXJhbUFyZywgaSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobGlnaHRUeXBlID09PSBMSUdIVFRZUEVfU1BPVCkgc2hhZG93UmVhZE1vZGUgPSBcIlNwb3RcIiArIHNoYWRvd1JlYWRNb2RlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gYCAgICBmbG9hdCBzaGFkb3cke2l9ID0gZ2V0U2hhZG93JHtzaGFkb3dSZWFkTW9kZX0obGlnaHQke2l9X3NoYWRvd01hcCwgbGlnaHQke2l9X3NoYWRvd1BhcmFtcyR7KGxpZ2h0Ll9pc1ZzbSA/IFwiLCBcIiArIGV2c21FeHAgOiBcIlwiKX0pO1xcbmA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSBgICAgIGRBdHRlbiAqPSBtaXgoMS4wLCBzaGFkb3cke2l9LCBsaWdodCR7aX1fc2hhZG93SW50ZW5zaXR5KTtcXG5gO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGxpZ2h0U2hhcGUgIT09IExJR0hUU0hBUEVfUFVOQ1RVQUwpIHtcblxuICAgICAgICAgICAgICAgICAgICAvLyBhcmVhIGxpZ2h0IC0gdGhleSBkbyBub3QgbWl4IGRpZmZ1c2UgbGlnaHRpbmcgaW50byBzcGVjdWxhciBhdHRlbnVhdGlvblxuICAgICAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5jb25zZXJ2ZUVuZXJneSAmJiBvcHRpb25zLnVzZVNwZWN1bGFyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGREaWZmdXNlTGlnaHQgKz0gbWl4KChkQXR0ZW5EICogZEF0dGVuKSAqIGxpZ2h0XCIgKyBpICsgXCJfY29sb3JcIiArICh1c2VzQ29va2llTm93ID8gXCIgKiBkQXR0ZW4zXCIgOiBcIlwiKSArIFwiLCB2ZWMzKDApLCBkTFRDU3BlY0ZyZXMpO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBkRGlmZnVzZUxpZ2h0ICs9IChkQXR0ZW5EICogZEF0dGVuKSAqIGxpZ2h0XCIgKyBpICsgXCJfY29sb3JcIiArICh1c2VzQ29va2llTm93ID8gXCIgKiBkQXR0ZW4zXCIgOiBcIlwiKSArIFwiO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgICAgICAgICAvLyBwdW5jdHVhbCBsaWdodFxuICAgICAgICAgICAgICAgICAgICBpZiAoaGFzQXJlYUxpZ2h0cyAmJiBvcHRpb25zLmNvbnNlcnZlRW5lcmd5ICYmIG9wdGlvbnMudXNlU3BlY3VsYXIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZERpZmZ1c2VMaWdodCArPSBtaXgoZEF0dGVuICogbGlnaHRcIiArIGkgKyBcIl9jb2xvclwiICsgKHVzZXNDb29raWVOb3cgPyBcIiAqIGRBdHRlbjNcIiA6IFwiXCIpICsgXCIsIHZlYzMoMCksIGRTcGVjdWxhcml0eSk7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGREaWZmdXNlTGlnaHQgKz0gZEF0dGVuICogbGlnaHRcIiArIGkgKyBcIl9jb2xvclwiICsgKHVzZXNDb29raWVOb3cgPyBcIiAqIGRBdHRlbjNcIiA6IFwiXCIpICsgXCI7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy51c2VTcGVjdWxhcikge1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGRIYWxmRGlyVyA9IG5vcm1hbGl6ZSgtZExpZ2h0RGlyTm9ybVcgKyBkVmlld0RpclcpO1xcblwiO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIHNwZWN1bGFyIC8gY2xlYXIgY29hdFxuICAgICAgICAgICAgICAgIGlmIChsaWdodFNoYXBlICE9PSBMSUdIVFNIQVBFX1BVTkNUVUFMKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gYXJlYSBsaWdodFxuICAgICAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5jbGVhckNvYXQpIGNvZGUgKz0gXCIgICAgY2NTcGVjdWxhckxpZ2h0ICs9IGNjTFRDU3BlY0ZyZXMgKiBnZXRcIiArIHNoYXBlU3RyaW5nICsgXCJMaWdodFNwZWN1bGFyQ0MoKSAqIGRBdHRlbiAqIGxpZ2h0XCIgKyBpICsgXCJfY29sb3JcIiArICh1c2VzQ29va2llTm93ID8gXCIgKiBkQXR0ZW4zXCIgOiBcIlwiKSArIFwiO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy51c2VTcGVjdWxhcikgY29kZSArPSBcIiAgICBkU3BlY3VsYXJMaWdodCArPSBkTFRDU3BlY0ZyZXMgKiBnZXRcIiArIHNoYXBlU3RyaW5nICsgXCJMaWdodFNwZWN1bGFyKCkgKiBkQXR0ZW4gKiBsaWdodFwiICsgaSArIFwiX2NvbG9yXCIgKyAodXNlc0Nvb2tpZU5vdyA/IFwiICogZEF0dGVuM1wiIDogXCJcIikgKyBcIjtcXG5cIjtcblxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBjYWxjRnJlc25lbCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICBpZiAobGlnaHRUeXBlID09PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwgJiYgb3B0aW9ucy5mcmVzbmVsTW9kZWwgPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxjRnJlc25lbCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBpZiBMVEMgbGlnaHRzIGFyZSBwcmVzZW50LCBzcGVjdWxhciBtdXN0IGJlIGFjY3VtdWxhdGVkIHdpdGggc3BlY3VsYXJpdHkgKHNwZWN1bGFyaXR5IGlzIHByZSBtdWx0aXBsaWVkIGJ5IHB1bmN0dWFsIGxpZ2h0IGZyZXNuZWwpXG4gICAgICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLnVzZVNwZWN1bGFyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGRTcGVjdWxhckxpZ2h0ICs9IGdldExpZ2h0U3BlY3VsYXIoZEhhbGZEaXJXKSAqIGRBdHRlbiAqIGxpZ2h0XCIgKyBpICsgXCJfY29sb3JcIjtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gdXNlc0Nvb2tpZU5vdyA/IFwiICogZEF0dGVuM1wiIDogXCJcIjtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gY2FsY0ZyZXNuZWwgPyBcIiAqIGdldEZyZXNuZWwoZG90KGRWaWV3RGlyVywgZEhhbGZEaXJXKSwgZFNwZWN1bGFyaXR5KVwiIDogXCIgKiBkU3BlY3VsYXJpdHlcIjtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCI7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMuc2hlZW4pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgc1NwZWN1bGFyTGlnaHQgKz0gZ2V0TGlnaHRTcGVjdWxhclNoZWVuKGRIYWxmRGlyVykgKiBkQXR0ZW4gKiBsaWdodFwiICsgaSArIFwiX2NvbG9yXCI7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlICs9IHVzZXNDb29raWVOb3cgPyBcIiAqIGRBdHRlbjNcIiA6IFwiXCI7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlICs9ICBcIjtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5jbGVhckNvYXQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgY2NTcGVjdWxhckxpZ2h0ICs9IGdldExpZ2h0U3BlY3VsYXJDQyhkSGFsZkRpclcpICogZEF0dGVuICogbGlnaHRcIiArIGkgKyBcIl9jb2xvclwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSB1c2VzQ29va2llTm93ID8gXCIgKiBkQXR0ZW4zXCIgOiBcIlwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSBjYWxjRnJlc25lbCA/IFwiICogZ2V0RnJlc25lbENDKGRvdChkVmlld0RpclcsIGRIYWxmRGlyVyksIGNjR2xvc3NpbmVzcylcIiA6IFwiXCI7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlICs9ICBcIjtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChsaWdodFR5cGUgIT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCkge1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIH1cXG5cIjsgLy8gQlJBTkNIIEVORFxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJcXG5cIjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gY2x1c3RlcmVkIGxpZ2h0aW5nXG4gICAgICAgICAgICBpZiAob3B0aW9ucy5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQgJiYgdGhpcy5saWdodGluZykge1xuICAgICAgICAgICAgICAgIHVzZXNMaW5lYXJGYWxsb2ZmID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB1c2VzSW52U3F1YXJlZEZhbGxvZmYgPSB0cnVlO1xuICAgICAgICAgICAgICAgIGhhc1BvaW50TGlnaHRzID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGFkZENsdXN0ZXJlZExpZ2h0cygpO1xcblwiO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoaGFzQXJlYUxpZ2h0cykge1xuICAgICAgICAgICAgICAgIC8vIHNwZWN1bGFyIGhhcyB0byBiZSBhY2N1bXVsYXRlZCBkaWZmZXJlbnRseSBpZiB3ZSB3YW50IGFyZWEgbGlnaHRzIHRvIGxvb2sgY29ycmVjdFxuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLmNsZWFyQ29hdCkge1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGNjU3BlY3VsYXJpdHkgPSAxLjA7XFxuXCI7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLnVzZVNwZWN1bGFyKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZFNwZWN1bGFyaXR5ID0gdmVjMygxKTtcXG5cIjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zLnJlZnJhY3Rpb24pIHtcbiAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGFkZFJlZnJhY3Rpb24oKTtcXG5cIjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjb2RlICs9IFwiXFxuXCI7XG5cbiAgICAgICAgaWYgKHVzZUFvKSB7XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5vY2NsdWRlRGlyZWN0KSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBvY2NsdWRlRGlmZnVzZSgpO1xcblwiO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKG9wdGlvbnMub2NjbHVkZVNwZWN1bGFyID09PSBTUEVDT0NDX0FPIHx8IG9wdGlvbnMub2NjbHVkZVNwZWN1bGFyID09PSBTUEVDT0NDX0dMT1NTREVQRU5ERU5UKSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBvY2NsdWRlU3BlY3VsYXIoKTtcXG5cIjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLnVzZVNwZWN1bGFyaXR5RmFjdG9yKSB7XG4gICAgICAgICAgICBjb2RlICs9IFwiICAgIGRTcGVjdWxhckxpZ2h0ICo9IGRTcGVjdWxhcml0eUZhY3RvcjtcXG5cIjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLm9wYWNpdHlGYWRlc1NwZWN1bGFyID09PSBmYWxzZSkge1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMuYmxlbmRUeXBlID09PSBCTEVORF9OT1JNQUwgfHwgb3B0aW9ucy5ibGVuZFR5cGUgPT09IEJMRU5EX1BSRU1VTFRJUExJRUQpIHtcbiAgICAgICAgICAgICAgICBjb2RlICs9IFwiZmxvYXQgc3BlY0x1bSA9IGRvdCgoZFNwZWN1bGFyTGlnaHQgKyBkUmVmbGVjdGlvbi5yZ2IgKiBkUmVmbGVjdGlvbi5hKSwgdmVjMyggMC4yMTI2LCAwLjcxNTIsIDAuMDcyMiApKTtcXG5cIjtcbiAgICAgICAgICAgICAgICBjb2RlICs9IFwiI2lmZGVmIExJVF9DTEVBUkNPQVRcXG4gc3BlY0x1bSArPSBkb3QoKGNjU3BlY3VsYXJMaWdodCArIGNjUmVmbGVjdGlvbi5yZ2IpICogY2NTcGVjdWxhcml0eSwgdmVjMyggMC4yMTI2LCAwLjcxNTIsIDAuMDcyMiApKTtcXG4jZW5kaWZcXG5cIjtcbiAgICAgICAgICAgICAgICBjb2RlICs9IFwiZEFscGhhID0gY2xhbXAoZEFscGhhICsgZ2FtbWFDb3JyZWN0SW5wdXQoc3BlY0x1bSksIDAuMCwgMS4wKTtcXG5cIjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvZGUgKz0gXCJkQWxwaGEgKj0gbWF0ZXJpYWxfYWxwaGFGYWRlO1xcblwiO1xuICAgICAgICB9XG5cbiAgICAgICAgY29kZSArPSBjaHVua3MuZW5kUFM7XG4gICAgICAgIGlmIChvcHRpb25zLmJsZW5kVHlwZSA9PT0gQkxFTkRfTk9STUFMIHx8IG9wdGlvbnMuYmxlbmRUeXBlID09PSBCTEVORF9BRERJVElWRUFMUEhBIHx8IG9wdGlvbnMuYWxwaGFUb0NvdmVyYWdlKSB7XG4gICAgICAgICAgICBjb2RlICs9IGNodW5rcy5vdXRwdXRBbHBoYVBTO1xuICAgICAgICB9IGVsc2UgaWYgKG9wdGlvbnMuYmxlbmRUeXBlID09PSBCTEVORF9QUkVNVUxUSVBMSUVEKSB7XG4gICAgICAgICAgICBjb2RlICs9IGNodW5rcy5vdXRwdXRBbHBoYVByZW11bFBTO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29kZSArPSBjaHVua3Mub3V0cHV0QWxwaGFPcGFxdWVQUztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLm1zZGYpIHtcbiAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZ2xfRnJhZ0NvbG9yID0gYXBwbHlNc2RmKGdsX0ZyYWdDb2xvcik7XFxuXCI7XG4gICAgICAgIH1cblxuICAgICAgICBjb2RlICs9IFwiXFxuXCI7XG4gICAgICAgIGNvZGUgKz0gZW5kKCk7XG5cbiAgICAgICAgaWYgKGhhc1BvaW50TGlnaHRzKSB7XG4gICAgICAgICAgICBjb2RlID0gY2h1bmtzLmxpZ2h0RGlyUG9pbnRQUyArIGNvZGU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHVzZXNMaW5lYXJGYWxsb2ZmKSB7XG4gICAgICAgICAgICBjb2RlID0gY2h1bmtzLmZhbGxvZmZMaW5lYXJQUyArIGNvZGU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHVzZXNJbnZTcXVhcmVkRmFsbG9mZikge1xuICAgICAgICAgICAgY29kZSA9IGNodW5rcy5mYWxsb2ZmSW52U3F1YXJlZFBTICsgY29kZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodXNlc1Nwb3QpIHtcbiAgICAgICAgICAgIGNvZGUgPSBjaHVua3Muc3BvdFBTICsgY29kZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodXNlc0Nvb2tpZSAmJiAhb3B0aW9ucy5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpIHtcbiAgICAgICAgICAgIC8vIG5vbi1jbHVzdGVyZWQgbGlnaHRzIGNvb2tpZSBjb2RlXG4gICAgICAgICAgICBjb2RlID0gY2h1bmtzLmNvb2tpZVBTICsgY29kZTtcbiAgICAgICAgfVxuICAgICAgICBsZXQgc3RydWN0Q29kZSA9IFwiXCI7XG4gICAgICAgIGlmIChjb2RlLmluY2x1ZGVzKFwiZFJlZmxlY3Rpb25cIikpIHN0cnVjdENvZGUgKz0gXCJ2ZWM0IGRSZWZsZWN0aW9uO1xcblwiO1xuICAgICAgICBpZiAoY29kZS5pbmNsdWRlcyhcImRUQk5cIikpIHN0cnVjdENvZGUgKz0gXCJtYXQzIGRUQk47XFxuXCI7XG4gICAgICAgIGlmIChjb2RlLmluY2x1ZGVzKFwiZFZlcnRleE5vcm1hbFdcIikpIHN0cnVjdENvZGUgKz0gXCJ2ZWMzIGRWZXJ0ZXhOb3JtYWxXO1xcblwiO1xuICAgICAgICBpZiAoY29kZS5pbmNsdWRlcyhcImRUYW5nZW50V1wiKSkgc3RydWN0Q29kZSArPSBcInZlYzMgZFRhbmdlbnRXO1xcblwiO1xuICAgICAgICBpZiAoY29kZS5pbmNsdWRlcyhcImRCaW5vcm1hbFdcIikpIHN0cnVjdENvZGUgKz0gXCJ2ZWMzIGRCaW5vcm1hbFc7XFxuXCI7XG4gICAgICAgIGlmIChjb2RlLmluY2x1ZGVzKFwiZFZpZXdEaXJXXCIpKSBzdHJ1Y3RDb2RlICs9IFwidmVjMyBkVmlld0Rpclc7XFxuXCI7XG4gICAgICAgIGlmIChjb2RlLmluY2x1ZGVzKFwiZFJlZmxEaXJXXCIpKSBzdHJ1Y3RDb2RlICs9IFwidmVjMyBkUmVmbERpclc7XFxuXCI7XG4gICAgICAgIGlmIChjb2RlLmluY2x1ZGVzKFwiZEhhbGZEaXJXXCIpKSBzdHJ1Y3RDb2RlICs9IFwidmVjMyBkSGFsZkRpclc7XFxuXCI7XG4gICAgICAgIGlmIChjb2RlLmluY2x1ZGVzKFwiZERpZmZ1c2VMaWdodFwiKSkgc3RydWN0Q29kZSArPSBcInZlYzMgZERpZmZ1c2VMaWdodDtcXG5cIjtcbiAgICAgICAgaWYgKGNvZGUuaW5jbHVkZXMoXCJkU3BlY3VsYXJMaWdodFwiKSkgc3RydWN0Q29kZSArPSBcInZlYzMgZFNwZWN1bGFyTGlnaHQ7XFxuXCI7XG4gICAgICAgIGlmIChjb2RlLmluY2x1ZGVzKFwiZExpZ2h0RGlyTm9ybVdcIikpIHN0cnVjdENvZGUgKz0gXCJ2ZWMzIGRMaWdodERpck5vcm1XO1xcblwiO1xuICAgICAgICBpZiAoY29kZS5pbmNsdWRlcyhcImRMaWdodERpcldcIikpIHN0cnVjdENvZGUgKz0gXCJ2ZWMzIGRMaWdodERpclc7XFxuXCI7XG4gICAgICAgIGlmIChjb2RlLmluY2x1ZGVzKFwiZExpZ2h0UG9zV1wiKSkgc3RydWN0Q29kZSArPSBcInZlYzMgZExpZ2h0UG9zVztcXG5cIjtcbiAgICAgICAgaWYgKGNvZGUuaW5jbHVkZXMoXCJkU2hhZG93Q29vcmRcIikpIHN0cnVjdENvZGUgKz0gXCJ2ZWMzIGRTaGFkb3dDb29yZDtcXG5cIjtcbiAgICAgICAgaWYgKGNvZGUuaW5jbHVkZXMoXCJkQXR0ZW5cIikpIHN0cnVjdENvZGUgKz0gXCJmbG9hdCBkQXR0ZW47XFxuXCI7XG4gICAgICAgIGlmIChjb2RlLmluY2x1ZGVzKFwiZEF0dGVuRFwiKSkgc3RydWN0Q29kZSArPSBcImZsb2F0IGRBdHRlbkQ7XFxuXCI7IC8vIHNlcGFyYXRlIGRpZmZ1c2UgYXR0ZW51YXRpb24gZm9yIG5vbi1wdW5jdHVhbCBsaWdodCBzb3VyY2VzXG4gICAgICAgIGlmIChjb2RlLmluY2x1ZGVzKFwiZEF0dGVuM1wiKSkgc3RydWN0Q29kZSArPSBcInZlYzMgZEF0dGVuMztcXG5cIjtcbiAgICAgICAgaWYgKGNvZGUuaW5jbHVkZXMoXCJkTXNkZlwiKSkgc3RydWN0Q29kZSArPSBcInZlYzQgZE1zZGY7XFxuXCI7XG4gICAgICAgIGlmIChjb2RlLmluY2x1ZGVzKFwiY2NGcmVzbmVsXCIpKSBzdHJ1Y3RDb2RlICs9IFwiZmxvYXQgY2NGcmVzbmVsO1xcblwiO1xuICAgICAgICBpZiAoY29kZS5pbmNsdWRlcyhcImNjUmVmbGVjdGlvblwiKSkgc3RydWN0Q29kZSArPSBcInZlYzMgY2NSZWZsZWN0aW9uO1xcblwiO1xuICAgICAgICBpZiAoY29kZS5pbmNsdWRlcyhcImNjUmVmbERpcldcIikpIHN0cnVjdENvZGUgKz0gXCJ2ZWMzIGNjUmVmbERpclc7XFxuXCI7XG4gICAgICAgIGlmIChjb2RlLmluY2x1ZGVzKFwiY2NTcGVjdWxhckxpZ2h0XCIpKSBzdHJ1Y3RDb2RlICs9IFwidmVjMyBjY1NwZWN1bGFyTGlnaHQ7XFxuXCI7XG4gICAgICAgIGlmIChjb2RlLmluY2x1ZGVzKFwiY2NTcGVjdWxhcml0eU5vRnJlc1wiKSkgc3RydWN0Q29kZSArPSBcImZsb2F0IGNjU3BlY3VsYXJpdHlOb0ZyZXM7XFxuXCI7XG4gICAgICAgIGlmIChjb2RlLmluY2x1ZGVzKFwic1NwZWN1bGFyTGlnaHRcIikpIHN0cnVjdENvZGUgKz0gXCJ2ZWMzIHNTcGVjdWxhckxpZ2h0O1xcblwiO1xuICAgICAgICBpZiAoY29kZS5pbmNsdWRlcyhcInNSZWZsZWN0aW9uXCIpKSBzdHJ1Y3RDb2RlICs9IFwidmVjMyBzUmVmbGVjdGlvbjtcXG5cIjtcblxuICAgICAgICBjb25zdCByZXN1bHQgPSB0aGlzLl9mc0dldEJlZ2luQ29kZSgpICtcbiAgICAgICAgICAgIHRoaXMudmFyeWluZ3MgK1xuICAgICAgICAgICAgdGhpcy5fZnNHZXRCYXNlQ29kZSgpICtcbiAgICAgICAgICAgIChvcHRpb25zLmRldGFpbE1vZGVzID8gY2h1bmtzLmRldGFpbE1vZGVzUFMgOiBcIlwiKSArXG4gICAgICAgICAgICBzdHJ1Y3RDb2RlICtcbiAgICAgICAgICAgIHRoaXMuZnJvbnRlbmREZWNsICtcbiAgICAgICAgICAgIGNvZGU7XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICBnZW5lcmF0ZUZyYWdtZW50U2hhZGVyKGZyb250ZW5kRGVjbCwgZnJvbnRlbmRDb2RlLCBmcm9udGVuZEZ1bmMsIGxpZ2h0aW5nVXYpIHtcbiAgICAgICAgY29uc3Qgb3B0aW9ucyA9IHRoaXMub3B0aW9ucztcblxuICAgICAgICB0aGlzLmZyb250ZW5kRGVjbCA9IGZyb250ZW5kRGVjbDtcbiAgICAgICAgdGhpcy5mcm9udGVuZENvZGUgPSBmcm9udGVuZENvZGU7XG4gICAgICAgIHRoaXMuZnJvbnRlbmRGdW5jID0gZnJvbnRlbmRGdW5jO1xuICAgICAgICB0aGlzLmxpZ2h0aW5nVXYgPSBsaWdodGluZ1V2O1xuXG4gICAgICAgIGlmIChvcHRpb25zLnBhc3MgPT09IFNIQURFUl9QSUNLKSB7XG4gICAgICAgICAgICB0aGlzLmZzaGFkZXIgPSB0aGlzLl9mc0dldFBpY2tQYXNzQ29kZSgpO1xuICAgICAgICB9IGVsc2UgaWYgKG9wdGlvbnMucGFzcyA9PT0gU0hBREVSX0RFUFRIKSB7XG4gICAgICAgICAgICB0aGlzLmZzaGFkZXIgPSB0aGlzLl9mc0dldERlcHRoUGFzc0NvZGUoKTtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLnNoYWRvd1Bhc3MpIHtcbiAgICAgICAgICAgIHRoaXMuZnNoYWRlciA9IHRoaXMuX2ZzR2V0U2hhZG93UGFzc0NvZGUoKTtcbiAgICAgICAgfSBlbHNlIGlmIChvcHRpb25zLmN1c3RvbUZyYWdtZW50U2hhZGVyKSB7XG4gICAgICAgICAgICB0aGlzLmZzaGFkZXIgPSB0aGlzLl9mc0dldEJlZ2luQ29kZSgpICsgb3B0aW9ucy5jdXN0b21GcmFnbWVudFNoYWRlcjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuZnNoYWRlciA9IHRoaXMuX2ZzR2V0TGl0UGFzc0NvZGUoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldERlZmluaXRpb24oKSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IHtcbiAgICAgICAgICAgIGF0dHJpYnV0ZXM6IHRoaXMuYXR0cmlidXRlcyxcbiAgICAgICAgICAgIHZzaGFkZXI6IHRoaXMudnNoYWRlcixcbiAgICAgICAgICAgIGZzaGFkZXI6IHRoaXMuZnNoYWRlclxuICAgICAgICB9O1xuXG4gICAgICAgIGlmIChTaGFkZXJQYXNzLmlzRm9yd2FyZCh0aGlzLm9wdGlvbnMucGFzcykpIHtcbiAgICAgICAgICAgIHJlc3VsdC50YWcgPSBTSEFERVJUQUdfTUFURVJJQUw7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbn1cblxuZXhwb3J0IHtcbiAgICBMaXRTaGFkZXJcbn07XG4iXSwibmFtZXMiOlsiYnVpbHRpbkF0dHJpYnV0ZXMiLCJ2ZXJ0ZXhfbm9ybWFsIiwiU0VNQU5USUNfTk9STUFMIiwidmVydGV4X3RhbmdlbnQiLCJTRU1BTlRJQ19UQU5HRU5UIiwidmVydGV4X3RleENvb3JkMCIsIlNFTUFOVElDX1RFWENPT1JEMCIsInZlcnRleF90ZXhDb29yZDEiLCJTRU1BTlRJQ19URVhDT09SRDEiLCJ2ZXJ0ZXhfY29sb3IiLCJTRU1BTlRJQ19DT0xPUiIsInZlcnRleF9ib25lV2VpZ2h0cyIsIlNFTUFOVElDX0JMRU5EV0VJR0hUIiwidmVydGV4X2JvbmVJbmRpY2VzIiwiU0VNQU5USUNfQkxFTkRJTkRJQ0VTIiwiYnVpbHRpblZhcnlpbmdzIiwidlZlcnRleENvbG9yIiwidlBvc2l0aW9uVyIsInZOb3JtYWxWIiwidk5vcm1hbFciLCJ2VGFuZ2VudFciLCJ2Qmlub3JtYWxXIiwidk9iamVjdFNwYWNlVXBXIiwidlV2MCIsInZVdjEiLCJMaXRTaGFkZXIiLCJjb25zdHJ1Y3RvciIsImRldmljZSIsIm9wdGlvbnMiLCJhdHRyaWJ1dGVzIiwidmVydGV4X3Bvc2l0aW9uIiwiU0VNQU5USUNfUE9TSVRJT04iLCJjaHVua3MiLCJ1c2VyQ2h1bmtzIiwidmFsaWRhdGVVc2VyQ2h1bmtzIiwiY2h1bmtOYW1lIiwic2hhZGVyQ2h1bmtzIiwiaGFzT3duUHJvcGVydHkiLCJjaHVuayIsImEiLCJpbmRleE9mIiwibGlnaHRpbmciLCJsaWdodHMiLCJsZW5ndGgiLCJkaXJMaWdodE1hcCIsImNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCIsInJlZmxlY3Rpb25zIiwicmVmbGVjdGlvblNvdXJjZSIsInVzZVNwZWN1bGFyIiwic3BlY3VsYXJNYXAiLCJnbG9zc01hcCIsInNoYWRvd1Bhc3MiLCJTaGFkZXJQYXNzIiwiaXNTaGFkb3ciLCJwYXNzIiwibmVlZHNOb3JtYWwiLCJhbWJpZW50U0giLCJoZWlnaHRNYXAiLCJlbmFibGVHR1hTcGVjdWxhciIsImNsZWFyQ29hdE5vcm1hbE1hcCIsIm5lZWRzU2NlbmVDb2xvciIsInVzZUR5bmFtaWNSZWZyYWN0aW9uIiwibmVlZHNTY3JlZW5TaXplIiwibmVlZHNUcmFuc2Zvcm1zIiwidmFyeWluZ3MiLCJ2c2hhZGVyIiwiZnJvbnRlbmREZWNsIiwiZnJvbnRlbmRDb2RlIiwiZnJvbnRlbmRGdW5jIiwibGlnaHRpbmdVdiIsImRlZmluZXMiLCJmc2hhZGVyIiwiX3ZzQWRkQmFzZUNvZGUiLCJjb2RlIiwiYmFzZVZTIiwibmluZVNsaWNlZE1vZGUiLCJTUFJJVEVfUkVOREVSTU9ERV9TTElDRUQiLCJTUFJJVEVfUkVOREVSTU9ERV9USUxFRCIsImJhc2VOaW5lU2xpY2VkVlMiLCJfdnNBZGRUcmFuc2Zvcm1Db2RlIiwidHJhbnNmb3JtVlMiLCJfc2V0TWFwVHJhbnNmb3JtIiwiY29kZXMiLCJuYW1lIiwiaWQiLCJ1diIsImNoZWNrSWQiLCJ2YXJOYW1lIiwiX2ZzR2V0QmFzZUNvZGUiLCJyZXN1bHQiLCJiYXNlUFMiLCJiYXNlTmluZVNsaWNlZFBTIiwiYmFzZU5pbmVTbGljZWRUaWxlZFBTIiwiX2ZzR2V0U3RhcnRDb2RlIiwic3RhcnRQUyIsInN0YXJ0TmluZVNsaWNlZFBTIiwic3RhcnROaW5lU2xpY2VkVGlsZWRQUyIsIl9kaXJlY3Rpb25hbFNoYWRvd01hcFByb2plY3Rpb24iLCJsaWdodCIsInNoYWRvd0Nvb3JkQXJncyIsInNoYWRvd1BhcmFtQXJnIiwibGlnaHRJbmRleCIsImNvb3Jkc0Z1bmN0aW9uTmFtZSIsIm51bUNhc2NhZGVzIiwiX25vblBvaW50U2hhZG93TWFwUHJvamVjdGlvbiIsInNoYWRvd01hdEFyZyIsIl9ub3JtYWxPZmZzZXRCaWFzIiwiX2lzVnNtIiwiX3R5cGUiLCJMSUdIVFRZUEVfU1BPVCIsIl9pc1BjZiIsIndlYmdsMiIsImV4dFN0YW5kYXJkRGVyaXZhdGl2ZXMiLCJfZ2V0TGlnaHRTb3VyY2VTaGFwZVN0cmluZyIsInNoYXBlIiwiTElHSFRTSEFQRV9SRUNUIiwiTElHSFRTSEFQRV9ESVNLIiwiTElHSFRTSEFQRV9TUEhFUkUiLCJnZW5lcmF0ZVZlcnRleFNoYWRlciIsInVzZVV2IiwidXNlVW5tb2RpZmllZFV2IiwibWFwVHJhbnNmb3JtcyIsImNvZGVCb2R5IiwiU0hBREVSX0RFUFRIIiwidXNlSW5zdGFuY2luZyIsImluc3RhbmNlX2xpbmUxIiwiU0VNQU5USUNfQVRUUjEyIiwiaW5zdGFuY2VfbGluZTIiLCJTRU1BTlRJQ19BVFRSMTMiLCJpbnN0YW5jZV9saW5lMyIsIlNFTUFOVElDX0FUVFIxNCIsImluc3RhbmNlX2xpbmU0IiwiU0VNQU5USUNfQVRUUjE1IiwiaW5zdGFuY2luZ1ZTIiwiZnJhZ21lbnRVbmlmb3Jtc0NvdW50Iiwidmlld05vcm1hbFZTIiwiaGFzVGFuZ2VudHMiLCJub3JtYWxNYXAiLCJ0YW5nZW50Qmlub3JtYWxWUyIsIm1heFV2U2V0cyIsImkiLCJmb3JFYWNoIiwibWFwVHJhbnNmb3JtIiwidmVydGV4Q29sb3JzIiwibXNkZiIsIm1zZGZUZXh0QXR0cmlidXRlIiwidmVydGV4X291dGxpbmVQYXJhbWV0ZXJzIiwiU0VNQU5USUNfQVRUUjgiLCJ2ZXJ0ZXhfc2hhZG93UGFyYW1ldGVycyIsIlNFTUFOVElDX0FUVFI5IiwibXNkZlZTIiwidXNlTW9ycGhQb3NpdGlvbiIsInVzZU1vcnBoTm9ybWFsIiwidXNlTW9ycGhUZXh0dXJlQmFzZWQiLCJtb3JwaF92ZXJ0ZXhfaWQiLCJtb3JwaF9wb3MwIiwibW9ycGhfcG9zMSIsIm1vcnBoX3BvczIiLCJTRU1BTlRJQ19BVFRSMTAiLCJtb3JwaF9wb3MzIiwiU0VNQU5USUNfQVRUUjExIiwibW9ycGhfbnJtMCIsIm1vcnBoX25ybTEiLCJtb3JwaF9ucm0yIiwibW9ycGhfbnJtMyIsIm1vcnBoX3BvczQiLCJtb3JwaF9wb3M1IiwibW9ycGhfcG9zNiIsIm1vcnBoX3BvczciLCJtb3JwaF9ucm00IiwibW9ycGhfbnJtNSIsIm1vcnBoX25ybTYiLCJtb3JwaF9ucm03Iiwic2tpbiIsInNraW5Db2RlIiwic2NyZWVuU3BhY2UiLCJwaXhlbFNuYXAiLCJub3JtYWxWUyIsInN0YXJ0VlMiLCJlbmRWUyIsIk9iamVjdCIsImtleXMiLCJ2Iiwic3RhcnRDb2RlIiwidmVydGV4SW50cm8iLCJleHRlbnNpb25WUyIsIl9mc0dldEJlZ2luQ29kZSIsInByZWNpc2lvbiIsImZvcmNlRnJhZ21lbnRQcmVjaXNpb24iLCJmcmFnbWVudEludHJvIiwiZXh0ZW5zaW9uUFMiLCJfZnNHZXRQaWNrUGFzc0NvZGUiLCJiZWdpbiIsImVuZCIsIl9mc0dldERlcHRoUGFzc0NvZGUiLCJwYWNrRGVwdGhQUyIsIl9mc0dldFNoYWRvd1Bhc3NDb2RlIiwibGlnaHRUeXBlIiwidG9MaWdodFR5cGUiLCJzaGFkb3dUeXBlIiwidG9TaGFkb3dUeXBlIiwiU0hBRE9XX1ZTTTMyIiwidGV4dHVyZUZsb2F0SGlnaFByZWNpc2lvbiIsIlNIQURPV19WU00xNiIsIkxJR0hUVFlQRV9ESVJFQ1RJT05BTCIsIlNIQURPV19QQ0YzIiwiTElHSFRUWVBFX09NTkkiLCJTSEFET1dfVlNNOCIsImlzVnNtIiwiYXBwbHlTbG9wZVNjYWxlQmlhcyIsIlNIQURPV19QQ0Y1Iiwic3RvcmVFVlNNUFMiLCJfZnNHZXRMaXRQYXNzQ29kZSIsIm9wYWNpdHlGYWRlc1NwZWN1bGFyIiwicHVzaCIsImNsZWFyQ29hdCIsImZyZXNuZWxNb2RlbCIsImNvbnNlcnZlRW5lcmd5Iiwic2hlZW4iLCJpcmlkZXNjZW5jZSIsInNoYWRvd1R5cGVVc2VkIiwibnVtU2hhZG93TGlnaHRzIiwic2hhZG93ZWREaXJlY3Rpb25hbExpZ2h0VXNlZCIsInVzZVZzbSIsInVzZVBlcnNwWmJ1ZmZlclNoYWRvdyIsImhhc0FyZWFMaWdodHMiLCJzb21lIiwiX3NoYXBlIiwiTElHSFRTSEFQRV9QVU5DVFVBTCIsImNsdXN0ZXJlZExpZ2h0aW5nQXJlYUxpZ2h0c0VuYWJsZWQiLCJhcmVhTHV0c1ByZWNpc2lvbiIsImFyZWFMaWdodEx1dEZvcm1hdCIsIlBJWEVMRk9STUFUX1I4X0c4X0I4X0E4IiwibGlnaHRTaGFwZSIsImNhc3RTaGFkb3dzIiwibm9TaGFkb3ciLCJfc2hhZG93VHlwZSIsIl9jb29raWUiLCJfY3ViZW1hcCIsIl9jb29raWVUcmFuc2Zvcm0iLCJoYXNUQk4iLCJmYXN0VGJuIiwiVEJOZmFzdFBTIiwiVEJOUFMiLCJUQk5kZXJpdmF0aXZlUFMiLCJyZXBsYWNlIiwiVEJOT2JqZWN0U3BhY2VQUyIsInNwaGVyaWNhbFBTIiwiZGVjb2RlUFMiLCJnYW1tYUNvZGUiLCJnYW1tYSIsInRvbmVtYXBDb2RlIiwidG9uZU1hcCIsImZvZ0NvZGUiLCJmb2ciLCJ1c2VDdWJlTWFwUm90YXRpb24iLCJjdWJlTWFwUm90YXRlUFMiLCJjdWJlTWFwUHJvamVjdGlvbiIsImN1YmVNYXBQcm9qZWN0Qm94UFMiLCJjdWJlTWFwUHJvamVjdE5vbmVQUyIsInNreWJveEludGVuc2l0eSIsImVudk11bHRpcGx5UFMiLCJlbnZDb25zdFBTIiwidXNlTWV0YWxuZXNzIiwibWV0YWxuZXNzTW9kdWxhdGVQUyIsIkZSRVNORUxfU0NITElDSyIsImZyZXNuZWxTY2hsaWNrUFMiLCJpcmlkZXNjZW5jZURpZmZyYWN0aW9uUFMiLCJ1c2VBbyIsImFvTWFwIiwiYW9WZXJ0ZXhDb2xvciIsImFvRGlmZnVzZU9jY1BTIiwib2NjbHVkZVNwZWN1bGFyIiwiU1BFQ09DQ19BTyIsIm9jY2x1ZGVTcGVjdWxhckZsb2F0IiwiYW9TcGVjT2NjU2ltcGxlUFMiLCJhb1NwZWNPY2NDb25zdFNpbXBsZVBTIiwiU1BFQ09DQ19HTE9TU0RFUEVOREVOVCIsImFvU3BlY09jY1BTIiwiYW9TcGVjT2NjQ29uc3RQUyIsImZpeFNlYW1zIiwiZml4Q3ViZW1hcFNlYW1zU3RyZXRjaFBTIiwiZml4Q3ViZW1hcFNlYW1zTm9uZVBTIiwiZW52QXRsYXNQUyIsInJlZmxlY3Rpb25FbnZIUVBTIiwiQ2h1bmtVdGlscyIsImRlY29kZUZ1bmMiLCJyZWZsZWN0aW9uRW5jb2RpbmciLCJyZWZsZWN0aW9uRW52UFMiLCJyZWZsZWN0aW9uQ3ViZVBTIiwic2NvZGUiLCJyZWZsZWN0aW9uU3BoZXJlUFMiLCJyZWZsZWN0aW9uU3BoZXJlTG93UFMiLCJyZWZsZWN0aW9uQ0NQUyIsInJlZmxlY3Rpb25TaGVlblBTIiwicmVmcmFjdGlvbiIsInJlZnJhY3Rpb25EeW5hbWljUFMiLCJyZWZyYWN0aW9uQ3ViZVBTIiwibGlnaHRTaGVlblBTIiwiY2x1c3RlcmVkTGlnaHRVdGlsc1BTIiwiY2x1c3RlcmVkTGlnaHRpbmdDb29raWVzRW5hYmxlZCIsImNsdXN0ZXJlZExpZ2h0Q29va2llc1BTIiwiY2x1c3RlcmVkTGlnaHRpbmdTaGFkb3dzRW5hYmxlZCIsInNoYWRvd0Nhc2NhZGVzUFMiLCJzaGFkb3dTdGFuZGFyZFBTIiwic2hhZG93U3RhbmRhcmRHTDJQUyIsInNoYWRvd1ZTTV9jb21tb25QUyIsInNoYWRvd1ZTTThQUyIsImV4dFRleHR1cmVIYWxmRmxvYXRMaW5lYXIiLCJzaGFkb3dFVlNNUFMiLCJzaGFkb3dFVlNNblBTIiwiZXh0VGV4dHVyZUZsb2F0TGluZWFyIiwiYmlhc0NvbnN0UFMiLCJzaGFkb3dDb29yZFBTIiwic2hhZG93Q29tbW9uUFMiLCJzaGFkb3dDb29yZFBlcnNwWmJ1ZmZlclBTIiwibGlnaHREaWZmdXNlTGFtYmVydFBTIiwibHRjIiwidXNlT2xkQW1iaWVudCIsInNoYWRpbmdNb2RlbCIsIlNQRUNVTEFSX1BIT05HIiwibGlnaHRTcGVjdWxhclBob25nUFMiLCJsaWdodFNwZWN1bGFyQW5pc29HR1hQUyIsImxpZ2h0U3BlY3VsYXJCbGlublBTIiwiZGlmZnVzZU1hcCIsImNvbWJpbmVQUyIsImxpZ2h0TWFwIiwibGlnaHRWZXJ0ZXhDb2xvciIsImxpZ2h0bWFwRGlyQWRkUFMiLCJsaWdodG1hcEFkZFBTIiwiYWRkQW1iaWVudCIsImxpZ2h0TWFwV2l0aG91dEFtYmllbnQiLCJhbWJpZW50U291cmNlIiwiYW1iaWVudFNIUFMiLCJhbWJpZW50RW52UFMiLCJhbWJpZW50RW5jb2RpbmciLCJhbWJpZW50Q29uc3RhbnRQUyIsImFtYmllbnRUaW50IiwibXNkZlBTIiwidmlld0RpclBTIiwicmVmbERpckFuaXNvUFMiLCJyZWZsRGlyUFMiLCJoYXNQb2ludExpZ2h0cyIsInVzZXNMaW5lYXJGYWxsb2ZmIiwidXNlc0ludlNxdWFyZWRGYWxsb2ZmIiwidXNlc1Nwb3QiLCJ1c2VzQ29va2llIiwidXNlc0Nvb2tpZU5vdyIsImZsb2F0VW5wYWNraW5nUFMiLCJsaWdodE1hc2tEeW5hbWljIiwic2hhZG93VHlwZVRvU3RyaW5nIiwiY2x1c3RlcmVkTGlnaHRpbmdTaGFkb3dUeXBlIiwiTGlnaHRzQnVmZmVyIiwic2hhZGVyRGVmaW5lcyIsImNsdXN0ZXJlZExpZ2h0U2hhZG93c1BTIiwiY2x1c3RlcmVkTGlnaHRQUyIsInR3b1NpZGVkTGlnaHRpbmciLCJzZXBhcmF0ZUFtYmllbnQiLCJvY2NsdWRlRGlyZWN0IiwidXNlU3BlY3VsYXJpdHlGYWN0b3IiLCJzaGFwZVN0cmluZyIsIl9jb29raWVGYWxsb2ZmIiwiX2Nvb2tpZUNoYW5uZWwiLCJfZmFsbG9mZk1vZGUiLCJMSUdIVEZBTExPRkZfTElORUFSIiwic2hhZG93UmVhZE1vZGUiLCJldnNtRXhwIiwiY2FsY0ZyZXNuZWwiLCJibGVuZFR5cGUiLCJCTEVORF9OT1JNQUwiLCJCTEVORF9QUkVNVUxUSVBMSUVEIiwiZW5kUFMiLCJCTEVORF9BRERJVElWRUFMUEhBIiwiYWxwaGFUb0NvdmVyYWdlIiwib3V0cHV0QWxwaGFQUyIsIm91dHB1dEFscGhhUHJlbXVsUFMiLCJvdXRwdXRBbHBoYU9wYXF1ZVBTIiwibGlnaHREaXJQb2ludFBTIiwiZmFsbG9mZkxpbmVhclBTIiwiZmFsbG9mZkludlNxdWFyZWRQUyIsInNwb3RQUyIsImNvb2tpZVBTIiwic3RydWN0Q29kZSIsImluY2x1ZGVzIiwiZGV0YWlsTW9kZXMiLCJkZXRhaWxNb2Rlc1BTIiwiZ2VuZXJhdGVGcmFnbWVudFNoYWRlciIsIlNIQURFUl9QSUNLIiwiY3VzdG9tRnJhZ21lbnRTaGFkZXIiLCJnZXREZWZpbml0aW9uIiwiaXNGb3J3YXJkIiwidGFnIiwiU0hBREVSVEFHX01BVEVSSUFMIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7OztBQTRCQSxNQUFNQSxpQkFBaUIsR0FBRztBQUN0QkMsRUFBQUEsYUFBYSxFQUFFQyxlQURPO0FBRXRCQyxFQUFBQSxjQUFjLEVBQUVDLGdCQUZNO0FBR3RCQyxFQUFBQSxnQkFBZ0IsRUFBRUMsa0JBSEk7QUFJdEJDLEVBQUFBLGdCQUFnQixFQUFFQyxrQkFKSTtBQUt0QkMsRUFBQUEsWUFBWSxFQUFFQyxjQUxRO0FBTXRCQyxFQUFBQSxrQkFBa0IsRUFBRUMsb0JBTkU7QUFPdEJDLEVBQUFBLGtCQUFrQixFQUFFQyxxQkFBQUE7QUFQRSxDQUExQixDQUFBO0FBVUEsTUFBTUMsZUFBZSxHQUFHO0FBQ3BCQyxFQUFBQSxZQUFZLEVBQUUsTUFETTtBQUVwQkMsRUFBQUEsVUFBVSxFQUFFLE1BRlE7QUFHcEJDLEVBQUFBLFFBQVEsRUFBRSxNQUhVO0FBSXBCQyxFQUFBQSxRQUFRLEVBQUUsTUFKVTtBQUtwQkMsRUFBQUEsU0FBUyxFQUFFLE1BTFM7QUFNcEJDLEVBQUFBLFVBQVUsRUFBRSxNQU5RO0FBT3BCQyxFQUFBQSxlQUFlLEVBQUUsTUFQRztBQVFwQkMsRUFBQUEsSUFBSSxFQUFFLE1BUmM7QUFTcEJDLEVBQUFBLElBQUksRUFBRSxNQUFBO0FBVGMsQ0FBeEIsQ0FBQTs7QUFZQSxNQUFNQyxTQUFOLENBQWdCO0FBQ1pDLEVBQUFBLFdBQVcsQ0FBQ0MsTUFBRCxFQUFTQyxPQUFULEVBQWtCO0lBQ3pCLElBQUtELENBQUFBLE1BQUwsR0FBY0EsTUFBZCxDQUFBO0lBQ0EsSUFBS0MsQ0FBQUEsT0FBTCxHQUFlQSxPQUFmLENBQUE7QUFHQSxJQUFBLElBQUEsQ0FBS0MsVUFBTCxHQUFrQjtBQUNkQyxNQUFBQSxlQUFlLEVBQUVDLGlCQUFBQTtLQURyQixDQUFBOztJQUlBLElBQUlILE9BQU8sQ0FBQ0ksTUFBWixFQUFvQjtNQUNoQixJQUFLQSxDQUFBQSxNQUFMLEdBQWMsRUFBZCxDQUFBO0FBRUEsTUFBQSxNQUFNQyxVQUFVLEdBQUdMLE9BQU8sQ0FBQ0ksTUFBM0IsQ0FBQTtBQUdBRSxNQUFBQSxrQkFBa0IsQ0FBQ04sT0FBTyxDQUFDSSxNQUFULENBQWxCLENBQUE7O0FBR0EsTUFBQSxLQUFLLE1BQU1HLFNBQVgsSUFBd0JDLFlBQXhCLEVBQXNDO0FBQ2xDLFFBQUEsSUFBSUgsVUFBVSxDQUFDSSxjQUFYLENBQTBCRixTQUExQixDQUFKLEVBQTBDO0FBQ3RDLFVBQUEsTUFBTUcsS0FBSyxHQUFHTCxVQUFVLENBQUNFLFNBQUQsQ0FBeEIsQ0FBQTs7QUFDQSxVQUFBLEtBQUssTUFBTUksQ0FBWCxJQUFnQnZDLGlCQUFoQixFQUFtQztBQUMvQixZQUFBLElBQUlBLGlCQUFpQixDQUFDcUMsY0FBbEIsQ0FBaUNFLENBQWpDLENBQUEsSUFBdUNELEtBQUssQ0FBQ0UsT0FBTixDQUFjRCxDQUFkLENBQUEsSUFBb0IsQ0FBL0QsRUFBa0U7QUFDOUQsY0FBQSxJQUFBLENBQUtWLFVBQUwsQ0FBZ0JVLENBQWhCLElBQXFCdkMsaUJBQWlCLENBQUN1QyxDQUFELENBQXRDLENBQUE7QUFDSCxhQUFBO0FBQ0osV0FBQTs7QUFDRCxVQUFBLElBQUEsQ0FBS1AsTUFBTCxDQUFZRyxTQUFaLENBQUEsR0FBeUJHLEtBQXpCLENBQUE7QUFDSCxTQVJELE1BUU87QUFDSCxVQUFBLElBQUEsQ0FBS04sTUFBTCxDQUFZRyxTQUFaLElBQXlCQyxZQUFZLENBQUNELFNBQUQsQ0FBckMsQ0FBQTtBQUNILFNBQUE7QUFDSixPQUFBO0FBQ0osS0F0QkQsTUFzQk87TUFDSCxJQUFLSCxDQUFBQSxNQUFMLEdBQWNJLFlBQWQsQ0FBQTtBQUNILEtBQUE7O0lBRUQsSUFBS0ssQ0FBQUEsUUFBTCxHQUFpQmIsT0FBTyxDQUFDYyxNQUFSLENBQWVDLE1BQWYsR0FBd0IsQ0FBekIsSUFBK0IsQ0FBQyxDQUFDZixPQUFPLENBQUNnQixXQUF6QyxJQUF3RCxDQUFDLENBQUNoQixPQUFPLENBQUNpQix3QkFBbEYsQ0FBQTtBQUNBLElBQUEsSUFBQSxDQUFLQyxXQUFMLEdBQW1CLENBQUMsQ0FBQ2xCLE9BQU8sQ0FBQ21CLGdCQUE3QixDQUFBO0FBQ0EsSUFBQSxJQUFJLENBQUNuQixPQUFPLENBQUNvQixXQUFiLEVBQTBCcEIsT0FBTyxDQUFDcUIsV0FBUixHQUFzQnJCLE9BQU8sQ0FBQ3NCLFFBQVIsR0FBbUIsSUFBekMsQ0FBQTtJQUMxQixJQUFLQyxDQUFBQSxVQUFMLEdBQWtCQyxVQUFVLENBQUNDLFFBQVgsQ0FBb0J6QixPQUFPLENBQUMwQixJQUE1QixDQUFsQixDQUFBO0FBQ0EsSUFBQSxJQUFBLENBQUtDLFdBQUwsR0FBbUIsSUFBS2QsQ0FBQUEsUUFBTCxJQUFpQixJQUFLSyxDQUFBQSxXQUF0QixJQUFxQ2xCLE9BQU8sQ0FBQ29CLFdBQTdDLElBQTREcEIsT0FBTyxDQUFDNEIsU0FBcEUsSUFBaUY1QixPQUFPLENBQUM2QixTQUF6RixJQUFzRzdCLE9BQU8sQ0FBQzhCLGlCQUE5RyxJQUNFOUIsT0FBTyxDQUFDaUIsd0JBQVIsSUFBb0MsQ0FBQyxJQUFLTSxDQUFBQSxVQUQ1QyxJQUMyRHZCLE9BQU8sQ0FBQytCLGtCQUR0RixDQUFBO0FBRUEsSUFBQSxJQUFBLENBQUtDLGVBQUwsR0FBdUJoQyxPQUFPLENBQUNpQyxvQkFBL0IsQ0FBQTtBQUNBLElBQUEsSUFBQSxDQUFLQyxlQUFMLEdBQXVCbEMsT0FBTyxDQUFDaUMsb0JBQS9CLENBQUE7QUFDQSxJQUFBLElBQUEsQ0FBS0UsZUFBTCxHQUF1Qm5DLE9BQU8sQ0FBQ2lDLG9CQUEvQixDQUFBO0lBR0EsSUFBS0csQ0FBQUEsUUFBTCxHQUFnQixFQUFoQixDQUFBO0lBQ0EsSUFBS0MsQ0FBQUEsT0FBTCxHQUFlLElBQWYsQ0FBQTtJQUdBLElBQUtDLENBQUFBLFlBQUwsR0FBb0IsSUFBcEIsQ0FBQTtJQUNBLElBQUtDLENBQUFBLFlBQUwsR0FBb0IsSUFBcEIsQ0FBQTtJQUNBLElBQUtDLENBQUFBLFlBQUwsR0FBb0IsSUFBcEIsQ0FBQTtJQUNBLElBQUtDLENBQUFBLFVBQUwsR0FBa0IsSUFBbEIsQ0FBQTtJQUdBLElBQUtDLENBQUFBLE9BQUwsR0FBZSxFQUFmLENBQUE7SUFHQSxJQUFLQyxDQUFBQSxPQUFMLEdBQWUsSUFBZixDQUFBO0FBQ0gsR0FBQTs7QUFFREMsRUFBQUEsY0FBYyxDQUFDQyxJQUFELEVBQU96QyxNQUFQLEVBQWVKLE9BQWYsRUFBd0I7SUFDbEM2QyxJQUFJLElBQUl6QyxNQUFNLENBQUMwQyxNQUFmLENBQUE7O0lBQ0EsSUFBSTlDLE9BQU8sQ0FBQytDLGNBQVIsS0FBMkJDLHdCQUEzQixJQUNBaEQsT0FBTyxDQUFDK0MsY0FBUixLQUEyQkUsdUJBRC9CLEVBQ3dEO01BQ3BESixJQUFJLElBQUl6QyxNQUFNLENBQUM4QyxnQkFBZixDQUFBO0FBQ0gsS0FBQTs7QUFDRCxJQUFBLE9BQU9MLElBQVAsQ0FBQTtBQUNILEdBQUE7O0VBRURNLG1CQUFtQixDQUFDTixJQUFELEVBQU85QyxNQUFQLEVBQWVLLE1BQWYsRUFBdUJKLE9BQXZCLEVBQWdDO0FBQy9DNkMsSUFBQUEsSUFBSSxJQUFJLElBQUEsQ0FBS3pDLE1BQUwsQ0FBWWdELFdBQXBCLENBQUE7QUFDQSxJQUFBLE9BQU9QLElBQVAsQ0FBQTtBQUNILEdBQUE7O0VBRURRLGdCQUFnQixDQUFDQyxLQUFELEVBQVFDLElBQVIsRUFBY0MsRUFBZCxFQUFrQkMsRUFBbEIsRUFBc0I7QUFDbEMsSUFBQSxNQUFNQyxPQUFPLEdBQUdGLEVBQUUsR0FBR0MsRUFBRSxHQUFHLEdBQTFCLENBQUE7O0lBQ0EsSUFBSSxDQUFDSCxLQUFLLENBQUMsQ0FBRCxDQUFMLENBQVNJLE9BQVQsQ0FBTCxFQUF3QjtBQUVwQixNQUFBLE1BQU1DLE9BQU8sR0FBSSxDQUFVSixRQUFBQSxFQUFBQSxJQUFLLENBQWhDLFlBQUEsQ0FBQSxDQUFBO0FBQ0FELE1BQUFBLEtBQUssQ0FBQyxDQUFELENBQUwsSUFBYSxDQUFBLGFBQUEsRUFBZUssT0FBUSxDQUFwQyxJQUFBLENBQUEsQ0FBQTtBQUNBTCxNQUFBQSxLQUFLLENBQUMsQ0FBRCxDQUFMLElBQWEsQ0FBQSxhQUFBLEVBQWVLLE9BQVEsQ0FBcEMsSUFBQSxDQUFBLENBQUE7TUFDQUwsS0FBSyxDQUFDLENBQUQsQ0FBTCxJQUFhLG1CQUFrQkcsRUFBRyxDQUFBLENBQUEsRUFBR0QsRUFBRyxDQUF4QyxHQUFBLENBQUEsQ0FBQTtBQUNBRixNQUFBQSxLQUFLLENBQUMsQ0FBRCxDQUFMLElBQWEsQ0FBQSxNQUFBLEVBQVFHLEVBQUcsQ0FBR0QsQ0FBQUEsRUFBQUEsRUFBRyxDQUFxQkMsbUJBQUFBLEVBQUFBLEVBQUcsU0FBUUUsT0FBUSxDQUFBLGVBQUEsRUFBaUJGLEVBQUcsQ0FBQSxNQUFBLEVBQVFFLE9BQVEsQ0FBMUcsTUFBQSxDQUFBLENBQUE7QUFDQUwsTUFBQUEsS0FBSyxDQUFDLENBQUQsQ0FBTCxDQUFTSSxPQUFULElBQW9CLElBQXBCLENBQUE7QUFDSCxLQUFBOztBQUNELElBQUEsT0FBT0osS0FBUCxDQUFBO0FBQ0gsR0FBQTs7QUFHRE0sRUFBQUEsY0FBYyxHQUFHO0lBQ2IsTUFBTTVELE9BQU8sR0FBRyxJQUFBLENBQUtBLE9BQXJCLENBQUE7SUFDQSxNQUFNSSxNQUFNLEdBQUcsSUFBQSxDQUFLQSxNQUFwQixDQUFBO0FBQ0EsSUFBQSxJQUFJeUQsTUFBTSxHQUFHLElBQUt6RCxDQUFBQSxNQUFMLENBQVkwRCxNQUF6QixDQUFBOztBQUNBLElBQUEsSUFBSTlELE9BQU8sQ0FBQytDLGNBQVIsS0FBMkJDLHdCQUEvQixFQUF5RDtNQUNyRGEsTUFBTSxJQUFJekQsTUFBTSxDQUFDMkQsZ0JBQWpCLENBQUE7QUFDSCxLQUZELE1BRU8sSUFBSS9ELE9BQU8sQ0FBQytDLGNBQVIsS0FBMkJFLHVCQUEvQixFQUF3RDtNQUMzRFksTUFBTSxJQUFJekQsTUFBTSxDQUFDNEQscUJBQWpCLENBQUE7QUFDSCxLQUFBOztBQUNELElBQUEsT0FBT0gsTUFBUCxDQUFBO0FBQ0gsR0FBQTs7RUFHREksZUFBZSxDQUFDcEIsSUFBRCxFQUFPOUMsTUFBUCxFQUFlSyxNQUFmLEVBQXVCSixPQUF2QixFQUFnQztBQUMzQyxJQUFBLElBQUk2RCxNQUFNLEdBQUd6RCxNQUFNLENBQUM4RCxPQUFwQixDQUFBOztBQUNBLElBQUEsSUFBSWxFLE9BQU8sQ0FBQytDLGNBQVIsS0FBMkJDLHdCQUEvQixFQUF5RDtNQUNyRGEsTUFBTSxJQUFJekQsTUFBTSxDQUFDK0QsaUJBQWpCLENBQUE7QUFDSCxLQUZELE1BRU8sSUFBSW5FLE9BQU8sQ0FBQytDLGNBQVIsS0FBMkJFLHVCQUEvQixFQUF3RDtNQUMzRFksTUFBTSxJQUFJekQsTUFBTSxDQUFDZ0Usc0JBQWpCLENBQUE7QUFDSCxLQUFBOztBQUNELElBQUEsT0FBT1AsTUFBUCxDQUFBO0FBQ0gsR0FBQTs7RUFHRFEsK0JBQStCLENBQUNDLEtBQUQsRUFBUUMsZUFBUixFQUF5QkMsY0FBekIsRUFBeUNDLFVBQXpDLEVBQXFEQyxrQkFBckQsRUFBeUU7SUFHcEcsSUFBSTdCLElBQUksR0FBRyxFQUFYLENBQUE7O0FBQ0EsSUFBQSxJQUFJeUIsS0FBSyxDQUFDSyxXQUFOLEdBQW9CLENBQXhCLEVBQTJCO0FBRXZCOUIsTUFBQUEsSUFBSSxJQUFLLENBQThCNEIsNEJBQUFBLEVBQUFBLFVBQVcsOEJBQTZCQSxVQUFXLENBQUEsOEJBQUEsRUFBZ0NBLFVBQVcsQ0FBckksdUJBQUEsQ0FBQSxDQUFBO01BQ0FGLGVBQWUsR0FBSSxDQUFxQkMsbUJBQUFBLEVBQUFBLGNBQWUsQ0FBdkQsSUFBQSxDQUFBLENBQUE7QUFDSCxLQUFBOztJQUdEM0IsSUFBSSxJQUFJNkIsa0JBQWtCLEdBQUdILGVBQTdCLENBQUE7SUFHQTFCLElBQUksSUFBSyxDQUFrQjRCLGdCQUFBQSxFQUFBQSxVQUFXLENBQXRDLDJCQUFBLENBQUEsQ0FBQTtBQUNBLElBQUEsT0FBTzVCLElBQVAsQ0FBQTtBQUNILEdBQUE7O0VBRUQrQiw0QkFBNEIsQ0FBQzdFLE1BQUQsRUFBU3VFLEtBQVQsRUFBZ0JPLFlBQWhCLEVBQThCTCxjQUE5QixFQUE4Q0MsVUFBOUMsRUFBMEQ7QUFDbEYsSUFBQSxNQUFNRixlQUFlLEdBQUksQ0FBQSxDQUFBLEVBQUdNLFlBQWEsQ0FBQSxFQUFBLEVBQUlMLGNBQWUsQ0FBNUQsSUFBQSxDQUFBLENBQUE7O0lBQ0EsSUFBSSxDQUFDRixLQUFLLENBQUNRLGlCQUFQLElBQTRCUixLQUFLLENBQUNTLE1BQXRDLEVBQThDO0FBQzFDLE1BQUEsSUFBSVQsS0FBSyxDQUFDVSxLQUFOLEtBQWdCQyxjQUFwQixFQUFvQztBQUNoQyxRQUFBLElBQUlYLEtBQUssQ0FBQ1ksTUFBTixLQUFpQm5GLE1BQU0sQ0FBQ29GLE1BQVAsSUFBaUJwRixNQUFNLENBQUNxRixzQkFBekMsQ0FBSixFQUFzRTtBQUNsRSxVQUFBLE9BQU8sc0NBQXNDYixlQUE3QyxDQUFBO0FBQ0gsU0FBQTs7QUFDRCxRQUFBLE9BQU8sK0JBQStCQSxlQUF0QyxDQUFBO0FBQ0gsT0FBQTs7QUFDRCxNQUFBLE9BQU8sSUFBS0YsQ0FBQUEsK0JBQUwsQ0FBcUNDLEtBQXJDLEVBQTRDQyxlQUE1QyxFQUE2REMsY0FBN0QsRUFBNkVDLFVBQTdFLEVBQXlGLHFCQUF6RixDQUFQLENBQUE7QUFDSCxLQUFBOztBQUNELElBQUEsSUFBSUgsS0FBSyxDQUFDVSxLQUFOLEtBQWdCQyxjQUFwQixFQUFvQztBQUNoQyxNQUFBLElBQUlYLEtBQUssQ0FBQ1ksTUFBTixLQUFpQm5GLE1BQU0sQ0FBQ29GLE1BQVAsSUFBaUJwRixNQUFNLENBQUNxRixzQkFBekMsQ0FBSixFQUFzRTtBQUNsRSxRQUFBLE9BQU8sa0RBQWtEYixlQUF6RCxDQUFBO0FBQ0gsT0FBQTs7QUFDRCxNQUFBLE9BQU8sMkNBQTJDQSxlQUFsRCxDQUFBO0FBQ0gsS0FBQTs7QUFDRCxJQUFBLE9BQU8sSUFBS0YsQ0FBQUEsK0JBQUwsQ0FBcUNDLEtBQXJDLEVBQTRDQyxlQUE1QyxFQUE2REMsY0FBN0QsRUFBNkVDLFVBQTdFLEVBQXlGLGlDQUF6RixDQUFQLENBQUE7QUFDSCxHQUFBOztFQUVEWSwwQkFBMEIsQ0FBQ0MsS0FBRCxFQUFRO0FBQzlCLElBQUEsUUFBUUEsS0FBUjtBQUNJLE1BQUEsS0FBS0MsZUFBTDtBQUNJLFFBQUEsT0FBTyxNQUFQLENBQUE7O0FBQ0osTUFBQSxLQUFLQyxlQUFMO0FBQ0ksUUFBQSxPQUFPLE1BQVAsQ0FBQTs7QUFDSixNQUFBLEtBQUtDLGlCQUFMO0FBQ0ksUUFBQSxPQUFPLFFBQVAsQ0FBQTs7QUFDSixNQUFBO0FBQ0ksUUFBQSxPQUFPLEVBQVAsQ0FBQTtBQVJSLEtBQUE7QUFVSCxHQUFBOztBQUVEQyxFQUFBQSxvQkFBb0IsQ0FBQ0MsS0FBRCxFQUFRQyxlQUFSLEVBQXlCQyxhQUF6QixFQUF3QztJQUN4RCxNQUFNOUYsTUFBTSxHQUFHLElBQUEsQ0FBS0EsTUFBcEIsQ0FBQTtJQUNBLE1BQU1DLE9BQU8sR0FBRyxJQUFBLENBQUtBLE9BQXJCLENBQUE7SUFDQSxNQUFNSSxNQUFNLEdBQUcsSUFBQSxDQUFLQSxNQUFwQixDQUFBO0lBRUEsSUFBSXlDLElBQUksR0FBRyxFQUFYLENBQUE7SUFDQSxJQUFJaUQsUUFBUSxHQUFHLEVBQWYsQ0FBQTtJQUdBakQsSUFBSSxHQUFHLEtBQUtELGNBQUwsQ0FBb0JDLElBQXBCLEVBQTBCekMsTUFBMUIsRUFBa0NKLE9BQWxDLENBQVAsQ0FBQTtBQUVBOEYsSUFBQUEsUUFBUSxJQUFJLDBDQUFaLENBQUE7O0FBRUEsSUFBQSxJQUFJLEtBQUs5RixPQUFMLENBQWEwQixJQUFiLEtBQXNCcUUsWUFBMUIsRUFBd0M7QUFDcENsRCxNQUFBQSxJQUFJLElBQUkseUJBQVIsQ0FBQTtBQUNBQSxNQUFBQSxJQUFJLElBQUksc0JBQVIsQ0FBQTtBQUNBQSxNQUFBQSxJQUFJLElBQUksc0JBQVIsQ0FBQTtBQUNBQSxNQUFBQSxJQUFJLElBQUksNkJBQVIsQ0FBQTtBQUNBQSxNQUFBQSxJQUFJLElBQUksVUFBUixDQUFBO0FBQ0FBLE1BQUFBLElBQUksSUFBSSx3QkFBUixDQUFBO0FBQ0FBLE1BQUFBLElBQUksSUFBSSx3QkFBUixDQUFBO0FBQ0FBLE1BQUFBLElBQUksSUFBSSxpQ0FBUixDQUFBO0FBQ0FBLE1BQUFBLElBQUksSUFBSSxVQUFSLENBQUE7QUFDQWlELE1BQUFBLFFBQVEsSUFBSSwyRUFBWixDQUFBO0FBQ0gsS0FBQTs7QUFFRCxJQUFBLElBQUksSUFBSzlGLENBQUFBLE9BQUwsQ0FBYWdHLGFBQWpCLEVBQWdDO0FBQzVCLE1BQUEsSUFBQSxDQUFLL0YsVUFBTCxDQUFnQmdHLGNBQWhCLEdBQWlDQyxlQUFqQyxDQUFBO0FBQ0EsTUFBQSxJQUFBLENBQUtqRyxVQUFMLENBQWdCa0csY0FBaEIsR0FBaUNDLGVBQWpDLENBQUE7QUFDQSxNQUFBLElBQUEsQ0FBS25HLFVBQUwsQ0FBZ0JvRyxjQUFoQixHQUFpQ0MsZUFBakMsQ0FBQTtBQUNBLE1BQUEsSUFBQSxDQUFLckcsVUFBTCxDQUFnQnNHLGNBQWhCLEdBQWlDQyxlQUFqQyxDQUFBO01BQ0EzRCxJQUFJLElBQUl6QyxNQUFNLENBQUNxRyxZQUFmLENBQUE7QUFDSCxLQUFBOztJQUVELElBQUksSUFBQSxDQUFLOUUsV0FBVCxFQUFzQjtBQUNsQixNQUFBLElBQUEsQ0FBSzFCLFVBQUwsQ0FBZ0I1QixhQUFoQixHQUFnQ0MsZUFBaEMsQ0FBQTtBQUNBd0gsTUFBQUEsUUFBUSxJQUFJLDhCQUFaLENBQUE7O01BRUEsSUFBSTlGLE9BQU8sQ0FBQ21CLGdCQUFSLEtBQTZCLFdBQTdCLElBQTRDcEIsTUFBTSxDQUFDMkcscUJBQVAsSUFBZ0MsRUFBaEYsRUFBb0Y7UUFDaEY3RCxJQUFJLElBQUl6QyxNQUFNLENBQUN1RyxZQUFmLENBQUE7QUFDQWIsUUFBQUEsUUFBUSxJQUFJLHFDQUFaLENBQUE7QUFDSCxPQUFBOztBQUVELE1BQUEsSUFBSTlGLE9BQU8sQ0FBQzRHLFdBQVIsS0FBd0I1RyxPQUFPLENBQUM2QixTQUFSLElBQXFCN0IsT0FBTyxDQUFDNkcsU0FBN0IsSUFBMEM3RyxPQUFPLENBQUM4QixpQkFBMUUsQ0FBSixFQUFrRztBQUM5RixRQUFBLElBQUEsQ0FBSzdCLFVBQUwsQ0FBZ0IxQixjQUFoQixHQUFpQ0MsZ0JBQWpDLENBQUE7UUFDQXFFLElBQUksSUFBSXpDLE1BQU0sQ0FBQzBHLGlCQUFmLENBQUE7QUFDQWhCLFFBQUFBLFFBQVEsSUFBSSxrQ0FBWixDQUFBO0FBQ0FBLFFBQUFBLFFBQVEsSUFBSSxtQ0FBWixDQUFBO0FBQ0gsT0FMRCxNQUtPLElBQUk5RixPQUFPLENBQUM4QixpQkFBWixFQUErQjtRQUNsQ2UsSUFBSSxJQUFJekMsTUFBTSxDQUFDMEcsaUJBQWYsQ0FBQTtBQUNBaEIsUUFBQUEsUUFBUSxJQUFJLDZDQUFaLENBQUE7QUFDSCxPQUFBO0FBQ0osS0FBQTs7SUFFRCxNQUFNaUIsU0FBUyxHQUFHLENBQWxCLENBQUE7O0lBRUEsS0FBSyxJQUFJQyxDQUFDLEdBQUcsQ0FBYixFQUFnQkEsQ0FBQyxHQUFHRCxTQUFwQixFQUErQkMsQ0FBQyxFQUFoQyxFQUFvQztBQUNoQyxNQUFBLElBQUlyQixLQUFLLENBQUNxQixDQUFELENBQVQsRUFBYztBQUNWLFFBQUEsSUFBQSxDQUFLL0csVUFBTCxDQUFnQixpQkFBQSxHQUFvQitHLENBQXBDLENBQUEsR0FBeUMsYUFBYUEsQ0FBdEQsQ0FBQTtBQUNBbkUsUUFBQUEsSUFBSSxJQUFJekMsTUFBTSxDQUFDLE9BQU80RyxDQUFQLEdBQVcsSUFBWixDQUFkLENBQUE7UUFDQWxCLFFBQVEsSUFBSSxlQUFla0IsQ0FBZixHQUFtQixVQUFuQixHQUFnQ0EsQ0FBaEMsR0FBb0MsT0FBaEQsQ0FBQTtBQUNILE9BQUE7O0FBQ0QsTUFBQSxJQUFJcEIsZUFBZSxDQUFDb0IsQ0FBRCxDQUFuQixFQUF3QjtRQUNwQmxCLFFBQVEsSUFBSSxXQUFXa0IsQ0FBWCxHQUFlLE9BQWYsR0FBeUJBLENBQXpCLEdBQTZCLEtBQXpDLENBQUE7QUFDSCxPQUFBO0FBQ0osS0FBQTs7SUFFRCxNQUFNMUQsS0FBSyxHQUFHLENBQUNULElBQUQsRUFBTyxJQUFLVCxDQUFBQSxRQUFaLEVBQXNCMEQsUUFBdEIsRUFBZ0MsRUFBaEMsQ0FBZCxDQUFBO0FBRUFELElBQUFBLGFBQWEsQ0FBQ29CLE9BQWQsQ0FBdUJDLFlBQUQsSUFBa0I7QUFDcEMsTUFBQSxJQUFBLENBQUs3RCxnQkFBTCxDQUFzQkMsS0FBdEIsRUFBNkI0RCxZQUFZLENBQUMzRCxJQUExQyxFQUFnRDJELFlBQVksQ0FBQzFELEVBQTdELEVBQWlFMEQsWUFBWSxDQUFDekQsRUFBOUUsQ0FBQSxDQUFBO0tBREosQ0FBQSxDQUFBO0FBSUFaLElBQUFBLElBQUksR0FBR1MsS0FBSyxDQUFDLENBQUQsQ0FBWixDQUFBO0FBQ0EsSUFBQSxJQUFBLENBQUtsQixRQUFMLEdBQWdCa0IsS0FBSyxDQUFDLENBQUQsQ0FBckIsQ0FBQTtBQUNBd0MsSUFBQUEsUUFBUSxHQUFHeEMsS0FBSyxDQUFDLENBQUQsQ0FBaEIsQ0FBQTs7SUFFQSxJQUFJdEQsT0FBTyxDQUFDbUgsWUFBWixFQUEwQjtBQUN0QixNQUFBLElBQUEsQ0FBS2xILFVBQUwsQ0FBZ0JwQixZQUFoQixHQUErQkMsY0FBL0IsQ0FBQTtBQUNBZ0gsTUFBQUEsUUFBUSxJQUFJLG1DQUFaLENBQUE7QUFDSCxLQUFBOztBQUVELElBQUEsSUFBSTlGLE9BQU8sQ0FBQ29ILElBQVIsSUFBZ0JwSCxPQUFPLENBQUNxSCxpQkFBNUIsRUFBK0M7QUFDM0MsTUFBQSxJQUFBLENBQUtwSCxVQUFMLENBQWdCcUgsd0JBQWhCLEdBQTJDQyxjQUEzQyxDQUFBO0FBQ0EsTUFBQSxJQUFBLENBQUt0SCxVQUFMLENBQWdCdUgsdUJBQWhCLEdBQTBDQyxjQUExQyxDQUFBO0FBRUEzQixNQUFBQSxRQUFRLElBQUksMkJBQVosQ0FBQTtNQUVBakQsSUFBSSxJQUFJekMsTUFBTSxDQUFDc0gsTUFBZixDQUFBO0FBQ0gsS0FBQTs7QUFHRCxJQUFBLElBQUkxSCxPQUFPLENBQUMySCxnQkFBUixJQUE0QjNILE9BQU8sQ0FBQzRILGNBQXhDLEVBQXdEO01BRXBELElBQUk1SCxPQUFPLENBQUM2SCxvQkFBWixFQUFrQztBQUU5QmhGLFFBQUFBLElBQUksSUFBSSxrQ0FBUixDQUFBOztRQUVBLElBQUk3QyxPQUFPLENBQUMySCxnQkFBWixFQUE4QjtBQUMxQjlFLFVBQUFBLElBQUksSUFBSSwyQ0FBUixDQUFBO0FBQ0gsU0FBQTs7UUFFRCxJQUFJN0MsT0FBTyxDQUFDNEgsY0FBWixFQUE0QjtBQUN4Qi9FLFVBQUFBLElBQUksSUFBSSx5Q0FBUixDQUFBO0FBQ0gsU0FBQTs7QUFHRCxRQUFBLElBQUEsQ0FBSzVDLFVBQUwsQ0FBZ0I2SCxlQUFoQixHQUFrQ3RCLGVBQWxDLENBQUE7QUFDQTNELFFBQUFBLElBQUksSUFBSSxvQ0FBUixDQUFBO0FBRUgsT0FoQkQsTUFnQk87QUFHSEEsUUFBQUEsSUFBSSxJQUFJLG9CQUFSLENBQUE7O1FBR0EsSUFBSTdDLE9BQU8sQ0FBQzJILGdCQUFaLEVBQThCO0FBQzFCLFVBQUEsSUFBQSxDQUFLMUgsVUFBTCxDQUFnQjhILFVBQWhCLEdBQTZCUixjQUE3QixDQUFBO0FBQ0EsVUFBQSxJQUFBLENBQUt0SCxVQUFMLENBQWdCK0gsVUFBaEIsR0FBNkJQLGNBQTdCLENBQUE7QUFDQSxVQUFBLElBQUEsQ0FBS3hILFVBQUwsQ0FBZ0JnSSxVQUFoQixHQUE2QkMsZUFBN0IsQ0FBQTtBQUNBLFVBQUEsSUFBQSxDQUFLakksVUFBTCxDQUFnQmtJLFVBQWhCLEdBQTZCQyxlQUE3QixDQUFBO0FBRUF2RixVQUFBQSxJQUFJLElBQUksMEJBQVIsQ0FBQTtBQUNBQSxVQUFBQSxJQUFJLElBQUksOEJBQVIsQ0FBQTtBQUNBQSxVQUFBQSxJQUFJLElBQUksOEJBQVIsQ0FBQTtBQUNBQSxVQUFBQSxJQUFJLElBQUksOEJBQVIsQ0FBQTtBQUNBQSxVQUFBQSxJQUFJLElBQUksOEJBQVIsQ0FBQTtBQUVILFNBWkQsTUFZTyxJQUFJN0MsT0FBTyxDQUFDNEgsY0FBWixFQUE0QjtBQUMvQixVQUFBLElBQUEsQ0FBSzNILFVBQUwsQ0FBZ0JvSSxVQUFoQixHQUE2QmQsY0FBN0IsQ0FBQTtBQUNBLFVBQUEsSUFBQSxDQUFLdEgsVUFBTCxDQUFnQnFJLFVBQWhCLEdBQTZCYixjQUE3QixDQUFBO0FBQ0EsVUFBQSxJQUFBLENBQUt4SCxVQUFMLENBQWdCc0ksVUFBaEIsR0FBNkJMLGVBQTdCLENBQUE7QUFDQSxVQUFBLElBQUEsQ0FBS2pJLFVBQUwsQ0FBZ0J1SSxVQUFoQixHQUE2QkosZUFBN0IsQ0FBQTtBQUVBdkYsVUFBQUEsSUFBSSxJQUFJLDBCQUFSLENBQUE7QUFDQUEsVUFBQUEsSUFBSSxJQUFJLDhCQUFSLENBQUE7QUFDQUEsVUFBQUEsSUFBSSxJQUFJLDhCQUFSLENBQUE7QUFDQUEsVUFBQUEsSUFBSSxJQUFJLDhCQUFSLENBQUE7QUFDQUEsVUFBQUEsSUFBSSxJQUFJLDhCQUFSLENBQUE7QUFDSCxTQUFBOztBQUdELFFBQUEsSUFBSSxDQUFDN0MsT0FBTyxDQUFDNEgsY0FBYixFQUE2QjtBQUN6QixVQUFBLElBQUEsQ0FBSzNILFVBQUwsQ0FBZ0J3SSxVQUFoQixHQUE2QnZDLGVBQTdCLENBQUE7QUFDQSxVQUFBLElBQUEsQ0FBS2pHLFVBQUwsQ0FBZ0J5SSxVQUFoQixHQUE2QnRDLGVBQTdCLENBQUE7QUFDQSxVQUFBLElBQUEsQ0FBS25HLFVBQUwsQ0FBZ0IwSSxVQUFoQixHQUE2QnJDLGVBQTdCLENBQUE7QUFDQSxVQUFBLElBQUEsQ0FBS3JHLFVBQUwsQ0FBZ0IySSxVQUFoQixHQUE2QnBDLGVBQTdCLENBQUE7QUFFQTNELFVBQUFBLElBQUksSUFBSSwwQkFBUixDQUFBO0FBQ0FBLFVBQUFBLElBQUksSUFBSSw4QkFBUixDQUFBO0FBQ0FBLFVBQUFBLElBQUksSUFBSSw4QkFBUixDQUFBO0FBQ0FBLFVBQUFBLElBQUksSUFBSSw4QkFBUixDQUFBO0FBQ0FBLFVBQUFBLElBQUksSUFBSSw4QkFBUixDQUFBO0FBQ0gsU0FYRCxNQVdPO0FBQ0gsVUFBQSxJQUFBLENBQUs1QyxVQUFMLENBQWdCNEksVUFBaEIsR0FBNkIzQyxlQUE3QixDQUFBO0FBQ0EsVUFBQSxJQUFBLENBQUtqRyxVQUFMLENBQWdCNkksVUFBaEIsR0FBNkIxQyxlQUE3QixDQUFBO0FBQ0EsVUFBQSxJQUFBLENBQUtuRyxVQUFMLENBQWdCOEksVUFBaEIsR0FBNkJ6QyxlQUE3QixDQUFBO0FBQ0EsVUFBQSxJQUFBLENBQUtyRyxVQUFMLENBQWdCK0ksVUFBaEIsR0FBNkJ4QyxlQUE3QixDQUFBO0FBRUEzRCxVQUFBQSxJQUFJLElBQUksMEJBQVIsQ0FBQTtBQUNBQSxVQUFBQSxJQUFJLElBQUksOEJBQVIsQ0FBQTtBQUNBQSxVQUFBQSxJQUFJLElBQUksOEJBQVIsQ0FBQTtBQUNBQSxVQUFBQSxJQUFJLElBQUksOEJBQVIsQ0FBQTtBQUNBQSxVQUFBQSxJQUFJLElBQUksOEJBQVIsQ0FBQTtBQUNILFNBQUE7QUFDSixPQUFBO0FBQ0osS0FBQTs7SUFFRCxJQUFJN0MsT0FBTyxDQUFDaUosSUFBWixFQUFrQjtBQUNkLE1BQUEsSUFBQSxDQUFLaEosVUFBTCxDQUFnQmxCLGtCQUFoQixHQUFxQ0Msb0JBQXJDLENBQUE7QUFDQSxNQUFBLElBQUEsQ0FBS2lCLFVBQUwsQ0FBZ0JoQixrQkFBaEIsR0FBcUNDLHFCQUFyQyxDQUFBO0FBQ0EyRCxNQUFBQSxJQUFJLElBQUlxRyxRQUFRLENBQUNuSixNQUFELEVBQVNLLE1BQVQsQ0FBaEIsQ0FBQTtBQUNBeUMsTUFBQUEsSUFBSSxJQUFJLGdCQUFSLENBQUE7QUFDSCxLQUxELE1BS08sSUFBSTdDLE9BQU8sQ0FBQ2dHLGFBQVosRUFBMkI7QUFDOUJuRCxNQUFBQSxJQUFJLElBQUksc0JBQVIsQ0FBQTtBQUNILEtBQUE7O0lBQ0QsSUFBSTdDLE9BQU8sQ0FBQ21KLFdBQVosRUFBeUI7QUFDckJ0RyxNQUFBQSxJQUFJLElBQUksdUJBQVIsQ0FBQTtBQUNILEtBQUE7O0lBQ0QsSUFBSTdDLE9BQU8sQ0FBQ29KLFNBQVosRUFBdUI7QUFDbkJ2RyxNQUFBQSxJQUFJLElBQUkscUJBQVIsQ0FBQTtBQUNILEtBQUE7O0lBRURBLElBQUksR0FBRyxJQUFLTSxDQUFBQSxtQkFBTCxDQUF5Qk4sSUFBekIsRUFBK0I5QyxNQUEvQixFQUF1Q0ssTUFBdkMsRUFBK0NKLE9BQS9DLENBQVAsQ0FBQTs7SUFFQSxJQUFJLElBQUEsQ0FBSzJCLFdBQVQsRUFBc0I7TUFDbEJrQixJQUFJLElBQUl6QyxNQUFNLENBQUNpSixRQUFmLENBQUE7QUFDSCxLQUFBOztBQUVEeEcsSUFBQUEsSUFBSSxJQUFJLElBQVIsQ0FBQTtJQUNBQSxJQUFJLElBQUl6QyxNQUFNLENBQUNrSixPQUFmLENBQUE7QUFDQXpHLElBQUFBLElBQUksSUFBSWlELFFBQVIsQ0FBQTtJQUNBakQsSUFBSSxJQUFJekMsTUFBTSxDQUFDbUosS0FBZixDQUFBO0FBQ0ExRyxJQUFBQSxJQUFJLElBQUksR0FBUixDQUFBO0lBR0EyRyxNQUFNLENBQUNDLElBQVAsQ0FBWXRLLGVBQVosRUFBNkI4SCxPQUE3QixDQUFzQ3lDLENBQUQsSUFBTztBQUN4QyxNQUFBLElBQUk3RyxJQUFJLENBQUNqQyxPQUFMLENBQWE4SSxDQUFiLENBQUEsSUFBbUIsQ0FBdkIsRUFBMEI7UUFDdEIsSUFBS3RILENBQUFBLFFBQUwsSUFBa0IsQ0FBVWpELFFBQUFBLEVBQUFBLGVBQWUsQ0FBQ3VLLENBQUQsQ0FBSSxDQUFHQSxDQUFBQSxFQUFBQSxDQUFFLENBQXBELEdBQUEsQ0FBQSxDQUFBO0FBQ0gsT0FBQTtLQUhMLENBQUEsQ0FBQTtBQU1BLElBQUEsTUFBTUMsU0FBUyxHQUFHQyxXQUFXLENBQUM3SixNQUFELEVBQVMsV0FBVCxFQUFzQixJQUFLQyxDQUFBQSxPQUFMLENBQWEwQixJQUFuQyxFQUF5Q3RCLE1BQU0sQ0FBQ3lKLFdBQWhELENBQTdCLENBQUE7QUFDQSxJQUFBLElBQUEsQ0FBS3hILE9BQUwsR0FBZXNILFNBQVMsR0FBRyxJQUFLdkgsQ0FBQUEsUUFBakIsR0FBNEJTLElBQTNDLENBQUE7QUFDSCxHQUFBOztBQUVEaUgsRUFBQUEsZUFBZSxHQUFHO0lBRWQsTUFBTS9KLE1BQU0sR0FBRyxJQUFBLENBQUtBLE1BQXBCLENBQUE7SUFDQSxNQUFNSyxNQUFNLEdBQUcsSUFBQSxDQUFLQSxNQUFwQixDQUFBO0FBRUEsSUFBQSxNQUFNMkosU0FBUyxHQUFHLElBQUsvSixDQUFBQSxPQUFMLENBQWFnSyxzQkFBL0IsQ0FBQTtBQUNBLElBQUEsSUFBSW5ILElBQUksR0FBR29ILGFBQWEsQ0FBQ2xLLE1BQUQsRUFBUyxXQUFULEVBQXNCLElBQUEsQ0FBS0MsT0FBTCxDQUFhMEIsSUFBbkMsRUFBeUN0QixNQUFNLENBQUM4SixXQUFoRCxFQUE2REgsU0FBN0QsQ0FBeEIsQ0FBQTs7QUFFQSxJQUFBLEtBQUssSUFBSS9DLENBQUMsR0FBRyxDQUFiLEVBQWdCQSxDQUFDLEdBQUcsSUFBS3RFLENBQUFBLE9BQUwsQ0FBYTNCLE1BQWpDLEVBQXlDaUcsQ0FBQyxFQUExQyxFQUE4QztBQUMxQ25FLE1BQUFBLElBQUksSUFBSyxDQUFVLFFBQUEsRUFBQSxJQUFBLENBQUtILE9BQUwsQ0FBYXNFLENBQWIsQ0FBZ0IsQ0FBbkMsRUFBQSxDQUFBLENBQUE7QUFDSCxLQUFBOztBQUVELElBQUEsT0FBT25FLElBQVAsQ0FBQTtBQUNILEdBQUE7O0FBRURzSCxFQUFBQSxrQkFBa0IsR0FBRztBQUNqQixJQUFBLElBQUl0SCxJQUFJLEdBQUcsSUFBS2lILENBQUFBLGVBQUwsRUFBWCxDQUFBOztBQUNBakgsSUFBQUEsSUFBSSxJQUFJLHdCQUFSLENBQUE7SUFDQUEsSUFBSSxJQUFJLEtBQUtULFFBQWIsQ0FBQTtJQUNBUyxJQUFJLElBQUksS0FBS1AsWUFBYixDQUFBO0lBQ0FPLElBQUksSUFBSSxLQUFLTixZQUFiLENBQUE7SUFDQU0sSUFBSSxJQUFJdUgsS0FBSyxFQUFiLENBQUE7SUFDQXZILElBQUksSUFBSSxLQUFLTCxZQUFiLENBQUE7QUFDQUssSUFBQUEsSUFBSSxJQUFJLDhCQUFSLENBQUE7SUFDQUEsSUFBSSxJQUFJd0gsR0FBRyxFQUFYLENBQUE7QUFDQSxJQUFBLE9BQU94SCxJQUFQLENBQUE7QUFDSCxHQUFBOztBQUVEeUgsRUFBQUEsbUJBQW1CLEdBQUc7SUFDbEIsTUFBTWxLLE1BQU0sR0FBRyxJQUFBLENBQUtBLE1BQXBCLENBQUE7O0FBRUEsSUFBQSxJQUFJeUMsSUFBSSxHQUFHLElBQUtpSCxDQUFBQSxlQUFMLEVBQVgsQ0FBQTs7QUFFQWpILElBQUFBLElBQUksSUFBSSx5QkFBUixDQUFBO0lBQ0FBLElBQUksSUFBSSxLQUFLVCxRQUFiLENBQUE7SUFDQVMsSUFBSSxJQUFJekMsTUFBTSxDQUFDbUssV0FBZixDQUFBO0lBQ0ExSCxJQUFJLElBQUksS0FBS1AsWUFBYixDQUFBO0lBQ0FPLElBQUksSUFBSSxLQUFLTixZQUFiLENBQUE7SUFDQU0sSUFBSSxJQUFJdUgsS0FBSyxFQUFiLENBQUE7SUFDQXZILElBQUksSUFBSSxLQUFLTCxZQUFiLENBQUE7QUFDQUssSUFBQUEsSUFBSSxJQUFJLHlDQUFSLENBQUE7SUFDQUEsSUFBSSxJQUFJd0gsR0FBRyxFQUFYLENBQUE7QUFFQSxJQUFBLE9BQU94SCxJQUFQLENBQUE7QUFDSCxHQUFBOztBQUVEMkgsRUFBQUEsb0JBQW9CLEdBQUc7SUFDbkIsTUFBTXpLLE1BQU0sR0FBRyxJQUFBLENBQUtBLE1BQXBCLENBQUE7SUFDQSxNQUFNQyxPQUFPLEdBQUcsSUFBQSxDQUFLQSxPQUFyQixDQUFBO0lBQ0EsTUFBTUksTUFBTSxHQUFHLElBQUEsQ0FBS0EsTUFBcEIsQ0FBQTtJQUNBLE1BQU1nQyxRQUFRLEdBQUcsSUFBQSxDQUFLQSxRQUF0QixDQUFBO0lBRUEsTUFBTXFJLFNBQVMsR0FBR2pKLFVBQVUsQ0FBQ2tKLFdBQVgsQ0FBdUIxSyxPQUFPLENBQUMwQixJQUEvQixDQUFsQixDQUFBO0lBQ0EsTUFBTWlKLFVBQVUsR0FBR25KLFVBQVUsQ0FBQ29KLFlBQVgsQ0FBd0I1SyxPQUFPLENBQUMwQixJQUFoQyxDQUFuQixDQUFBOztBQUVBLElBQUEsSUFBSW1CLElBQUksR0FBRyxJQUFLaUgsQ0FBQUEsZUFBTCxFQUFYLENBQUE7O0lBRUEsSUFBSS9KLE1BQU0sQ0FBQ3FGLHNCQUFQLElBQWlDLENBQUNyRixNQUFNLENBQUNvRixNQUE3QyxFQUFxRDtBQUNqRHRDLE1BQUFBLElBQUksSUFBSSwrQkFBUixDQUFBO0FBQ0gsS0FBQTs7SUFFRCxJQUFJOEgsVUFBVSxLQUFLRSxZQUFuQixFQUFpQztNQUM3QixJQUFJOUssTUFBTSxDQUFDK0sseUJBQVgsRUFBc0M7QUFDbENqSSxRQUFBQSxJQUFJLElBQUksK0JBQVIsQ0FBQTtBQUNILE9BRkQsTUFFTztBQUNIQSxRQUFBQSxJQUFJLElBQUksK0JBQVIsQ0FBQTtBQUNILE9BQUE7QUFDSixLQU5ELE1BTU8sSUFBSThILFVBQVUsS0FBS0ksWUFBbkIsRUFBaUM7QUFDcENsSSxNQUFBQSxJQUFJLElBQUksK0JBQVIsQ0FBQTtBQUNILEtBQUE7O0lBRUQsSUFBSTRILFNBQVMsS0FBS08scUJBQWxCLEVBQXlDO0FBQ3JDbkksTUFBQUEsSUFBSSxJQUFJLCtCQUFSLENBQUE7QUFDQUEsTUFBQUEsSUFBSSxJQUFJLCtCQUFSLENBQUE7QUFDSCxLQUFBOztBQUVEQSxJQUFBQSxJQUFJLElBQUlULFFBQVIsQ0FBQTtJQUNBUyxJQUFJLElBQUksS0FBS1AsWUFBYixDQUFBO0lBQ0FPLElBQUksSUFBSSxLQUFLTixZQUFiLENBQUE7O0FBRUEsSUFBQSxJQUFJb0ksVUFBVSxLQUFLTSxXQUFmLEtBQStCLENBQUNsTCxNQUFNLENBQUNvRixNQUFSLElBQWtCc0YsU0FBUyxLQUFLUyxjQUEvRCxDQUFKLEVBQW9GO01BQ2hGckksSUFBSSxJQUFJekMsTUFBTSxDQUFDbUssV0FBZixDQUFBO0FBQ0gsS0FGRCxNQUVPLElBQUlJLFVBQVUsS0FBS1EsV0FBbkIsRUFBZ0M7QUFDbkN0SSxNQUFBQSxJQUFJLElBQUksbUNBQVIsQ0FBQTtBQUNBQSxNQUFBQSxJQUFJLElBQUksd0NBQVIsQ0FBQTtBQUNBQSxNQUFBQSxJQUFJLElBQUkseUJBQVIsQ0FBQTtBQUNBQSxNQUFBQSxJQUFJLElBQUksbURBQVIsQ0FBQTtBQUNBQSxNQUFBQSxJQUFJLElBQUksbUJBQVIsQ0FBQTtBQUNBQSxNQUFBQSxJQUFJLElBQUksT0FBUixDQUFBO0FBQ0gsS0FBQTs7SUFFREEsSUFBSSxJQUFJdUgsS0FBSyxFQUFiLENBQUE7SUFFQXZILElBQUksSUFBSSxLQUFLTCxZQUFiLENBQUE7QUFFQSxJQUFBLE1BQU00SSxLQUFLLEdBQUdULFVBQVUsS0FBS1EsV0FBZixJQUE4QlIsVUFBVSxLQUFLSSxZQUE3QyxJQUE2REosVUFBVSxLQUFLRSxZQUExRixDQUFBO0lBQ0EsTUFBTVEsbUJBQW1CLEdBQUcsQ0FBQ3RMLE1BQU0sQ0FBQ29GLE1BQVIsSUFBa0JwRixNQUFNLENBQUNxRixzQkFBckQsQ0FBQTs7SUFFQSxJQUFJcUYsU0FBUyxLQUFLUyxjQUFkLElBQWlDRSxLQUFLLElBQUlYLFNBQVMsS0FBS08scUJBQTVELEVBQW9GO0FBQ2hGbkksTUFBQUEsSUFBSSxJQUFJLHVGQUFSLENBQUE7QUFDSCxLQUZELE1BRU87QUFDSEEsTUFBQUEsSUFBSSxJQUFJLHFDQUFSLENBQUE7QUFDSCxLQUFBOztBQUVELElBQUEsSUFBSXdJLG1CQUFKLEVBQXlCO0FBQ3JCeEksTUFBQUEsSUFBSSxJQUFJLDJGQUFSLENBQUE7QUFDQUEsTUFBQUEsSUFBSSxJQUFJLHdHQUFSLENBQUE7QUFDSCxLQUFBOztBQUVELElBQUEsSUFBSThILFVBQVUsS0FBS00sV0FBZixLQUErQixDQUFDbEwsTUFBTSxDQUFDb0YsTUFBUixJQUFtQnNGLFNBQVMsS0FBS1MsY0FBZCxJQUFnQyxDQUFDbEwsT0FBTyxDQUFDaUIsd0JBQTNGLENBQUosRUFBMkg7QUFDdkg0QixNQUFBQSxJQUFJLElBQUksd0NBQVIsQ0FBQTtLQURKLE1BRU8sSUFBSThILFVBQVUsS0FBS00sV0FBZixJQUE4Qk4sVUFBVSxLQUFLVyxXQUFqRCxFQUE4RDtBQUNqRXpJLE1BQUFBLElBQUksSUFBSSxpQ0FBUixDQUFBOztNQUdBLElBQUk3QyxPQUFPLENBQUNpQix3QkFBUixJQUFvQ3dKLFNBQVMsS0FBS1MsY0FBbEQsSUFBb0VuTCxNQUFNLENBQUNvRixNQUEvRSxFQUF1RjtBQUNuRnRDLFFBQUFBLElBQUksSUFBSSw2QkFBUixDQUFBO0FBQ0gsT0FBQTtBQUNKLEtBUE0sTUFPQSxJQUFJOEgsVUFBVSxLQUFLUSxXQUFuQixFQUFnQztBQUNuQ3RJLE1BQUFBLElBQUksSUFBSSw4RUFBUixDQUFBO0FBQ0gsS0FGTSxNQUVBO01BQ0hBLElBQUksSUFBSXpDLE1BQU0sQ0FBQ21MLFdBQWYsQ0FBQTtBQUNILEtBQUE7O0lBRUQxSSxJQUFJLElBQUl3SCxHQUFHLEVBQVgsQ0FBQTtBQUVBLElBQUEsT0FBT3hILElBQVAsQ0FBQTtBQUNILEdBQUE7O0FBR0QySSxFQUFBQSxpQkFBaUIsR0FBRztJQUNoQixNQUFNekwsTUFBTSxHQUFHLElBQUEsQ0FBS0EsTUFBcEIsQ0FBQTtJQUNBLE1BQU1DLE9BQU8sR0FBRyxJQUFBLENBQUtBLE9BQXJCLENBQUE7SUFDQSxNQUFNSSxNQUFNLEdBQUcsSUFBQSxDQUFLQSxNQUFwQixDQUFBO0lBRUEsSUFBSXlDLElBQUksR0FBRyxFQUFYLENBQUE7O0FBRUEsSUFBQSxJQUFJN0MsT0FBTyxDQUFDeUwsb0JBQVIsS0FBaUMsS0FBckMsRUFBNEM7QUFDeEM1SSxNQUFBQSxJQUFJLElBQUkscUNBQVIsQ0FBQTtBQUNILEtBQUE7O0lBRUQsSUFBSTdDLE9BQU8sQ0FBQ29CLFdBQVosRUFBeUI7QUFDckIsTUFBQSxJQUFBLENBQUtzQixPQUFMLENBQWFnSixJQUFiLENBQWtCLGNBQWxCLENBQUEsQ0FBQTs7TUFFQSxJQUFJLElBQUEsQ0FBS3hLLFdBQVQsRUFBc0I7QUFDbEIsUUFBQSxJQUFBLENBQUt3QixPQUFMLENBQWFnSixJQUFiLENBQWtCLGlCQUFsQixDQUFBLENBQUE7QUFDSCxPQUFBOztNQUVELElBQUkxTCxPQUFPLENBQUMyTCxTQUFaLEVBQXVCO0FBQ25CLFFBQUEsSUFBQSxDQUFLakosT0FBTCxDQUFhZ0osSUFBYixDQUFrQixlQUFsQixDQUFBLENBQUE7QUFDSCxPQUFBOztBQUVELE1BQUEsSUFBSTFMLE9BQU8sQ0FBQzRMLFlBQVIsR0FBdUIsQ0FBM0IsRUFBOEI7QUFDMUIsUUFBQSxJQUFBLENBQUtsSixPQUFMLENBQWFnSixJQUFiLENBQWtCLHNCQUFsQixDQUFBLENBQUE7QUFDSCxPQUFBOztNQUdELElBQUkxTCxPQUFPLENBQUM2TCxjQUFaLEVBQTRCO0FBQ3hCLFFBQUEsSUFBQSxDQUFLbkosT0FBTCxDQUFhZ0osSUFBYixDQUFrQixxQkFBbEIsQ0FBQSxDQUFBO0FBQ0gsT0FBQTs7TUFFRCxJQUFJMUwsT0FBTyxDQUFDOEwsS0FBWixFQUFtQjtBQUNmLFFBQUEsSUFBQSxDQUFLcEosT0FBTCxDQUFhZ0osSUFBYixDQUFrQixXQUFsQixDQUFBLENBQUE7QUFDSCxPQUFBOztNQUVELElBQUkxTCxPQUFPLENBQUMrTCxXQUFaLEVBQXlCO0FBQ3JCLFFBQUEsSUFBQSxDQUFLckosT0FBTCxDQUFhZ0osSUFBYixDQUFrQixpQkFBbEIsQ0FBQSxDQUFBO0FBQ0gsT0FBQTtBQUNKLEtBQUE7O0lBR0QsTUFBTU0sY0FBYyxHQUFHLEVBQXZCLENBQUE7SUFDQSxJQUFJQyxlQUFlLEdBQUcsQ0FBdEIsQ0FBQTtJQUNBLElBQUlDLDRCQUE0QixHQUFHLEtBQW5DLENBQUE7SUFDQSxJQUFJQyxNQUFNLEdBQUcsS0FBYixDQUFBO0lBQ0EsSUFBSUMscUJBQXFCLEdBQUcsS0FBNUIsQ0FBQTtJQUVBLElBQUlDLGFBQWEsR0FBR3JNLE9BQU8sQ0FBQ2MsTUFBUixDQUFld0wsSUFBZixDQUFvQixVQUFVaEksS0FBVixFQUFpQjtNQUNyRCxPQUFPQSxLQUFLLENBQUNpSSxNQUFOLElBQWdCakksS0FBSyxDQUFDaUksTUFBTixLQUFpQkMsbUJBQXhDLENBQUE7QUFDSCxLQUZtQixDQUFwQixDQUFBOztBQU1BLElBQUEsSUFBSXhNLE9BQU8sQ0FBQ2lCLHdCQUFSLElBQW9DakIsT0FBTyxDQUFDeU0sa0NBQWhELEVBQW9GO0FBQ2hGSixNQUFBQSxhQUFhLEdBQUcsSUFBaEIsQ0FBQTtBQUNILEtBQUE7O0lBRUQsSUFBSUssaUJBQWlCLEdBQUcsT0FBeEIsQ0FBQTs7QUFDQSxJQUFBLElBQUkzTSxNQUFNLENBQUM0TSxrQkFBUCxLQUE4QkMsdUJBQWxDLEVBQTJEO0FBRXZEL0osTUFBQUEsSUFBSSxJQUFJLGlDQUFSLENBQUE7QUFDQTZKLE1BQUFBLGlCQUFpQixHQUFHLE1BQXBCLENBQUE7QUFDSCxLQUFBOztBQUVELElBQUEsSUFBSUwsYUFBYSxJQUFJck0sT0FBTyxDQUFDaUIsd0JBQTdCLEVBQXVEO0FBQ25ENEIsTUFBQUEsSUFBSSxJQUFJLHVCQUFSLENBQUE7TUFDQUEsSUFBSSxJQUFLLENBQVU2SixRQUFBQSxFQUFBQSxpQkFBa0IsQ0FBckMsK0JBQUEsQ0FBQSxDQUFBO01BQ0E3SixJQUFJLElBQUssQ0FBVTZKLFFBQUFBLEVBQUFBLGlCQUFrQixDQUFyQywrQkFBQSxDQUFBLENBQUE7QUFDSCxLQUFBOztBQUVELElBQUEsS0FBSyxJQUFJMUYsQ0FBQyxHQUFHLENBQWIsRUFBZ0JBLENBQUMsR0FBR2hILE9BQU8sQ0FBQ2MsTUFBUixDQUFlQyxNQUFuQyxFQUEyQ2lHLENBQUMsRUFBNUMsRUFBZ0Q7QUFDNUMsTUFBQSxNQUFNMUMsS0FBSyxHQUFHdEUsT0FBTyxDQUFDYyxNQUFSLENBQWVrRyxDQUFmLENBQWQsQ0FBQTtBQUNBLE1BQUEsTUFBTXlELFNBQVMsR0FBR25HLEtBQUssQ0FBQ1UsS0FBeEIsQ0FBQTtBQUdBLE1BQUEsSUFBSWhGLE9BQU8sQ0FBQ2lCLHdCQUFSLElBQW9Dd0osU0FBUyxLQUFLTyxxQkFBdEQsRUFDSSxTQUFBO0FBRUosTUFBQSxNQUFNNkIsVUFBVSxHQUFJUixhQUFhLElBQUkvSCxLQUFLLENBQUNpSSxNQUF4QixHQUFrQ2pJLEtBQUssQ0FBQ2lJLE1BQXhDLEdBQWlEQyxtQkFBcEUsQ0FBQTtBQUVBM0osTUFBQUEsSUFBSSxJQUFJLG9CQUFBLEdBQXVCbUUsQ0FBdkIsR0FBMkIsV0FBbkMsQ0FBQTs7TUFDQSxJQUFJeUQsU0FBUyxLQUFLTyxxQkFBbEIsRUFBeUM7QUFDckNuSSxRQUFBQSxJQUFJLElBQUksb0JBQUEsR0FBdUJtRSxDQUF2QixHQUEyQixlQUFuQyxDQUFBO0FBQ0gsT0FGRCxNQUVPO0FBQ0huRSxRQUFBQSxJQUFJLElBQUksb0JBQUEsR0FBdUJtRSxDQUF2QixHQUEyQixjQUFuQyxDQUFBO0FBQ0FuRSxRQUFBQSxJQUFJLElBQUkscUJBQUEsR0FBd0JtRSxDQUF4QixHQUE0QixZQUFwQyxDQUFBOztRQUNBLElBQUl5RCxTQUFTLEtBQUt4RixjQUFsQixFQUFrQztBQUM5QnBDLFVBQUFBLElBQUksSUFBSSxvQkFBQSxHQUF1Qm1FLENBQXZCLEdBQTJCLGVBQW5DLENBQUE7QUFDQW5FLFVBQUFBLElBQUksSUFBSSxxQkFBQSxHQUF3Qm1FLENBQXhCLEdBQTRCLG9CQUFwQyxDQUFBO0FBQ0FuRSxVQUFBQSxJQUFJLElBQUkscUJBQUEsR0FBd0JtRSxDQUF4QixHQUE0QixvQkFBcEMsQ0FBQTtBQUNILFNBQUE7QUFDSixPQUFBOztNQUNELElBQUk2RixVQUFVLEtBQUtMLG1CQUFuQixFQUF3QztRQUNwQyxJQUFJL0IsU0FBUyxLQUFLTyxxQkFBbEIsRUFBeUM7QUFDckNuSSxVQUFBQSxJQUFJLElBQUksb0JBQUEsR0FBdUJtRSxDQUF2QixHQUEyQixjQUFuQyxDQUFBO0FBQ0gsU0FBQTs7QUFDRG5FLFFBQUFBLElBQUksSUFBSSxvQkFBQSxHQUF1Qm1FLENBQXZCLEdBQTJCLGVBQW5DLENBQUE7QUFDQW5FLFFBQUFBLElBQUksSUFBSSxvQkFBQSxHQUF1Qm1FLENBQXZCLEdBQTJCLGdCQUFuQyxDQUFBO0FBQ0gsT0FBQTs7TUFDRCxJQUFJMUMsS0FBSyxDQUFDd0ksV0FBTixJQUFxQixDQUFDOU0sT0FBTyxDQUFDK00sUUFBbEMsRUFBNEM7QUFDeENsSyxRQUFBQSxJQUFJLElBQUksb0JBQUEsR0FBdUJtRSxDQUF2QixHQUEyQixrQkFBbkMsQ0FBQTtBQUNBbkUsUUFBQUEsSUFBSSxJQUFJLHFCQUFBLEdBQXdCbUUsQ0FBeEIsR0FBNEIscUJBQXBDLENBQUE7O1FBR0EsSUFBSXlELFNBQVMsS0FBS08scUJBQWxCLEVBQXlDO0FBQ3JDbkksVUFBQUEsSUFBSSxJQUFJLG9CQUFBLEdBQXVCbUUsQ0FBdkIsR0FBMkIsNEJBQW5DLENBQUE7QUFDQW5FLFVBQUFBLElBQUksSUFBSSxxQkFBQSxHQUF3Qm1FLENBQXhCLEdBQTRCLCtCQUFwQyxDQUFBO0FBQ0FuRSxVQUFBQSxJQUFJLElBQUkscUJBQUEsR0FBd0JtRSxDQUF4QixHQUE0Qix3QkFBcEMsQ0FBQTtBQUNILFNBQUE7O1FBRUQsSUFBSXlELFNBQVMsS0FBS08scUJBQWxCLEVBQXlDO0FBQ3JDbkksVUFBQUEsSUFBSSxJQUFJLG9CQUFBLEdBQXVCbUUsQ0FBdkIsR0FBMkIsa0JBQW5DLENBQUE7QUFDSCxTQUZELE1BRU87QUFDSGtGLFVBQUFBLDRCQUE0QixHQUFHLElBQS9CLENBQUE7QUFDQXJKLFVBQUFBLElBQUksSUFBSSxvQkFBQSxHQUF1Qm1FLENBQXZCLEdBQTJCLGtCQUFuQyxDQUFBO0FBQ0gsU0FBQTs7UUFDRCxJQUFJeUQsU0FBUyxLQUFLUyxjQUFsQixFQUFrQztBQUM5QnJJLFVBQUFBLElBQUksSUFBSSwyQkFBQSxHQUE4Qm1FLENBQTlCLEdBQWtDLGVBQTFDLENBQUE7QUFDSCxTQUZELE1BRU87QUFDSCxVQUFBLElBQUkxQyxLQUFLLENBQUNZLE1BQU4sSUFBZ0JuRixNQUFNLENBQUNvRixNQUEzQixFQUFtQztBQUMvQnRDLFlBQUFBLElBQUksSUFBSSwrQkFBQSxHQUFrQ21FLENBQWxDLEdBQXNDLGVBQTlDLENBQUE7QUFDSCxXQUZELE1BRU87QUFDSG5FLFlBQUFBLElBQUksSUFBSSx5QkFBQSxHQUE0Qm1FLENBQTVCLEdBQWdDLGVBQXhDLENBQUE7QUFDSCxXQUFBO0FBQ0osU0FBQTs7UUFDRGlGLGVBQWUsRUFBQSxDQUFBO0FBQ2ZELFFBQUFBLGNBQWMsQ0FBQzFILEtBQUssQ0FBQzBJLFdBQVAsQ0FBZCxHQUFvQyxJQUFwQyxDQUFBO0FBQ0EsUUFBQSxJQUFJMUksS0FBSyxDQUFDUyxNQUFWLEVBQWtCb0gsTUFBTSxHQUFHLElBQVQsQ0FBQTtBQUNsQixRQUFBLElBQUk3SCxLQUFLLENBQUNZLE1BQU4sS0FBaUJuRixNQUFNLENBQUNvRixNQUFQLElBQWlCcEYsTUFBTSxDQUFDcUYsc0JBQXpDLEtBQW9FcUYsU0FBUyxLQUFLeEYsY0FBdEYsRUFBc0dtSCxxQkFBcUIsR0FBRyxJQUF4QixDQUFBO0FBQ3pHLE9BQUE7O01BQ0QsSUFBSTlILEtBQUssQ0FBQzJJLE9BQVYsRUFBbUI7QUFDZixRQUFBLElBQUkzSSxLQUFLLENBQUMySSxPQUFOLENBQWNDLFFBQWxCLEVBQTRCO1VBQ3hCLElBQUl6QyxTQUFTLEtBQUtTLGNBQWxCLEVBQWtDO0FBQzlCckksWUFBQUEsSUFBSSxJQUFJLDJCQUFBLEdBQThCbUUsQ0FBOUIsR0FBa0MsWUFBMUMsQ0FBQTtBQUNBbkUsWUFBQUEsSUFBSSxJQUFJLHFCQUFBLEdBQXdCbUUsQ0FBeEIsR0FBNEIscUJBQXBDLENBQUE7QUFDQSxZQUFBLElBQUksQ0FBQzFDLEtBQUssQ0FBQ3dJLFdBQVAsSUFBc0I5TSxPQUFPLENBQUMrTSxRQUFsQyxFQUE0Q2xLLElBQUksSUFBSSxvQkFBdUJtRSxHQUFBQSxDQUF2QixHQUEyQixrQkFBbkMsQ0FBQTtBQUMvQyxXQUFBO0FBQ0osU0FORCxNQU1PO1VBQ0gsSUFBSXlELFNBQVMsS0FBS3hGLGNBQWxCLEVBQWtDO0FBQzlCcEMsWUFBQUEsSUFBSSxJQUFJLHlCQUFBLEdBQTRCbUUsQ0FBNUIsR0FBZ0MsWUFBeEMsQ0FBQTtBQUNBbkUsWUFBQUEsSUFBSSxJQUFJLHFCQUFBLEdBQXdCbUUsQ0FBeEIsR0FBNEIscUJBQXBDLENBQUE7QUFDQSxZQUFBLElBQUksQ0FBQzFDLEtBQUssQ0FBQ3dJLFdBQVAsSUFBc0I5TSxPQUFPLENBQUMrTSxRQUFsQyxFQUE0Q2xLLElBQUksSUFBSSxvQkFBdUJtRSxHQUFBQSxDQUF2QixHQUEyQixrQkFBbkMsQ0FBQTs7WUFDNUMsSUFBSTFDLEtBQUssQ0FBQzZJLGdCQUFWLEVBQTRCO0FBQ3hCdEssY0FBQUEsSUFBSSxJQUFJLG9CQUFBLEdBQXVCbUUsQ0FBdkIsR0FBMkIsa0JBQW5DLENBQUE7QUFDQW5FLGNBQUFBLElBQUksSUFBSSxvQkFBQSxHQUF1Qm1FLENBQXZCLEdBQTJCLGtCQUFuQyxDQUFBO0FBQ0gsYUFBQTtBQUNKLFdBQUE7QUFDSixTQUFBO0FBQ0osT0FBQTtBQUNKLEtBQUE7O0FBRURuRSxJQUFBQSxJQUFJLElBQUksSUFBUixDQUFBO0lBR0EsTUFBTXVLLE1BQU0sR0FBRyxJQUFLekwsQ0FBQUEsV0FBTCxLQUFxQjNCLE9BQU8sQ0FBQzZHLFNBQVIsSUFBcUI3RyxPQUFPLENBQUMrQixrQkFBN0IsSUFBb0QvQixPQUFPLENBQUM4QixpQkFBUixJQUE2QixDQUFDOUIsT0FBTyxDQUFDNkIsU0FBL0csQ0FBZixDQUFBOztBQUVBLElBQUEsSUFBSXVMLE1BQUosRUFBWTtNQUNSLElBQUlwTixPQUFPLENBQUM0RyxXQUFaLEVBQXlCO1FBQ3JCL0QsSUFBSSxJQUFJN0MsT0FBTyxDQUFDcU4sT0FBUixHQUFrQmpOLE1BQU0sQ0FBQ2tOLFNBQXpCLEdBQXFDbE4sTUFBTSxDQUFDbU4sS0FBcEQsQ0FBQTtBQUNILE9BRkQsTUFFTztBQUNILFFBQUEsSUFBSXhOLE1BQU0sQ0FBQ3FGLHNCQUFQLEtBQWtDcEYsT0FBTyxDQUFDNkcsU0FBUixJQUFxQjdHLE9BQU8sQ0FBQytCLGtCQUEvRCxDQUFKLEVBQXdGO1VBQ3BGYyxJQUFJLElBQUl6QyxNQUFNLENBQUNvTixlQUFQLENBQXVCQyxPQUF2QixDQUErQixPQUEvQixFQUF3QyxJQUFLaEwsQ0FBQUEsVUFBN0MsQ0FBUixDQUFBO0FBQ0gsU0FGRCxNQUVPO1VBQ0hJLElBQUksSUFBSXpDLE1BQU0sQ0FBQ3NOLGdCQUFmLENBQUE7QUFDSCxTQUFBO0FBQ0osT0FBQTtBQUNKLEtBQUE7O0lBR0Q3SyxJQUFJLElBQUl6QyxNQUFNLENBQUN1TixXQUFmLENBQUE7SUFDQTlLLElBQUksSUFBSXpDLE1BQU0sQ0FBQ3dOLFFBQWYsQ0FBQTtJQUNBL0ssSUFBSSxJQUFJZ0wsU0FBUyxDQUFDN04sT0FBTyxDQUFDOE4sS0FBVCxFQUFnQjFOLE1BQWhCLENBQWpCLENBQUE7SUFDQXlDLElBQUksSUFBSWtMLFdBQVcsQ0FBQy9OLE9BQU8sQ0FBQ2dPLE9BQVQsRUFBa0I1TixNQUFsQixDQUFuQixDQUFBO0lBQ0F5QyxJQUFJLElBQUlvTCxPQUFPLENBQUNqTyxPQUFPLENBQUNrTyxHQUFULEVBQWM5TixNQUFkLENBQWYsQ0FBQTtJQUlBeUMsSUFBSSxJQUFJLEtBQUtOLFlBQWIsQ0FBQTs7SUFFQSxJQUFJdkMsT0FBTyxDQUFDbU8sa0JBQVosRUFBZ0M7QUFDNUJ0TCxNQUFBQSxJQUFJLElBQUksNEJBQVIsQ0FBQTtBQUNILEtBQUE7O0lBRUQsSUFBSSxJQUFBLENBQUtsQixXQUFULEVBQXNCO01BQ2xCa0IsSUFBSSxJQUFJekMsTUFBTSxDQUFDZ08sZUFBZixDQUFBO0FBQ0F2TCxNQUFBQSxJQUFJLElBQUk3QyxPQUFPLENBQUNxTyxpQkFBUixHQUE0QixDQUE1QixHQUFnQ2pPLE1BQU0sQ0FBQ2tPLG1CQUF2QyxHQUE2RGxPLE1BQU0sQ0FBQ21PLG9CQUE1RSxDQUFBO01BQ0ExTCxJQUFJLElBQUk3QyxPQUFPLENBQUN3TyxlQUFSLEdBQTBCcE8sTUFBTSxDQUFDcU8sYUFBakMsR0FBaURyTyxNQUFNLENBQUNzTyxVQUFoRSxDQUFBO0FBQ0gsS0FBQTs7SUFFRCxJQUFLLElBQUEsQ0FBSzdOLFFBQUwsSUFBaUJiLE9BQU8sQ0FBQ29CLFdBQTFCLElBQTBDLElBQUtGLENBQUFBLFdBQW5ELEVBQWdFO01BQzVELElBQUlsQixPQUFPLENBQUMyTyxZQUFaLEVBQTBCO1FBQ3RCOUwsSUFBSSxJQUFJekMsTUFBTSxDQUFDd08sbUJBQWYsQ0FBQTtBQUNILE9BQUE7O0FBRUQsTUFBQSxJQUFJNU8sT0FBTyxDQUFDNEwsWUFBUixLQUF5QmlELGVBQTdCLEVBQThDO1FBQzFDaE0sSUFBSSxJQUFJekMsTUFBTSxDQUFDME8sZ0JBQWYsQ0FBQTtBQUNILE9BQUE7O01BRUQsSUFBSTlPLE9BQU8sQ0FBQytMLFdBQVosRUFBeUI7UUFDckJsSixJQUFJLElBQUl6QyxNQUFNLENBQUMyTyx3QkFBZixDQUFBO0FBQ0gsT0FBQTtBQUNKLEtBQUE7O0lBRUQsTUFBTUMsS0FBSyxHQUFHaFAsT0FBTyxDQUFDaVAsS0FBUixJQUFpQmpQLE9BQU8sQ0FBQ2tQLGFBQXZDLENBQUE7O0FBRUEsSUFBQSxJQUFJRixLQUFKLEVBQVc7TUFDUG5NLElBQUksSUFBSXpDLE1BQU0sQ0FBQytPLGNBQWYsQ0FBQTs7TUFDQSxRQUFRblAsT0FBTyxDQUFDb1AsZUFBaEI7QUFDSSxRQUFBLEtBQUtDLFVBQUw7VUFDSXhNLElBQUksSUFBSTdDLE9BQU8sQ0FBQ3NQLG9CQUFSLEdBQStCbFAsTUFBTSxDQUFDbVAsaUJBQXRDLEdBQTBEblAsTUFBTSxDQUFDb1Asc0JBQXpFLENBQUE7QUFDQSxVQUFBLE1BQUE7O0FBQ0osUUFBQSxLQUFLQyxzQkFBTDtVQUNJNU0sSUFBSSxJQUFJN0MsT0FBTyxDQUFDc1Asb0JBQVIsR0FBK0JsUCxNQUFNLENBQUNzUCxXQUF0QyxHQUFvRHRQLE1BQU0sQ0FBQ3VQLGdCQUFuRSxDQUFBO0FBQ0EsVUFBQSxNQUFBO0FBTlIsT0FBQTtBQVVILEtBQUE7O0FBRUQsSUFBQSxJQUFJM1AsT0FBTyxDQUFDbUIsZ0JBQVIsS0FBNkIsWUFBakMsRUFBK0M7TUFDM0MwQixJQUFJLElBQUk3QyxPQUFPLENBQUM0UCxRQUFSLEdBQW1CeFAsTUFBTSxDQUFDeVAsd0JBQTFCLEdBQXFEelAsTUFBTSxDQUFDMFAscUJBQXBFLENBQUE7TUFDQWpOLElBQUksSUFBSXpDLE1BQU0sQ0FBQzJQLFVBQWYsQ0FBQTtBQUNBbE4sTUFBQUEsSUFBSSxJQUFJekMsTUFBTSxDQUFDNFAsaUJBQVAsQ0FBeUJ2QyxPQUF6QixDQUFpQyxXQUFqQyxFQUE4Q3dDLFVBQVUsQ0FBQ0MsVUFBWCxDQUFzQmxRLE9BQU8sQ0FBQ21RLGtCQUE5QixDQUE5QyxDQUFSLENBQUE7QUFDSCxLQUpELE1BSU8sSUFBSW5RLE9BQU8sQ0FBQ21CLGdCQUFSLEtBQTZCLFVBQWpDLEVBQTZDO01BQ2hEMEIsSUFBSSxJQUFJekMsTUFBTSxDQUFDMlAsVUFBZixDQUFBO0FBQ0FsTixNQUFBQSxJQUFJLElBQUl6QyxNQUFNLENBQUNnUSxlQUFQLENBQXVCM0MsT0FBdkIsQ0FBK0IsV0FBL0IsRUFBNEN3QyxVQUFVLENBQUNDLFVBQVgsQ0FBc0JsUSxPQUFPLENBQUNtUSxrQkFBOUIsQ0FBNUMsQ0FBUixDQUFBO0FBQ0gsS0FITSxNQUdBLElBQUluUSxPQUFPLENBQUNtQixnQkFBUixLQUE2QixTQUFqQyxFQUE0QztNQUMvQzBCLElBQUksSUFBSTdDLE9BQU8sQ0FBQzRQLFFBQVIsR0FBbUJ4UCxNQUFNLENBQUN5UCx3QkFBMUIsR0FBcUR6UCxNQUFNLENBQUMwUCxxQkFBcEUsQ0FBQTtBQUNBak4sTUFBQUEsSUFBSSxJQUFJekMsTUFBTSxDQUFDaVEsZ0JBQVAsQ0FBd0I1QyxPQUF4QixDQUFnQyxXQUFoQyxFQUE2Q3dDLFVBQVUsQ0FBQ0MsVUFBWCxDQUFzQmxRLE9BQU8sQ0FBQ21RLGtCQUE5QixDQUE3QyxDQUFSLENBQUE7QUFDSCxLQUhNLE1BR0EsSUFBSW5RLE9BQU8sQ0FBQ21CLGdCQUFSLEtBQTZCLFdBQWpDLEVBQThDO0FBQ2pELE1BQUEsTUFBTW1QLEtBQUssR0FBR3ZRLE1BQU0sQ0FBQzJHLHFCQUFQLEdBQStCLEVBQS9CLEdBQW9DdEcsTUFBTSxDQUFDbVEsa0JBQTNDLEdBQWdFblEsTUFBTSxDQUFDb1EscUJBQXJGLENBQUE7QUFDQTNOLE1BQUFBLElBQUksSUFBSXlOLEtBQUssQ0FBQzdDLE9BQU4sQ0FBYyxXQUFkLEVBQTJCd0MsVUFBVSxDQUFDQyxVQUFYLENBQXNCbFEsT0FBTyxDQUFDbVEsa0JBQTlCLENBQTNCLENBQVIsQ0FBQTtBQUNILEtBQUE7O0lBRUQsSUFBSSxJQUFBLENBQUtqUCxXQUFULEVBQXNCO01BQ2xCLElBQUlsQixPQUFPLENBQUMyTCxTQUFaLEVBQXVCO1FBQ25COUksSUFBSSxJQUFJekMsTUFBTSxDQUFDcVEsY0FBZixDQUFBO0FBQ0gsT0FBQTs7TUFDRCxJQUFJelEsT0FBTyxDQUFDOEwsS0FBWixFQUFtQjtRQUNmakosSUFBSSxJQUFJekMsTUFBTSxDQUFDc1EsaUJBQWYsQ0FBQTtBQUNILE9BQUE7QUFDSixLQUFBOztJQUVELElBQUkxUSxPQUFPLENBQUMyUSxVQUFaLEVBQXdCO01BQ3BCLElBQUkzUSxPQUFPLENBQUNpQyxvQkFBWixFQUFrQztRQUM5QlksSUFBSSxJQUFJekMsTUFBTSxDQUFDd1EsbUJBQWYsQ0FBQTtBQUNILE9BRkQsTUFFTyxJQUFJLElBQUsxUCxDQUFBQSxXQUFULEVBQXNCO1FBQ3pCMkIsSUFBSSxJQUFJekMsTUFBTSxDQUFDeVEsZ0JBQWYsQ0FBQTtBQUNILE9BQUE7QUFDSixLQUFBOztJQUVELElBQUk3USxPQUFPLENBQUM4TCxLQUFaLEVBQW1CO01BQ2ZqSixJQUFJLElBQUl6QyxNQUFNLENBQUMwUSxZQUFmLENBQUE7QUFDSCxLQUFBOztJQUdELElBQUk5USxPQUFPLENBQUNpQix3QkFBWixFQUFzQztNQUdsQzRCLElBQUksSUFBSXpDLE1BQU0sQ0FBQzJRLHFCQUFmLENBQUE7TUFDQSxJQUFJL1EsT0FBTyxDQUFDZ1IsK0JBQVosRUFDSW5PLElBQUksSUFBSXpDLE1BQU0sQ0FBQzZRLHVCQUFmLENBQUE7O01BR0osSUFBSWpSLE9BQU8sQ0FBQ2tSLCtCQUFSLElBQTJDLENBQUNsUixPQUFPLENBQUMrTSxRQUF4RCxFQUFrRTtBQUM5RGYsUUFBQUEsY0FBYyxDQUFDZixXQUFELENBQWQsR0FBOEIsSUFBOUIsQ0FBQTtBQUNBZSxRQUFBQSxjQUFjLENBQUNWLFdBQUQsQ0FBZCxHQUE4QixJQUE5QixDQUFBO0FBQ0gsT0FBQTs7QUFDRGMsTUFBQUEscUJBQXFCLEdBQUcsSUFBeEIsQ0FBQTtBQUNILEtBQUE7O0FBRUQsSUFBQSxJQUFJSCxlQUFlLEdBQUcsQ0FBbEIsSUFBdUJqTSxPQUFPLENBQUNpQix3QkFBbkMsRUFBNkQ7QUFDekQsTUFBQSxJQUFJaUwsNEJBQUosRUFBa0M7UUFDOUJySixJQUFJLElBQUl6QyxNQUFNLENBQUMrUSxnQkFBZixDQUFBO0FBQ0gsT0FBQTs7QUFDRCxNQUFBLElBQUluRixjQUFjLENBQUNmLFdBQUQsQ0FBbEIsRUFBaUM7UUFDN0JwSSxJQUFJLElBQUl6QyxNQUFNLENBQUNnUixnQkFBZixDQUFBO0FBQ0gsT0FBQTs7TUFDRCxJQUFJcEYsY0FBYyxDQUFDVixXQUFELENBQWQsSUFBK0J2TCxNQUFNLENBQUNvRixNQUExQyxFQUFrRDtRQUM5Q3RDLElBQUksSUFBSXpDLE1BQU0sQ0FBQ2lSLG1CQUFmLENBQUE7QUFDSCxPQUFBOztBQUNELE1BQUEsSUFBSWxGLE1BQUosRUFBWTtRQUNSdEosSUFBSSxJQUFJekMsTUFBTSxDQUFDa1Isa0JBQWYsQ0FBQTs7QUFDQSxRQUFBLElBQUl0RixjQUFjLENBQUNiLFdBQUQsQ0FBbEIsRUFBaUM7VUFDN0J0SSxJQUFJLElBQUl6QyxNQUFNLENBQUNtUixZQUFmLENBQUE7QUFDSCxTQUFBOztBQUNELFFBQUEsSUFBSXZGLGNBQWMsQ0FBQ2pCLFlBQUQsQ0FBbEIsRUFBa0M7VUFDOUJsSSxJQUFJLElBQUk5QyxNQUFNLENBQUN5Uix5QkFBUCxHQUFtQ3BSLE1BQU0sQ0FBQ3FSLFlBQVAsQ0FBb0JoRSxPQUFwQixDQUE0QixLQUE1QixFQUFtQyxJQUFuQyxDQUFuQyxHQUE4RXJOLE1BQU0sQ0FBQ3NSLGFBQVAsQ0FBcUJqRSxPQUFyQixDQUE2QixLQUE3QixFQUFvQyxJQUFwQyxDQUF0RixDQUFBO0FBQ0gsU0FBQTs7QUFDRCxRQUFBLElBQUl6QixjQUFjLENBQUNuQixZQUFELENBQWxCLEVBQWtDO1VBQzlCaEksSUFBSSxJQUFJOUMsTUFBTSxDQUFDNFIscUJBQVAsR0FBK0J2UixNQUFNLENBQUNxUixZQUFQLENBQW9CaEUsT0FBcEIsQ0FBNEIsS0FBNUIsRUFBbUMsSUFBbkMsQ0FBL0IsR0FBMEVyTixNQUFNLENBQUNzUixhQUFQLENBQXFCakUsT0FBckIsQ0FBNkIsS0FBN0IsRUFBb0MsSUFBcEMsQ0FBbEYsQ0FBQTtBQUNILFNBQUE7QUFDSixPQUFBOztNQUVELElBQUksRUFBRTFOLE1BQU0sQ0FBQ29GLE1BQVAsSUFBaUJwRixNQUFNLENBQUNxRixzQkFBMUIsQ0FBSixFQUF1RDtRQUNuRHZDLElBQUksSUFBSXpDLE1BQU0sQ0FBQ3dSLFdBQWYsQ0FBQTtBQUNILE9BQUE7O0FBR0QvTyxNQUFBQSxJQUFJLElBQUl6QyxNQUFNLENBQUN5UixhQUFQLEdBQXVCelIsTUFBTSxDQUFDMFIsY0FBdEMsQ0FBQTtBQUNBLE1BQUEsSUFBSTFGLHFCQUFKLEVBQTJCdkosSUFBSSxJQUFJekMsTUFBTSxDQUFDMlIseUJBQWYsQ0FBQTtBQUM5QixLQUFBOztBQUVELElBQUEsSUFBSS9SLE9BQU8sQ0FBQzhCLGlCQUFaLEVBQStCZSxJQUFJLElBQUksc0NBQVIsQ0FBQTs7SUFFL0IsSUFBSSxJQUFBLENBQUtoQyxRQUFULEVBQW1CO01BQ2ZnQyxJQUFJLElBQUl6QyxNQUFNLENBQUM0UixxQkFBZixDQUFBO01BQ0EsSUFBSTNGLGFBQWEsSUFBSXJNLE9BQU8sQ0FBQ2lCLHdCQUE3QixFQUF1RDRCLElBQUksSUFBSXpDLE1BQU0sQ0FBQzZSLEdBQWYsQ0FBQTtBQUMxRCxLQUFBOztBQUVEcFAsSUFBQUEsSUFBSSxJQUFJLElBQVIsQ0FBQTtJQUVBLElBQUlxUCxhQUFhLEdBQUcsS0FBcEIsQ0FBQTs7SUFDQSxJQUFJbFMsT0FBTyxDQUFDb0IsV0FBWixFQUF5QjtNQUVyQixJQUFJLElBQUEsQ0FBS1AsUUFBVCxFQUFtQjtRQUNmZ0MsSUFBSSxJQUFJN0MsT0FBTyxDQUFDbVMsWUFBUixLQUF5QkMsY0FBekIsR0FBMENoUyxNQUFNLENBQUNpUyxvQkFBakQsR0FBeUVyUyxPQUFPLENBQUM4QixpQkFBUixHQUE0QjFCLE1BQU0sQ0FBQ2tTLHVCQUFuQyxHQUE2RGxTLE1BQU0sQ0FBQ21TLG9CQUFySixDQUFBO0FBQ0gsT0FBQTs7QUFFRCxNQUFBLElBQUksQ0FBQ3ZTLE9BQU8sQ0FBQzRMLFlBQVQsSUFBeUIsQ0FBQyxJQUFLMUssQ0FBQUEsV0FBL0IsSUFBOEMsQ0FBQ2xCLE9BQU8sQ0FBQ3dTLFVBQTNELEVBQXVFO0FBQ25FM1AsUUFBQUEsSUFBSSxJQUFJLHNDQUFSLENBQUE7QUFDQUEsUUFBQUEsSUFBSSxJQUFJLHlCQUFSLENBQUE7QUFDQXFQLFFBQUFBLGFBQWEsR0FBRyxJQUFoQixDQUFBO0FBQ0gsT0FBQTtBQUNKLEtBQUE7O0lBRURyUCxJQUFJLElBQUl6QyxNQUFNLENBQUNxUyxTQUFmLENBQUE7O0FBR0EsSUFBQSxJQUFJelMsT0FBTyxDQUFDMFMsUUFBUixJQUFvQjFTLE9BQU8sQ0FBQzJTLGdCQUFoQyxFQUFrRDtBQUM5QzlQLE1BQUFBLElBQUksSUFBSzdDLE9BQU8sQ0FBQ29CLFdBQVIsSUFBdUJwQixPQUFPLENBQUNnQixXQUFoQyxHQUErQ1osTUFBTSxDQUFDd1MsZ0JBQXRELEdBQXlFeFMsTUFBTSxDQUFDeVMsYUFBeEYsQ0FBQTtBQUNILEtBQUE7O0FBRUQsSUFBQSxNQUFNQyxVQUFVLEdBQUksQ0FBQzlTLE9BQU8sQ0FBQzBTLFFBQVQsSUFBcUIsQ0FBQzFTLE9BQU8sQ0FBQzJTLGdCQUEvQixJQUFvRDNTLE9BQU8sQ0FBQytTLHNCQUEvRSxDQUFBOztBQUVBLElBQUEsSUFBSUQsVUFBSixFQUFnQjtBQUNaLE1BQUEsSUFBSTlTLE9BQU8sQ0FBQ2dULGFBQVIsS0FBMEIsV0FBOUIsRUFBMkM7UUFDdkNuUSxJQUFJLElBQUl6QyxNQUFNLENBQUM2UyxXQUFmLENBQUE7QUFDSCxPQUZELE1BRU8sSUFBSWpULE9BQU8sQ0FBQ2dULGFBQVIsS0FBMEIsVUFBOUIsRUFBMEM7UUFDN0MsSUFBSWhULE9BQU8sQ0FBQ21CLGdCQUFSLEtBQTZCLFVBQTdCLElBQTJDbkIsT0FBTyxDQUFDbUIsZ0JBQVIsS0FBNkIsWUFBNUUsRUFBMEY7VUFDdEYwQixJQUFJLElBQUl6QyxNQUFNLENBQUMyUCxVQUFmLENBQUE7QUFDSCxTQUFBOztBQUNEbE4sUUFBQUEsSUFBSSxJQUFJekMsTUFBTSxDQUFDOFMsWUFBUCxDQUFvQnpGLE9BQXBCLENBQTRCLFdBQTVCLEVBQXlDd0MsVUFBVSxDQUFDQyxVQUFYLENBQXNCbFEsT0FBTyxDQUFDbVQsZUFBOUIsQ0FBekMsQ0FBUixDQUFBO0FBQ0gsT0FMTSxNQUtBO1FBQ0h0USxJQUFJLElBQUl6QyxNQUFNLENBQUNnVCxpQkFBZixDQUFBO0FBQ0gsT0FBQTtBQUNKLEtBQUE7O0FBRUQsSUFBQSxJQUFJcFQsT0FBTyxDQUFDcVQsV0FBUixJQUF1QixDQUFDbkIsYUFBNUIsRUFBMkM7QUFDdkNyUCxNQUFBQSxJQUFJLElBQUksa0NBQVIsQ0FBQTtBQUNILEtBQUE7O0lBRUQsSUFBSTdDLE9BQU8sQ0FBQ29ILElBQVosRUFBa0I7QUFDZCxNQUFBLElBQUksQ0FBQ3BILE9BQU8sQ0FBQ3FILGlCQUFiLEVBQWdDO0FBQzVCeEUsUUFBQUEsSUFBSSxJQUFJLG1DQUFSLENBQUE7QUFDSCxPQUFBOztNQUNEQSxJQUFJLElBQUl6QyxNQUFNLENBQUNrVCxNQUFmLENBQUE7QUFDSCxLQUFBOztJQUVELElBQUksSUFBQSxDQUFLM1IsV0FBVCxFQUFzQjtNQUNsQmtCLElBQUksSUFBSXpDLE1BQU0sQ0FBQ21ULFNBQWYsQ0FBQTs7TUFDQSxJQUFJdlQsT0FBTyxDQUFDb0IsV0FBWixFQUF5QjtRQUNyQnlCLElBQUksSUFBSzdDLE9BQU8sQ0FBQzhCLGlCQUFULEdBQThCMUIsTUFBTSxDQUFDb1QsY0FBckMsR0FBc0RwVCxNQUFNLENBQUNxVCxTQUFyRSxDQUFBO0FBQ0gsT0FBQTtBQUNKLEtBQUE7O0lBRUQsSUFBSUMsY0FBYyxHQUFHLEtBQXJCLENBQUE7SUFDQSxJQUFJQyxpQkFBaUIsR0FBRyxLQUF4QixDQUFBO0lBQ0EsSUFBSUMscUJBQXFCLEdBQUcsS0FBNUIsQ0FBQTtJQUNBLElBQUlDLFFBQVEsR0FBRyxLQUFmLENBQUE7SUFDQSxJQUFJQyxVQUFVLEdBQUcsS0FBakIsQ0FBQTtBQUNBLElBQUEsSUFBSUMsYUFBSixDQUFBOztBQUdBLElBQUEsSUFBSS9ULE9BQU8sQ0FBQ2lCLHdCQUFSLElBQW9DLElBQUEsQ0FBS0osUUFBN0MsRUFBdUQ7QUFFbkRnVCxNQUFBQSxRQUFRLEdBQUcsSUFBWCxDQUFBO0FBQ0FILE1BQUFBLGNBQWMsR0FBRyxJQUFqQixDQUFBO0FBQ0FDLE1BQUFBLGlCQUFpQixHQUFHLElBQXBCLENBQUE7QUFDQUcsTUFBQUEsVUFBVSxHQUFHLElBQWIsQ0FBQTtNQUVBalIsSUFBSSxJQUFJekMsTUFBTSxDQUFDNFQsZ0JBQWYsQ0FBQTtBQUVBLE1BQUEsSUFBSWhVLE9BQU8sQ0FBQ2lVLGdCQUFaLEVBQ0lwUixJQUFJLElBQUksdUNBQVIsQ0FBQTtBQUVKLE1BQUEsSUFBSTdDLE9BQU8sQ0FBQ2dSLCtCQUFaLEVBQ0luTyxJQUFJLElBQUksMkJBQVIsQ0FBQTs7TUFDSixJQUFJN0MsT0FBTyxDQUFDa1IsK0JBQVIsSUFBMkMsQ0FBQ2xSLE9BQU8sQ0FBQytNLFFBQXhELEVBQWtFO0FBQzlEbEssUUFBQUEsSUFBSSxJQUFJLDJCQUFSLENBQUE7QUFDQUEsUUFBQUEsSUFBSSxJQUFJLGdDQUFtQ3FSLEdBQUFBLGtCQUFrQixDQUFDbFUsT0FBTyxDQUFDbVUsMkJBQVQsQ0FBN0QsQ0FBQTtBQUNILE9BQUE7O0FBRUQsTUFBQSxJQUFJblUsT0FBTyxDQUFDeU0sa0NBQVosRUFDSTVKLElBQUksSUFBSSw4QkFBUixDQUFBO01BRUpBLElBQUksSUFBSXVSLFlBQVksQ0FBQ0MsYUFBckIsQ0FBQTs7TUFFQSxJQUFJclUsT0FBTyxDQUFDa1IsK0JBQVIsSUFBMkMsQ0FBQ2xSLE9BQU8sQ0FBQytNLFFBQXhELEVBQWtFO1FBQzlEbEssSUFBSSxJQUFJekMsTUFBTSxDQUFDa1UsdUJBQWYsQ0FBQTtBQUNILE9BQUE7O01BRUR6UixJQUFJLElBQUl6QyxNQUFNLENBQUNtVSxnQkFBZixDQUFBO0FBQ0gsS0FBQTs7QUFFRCxJQUFBLElBQUl2VSxPQUFPLENBQUN3VSxnQkFBWixFQUE4QjNSLElBQUksSUFBSSxpREFBUixDQUFBO0lBSTlCQSxJQUFJLElBQUksSUFBS29CLENBQUFBLGVBQUwsQ0FBcUJwQixJQUFyQixFQUEyQjlDLE1BQTNCLEVBQW1DSyxNQUFuQyxFQUEyQ0osT0FBM0MsQ0FBUixDQUFBOztJQUVBLElBQUksSUFBQSxDQUFLMkIsV0FBVCxFQUFzQjtNQUNsQixJQUFJM0IsT0FBTyxDQUFDd1UsZ0JBQVosRUFBOEI7QUFDMUIzUixRQUFBQSxJQUFJLElBQUksNElBQVIsQ0FBQTtBQUNILE9BRkQsTUFFTztBQUNIQSxRQUFBQSxJQUFJLElBQUksNkNBQVIsQ0FBQTtBQUNILE9BQUE7O0FBRUQsTUFBQSxJQUFJLENBQUM3QyxPQUFPLENBQUM2QixTQUFSLElBQXFCN0IsT0FBTyxDQUFDNkcsU0FBOUIsS0FBNEM3RyxPQUFPLENBQUM0RyxXQUF4RCxFQUFxRTtRQUNqRSxJQUFJNUcsT0FBTyxDQUFDd1UsZ0JBQVosRUFBOEI7QUFDMUIzUixVQUFBQSxJQUFJLElBQUksOEhBQVIsQ0FBQTtBQUNBQSxVQUFBQSxJQUFJLElBQUksaUlBQVIsQ0FBQTtBQUNILFNBSEQsTUFHTztBQUNIQSxVQUFBQSxJQUFJLElBQUksOEJBQVIsQ0FBQTtBQUNBQSxVQUFBQSxJQUFJLElBQUksZ0NBQVIsQ0FBQTtBQUNILFNBQUE7QUFDSixPQUFBOztBQUVEQSxNQUFBQSxJQUFJLElBQUkscUJBQVIsQ0FBQTs7QUFDQSxNQUFBLElBQUl1SyxNQUFKLEVBQVk7QUFDUnZLLFFBQUFBLElBQUksSUFBSSxpQkFBUixDQUFBO0FBQ0gsT0FBQTtBQUNKLEtBQUE7O0lBR0RBLElBQUksSUFBSSxLQUFLTCxZQUFiLENBQUE7O0lBR0EsSUFBSSxJQUFBLENBQUtiLFdBQVQsRUFBc0I7TUFDbEIsSUFBSTNCLE9BQU8sQ0FBQ29CLFdBQVosRUFBeUI7QUFDckJ5QixRQUFBQSxJQUFJLElBQUkscUJBQVIsQ0FBQTtBQUNILE9BQUE7O01BRUQsSUFBSTdDLE9BQU8sQ0FBQzJMLFNBQVosRUFBdUI7QUFDbkI5SSxRQUFBQSxJQUFJLElBQUksK0RBQVIsQ0FBQTtBQUNILE9BQUE7QUFDSixLQUFBOztJQUVELElBQUssSUFBQSxDQUFLaEMsUUFBTCxJQUFpQmIsT0FBTyxDQUFDb0IsV0FBMUIsSUFBMEMsSUFBS0YsQ0FBQUEsV0FBbkQsRUFBZ0U7TUFDNUQsSUFBSWxCLE9BQU8sQ0FBQzJPLFlBQVosRUFBMEI7QUFDdEI5TCxRQUFBQSxJQUFJLElBQUksK0JBQVIsQ0FBQTtBQUNILE9BQUE7O01BRUQsSUFBSTdDLE9BQU8sQ0FBQytMLFdBQVosRUFBeUI7QUFDckJsSixRQUFBQSxJQUFJLElBQUksMkRBQVIsQ0FBQTtBQUNILE9BQUE7QUFDSixLQUFBOztBQUVELElBQUEsSUFBSWlRLFVBQUosRUFBZ0I7QUFDWmpRLE1BQUFBLElBQUksSUFBSSxxQkFBUixDQUFBOztNQUdBLElBQUk3QyxPQUFPLENBQUN5VSxlQUFaLEVBQTZCO0FBQ3pCNVIsUUFBQUEsSUFBSSxJQUFLLENBQUE7QUFDekI7QUFDQTtBQUNBLGdCQUhnQixDQUFBLENBQUE7QUFJSCxPQUFBO0FBQ0osS0FBQTs7QUFFRCxJQUFBLElBQUk3QyxPQUFPLENBQUNxVCxXQUFSLElBQXVCLENBQUNuQixhQUE1QixFQUEyQztBQUN2Q3JQLE1BQUFBLElBQUksSUFBSSwwQ0FBUixDQUFBO0FBQ0gsS0FBQTs7QUFFRCxJQUFBLElBQUltTSxLQUFLLElBQUksQ0FBQ2hQLE9BQU8sQ0FBQzBVLGFBQXRCLEVBQXFDO0FBQ2pDN1IsTUFBQUEsSUFBSSxJQUFJLHlCQUFSLENBQUE7QUFDSCxLQUFBOztBQUVELElBQUEsSUFBSTdDLE9BQU8sQ0FBQzBTLFFBQVIsSUFBb0IxUyxPQUFPLENBQUMyUyxnQkFBaEMsRUFBa0Q7QUFDOUM5UCxNQUFBQSxJQUFJLElBQUksc0JBQVIsQ0FBQTtBQUNILEtBQUE7O0FBRUQsSUFBQSxJQUFJLElBQUtoQyxDQUFBQSxRQUFMLElBQWlCLElBQUEsQ0FBS0ssV0FBMUIsRUFBdUM7TUFDbkMsSUFBSSxJQUFBLENBQUtBLFdBQVQsRUFBc0I7UUFDbEIsSUFBSWxCLE9BQU8sQ0FBQzJMLFNBQVosRUFBdUI7QUFDbkI5SSxVQUFBQSxJQUFJLElBQUksMEJBQVIsQ0FBQTs7QUFDQSxVQUFBLElBQUk3QyxPQUFPLENBQUM0TCxZQUFSLEdBQXVCLENBQTNCLEVBQThCO0FBQzFCL0ksWUFBQUEsSUFBSSxJQUFJLDBFQUFSLENBQUE7QUFDQUEsWUFBQUEsSUFBSSxJQUFJLHNDQUFSLENBQUE7QUFDSCxXQUhELE1BR1E7QUFDSkEsWUFBQUEsSUFBSSxJQUFJLHdCQUFSLENBQUE7QUFDSCxXQUFBO0FBQ0osU0FBQTs7UUFDRCxJQUFJN0MsT0FBTyxDQUFDMlUsb0JBQVosRUFBa0M7QUFDOUI5UixVQUFBQSxJQUFJLElBQUksK0NBQVIsQ0FBQTtBQUNILFNBQUE7O1FBRUQsSUFBSTdDLE9BQU8sQ0FBQzhMLEtBQVosRUFBbUI7QUFDZmpKLFVBQUFBLElBQUksSUFBSSw2QkFBUixDQUFBO0FBQ0gsU0FBQTs7QUFHREEsUUFBQUEsSUFBSSxJQUFJLHdCQUFSLENBQUE7O0FBRUEsUUFBQSxJQUFJN0MsT0FBTyxDQUFDNEwsWUFBUixHQUF1QixDQUEzQixFQUE4QjtBQUMxQi9JLFVBQUFBLElBQUksSUFBSSw4RUFBUixDQUFBO0FBQ0gsU0FGRCxNQUVPO0FBQ0hBLFVBQUFBLElBQUksSUFBSSx3Q0FBUixDQUFBO0FBQ0gsU0FBQTs7UUFDRCxJQUFJN0MsT0FBTyxDQUFDMlUsb0JBQVosRUFBa0M7QUFDOUI5UixVQUFBQSxJQUFJLElBQUksOENBQVIsQ0FBQTtBQUNILFNBQUE7QUFDSixPQUFBOztBQUVELE1BQUEsSUFBSXdKLGFBQUosRUFBbUI7QUFFZnhKLFFBQUFBLElBQUksSUFBSSx1Q0FBUixDQUFBOztRQUlBLElBQUk3QyxPQUFPLENBQUNvQixXQUFaLEVBQXlCO0FBQ3JCeUIsVUFBQUEsSUFBSSxJQUFJLDZCQUFSLENBQUE7QUFDSCxTQUFBO0FBQ0osT0FBQTs7QUFFRCxNQUFBLEtBQUssSUFBSW1FLENBQUMsR0FBRyxDQUFiLEVBQWdCQSxDQUFDLEdBQUdoSCxPQUFPLENBQUNjLE1BQVIsQ0FBZUMsTUFBbkMsRUFBMkNpRyxDQUFDLEVBQTVDLEVBQWdEO0FBQzVDLFFBQUEsTUFBTTFDLEtBQUssR0FBR3RFLE9BQU8sQ0FBQ2MsTUFBUixDQUFla0csQ0FBZixDQUFkLENBQUE7QUFDQSxRQUFBLE1BQU15RCxTQUFTLEdBQUduRyxLQUFLLENBQUNVLEtBQXhCLENBQUE7O0FBR0EsUUFBQSxJQUFJaEYsT0FBTyxDQUFDaUIsd0JBQVIsSUFBb0N3SixTQUFTLEtBQUtPLHFCQUF0RCxFQUE2RTtBQUN6RSxVQUFBLFNBQUE7QUFDSCxTQUFBOztBQVVEK0ksUUFBQUEsYUFBYSxHQUFHLEtBQWhCLENBQUE7QUFFQSxRQUFBLE1BQU1sSCxVQUFVLEdBQUlSLGFBQWEsSUFBSS9ILEtBQUssQ0FBQ2lJLE1BQXhCLEdBQWtDakksS0FBSyxDQUFDZ0IsS0FBeEMsR0FBZ0RrSCxtQkFBbkUsQ0FBQTtBQUNBLFFBQUEsTUFBTW9JLFdBQVcsR0FBSXZJLGFBQWEsSUFBSS9ILEtBQUssQ0FBQ2lJLE1BQXhCLEdBQWtDLElBQUEsQ0FBS2xILDBCQUFMLENBQWdDd0gsVUFBaEMsQ0FBbEMsR0FBZ0YsRUFBcEcsQ0FBQTs7UUFFQSxJQUFJQSxVQUFVLEtBQUtMLG1CQUFuQixFQUF3QztBQUNwQzNKLFVBQUFBLElBQUksSUFBSSxVQUFhK1IsR0FBQUEsV0FBYixHQUEyQixtQkFBM0IsR0FBaUQ1TixDQUFqRCxHQUFxRCxrQkFBckQsR0FBMEVBLENBQTFFLEdBQThFLG1CQUE5RSxHQUFvR0EsQ0FBcEcsR0FBd0csaUJBQWhILENBQUE7QUFDSCxTQUFBOztRQUVELElBQUl5RCxTQUFTLEtBQUtPLHFCQUFsQixFQUF5QztBQUVyQ25JLFVBQUFBLElBQUksSUFBSSw0QkFBQSxHQUErQm1FLENBQS9CLEdBQW1DLGVBQTNDLENBQUE7QUFDQW5FLFVBQUFBLElBQUksSUFBSSxxQkFBUixDQUFBO0FBQ0gsU0FKRCxNQUlPO1VBRUgsSUFBSXlCLEtBQUssQ0FBQzJJLE9BQVYsRUFBbUI7WUFDZixJQUFJeEMsU0FBUyxLQUFLeEYsY0FBZCxJQUFnQyxDQUFDWCxLQUFLLENBQUMySSxPQUFOLENBQWNDLFFBQW5ELEVBQTZEO0FBQ3pENEcsY0FBQUEsVUFBVSxHQUFHLElBQWIsQ0FBQTtBQUNBQyxjQUFBQSxhQUFhLEdBQUcsSUFBaEIsQ0FBQTthQUZKLE1BR08sSUFBSXRKLFNBQVMsS0FBS1MsY0FBZCxJQUFnQzVHLEtBQUssQ0FBQzJJLE9BQU4sQ0FBY0MsUUFBbEQsRUFBNEQ7QUFDL0Q0RyxjQUFBQSxVQUFVLEdBQUcsSUFBYixDQUFBO0FBQ0FDLGNBQUFBLGFBQWEsR0FBRyxJQUFoQixDQUFBO0FBQ0gsYUFBQTtBQUNKLFdBQUE7O0FBRURsUixVQUFBQSxJQUFJLElBQUksNEJBQUEsR0FBK0JtRSxDQUEvQixHQUFtQyxlQUEzQyxDQUFBO0FBQ0EwTSxVQUFBQSxjQUFjLEdBQUcsSUFBakIsQ0FBQTs7QUFFQSxVQUFBLElBQUlLLGFBQUosRUFBbUI7WUFDZixJQUFJdEosU0FBUyxLQUFLeEYsY0FBbEIsRUFBa0M7Y0FDOUJwQyxJQUFJLElBQUksMkJBQStCeUIsSUFBQUEsS0FBSyxDQUFDdVEsY0FBTixHQUF1QixFQUF2QixHQUE0QixNQUEzRCxDQUFBLElBQXNFdlEsS0FBSyxDQUFDNkksZ0JBQU4sR0FBeUIsT0FBekIsR0FBbUMsRUFBekcsQ0FBK0csR0FBQSxRQUEvRyxHQUEwSG5HLENBQTFILEdBQThILGdCQUE5SCxHQUFpSkEsQ0FBakosR0FBcUosc0JBQXJKLEdBQThLQSxDQUE5SyxHQUFrTCxrQkFBbEwsSUFBd00xQyxLQUFLLENBQUM2SSxnQkFBTixHQUF5QixTQUFZbkcsR0FBQUEsQ0FBWixHQUFnQixzQkFBaEIsR0FBeUNBLENBQXpDLEdBQTZDLGVBQXRFLEdBQXdGLEVBQWhTLENBQUEsR0FBc1MsSUFBdFMsR0FBNlMxQyxLQUFLLENBQUN3USxjQUFuVCxHQUFvVSxLQUE1VSxDQUFBO0FBQ0gsYUFGRCxNQUVPO0FBQ0hqUyxjQUFBQSxJQUFJLElBQUksbUNBQXNDbUUsR0FBQUEsQ0FBdEMsR0FBMEMsZ0JBQTFDLEdBQTZEQSxDQUE3RCxHQUFpRSxzQkFBakUsR0FBMEZBLENBQTFGLEdBQThGLG9CQUE5RixHQUFxSDFDLEtBQUssQ0FBQ3dRLGNBQTNILEdBQTRJLEtBQXBKLENBQUE7QUFDSCxhQUFBO0FBQ0osV0FBQTs7VUFFRCxJQUFJakksVUFBVSxLQUFLTCxtQkFBbkIsRUFBd0M7QUFDcEMsWUFBQSxJQUFJbEksS0FBSyxDQUFDeVEsWUFBTixLQUF1QkMsbUJBQTNCLEVBQWdEO0FBQzVDblMsY0FBQUEsSUFBSSxJQUFJLHFDQUFBLEdBQXdDbUUsQ0FBeEMsR0FBNEMsYUFBcEQsQ0FBQTtBQUNBMk0sY0FBQUEsaUJBQWlCLEdBQUcsSUFBcEIsQ0FBQTtBQUNILGFBSEQsTUFHTztBQUNIOVEsY0FBQUEsSUFBSSxJQUFJLHlDQUFBLEdBQTRDbUUsQ0FBNUMsR0FBZ0QsYUFBeEQsQ0FBQTtBQUNBNE0sY0FBQUEscUJBQXFCLEdBQUcsSUFBeEIsQ0FBQTtBQUNILGFBQUE7QUFDSixXQVJELE1BUU87QUFFSC9RLFlBQUFBLElBQUksSUFBSSxxQ0FBQSxHQUF3Q21FLENBQXhDLEdBQTRDLGFBQXBELENBQUE7QUFDQTRNLFlBQUFBLHFCQUFxQixHQUFHLElBQXhCLENBQUE7QUFDSCxXQUFBOztBQUVEL1EsVUFBQUEsSUFBSSxJQUFJLCtCQUFSLENBQUE7O1VBRUEsSUFBSTRILFNBQVMsS0FBS3hGLGNBQWxCLEVBQWtDO1lBQzlCLElBQUksRUFBRThPLGFBQWEsSUFBSSxDQUFDelAsS0FBSyxDQUFDdVEsY0FBMUIsQ0FBSixFQUErQztBQUMzQ2hTLGNBQUFBLElBQUksSUFBSSxtQ0FBQSxHQUFzQ21FLENBQXRDLEdBQTBDLG1CQUExQyxHQUFnRUEsQ0FBaEUsR0FBb0Usd0JBQXBFLEdBQStGQSxDQUEvRixHQUFtRyxxQkFBM0csQ0FBQTtBQUNBNk0sY0FBQUEsUUFBUSxHQUFHLElBQVgsQ0FBQTtBQUNILGFBQUE7QUFDSixXQUFBO0FBQ0osU0FBQTs7UUFHRCxJQUFJaEgsVUFBVSxLQUFLTCxtQkFBbkIsRUFBd0M7VUFDcEMsSUFBSS9CLFNBQVMsS0FBS08scUJBQWxCLEVBQXlDO0FBRXJDbkksWUFBQUEsSUFBSSxJQUFJLG9DQUFSLENBQUE7QUFDSCxXQUhELE1BR087QUFFSEEsWUFBQUEsSUFBSSxJQUFJLG1CQUFBLEdBQXNCK1IsV0FBdEIsR0FBb0MsMEJBQTVDLENBQUE7QUFDSCxXQUFBO0FBQ0osU0FSRCxNQVFPO0FBQ0gvUixVQUFBQSxJQUFJLElBQUksb0NBQVIsQ0FBQTtBQUNILFNBQUE7O1FBRUQsSUFBSXlCLEtBQUssQ0FBQ3dJLFdBQU4sSUFBcUIsQ0FBQzlNLE9BQU8sQ0FBQytNLFFBQWxDLEVBQTRDO1VBQ3hDLElBQUlrSSxjQUFjLEdBQUcsSUFBckIsQ0FBQTtBQUNBLFVBQUEsSUFBSUMsT0FBSixDQUFBOztBQUNBLFVBQUEsSUFBSTVRLEtBQUssQ0FBQzBJLFdBQU4sS0FBc0I3QixXQUExQixFQUF1QztBQUNuQzhKLFlBQUFBLGNBQWMsR0FBRyxNQUFqQixDQUFBO0FBQ0FDLFlBQUFBLE9BQU8sR0FBRyxLQUFWLENBQUE7QUFDSCxXQUhELE1BR08sSUFBSTVRLEtBQUssQ0FBQzBJLFdBQU4sS0FBc0JqQyxZQUExQixFQUF3QztBQUMzQ2tLLFlBQUFBLGNBQWMsR0FBRyxPQUFqQixDQUFBO0FBQ0FDLFlBQUFBLE9BQU8sR0FBRyxNQUFWLENBQUE7QUFDSCxXQUhNLE1BR0EsSUFBSTVRLEtBQUssQ0FBQzBJLFdBQU4sS0FBc0JuQyxZQUExQixFQUF3QztBQUMzQ29LLFlBQUFBLGNBQWMsR0FBRyxPQUFqQixDQUFBOztZQUNBLElBQUlsVixNQUFNLENBQUMrSyx5QkFBWCxFQUFzQztBQUNsQ29LLGNBQUFBLE9BQU8sR0FBRyxNQUFWLENBQUE7QUFDSCxhQUZELE1BRU87QUFDSEEsY0FBQUEsT0FBTyxHQUFHLE1BQVYsQ0FBQTtBQUNILGFBQUE7QUFDSixXQVBNLE1BT0EsSUFBSTVRLEtBQUssQ0FBQzBJLFdBQU4sS0FBc0IxQixXQUExQixFQUF1QztBQUMxQzJKLFlBQUFBLGNBQWMsR0FBRyxRQUFqQixDQUFBO0FBQ0gsV0FGTSxNQUVBO0FBQ0hBLFlBQUFBLGNBQWMsR0FBRyxRQUFqQixDQUFBO0FBQ0gsV0FBQTs7VUFFRCxJQUFJQSxjQUFjLEtBQUssSUFBdkIsRUFBNkI7WUFDekIsSUFBSXhLLFNBQVMsS0FBS1MsY0FBbEIsRUFBa0M7Y0FDOUIsTUFBTTNHLGVBQWUsR0FBRyxRQUFXeUMsR0FBQUEsQ0FBWCxHQUFlLG1CQUFmLEdBQXFDQSxDQUFyQyxHQUF5QyxtQkFBakUsQ0FBQTs7Y0FDQSxJQUFJMUMsS0FBSyxDQUFDUSxpQkFBVixFQUE2QjtBQUN6QmpDLGdCQUFBQSxJQUFJLElBQUksbUNBQUEsR0FBc0NtRSxDQUF0QyxHQUEwQyxtQkFBbEQsQ0FBQTtBQUNILGVBQUE7O0FBQ0RuRSxjQUFBQSxJQUFJLElBQUssQ0FBa0JtRSxnQkFBQUEsRUFBQUEsQ0FBRSxvQkFBbUJpTyxjQUFlLENBQUEsRUFBRTFRLGVBQWdCLENBQWpGLENBQUEsQ0FBQTtBQUNBMUIsY0FBQUEsSUFBSSxJQUFLLENBQUEsNkJBQUEsRUFBK0JtRSxDQUFFLENBQUEsT0FBQSxFQUFTQSxDQUFFLENBQXJELG9CQUFBLENBQUEsQ0FBQTtBQUNILGFBUEQsTUFPTztBQUNILGNBQUEsTUFBTW5DLFlBQVksR0FBSSxDQUFPbUMsS0FBQUEsRUFBQUEsQ0FBRSxDQUEvQixhQUFBLENBQUEsQ0FBQTtBQUNBLGNBQUEsTUFBTXhDLGNBQWMsR0FBSSxDQUFPd0MsS0FBQUEsRUFBQUEsQ0FBRSxDQUFqQyxhQUFBLENBQUEsQ0FBQTtBQUNBbkUsY0FBQUEsSUFBSSxJQUFJLElBQUsrQixDQUFBQSw0QkFBTCxDQUFrQzdFLE1BQWxDLEVBQTBDQyxPQUFPLENBQUNjLE1BQVIsQ0FBZWtHLENBQWYsQ0FBMUMsRUFBNkRuQyxZQUE3RCxFQUEyRUwsY0FBM0UsRUFBMkZ3QyxDQUEzRixDQUFSLENBQUE7QUFFQSxjQUFBLElBQUl5RCxTQUFTLEtBQUt4RixjQUFsQixFQUFrQ2dRLGNBQWMsR0FBRyxTQUFTQSxjQUExQixDQUFBO0FBQ2xDcFMsY0FBQUEsSUFBSSxJQUFLLENBQWtCbUUsZ0JBQUFBLEVBQUFBLENBQUUsZUFBY2lPLGNBQWUsQ0FBQSxNQUFBLEVBQVFqTyxDQUFFLENBQW1CQSxpQkFBQUEsRUFBQUEsQ0FBRSxDQUFnQjFDLGFBQUFBLEVBQUFBLEtBQUssQ0FBQ1MsTUFBTixHQUFlLE9BQU9tUSxPQUF0QixHQUFnQyxFQUFJLENBQTdJLElBQUEsQ0FBQSxDQUFBO0FBQ0FyUyxjQUFBQSxJQUFJLElBQUssQ0FBQSw2QkFBQSxFQUErQm1FLENBQUUsQ0FBQSxPQUFBLEVBQVNBLENBQUUsQ0FBckQsb0JBQUEsQ0FBQSxDQUFBO0FBQ0gsYUFBQTtBQUNKLFdBQUE7QUFDSixTQUFBOztRQUVELElBQUk2RixVQUFVLEtBQUtMLG1CQUFuQixFQUF3QztBQUdwQyxVQUFBLElBQUl4TSxPQUFPLENBQUM2TCxjQUFSLElBQTBCN0wsT0FBTyxDQUFDb0IsV0FBdEMsRUFBbUQ7QUFDL0N5QixZQUFBQSxJQUFJLElBQUkscURBQUEsR0FBd0RtRSxDQUF4RCxHQUE0RCxRQUE1RCxJQUF3RStNLGFBQWEsR0FBRyxZQUFILEdBQWtCLEVBQXZHLENBQUEsR0FBNkcsNkJBQXJILENBQUE7QUFDSCxXQUZELE1BRU87QUFDSGxSLFlBQUFBLElBQUksSUFBSSxpREFBQSxHQUFvRG1FLENBQXBELEdBQXdELFFBQXhELElBQW9FK00sYUFBYSxHQUFHLFlBQUgsR0FBa0IsRUFBbkcsQ0FBQSxHQUF5RyxLQUFqSCxDQUFBO0FBQ0gsV0FBQTtBQUNKLFNBUkQsTUFRTztVQUdILElBQUkxSCxhQUFhLElBQUlyTSxPQUFPLENBQUM2TCxjQUF6QixJQUEyQzdMLE9BQU8sQ0FBQ29CLFdBQXZELEVBQW9FO0FBQ2hFeUIsWUFBQUEsSUFBSSxJQUFJLHlDQUFBLEdBQTRDbUUsQ0FBNUMsR0FBZ0QsUUFBaEQsSUFBNEQrTSxhQUFhLEdBQUcsWUFBSCxHQUFrQixFQUEzRixDQUFBLEdBQWlHLDZCQUF6RyxDQUFBO0FBQ0gsV0FGRCxNQUVPO0FBQ0hsUixZQUFBQSxJQUFJLElBQUkscUNBQUEsR0FBd0NtRSxDQUF4QyxHQUE0QyxRQUE1QyxJQUF3RCtNLGFBQWEsR0FBRyxZQUFILEdBQWtCLEVBQXZGLENBQUEsR0FBNkYsS0FBckcsQ0FBQTtBQUNILFdBQUE7QUFDSixTQUFBOztRQUVELElBQUkvVCxPQUFPLENBQUNvQixXQUFaLEVBQXlCO0FBQ3JCeUIsVUFBQUEsSUFBSSxJQUFJLDJEQUFSLENBQUE7QUFDSCxTQUFBOztRQUdELElBQUlnSyxVQUFVLEtBQUtMLG1CQUFuQixFQUF3QztVQUdwQyxJQUFJeE0sT0FBTyxDQUFDMkwsU0FBWixFQUF1QjlJLElBQUksSUFBSSw0Q0FBQSxHQUErQytSLFdBQS9DLEdBQTZELG9DQUE3RCxHQUFvRzVOLENBQXBHLEdBQXdHLFFBQXhHLElBQW9IK00sYUFBYSxHQUFHLFlBQUgsR0FBa0IsRUFBbkosQ0FBQSxHQUF5SixLQUFqSyxDQUFBO1VBQ3ZCLElBQUkvVCxPQUFPLENBQUNvQixXQUFaLEVBQXlCeUIsSUFBSSxJQUFJLDBDQUFBLEdBQTZDK1IsV0FBN0MsR0FBMkQsa0NBQTNELEdBQWdHNU4sQ0FBaEcsR0FBb0csUUFBcEcsSUFBZ0grTSxhQUFhLEdBQUcsWUFBSCxHQUFrQixFQUEvSSxDQUFBLEdBQXFKLEtBQTdKLENBQUE7QUFFNUIsU0FORCxNQU1PO1VBQ0gsSUFBSW9CLFdBQVcsR0FBRyxLQUFsQixDQUFBOztVQUNBLElBQUkxSyxTQUFTLEtBQUtPLHFCQUFkLElBQXVDaEwsT0FBTyxDQUFDNEwsWUFBUixHQUF1QixDQUFsRSxFQUFxRTtBQUNqRXVKLFlBQUFBLFdBQVcsR0FBRyxJQUFkLENBQUE7QUFDSCxXQUFBOztVQUdELElBQUluVixPQUFPLENBQUNvQixXQUFaLEVBQXlCO0FBQ3JCeUIsWUFBQUEsSUFBSSxJQUFJLG9FQUFBLEdBQXVFbUUsQ0FBdkUsR0FBMkUsUUFBbkYsQ0FBQTtBQUNBbkUsWUFBQUEsSUFBSSxJQUFJa1IsYUFBYSxHQUFHLFlBQUgsR0FBa0IsRUFBdkMsQ0FBQTtBQUNBbFIsWUFBQUEsSUFBSSxJQUFJc1MsV0FBVyxHQUFHLHdEQUFILEdBQThELGlCQUFqRixDQUFBO0FBQ0F0UyxZQUFBQSxJQUFJLElBQUksS0FBUixDQUFBO0FBQ0gsV0FBQTs7VUFDRCxJQUFJN0MsT0FBTyxDQUFDOEwsS0FBWixFQUFtQjtBQUNmakosWUFBQUEsSUFBSSxJQUFJLHlFQUFBLEdBQTRFbUUsQ0FBNUUsR0FBZ0YsUUFBeEYsQ0FBQTtBQUNBbkUsWUFBQUEsSUFBSSxJQUFJa1IsYUFBYSxHQUFHLFlBQUgsR0FBa0IsRUFBdkMsQ0FBQTtBQUNBbFIsWUFBQUEsSUFBSSxJQUFLLEtBQVQsQ0FBQTtBQUNILFdBQUE7O1VBQ0QsSUFBSTdDLE9BQU8sQ0FBQzJMLFNBQVosRUFBdUI7QUFDbkI5SSxZQUFBQSxJQUFJLElBQUksdUVBQUEsR0FBMEVtRSxDQUExRSxHQUE4RSxRQUF0RixDQUFBO0FBQ0FuRSxZQUFBQSxJQUFJLElBQUlrUixhQUFhLEdBQUcsWUFBSCxHQUFrQixFQUF2QyxDQUFBO0FBQ0FsUixZQUFBQSxJQUFJLElBQUlzUyxXQUFXLEdBQUcsMERBQUgsR0FBZ0UsRUFBbkYsQ0FBQTtBQUNBdFMsWUFBQUEsSUFBSSxJQUFLLEtBQVQsQ0FBQTtBQUNILFdBQUE7QUFDSixTQUFBOztRQUVELElBQUk0SCxTQUFTLEtBQUtPLHFCQUFsQixFQUF5QztBQUNyQ25JLFVBQUFBLElBQUksSUFBSSxTQUFSLENBQUE7QUFDSCxTQUFBOztBQUVEQSxRQUFBQSxJQUFJLElBQUksSUFBUixDQUFBO0FBQ0gsT0FBQTs7QUFHRCxNQUFBLElBQUk3QyxPQUFPLENBQUNpQix3QkFBUixJQUFvQyxJQUFBLENBQUtKLFFBQTdDLEVBQXVEO0FBQ25EOFMsUUFBQUEsaUJBQWlCLEdBQUcsSUFBcEIsQ0FBQTtBQUNBQyxRQUFBQSxxQkFBcUIsR0FBRyxJQUF4QixDQUFBO0FBQ0FGLFFBQUFBLGNBQWMsR0FBRyxJQUFqQixDQUFBO0FBQ0E3USxRQUFBQSxJQUFJLElBQUksNkJBQVIsQ0FBQTtBQUNILE9BQUE7O0FBRUQsTUFBQSxJQUFJd0osYUFBSixFQUFtQjtRQUVmLElBQUlyTSxPQUFPLENBQUMyTCxTQUFaLEVBQXVCO0FBQ25COUksVUFBQUEsSUFBSSxJQUFJLDRCQUFSLENBQUE7QUFDSCxTQUFBOztRQUNELElBQUk3QyxPQUFPLENBQUNvQixXQUFaLEVBQXlCO0FBQ3JCeUIsVUFBQUEsSUFBSSxJQUFJLCtCQUFSLENBQUE7QUFDSCxTQUFBO0FBQ0osT0FBQTs7TUFFRCxJQUFJN0MsT0FBTyxDQUFDMlEsVUFBWixFQUF3QjtBQUNwQjlOLFFBQUFBLElBQUksSUFBSSx3QkFBUixDQUFBO0FBQ0gsT0FBQTtBQUNKLEtBQUE7O0FBQ0RBLElBQUFBLElBQUksSUFBSSxJQUFSLENBQUE7O0FBRUEsSUFBQSxJQUFJbU0sS0FBSixFQUFXO01BQ1AsSUFBSWhQLE9BQU8sQ0FBQzBVLGFBQVosRUFBMkI7QUFDdkI3UixRQUFBQSxJQUFJLElBQUkseUJBQVIsQ0FBQTtBQUNILE9BQUE7O01BQ0QsSUFBSTdDLE9BQU8sQ0FBQ29QLGVBQVIsS0FBNEJDLFVBQTVCLElBQTBDclAsT0FBTyxDQUFDb1AsZUFBUixLQUE0Qkssc0JBQTFFLEVBQWtHO0FBQzlGNU0sUUFBQUEsSUFBSSxJQUFJLDBCQUFSLENBQUE7QUFDSCxPQUFBO0FBQ0osS0FBQTs7SUFFRCxJQUFJN0MsT0FBTyxDQUFDMlUsb0JBQVosRUFBa0M7QUFDOUI5UixNQUFBQSxJQUFJLElBQUksNkNBQVIsQ0FBQTtBQUNILEtBQUE7O0FBRUQsSUFBQSxJQUFJN0MsT0FBTyxDQUFDeUwsb0JBQVIsS0FBaUMsS0FBckMsRUFBNEM7TUFDeEMsSUFBSXpMLE9BQU8sQ0FBQ29WLFNBQVIsS0FBc0JDLFlBQXRCLElBQXNDclYsT0FBTyxDQUFDb1YsU0FBUixLQUFzQkUsbUJBQWhFLEVBQXFGO0FBQ2pGelMsUUFBQUEsSUFBSSxJQUFJLDRHQUFSLENBQUE7QUFDQUEsUUFBQUEsSUFBSSxJQUFJLHdJQUFSLENBQUE7QUFDQUEsUUFBQUEsSUFBSSxJQUFJLGtFQUFSLENBQUE7QUFDSCxPQUFBOztBQUNEQSxNQUFBQSxJQUFJLElBQUksaUNBQVIsQ0FBQTtBQUNILEtBQUE7O0lBRURBLElBQUksSUFBSXpDLE1BQU0sQ0FBQ21WLEtBQWYsQ0FBQTs7QUFDQSxJQUFBLElBQUl2VixPQUFPLENBQUNvVixTQUFSLEtBQXNCQyxZQUF0QixJQUFzQ3JWLE9BQU8sQ0FBQ29WLFNBQVIsS0FBc0JJLG1CQUE1RCxJQUFtRnhWLE9BQU8sQ0FBQ3lWLGVBQS9GLEVBQWdIO01BQzVHNVMsSUFBSSxJQUFJekMsTUFBTSxDQUFDc1YsYUFBZixDQUFBO0FBQ0gsS0FGRCxNQUVPLElBQUkxVixPQUFPLENBQUNvVixTQUFSLEtBQXNCRSxtQkFBMUIsRUFBK0M7TUFDbER6UyxJQUFJLElBQUl6QyxNQUFNLENBQUN1VixtQkFBZixDQUFBO0FBQ0gsS0FGTSxNQUVBO01BQ0g5UyxJQUFJLElBQUl6QyxNQUFNLENBQUN3VixtQkFBZixDQUFBO0FBQ0gsS0FBQTs7SUFFRCxJQUFJNVYsT0FBTyxDQUFDb0gsSUFBWixFQUFrQjtBQUNkdkUsTUFBQUEsSUFBSSxJQUFJLCtDQUFSLENBQUE7QUFDSCxLQUFBOztBQUVEQSxJQUFBQSxJQUFJLElBQUksSUFBUixDQUFBO0lBQ0FBLElBQUksSUFBSXdILEdBQUcsRUFBWCxDQUFBOztBQUVBLElBQUEsSUFBSXFKLGNBQUosRUFBb0I7QUFDaEI3USxNQUFBQSxJQUFJLEdBQUd6QyxNQUFNLENBQUN5VixlQUFQLEdBQXlCaFQsSUFBaEMsQ0FBQTtBQUNILEtBQUE7O0FBQ0QsSUFBQSxJQUFJOFEsaUJBQUosRUFBdUI7QUFDbkI5USxNQUFBQSxJQUFJLEdBQUd6QyxNQUFNLENBQUMwVixlQUFQLEdBQXlCalQsSUFBaEMsQ0FBQTtBQUNILEtBQUE7O0FBQ0QsSUFBQSxJQUFJK1EscUJBQUosRUFBMkI7QUFDdkIvUSxNQUFBQSxJQUFJLEdBQUd6QyxNQUFNLENBQUMyVixtQkFBUCxHQUE2QmxULElBQXBDLENBQUE7QUFDSCxLQUFBOztBQUNELElBQUEsSUFBSWdSLFFBQUosRUFBYztBQUNWaFIsTUFBQUEsSUFBSSxHQUFHekMsTUFBTSxDQUFDNFYsTUFBUCxHQUFnQm5ULElBQXZCLENBQUE7QUFDSCxLQUFBOztBQUNELElBQUEsSUFBSWlSLFVBQVUsSUFBSSxDQUFDOVQsT0FBTyxDQUFDaUIsd0JBQTNCLEVBQXFEO0FBRWpENEIsTUFBQUEsSUFBSSxHQUFHekMsTUFBTSxDQUFDNlYsUUFBUCxHQUFrQnBULElBQXpCLENBQUE7QUFDSCxLQUFBOztJQUNELElBQUlxVCxVQUFVLEdBQUcsRUFBakIsQ0FBQTtJQUNBLElBQUlyVCxJQUFJLENBQUNzVCxRQUFMLENBQWMsYUFBZCxDQUFKLEVBQWtDRCxVQUFVLElBQUkscUJBQWQsQ0FBQTtJQUNsQyxJQUFJclQsSUFBSSxDQUFDc1QsUUFBTCxDQUFjLE1BQWQsQ0FBSixFQUEyQkQsVUFBVSxJQUFJLGNBQWQsQ0FBQTtJQUMzQixJQUFJclQsSUFBSSxDQUFDc1QsUUFBTCxDQUFjLGdCQUFkLENBQUosRUFBcUNELFVBQVUsSUFBSSx3QkFBZCxDQUFBO0lBQ3JDLElBQUlyVCxJQUFJLENBQUNzVCxRQUFMLENBQWMsV0FBZCxDQUFKLEVBQWdDRCxVQUFVLElBQUksbUJBQWQsQ0FBQTtJQUNoQyxJQUFJclQsSUFBSSxDQUFDc1QsUUFBTCxDQUFjLFlBQWQsQ0FBSixFQUFpQ0QsVUFBVSxJQUFJLG9CQUFkLENBQUE7SUFDakMsSUFBSXJULElBQUksQ0FBQ3NULFFBQUwsQ0FBYyxXQUFkLENBQUosRUFBZ0NELFVBQVUsSUFBSSxtQkFBZCxDQUFBO0lBQ2hDLElBQUlyVCxJQUFJLENBQUNzVCxRQUFMLENBQWMsV0FBZCxDQUFKLEVBQWdDRCxVQUFVLElBQUksbUJBQWQsQ0FBQTtJQUNoQyxJQUFJclQsSUFBSSxDQUFDc1QsUUFBTCxDQUFjLFdBQWQsQ0FBSixFQUFnQ0QsVUFBVSxJQUFJLG1CQUFkLENBQUE7SUFDaEMsSUFBSXJULElBQUksQ0FBQ3NULFFBQUwsQ0FBYyxlQUFkLENBQUosRUFBb0NELFVBQVUsSUFBSSx1QkFBZCxDQUFBO0lBQ3BDLElBQUlyVCxJQUFJLENBQUNzVCxRQUFMLENBQWMsZ0JBQWQsQ0FBSixFQUFxQ0QsVUFBVSxJQUFJLHdCQUFkLENBQUE7SUFDckMsSUFBSXJULElBQUksQ0FBQ3NULFFBQUwsQ0FBYyxnQkFBZCxDQUFKLEVBQXFDRCxVQUFVLElBQUksd0JBQWQsQ0FBQTtJQUNyQyxJQUFJclQsSUFBSSxDQUFDc1QsUUFBTCxDQUFjLFlBQWQsQ0FBSixFQUFpQ0QsVUFBVSxJQUFJLG9CQUFkLENBQUE7SUFDakMsSUFBSXJULElBQUksQ0FBQ3NULFFBQUwsQ0FBYyxZQUFkLENBQUosRUFBaUNELFVBQVUsSUFBSSxvQkFBZCxDQUFBO0lBQ2pDLElBQUlyVCxJQUFJLENBQUNzVCxRQUFMLENBQWMsY0FBZCxDQUFKLEVBQW1DRCxVQUFVLElBQUksc0JBQWQsQ0FBQTtJQUNuQyxJQUFJclQsSUFBSSxDQUFDc1QsUUFBTCxDQUFjLFFBQWQsQ0FBSixFQUE2QkQsVUFBVSxJQUFJLGlCQUFkLENBQUE7SUFDN0IsSUFBSXJULElBQUksQ0FBQ3NULFFBQUwsQ0FBYyxTQUFkLENBQUosRUFBOEJELFVBQVUsSUFBSSxrQkFBZCxDQUFBO0lBQzlCLElBQUlyVCxJQUFJLENBQUNzVCxRQUFMLENBQWMsU0FBZCxDQUFKLEVBQThCRCxVQUFVLElBQUksaUJBQWQsQ0FBQTtJQUM5QixJQUFJclQsSUFBSSxDQUFDc1QsUUFBTCxDQUFjLE9BQWQsQ0FBSixFQUE0QkQsVUFBVSxJQUFJLGVBQWQsQ0FBQTtJQUM1QixJQUFJclQsSUFBSSxDQUFDc1QsUUFBTCxDQUFjLFdBQWQsQ0FBSixFQUFnQ0QsVUFBVSxJQUFJLG9CQUFkLENBQUE7SUFDaEMsSUFBSXJULElBQUksQ0FBQ3NULFFBQUwsQ0FBYyxjQUFkLENBQUosRUFBbUNELFVBQVUsSUFBSSxzQkFBZCxDQUFBO0lBQ25DLElBQUlyVCxJQUFJLENBQUNzVCxRQUFMLENBQWMsWUFBZCxDQUFKLEVBQWlDRCxVQUFVLElBQUksb0JBQWQsQ0FBQTtJQUNqQyxJQUFJclQsSUFBSSxDQUFDc1QsUUFBTCxDQUFjLGlCQUFkLENBQUosRUFBc0NELFVBQVUsSUFBSSx5QkFBZCxDQUFBO0lBQ3RDLElBQUlyVCxJQUFJLENBQUNzVCxRQUFMLENBQWMscUJBQWQsQ0FBSixFQUEwQ0QsVUFBVSxJQUFJLDhCQUFkLENBQUE7SUFDMUMsSUFBSXJULElBQUksQ0FBQ3NULFFBQUwsQ0FBYyxnQkFBZCxDQUFKLEVBQXFDRCxVQUFVLElBQUksd0JBQWQsQ0FBQTtJQUNyQyxJQUFJclQsSUFBSSxDQUFDc1QsUUFBTCxDQUFjLGFBQWQsQ0FBSixFQUFrQ0QsVUFBVSxJQUFJLHFCQUFkLENBQUE7SUFFbEMsTUFBTXJTLE1BQU0sR0FBRyxJQUFBLENBQUtpRyxlQUFMLEVBQUEsR0FDWCxJQUFLMUgsQ0FBQUEsUUFETSxHQUVYLElBQUEsQ0FBS3dCLGNBQUwsRUFGVyxJQUdWNUQsT0FBTyxDQUFDb1csV0FBUixHQUFzQmhXLE1BQU0sQ0FBQ2lXLGFBQTdCLEdBQTZDLEVBSG5DLENBSVhILEdBQUFBLFVBSlcsR0FLWCxJQUFBLENBQUs1VCxZQUxNLEdBTVhPLElBTkosQ0FBQTtBQVFBLElBQUEsT0FBT2dCLE1BQVAsQ0FBQTtBQUNILEdBQUE7O0VBRUR5UyxzQkFBc0IsQ0FBQ2hVLFlBQUQsRUFBZUMsWUFBZixFQUE2QkMsWUFBN0IsRUFBMkNDLFVBQTNDLEVBQXVEO0lBQ3pFLE1BQU16QyxPQUFPLEdBQUcsSUFBQSxDQUFLQSxPQUFyQixDQUFBO0lBRUEsSUFBS3NDLENBQUFBLFlBQUwsR0FBb0JBLFlBQXBCLENBQUE7SUFDQSxJQUFLQyxDQUFBQSxZQUFMLEdBQW9CQSxZQUFwQixDQUFBO0lBQ0EsSUFBS0MsQ0FBQUEsWUFBTCxHQUFvQkEsWUFBcEIsQ0FBQTtJQUNBLElBQUtDLENBQUFBLFVBQUwsR0FBa0JBLFVBQWxCLENBQUE7O0FBRUEsSUFBQSxJQUFJekMsT0FBTyxDQUFDMEIsSUFBUixLQUFpQjZVLFdBQXJCLEVBQWtDO0FBQzlCLE1BQUEsSUFBQSxDQUFLNVQsT0FBTCxHQUFlLElBQUt3SCxDQUFBQSxrQkFBTCxFQUFmLENBQUE7QUFDSCxLQUZELE1BRU8sSUFBSW5LLE9BQU8sQ0FBQzBCLElBQVIsS0FBaUJxRSxZQUFyQixFQUFtQztBQUN0QyxNQUFBLElBQUEsQ0FBS3BELE9BQUwsR0FBZSxJQUFLMkgsQ0FBQUEsbUJBQUwsRUFBZixDQUFBO0FBQ0gsS0FGTSxNQUVBLElBQUksSUFBSy9JLENBQUFBLFVBQVQsRUFBcUI7QUFDeEIsTUFBQSxJQUFBLENBQUtvQixPQUFMLEdBQWUsSUFBSzZILENBQUFBLG9CQUFMLEVBQWYsQ0FBQTtBQUNILEtBRk0sTUFFQSxJQUFJeEssT0FBTyxDQUFDd1csb0JBQVosRUFBa0M7QUFDckMsTUFBQSxJQUFBLENBQUs3VCxPQUFMLEdBQWUsSUFBQSxDQUFLbUgsZUFBTCxFQUF5QjlKLEdBQUFBLE9BQU8sQ0FBQ3dXLG9CQUFoRCxDQUFBO0FBQ0gsS0FGTSxNQUVBO0FBQ0gsTUFBQSxJQUFBLENBQUs3VCxPQUFMLEdBQWUsSUFBSzZJLENBQUFBLGlCQUFMLEVBQWYsQ0FBQTtBQUNILEtBQUE7QUFDSixHQUFBOztBQUVEaUwsRUFBQUEsYUFBYSxHQUFHO0FBQ1osSUFBQSxNQUFNNVMsTUFBTSxHQUFHO01BQ1g1RCxVQUFVLEVBQUUsS0FBS0EsVUFETjtNQUVYb0MsT0FBTyxFQUFFLEtBQUtBLE9BRkg7QUFHWE0sTUFBQUEsT0FBTyxFQUFFLElBQUtBLENBQUFBLE9BQUFBO0tBSGxCLENBQUE7O0lBTUEsSUFBSW5CLFVBQVUsQ0FBQ2tWLFNBQVgsQ0FBcUIsS0FBSzFXLE9BQUwsQ0FBYTBCLElBQWxDLENBQUosRUFBNkM7TUFDekNtQyxNQUFNLENBQUM4UyxHQUFQLEdBQWFDLGtCQUFiLENBQUE7QUFDSCxLQUFBOztBQUVELElBQUEsT0FBTy9TLE1BQVAsQ0FBQTtBQUNILEdBQUE7O0FBMzFDVzs7OzsifQ==
