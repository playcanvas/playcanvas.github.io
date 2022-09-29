/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
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
            code += "    ccFresnel = getFresnelCC(dot(dViewDirW, ccNormalW));\n";
            code += "    ccReflection.rgb *= ccFresnel;\n";
          } else {
            code += "    ccFresnel = 0.0;\n";
            code += "    ccReflection.rgb *= ccSpecularity;\n";
          }
        }

        if (options.useSpecularityFactor) {
          code += "    ccReflection.rgb *= dSpecularityFactor;\n";
        }

        if (options.sheen) {
          code += "    addReflectionSheen();\n";
          code += "    sReflection.rgb *= sSpecularity;\n";
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

          if (options.clearCoat) {
            code += "    ccSpecularLight += getLightSpecularCC(dHalfDirW) * dAtten * light" + i + "_color";
            code += usesCookieNow ? " * dAtten3" : "";
            code += calcFresnel ? " * getFresnel(dot(dViewDirW, dHalfDirW), vec3(ccSpecularity))" : " * vec3(ccSpecularity)";
            code += ";\n";
          }

          if (options.sheen) {
            code += "    sSpecularLight += getLightSpecularSheen(dHalfDirW) * dAtten * light" + i + "_color * sSpecularity";
            code += usesCookieNow ? " * dAtten3" : "";
            code += ";\n";
          }

          if (options.useSpecular) {
            code += "    dSpecularLight += getLightSpecular(dHalfDirW) * dAtten * light" + i + "_color";
            code += usesCookieNow ? " * dAtten3" : "";
            code += calcFresnel ? " * getFresnel(dot(dViewDirW, dHalfDirW), dSpecularity)" : " * dSpecularity";
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
        code += "#ifdef LIT_CLEARCOAT\n specLum += dot(ccSpecularLight * ccSpecularity + ccReflection.rgb * ccSpecularity, vec3( 0.2126, 0.7152, 0.0722 ));\n#endif\n";
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
    if (code.includes("sReflection")) structCode += "vec4 sReflection;\n";
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGl0LXNoYWRlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL2dyYXBoaWNzL3Byb2dyYW0tbGliL3Byb2dyYW1zL2xpdC1zaGFkZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtcbiAgICBTRU1BTlRJQ19BVFRSOCwgU0VNQU5USUNfQVRUUjksIFNFTUFOVElDX0FUVFIxMCwgU0VNQU5USUNfQVRUUjExLCBTRU1BTlRJQ19BVFRSMTIsIFNFTUFOVElDX0FUVFIxMywgU0VNQU5USUNfQVRUUjE0LCBTRU1BTlRJQ19BVFRSMTUsXG4gICAgU0VNQU5USUNfQkxFTkRJTkRJQ0VTLCBTRU1BTlRJQ19CTEVORFdFSUdIVCwgU0VNQU5USUNfQ09MT1IsIFNFTUFOVElDX05PUk1BTCwgU0VNQU5USUNfUE9TSVRJT04sIFNFTUFOVElDX1RBTkdFTlQsXG4gICAgU0VNQU5USUNfVEVYQ09PUkQwLCBTRU1BTlRJQ19URVhDT09SRDEsXG4gICAgU0hBREVSVEFHX01BVEVSSUFMLFxuICAgIFBJWEVMRk9STUFUX1I4X0c4X0I4X0E4XG59IGZyb20gJy4uLy4uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBzaGFkZXJDaHVua3MgfSBmcm9tICcuLi9jaHVua3MvY2h1bmtzLmpzJztcbmltcG9ydCB7IENodW5rVXRpbHMgfSBmcm9tICcuLi9jaHVuay11dGlscy5qcyc7XG5cbmltcG9ydCB7XG4gICAgQkxFTkRfQURESVRJVkVBTFBIQSwgQkxFTkRfTk9STUFMLCBCTEVORF9QUkVNVUxUSVBMSUVELFxuICAgIEZSRVNORUxfU0NITElDSyxcbiAgICBMSUdIVEZBTExPRkZfTElORUFSLFxuICAgIExJR0hUU0hBUEVfUFVOQ1RVQUwsIExJR0hUU0hBUEVfUkVDVCwgTElHSFRTSEFQRV9ESVNLLCBMSUdIVFNIQVBFX1NQSEVSRSxcbiAgICBMSUdIVFRZUEVfRElSRUNUSU9OQUwsIExJR0hUVFlQRV9PTU5JLCBMSUdIVFRZUEVfU1BPVCxcbiAgICBTSEFERVJfREVQVEgsIFNIQURFUl9QSUNLLFxuICAgIFNIQURPV19QQ0YzLCBTSEFET1dfUENGNSwgU0hBRE9XX1ZTTTgsIFNIQURPV19WU00xNiwgU0hBRE9XX1ZTTTMyLFxuICAgIFNQRUNPQ0NfQU8sIFNQRUNPQ0NfR0xPU1NERVBFTkRFTlQsXG4gICAgU1BFQ1VMQVJfUEhPTkcsXG4gICAgU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VELCBTUFJJVEVfUkVOREVSTU9ERV9USUxFRCwgc2hhZG93VHlwZVRvU3RyaW5nXG59IGZyb20gJy4uLy4uLy4uL3NjZW5lL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBMaWdodHNCdWZmZXIgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9saWdodGluZy9saWdodHMtYnVmZmVyLmpzJztcbmltcG9ydCB7IFNoYWRlclBhc3MgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9zaGFkZXItcGFzcy5qcyc7XG5cbmltcG9ydCB7IHZlcnRleEludHJvLCBmcmFnbWVudEludHJvLCBiZWdpbiwgZW5kLCBmb2dDb2RlLCBnYW1tYUNvZGUsIHNraW5Db2RlLCB0b25lbWFwQ29kZSB9IGZyb20gJy4vY29tbW9uLmpzJztcbmltcG9ydCB7IHZhbGlkYXRlVXNlckNodW5rcyB9IGZyb20gJy4uL2NodW5rcy9jaHVuay12YWxpZGF0aW9uLmpzJztcblxuY29uc3QgYnVpbHRpbkF0dHJpYnV0ZXMgPSB7XG4gICAgdmVydGV4X25vcm1hbDogU0VNQU5USUNfTk9STUFMLFxuICAgIHZlcnRleF90YW5nZW50OiBTRU1BTlRJQ19UQU5HRU5ULFxuICAgIHZlcnRleF90ZXhDb29yZDA6IFNFTUFOVElDX1RFWENPT1JEMCxcbiAgICB2ZXJ0ZXhfdGV4Q29vcmQxOiBTRU1BTlRJQ19URVhDT09SRDEsXG4gICAgdmVydGV4X2NvbG9yOiBTRU1BTlRJQ19DT0xPUixcbiAgICB2ZXJ0ZXhfYm9uZVdlaWdodHM6IFNFTUFOVElDX0JMRU5EV0VJR0hULFxuICAgIHZlcnRleF9ib25lSW5kaWNlczogU0VNQU5USUNfQkxFTkRJTkRJQ0VTXG59O1xuXG5jb25zdCBidWlsdGluVmFyeWluZ3MgPSB7XG4gICAgdlZlcnRleENvbG9yOiBcInZlYzRcIixcbiAgICB2UG9zaXRpb25XOiBcInZlYzNcIixcbiAgICB2Tm9ybWFsVjogXCJ2ZWMzXCIsXG4gICAgdk5vcm1hbFc6IFwidmVjM1wiLFxuICAgIHZUYW5nZW50VzogXCJ2ZWMzXCIsXG4gICAgdkJpbm9ybWFsVzogXCJ2ZWMzXCIsXG4gICAgdk9iamVjdFNwYWNlVXBXOiBcInZlYzNcIixcbiAgICB2VXYwOiBcInZlYzJcIixcbiAgICB2VXYxOiBcInZlYzJcIlxufTtcblxuY2xhc3MgTGl0U2hhZGVyIHtcbiAgICBjb25zdHJ1Y3RvcihkZXZpY2UsIG9wdGlvbnMpIHtcbiAgICAgICAgdGhpcy5kZXZpY2UgPSBkZXZpY2U7XG4gICAgICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG5cbiAgICAgICAgLy8gcmVzb2x2ZSBjdXN0b20gY2h1bmsgYXR0cmlidXRlc1xuICAgICAgICB0aGlzLmF0dHJpYnV0ZXMgPSB7XG4gICAgICAgICAgICB2ZXJ0ZXhfcG9zaXRpb246IFNFTUFOVElDX1BPU0lUSU9OXG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKG9wdGlvbnMuY2h1bmtzKSB7XG4gICAgICAgICAgICB0aGlzLmNodW5rcyA9IHt9O1xuXG4gICAgICAgICAgICBjb25zdCB1c2VyQ2h1bmtzID0gb3B0aW9ucy5jaHVua3M7XG5cbiAgICAgICAgICAgIC8vICNpZiBfREVCVUdcbiAgICAgICAgICAgIHZhbGlkYXRlVXNlckNodW5rcyhvcHRpb25zLmNodW5rcyk7XG4gICAgICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAgICAgZm9yIChjb25zdCBjaHVua05hbWUgaW4gc2hhZGVyQ2h1bmtzKSB7XG4gICAgICAgICAgICAgICAgaWYgKHVzZXJDaHVua3MuaGFzT3duUHJvcGVydHkoY2h1bmtOYW1lKSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjaHVuayA9IHVzZXJDaHVua3NbY2h1bmtOYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBhIGluIGJ1aWx0aW5BdHRyaWJ1dGVzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYnVpbHRpbkF0dHJpYnV0ZXMuaGFzT3duUHJvcGVydHkoYSkgJiYgY2h1bmsuaW5kZXhPZihhKSA+PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGVzW2FdID0gYnVpbHRpbkF0dHJpYnV0ZXNbYV07XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jaHVua3NbY2h1bmtOYW1lXSA9IGNodW5rO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY2h1bmtzW2NodW5rTmFtZV0gPSBzaGFkZXJDaHVua3NbY2h1bmtOYW1lXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmNodW5rcyA9IHNoYWRlckNodW5rcztcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMubGlnaHRpbmcgPSAob3B0aW9ucy5saWdodHMubGVuZ3RoID4gMCkgfHwgISFvcHRpb25zLmRpckxpZ2h0TWFwIHx8ICEhb3B0aW9ucy5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQ7XG4gICAgICAgIHRoaXMucmVmbGVjdGlvbnMgPSAhIW9wdGlvbnMucmVmbGVjdGlvblNvdXJjZTtcbiAgICAgICAgaWYgKCFvcHRpb25zLnVzZVNwZWN1bGFyKSBvcHRpb25zLnNwZWN1bGFyTWFwID0gb3B0aW9ucy5nbG9zc01hcCA9IG51bGw7XG4gICAgICAgIHRoaXMuc2hhZG93UGFzcyA9IFNoYWRlclBhc3MuaXNTaGFkb3cob3B0aW9ucy5wYXNzKTtcbiAgICAgICAgdGhpcy5uZWVkc05vcm1hbCA9IHRoaXMubGlnaHRpbmcgfHwgdGhpcy5yZWZsZWN0aW9ucyB8fCBvcHRpb25zLnVzZVNwZWN1bGFyIHx8IG9wdGlvbnMuYW1iaWVudFNIIHx8IG9wdGlvbnMuaGVpZ2h0TWFwIHx8IG9wdGlvbnMuZW5hYmxlR0dYU3BlY3VsYXIgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAob3B0aW9ucy5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQgJiYgIXRoaXMuc2hhZG93UGFzcykgfHwgb3B0aW9ucy5jbGVhckNvYXROb3JtYWxNYXA7XG4gICAgICAgIHRoaXMubmVlZHNTY2VuZUNvbG9yID0gb3B0aW9ucy51c2VEeW5hbWljUmVmcmFjdGlvbjtcbiAgICAgICAgdGhpcy5uZWVkc1NjcmVlblNpemUgPSBvcHRpb25zLnVzZUR5bmFtaWNSZWZyYWN0aW9uO1xuICAgICAgICB0aGlzLm5lZWRzVHJhbnNmb3JtcyA9IG9wdGlvbnMudXNlRHluYW1pY1JlZnJhY3Rpb247XG5cbiAgICAgICAgLy8gZ2VuZXJhdGVkIGJ5IHZzaGFkZXJcbiAgICAgICAgdGhpcy52YXJ5aW5ncyA9IFwiXCI7XG4gICAgICAgIHRoaXMudnNoYWRlciA9IG51bGw7XG5cbiAgICAgICAgLy8gc3VwcGxpZWQgYnkgY2FsbGVyXG4gICAgICAgIHRoaXMuZnJvbnRlbmREZWNsID0gbnVsbDtcbiAgICAgICAgdGhpcy5mcm9udGVuZENvZGUgPSBudWxsO1xuICAgICAgICB0aGlzLmZyb250ZW5kRnVuYyA9IG51bGw7XG4gICAgICAgIHRoaXMubGlnaHRpbmdVdiA9IG51bGw7XG5cbiAgICAgICAgLy8gZGVmaW5lcyBzZXQgYnkgdGhlIHNoYWRlciBnZW5lcmF0aW9uXG4gICAgICAgIHRoaXMuZGVmaW5lcyA9IFtdO1xuXG4gICAgICAgIC8vIGdlbmVyYXRlZCBieSBmc2hhZGVyXG4gICAgICAgIHRoaXMuZnNoYWRlciA9IG51bGw7XG4gICAgfVxuXG4gICAgX3ZzQWRkQmFzZUNvZGUoY29kZSwgY2h1bmtzLCBvcHRpb25zKSB7XG4gICAgICAgIGNvZGUgKz0gY2h1bmtzLmJhc2VWUztcbiAgICAgICAgaWYgKG9wdGlvbnMubmluZVNsaWNlZE1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1NMSUNFRCB8fFxuICAgICAgICAgICAgb3B0aW9ucy5uaW5lU2xpY2VkTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfVElMRUQpIHtcbiAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLmJhc2VOaW5lU2xpY2VkVlM7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNvZGU7XG4gICAgfVxuXG4gICAgX3ZzQWRkVHJhbnNmb3JtQ29kZShjb2RlLCBkZXZpY2UsIGNodW5rcywgb3B0aW9ucykge1xuICAgICAgICBjb2RlICs9IHRoaXMuY2h1bmtzLnRyYW5zZm9ybVZTO1xuICAgICAgICByZXR1cm4gY29kZTtcbiAgICB9XG5cbiAgICBfc2V0TWFwVHJhbnNmb3JtKGNvZGVzLCBuYW1lLCBpZCwgdXYpIHtcbiAgICAgICAgY29uc3QgY2hlY2tJZCA9IGlkICsgdXYgKiAxMDA7XG4gICAgICAgIGlmICghY29kZXNbM11bY2hlY2tJZF0pIHtcbiAgICAgICAgICAgIC8vIHVwbG9hZCBhIDN4MiBtYXRyaXggYW5kIG1hbnVhbGx5IHBlcmZvcm0gdGhlIG11bHRpcGxpY2F0aW9uXG4gICAgICAgICAgICBjb25zdCB2YXJOYW1lID0gYHRleHR1cmVfJHtuYW1lfU1hcFRyYW5zZm9ybWA7XG4gICAgICAgICAgICBjb2Rlc1swXSArPSBgdW5pZm9ybSB2ZWMzICR7dmFyTmFtZX0wO1xcbmA7XG4gICAgICAgICAgICBjb2Rlc1swXSArPSBgdW5pZm9ybSB2ZWMzICR7dmFyTmFtZX0xO1xcbmA7XG4gICAgICAgICAgICBjb2Rlc1sxXSArPSBgdmFyeWluZyB2ZWMyIHZVViR7dXZ9XyR7aWR9O1xcbmA7XG4gICAgICAgICAgICBjb2Rlc1syXSArPSBgICAgdlVWJHt1dn1fJHtpZH0gPSB2ZWMyKGRvdCh2ZWMzKHV2JHt1dn0sIDEpLCAke3Zhck5hbWV9MCksIGRvdCh2ZWMzKHV2JHt1dn0sIDEpLCAke3Zhck5hbWV9MSkpO1xcbmA7XG4gICAgICAgICAgICBjb2Rlc1szXVtjaGVja0lkXSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNvZGVzO1xuICAgIH1cblxuICAgIC8vIEFkZCBcIkJhc2VcIiBDb2RlIHNlY3Rpb24gdG8gZnJhZ21lbnQgc2hhZGVyLlxuICAgIF9mc0dldEJhc2VDb2RlKCkge1xuICAgICAgICBjb25zdCBvcHRpb25zID0gdGhpcy5vcHRpb25zO1xuICAgICAgICBjb25zdCBjaHVua3MgPSB0aGlzLmNodW5rcztcbiAgICAgICAgbGV0IHJlc3VsdCA9IHRoaXMuY2h1bmtzLmJhc2VQUztcbiAgICAgICAgaWYgKG9wdGlvbnMubmluZVNsaWNlZE1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1NMSUNFRCkge1xuICAgICAgICAgICAgcmVzdWx0ICs9IGNodW5rcy5iYXNlTmluZVNsaWNlZFBTO1xuICAgICAgICB9IGVsc2UgaWYgKG9wdGlvbnMubmluZVNsaWNlZE1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1RJTEVEKSB7XG4gICAgICAgICAgICByZXN1bHQgKz0gY2h1bmtzLmJhc2VOaW5lU2xpY2VkVGlsZWRQUztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIC8vIEFkZCBcIlN0YXJ0XCIgQ29kZSBzZWN0aW9uIHRvIGZyYWdtZW50IHNoYWRlci5cbiAgICBfZnNHZXRTdGFydENvZGUoY29kZSwgZGV2aWNlLCBjaHVua3MsIG9wdGlvbnMpIHtcbiAgICAgICAgbGV0IHJlc3VsdCA9IGNodW5rcy5zdGFydFBTO1xuICAgICAgICBpZiAob3B0aW9ucy5uaW5lU2xpY2VkTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VEKSB7XG4gICAgICAgICAgICByZXN1bHQgKz0gY2h1bmtzLnN0YXJ0TmluZVNsaWNlZFBTO1xuICAgICAgICB9IGVsc2UgaWYgKG9wdGlvbnMubmluZVNsaWNlZE1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1RJTEVEKSB7XG4gICAgICAgICAgICByZXN1bHQgKz0gY2h1bmtzLnN0YXJ0TmluZVNsaWNlZFRpbGVkUFM7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICAvLyBoYW5kbGVzIGRpcmVjdGlvbmFsIG1hcCBzaGFkb3cgY29vcmRpbmF0ZSBnZW5lcmF0aW9uLCBpbmNsdWRpbmcgY2FzY2FkZWQgc2hhZG93c1xuICAgIF9kaXJlY3Rpb25hbFNoYWRvd01hcFByb2plY3Rpb24obGlnaHQsIHNoYWRvd0Nvb3JkQXJncywgc2hhZG93UGFyYW1BcmcsIGxpZ2h0SW5kZXgsIGNvb3Jkc0Z1bmN0aW9uTmFtZSkge1xuXG4gICAgICAgIC8vIGZvciBzaGFkb3cgY2FzY2FkZXNcbiAgICAgICAgbGV0IGNvZGUgPSBcIlwiO1xuICAgICAgICBpZiAobGlnaHQubnVtQ2FzY2FkZXMgPiAxKSB7XG4gICAgICAgICAgICAvLyBjb21wdXRlIHdoaWNoIGNhc2NhZGUgbWF0cml4IG5lZWRzIHRvIGJlIHVzZWRcbiAgICAgICAgICAgIGNvZGUgKz0gYGdldFNoYWRvd0Nhc2NhZGVNYXRyaXgobGlnaHQke2xpZ2h0SW5kZXh9X3NoYWRvd01hdHJpeFBhbGV0dGUsIGxpZ2h0JHtsaWdodEluZGV4fV9zaGFkb3dDYXNjYWRlRGlzdGFuY2VzLCBsaWdodCR7bGlnaHRJbmRleH1fc2hhZG93Q2FzY2FkZUNvdW50KTtcXG5gO1xuICAgICAgICAgICAgc2hhZG93Q29vcmRBcmdzID0gYChjYXNjYWRlU2hhZG93TWF0LCAke3NoYWRvd1BhcmFtQXJnfSk7XFxuYDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHNoYWRvdyBjb29yZGluYXRlIGdlbmVyYXRpb25cbiAgICAgICAgY29kZSArPSBjb29yZHNGdW5jdGlvbk5hbWUgKyBzaGFkb3dDb29yZEFyZ3M7XG5cbiAgICAgICAgLy8gc3RvcCBzaGFkb3cgYXQgdGhlIGZhciBkaXN0YW5jZVxuICAgICAgICBjb2RlICs9IGBmYWRlU2hhZG93KGxpZ2h0JHtsaWdodEluZGV4fV9zaGFkb3dDYXNjYWRlRGlzdGFuY2VzKTtcXG5gO1xuICAgICAgICByZXR1cm4gY29kZTtcbiAgICB9XG5cbiAgICBfbm9uUG9pbnRTaGFkb3dNYXBQcm9qZWN0aW9uKGRldmljZSwgbGlnaHQsIHNoYWRvd01hdEFyZywgc2hhZG93UGFyYW1BcmcsIGxpZ2h0SW5kZXgpIHtcbiAgICAgICAgY29uc3Qgc2hhZG93Q29vcmRBcmdzID0gYCgke3NoYWRvd01hdEFyZ30sICR7c2hhZG93UGFyYW1Bcmd9KTtcXG5gO1xuICAgICAgICBpZiAoIWxpZ2h0Ll9ub3JtYWxPZmZzZXRCaWFzIHx8IGxpZ2h0Ll9pc1ZzbSkge1xuICAgICAgICAgICAgaWYgKGxpZ2h0Ll90eXBlID09PSBMSUdIVFRZUEVfU1BPVCkge1xuICAgICAgICAgICAgICAgIGlmIChsaWdodC5faXNQY2YgJiYgKGRldmljZS53ZWJnbDIgfHwgZGV2aWNlLmV4dFN0YW5kYXJkRGVyaXZhdGl2ZXMpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBcIiAgICAgICBnZXRTaGFkb3dDb29yZFBlcnNwWmJ1ZmZlclwiICsgc2hhZG93Q29vcmRBcmdzO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gXCIgICAgICAgZ2V0U2hhZG93Q29vcmRQZXJzcFwiICsgc2hhZG93Q29vcmRBcmdzO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2RpcmVjdGlvbmFsU2hhZG93TWFwUHJvamVjdGlvbihsaWdodCwgc2hhZG93Q29vcmRBcmdzLCBzaGFkb3dQYXJhbUFyZywgbGlnaHRJbmRleCwgXCJnZXRTaGFkb3dDb29yZE9ydGhvXCIpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChsaWdodC5fdHlwZSA9PT0gTElHSFRUWVBFX1NQT1QpIHtcbiAgICAgICAgICAgIGlmIChsaWdodC5faXNQY2YgJiYgKGRldmljZS53ZWJnbDIgfHwgZGV2aWNlLmV4dFN0YW5kYXJkRGVyaXZhdGl2ZXMpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFwiICAgICAgIGdldFNoYWRvd0Nvb3JkUGVyc3BaYnVmZmVyTm9ybWFsT2Zmc2V0XCIgKyBzaGFkb3dDb29yZEFyZ3M7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gXCIgICAgICAgZ2V0U2hhZG93Q29vcmRQZXJzcE5vcm1hbE9mZnNldFwiICsgc2hhZG93Q29vcmRBcmdzO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9kaXJlY3Rpb25hbFNoYWRvd01hcFByb2plY3Rpb24obGlnaHQsIHNoYWRvd0Nvb3JkQXJncywgc2hhZG93UGFyYW1BcmcsIGxpZ2h0SW5kZXgsIFwiZ2V0U2hhZG93Q29vcmRPcnRob05vcm1hbE9mZnNldFwiKTtcbiAgICB9XG5cbiAgICBfZ2V0TGlnaHRTb3VyY2VTaGFwZVN0cmluZyhzaGFwZSkge1xuICAgICAgICBzd2l0Y2ggKHNoYXBlKSB7XG4gICAgICAgICAgICBjYXNlIExJR0hUU0hBUEVfUkVDVDpcbiAgICAgICAgICAgICAgICByZXR1cm4gJ1JlY3QnO1xuICAgICAgICAgICAgY2FzZSBMSUdIVFNIQVBFX0RJU0s6XG4gICAgICAgICAgICAgICAgcmV0dXJuICdEaXNrJztcbiAgICAgICAgICAgIGNhc2UgTElHSFRTSEFQRV9TUEhFUkU6XG4gICAgICAgICAgICAgICAgcmV0dXJuICdTcGhlcmUnO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICByZXR1cm4gJyc7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZW5lcmF0ZVZlcnRleFNoYWRlcih1c2VVdiwgdXNlVW5tb2RpZmllZFV2LCBtYXBUcmFuc2Zvcm1zKSB7XG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuICAgICAgICBjb25zdCBvcHRpb25zID0gdGhpcy5vcHRpb25zO1xuICAgICAgICBjb25zdCBjaHVua3MgPSB0aGlzLmNodW5rcztcblxuICAgICAgICBsZXQgY29kZSA9ICcnO1xuICAgICAgICBsZXQgY29kZUJvZHkgPSAnJztcblxuICAgICAgICAvLyBjb2RlICs9IGNodW5rcy5iYXNlVlM7XG4gICAgICAgIGNvZGUgPSB0aGlzLl92c0FkZEJhc2VDb2RlKGNvZGUsIGNodW5rcywgb3B0aW9ucyk7XG5cbiAgICAgICAgY29kZUJvZHkgKz0gXCIgICB2UG9zaXRpb25XICAgID0gZ2V0V29ybGRQb3NpdGlvbigpO1xcblwiO1xuXG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMucGFzcyA9PT0gU0hBREVSX0RFUFRIKSB7XG4gICAgICAgICAgICBjb2RlICs9ICd2YXJ5aW5nIGZsb2F0IHZEZXB0aDtcXG4nO1xuICAgICAgICAgICAgY29kZSArPSAnI2lmbmRlZiBWSUVXTUFUUklYXFxuJztcbiAgICAgICAgICAgIGNvZGUgKz0gJyNkZWZpbmUgVklFV01BVFJJWFxcbic7XG4gICAgICAgICAgICBjb2RlICs9ICd1bmlmb3JtIG1hdDQgbWF0cml4X3ZpZXc7XFxuJztcbiAgICAgICAgICAgIGNvZGUgKz0gJyNlbmRpZlxcbic7XG4gICAgICAgICAgICBjb2RlICs9ICcjaWZuZGVmIENBTUVSQVBMQU5FU1xcbic7XG4gICAgICAgICAgICBjb2RlICs9ICcjZGVmaW5lIENBTUVSQVBMQU5FU1xcbic7XG4gICAgICAgICAgICBjb2RlICs9ICd1bmlmb3JtIHZlYzQgY2FtZXJhX3BhcmFtcztcXG5cXG4nO1xuICAgICAgICAgICAgY29kZSArPSAnI2VuZGlmXFxuJztcbiAgICAgICAgICAgIGNvZGVCb2R5ICs9IFwiICAgIHZEZXB0aCA9IC0obWF0cml4X3ZpZXcgKiB2ZWM0KHZQb3NpdGlvblcsMS4wKSkueiAqIGNhbWVyYV9wYXJhbXMueDtcXG5cIjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMudXNlSW5zdGFuY2luZykge1xuICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGVzLmluc3RhbmNlX2xpbmUxID0gU0VNQU5USUNfQVRUUjEyO1xuICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGVzLmluc3RhbmNlX2xpbmUyID0gU0VNQU5USUNfQVRUUjEzO1xuICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGVzLmluc3RhbmNlX2xpbmUzID0gU0VNQU5USUNfQVRUUjE0O1xuICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGVzLmluc3RhbmNlX2xpbmU0ID0gU0VNQU5USUNfQVRUUjE1O1xuICAgICAgICAgICAgY29kZSArPSBjaHVua3MuaW5zdGFuY2luZ1ZTO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMubmVlZHNOb3JtYWwpIHtcbiAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlcy52ZXJ0ZXhfbm9ybWFsID0gU0VNQU5USUNfTk9STUFMO1xuICAgICAgICAgICAgY29kZUJvZHkgKz0gXCIgICB2Tm9ybWFsVyA9IGdldE5vcm1hbCgpO1xcblwiO1xuXG4gICAgICAgICAgICBpZiAob3B0aW9ucy5yZWZsZWN0aW9uU291cmNlID09PSAnc3BoZXJlTWFwJyAmJiBkZXZpY2UuZnJhZ21lbnRVbmlmb3Jtc0NvdW50IDw9IDE2KSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBjaHVua3Mudmlld05vcm1hbFZTO1xuICAgICAgICAgICAgICAgIGNvZGVCb2R5ICs9IFwiICAgdk5vcm1hbFYgICAgPSBnZXRWaWV3Tm9ybWFsKCk7XFxuXCI7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zLmhhc1RhbmdlbnRzICYmIChvcHRpb25zLmhlaWdodE1hcCB8fCBvcHRpb25zLm5vcm1hbE1hcCB8fCBvcHRpb25zLmVuYWJsZUdHWFNwZWN1bGFyKSkge1xuICAgICAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlcy52ZXJ0ZXhfdGFuZ2VudCA9IFNFTUFOVElDX1RBTkdFTlQ7XG4gICAgICAgICAgICAgICAgY29kZSArPSBjaHVua3MudGFuZ2VudEJpbm9ybWFsVlM7XG4gICAgICAgICAgICAgICAgY29kZUJvZHkgKz0gXCIgICB2VGFuZ2VudFcgICA9IGdldFRhbmdlbnQoKTtcXG5cIjtcbiAgICAgICAgICAgICAgICBjb2RlQm9keSArPSBcIiAgIHZCaW5vcm1hbFcgID0gZ2V0Qmlub3JtYWwoKTtcXG5cIjtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAob3B0aW9ucy5lbmFibGVHR1hTcGVjdWxhcikge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLnRhbmdlbnRCaW5vcm1hbFZTO1xuICAgICAgICAgICAgICAgIGNvZGVCb2R5ICs9IFwiICAgdk9iamVjdFNwYWNlVXBXICA9IGdldE9iamVjdFNwYWNlVXAoKTtcXG5cIjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IG1heFV2U2V0cyA9IDI7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtYXhVdlNldHM7IGkrKykge1xuICAgICAgICAgICAgaWYgKHVzZVV2W2ldKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGVzW1widmVydGV4X3RleENvb3JkXCIgKyBpXSA9IFwiVEVYQ09PUkRcIiArIGk7XG4gICAgICAgICAgICAgICAgY29kZSArPSBjaHVua3NbXCJ1dlwiICsgaSArIFwiVlNcIl07XG4gICAgICAgICAgICAgICAgY29kZUJvZHkgKz0gXCIgICB2ZWMyIHV2XCIgKyBpICsgXCIgPSBnZXRVdlwiICsgaSArIFwiKCk7XFxuXCI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodXNlVW5tb2RpZmllZFV2W2ldKSB7XG4gICAgICAgICAgICAgICAgY29kZUJvZHkgKz0gXCIgICB2VXZcIiArIGkgKyBcIiA9IHV2XCIgKyBpICsgXCI7XFxuXCI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBjb2RlcyA9IFtjb2RlLCB0aGlzLnZhcnlpbmdzLCBjb2RlQm9keSwgW11dO1xuXG4gICAgICAgIG1hcFRyYW5zZm9ybXMuZm9yRWFjaCgobWFwVHJhbnNmb3JtKSA9PiB7XG4gICAgICAgICAgICB0aGlzLl9zZXRNYXBUcmFuc2Zvcm0oY29kZXMsIG1hcFRyYW5zZm9ybS5uYW1lLCBtYXBUcmFuc2Zvcm0uaWQsIG1hcFRyYW5zZm9ybS51dik7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvZGUgPSBjb2Rlc1swXTtcbiAgICAgICAgdGhpcy52YXJ5aW5ncyA9IGNvZGVzWzFdO1xuICAgICAgICBjb2RlQm9keSA9IGNvZGVzWzJdO1xuXG4gICAgICAgIGlmIChvcHRpb25zLnZlcnRleENvbG9ycykge1xuICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGVzLnZlcnRleF9jb2xvciA9IFNFTUFOVElDX0NPTE9SO1xuICAgICAgICAgICAgY29kZUJvZHkgKz0gXCIgICB2VmVydGV4Q29sb3IgPSB2ZXJ0ZXhfY29sb3I7XFxuXCI7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy5tc2RmICYmIG9wdGlvbnMubXNkZlRleHRBdHRyaWJ1dGUpIHtcbiAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlcy52ZXJ0ZXhfb3V0bGluZVBhcmFtZXRlcnMgPSBTRU1BTlRJQ19BVFRSODtcbiAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlcy52ZXJ0ZXhfc2hhZG93UGFyYW1ldGVycyA9IFNFTUFOVElDX0FUVFI5O1xuXG4gICAgICAgICAgICBjb2RlQm9keSArPSBcIiAgICB1bnBhY2tNc2RmUGFyYW1zKCk7XFxuXCI7XG5cbiAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLm1zZGZWUztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIG1vcnBoaW5nXG4gICAgICAgIGlmIChvcHRpb25zLnVzZU1vcnBoUG9zaXRpb24gfHwgb3B0aW9ucy51c2VNb3JwaE5vcm1hbCkge1xuXG4gICAgICAgICAgICBpZiAob3B0aW9ucy51c2VNb3JwaFRleHR1cmVCYXNlZCkge1xuXG4gICAgICAgICAgICAgICAgY29kZSArPSBcIiNkZWZpbmUgTU9SUEhJTkdfVEVYVFVSRV9CQVNFRFxcblwiO1xuXG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMudXNlTW9ycGhQb3NpdGlvbikge1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiI2RlZmluZSBNT1JQSElOR19URVhUVVJFX0JBU0VEX1BPU0lUSU9OXFxuXCI7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMudXNlTW9ycGhOb3JtYWwpIHtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiNkZWZpbmUgTU9SUEhJTkdfVEVYVFVSRV9CQVNFRF9OT1JNQUxcXG5cIjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyB2ZXJ0ZXggaWRzIGF0dHJpYnV0ZXNcbiAgICAgICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXMubW9ycGhfdmVydGV4X2lkID0gU0VNQU5USUNfQVRUUjE1O1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJhdHRyaWJ1dGUgZmxvYXQgbW9ycGhfdmVydGV4X2lkO1xcblwiO1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgLy8gc2V0IHVwIDggc2xvdHMgZm9yIG1vcnBoaW5nLiB0aGVzZSBhcmUgc3VwcG9ydGVkIGNvbWJpbmF0aW9uczogUFBQUFBQUFAsIE5OTk5OTk5OLCBQUFBQTk5OTlxuICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIjZGVmaW5lIE1PUlBISU5HXFxuXCI7XG5cbiAgICAgICAgICAgICAgICAvLyBmaXJzdCA0IHNsb3RzIGFyZSBlaXRoZXIgcG9zaXRpb24gb3Igbm9ybWFsXG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMudXNlTW9ycGhQb3NpdGlvbikge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXMubW9ycGhfcG9zMCA9IFNFTUFOVElDX0FUVFI4O1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXMubW9ycGhfcG9zMSA9IFNFTUFOVElDX0FUVFI5O1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXMubW9ycGhfcG9zMiA9IFNFTUFOVElDX0FUVFIxMDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGVzLm1vcnBoX3BvczMgPSBTRU1BTlRJQ19BVFRSMTE7XG5cbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiNkZWZpbmUgTU9SUEhJTkdfUE9TMDNcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcImF0dHJpYnV0ZSB2ZWMzIG1vcnBoX3BvczA7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJhdHRyaWJ1dGUgdmVjMyBtb3JwaF9wb3MxO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiYXR0cmlidXRlIHZlYzMgbW9ycGhfcG9zMjtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcImF0dHJpYnV0ZSB2ZWMzIG1vcnBoX3BvczM7XFxuXCI7XG5cbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKG9wdGlvbnMudXNlTW9ycGhOb3JtYWwpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGVzLm1vcnBoX25ybTAgPSBTRU1BTlRJQ19BVFRSODtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGVzLm1vcnBoX25ybTEgPSBTRU1BTlRJQ19BVFRSOTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGVzLm1vcnBoX25ybTIgPSBTRU1BTlRJQ19BVFRSMTA7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlcy5tb3JwaF9ucm0zID0gU0VNQU5USUNfQVRUUjExO1xuXG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIjZGVmaW5lIE1PUlBISU5HX05STTAzXFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJhdHRyaWJ1dGUgdmVjMyBtb3JwaF9ucm0wO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiYXR0cmlidXRlIHZlYzMgbW9ycGhfbnJtMTtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcImF0dHJpYnV0ZSB2ZWMzIG1vcnBoX25ybTI7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJhdHRyaWJ1dGUgdmVjMyBtb3JwaF9ucm0zO1xcblwiO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIG5leHQgNCBzbG90cyBhcmUgZWl0aGVyIHBvc2l0aW9uIG9yIG5vcm1hbFxuICAgICAgICAgICAgICAgIGlmICghb3B0aW9ucy51c2VNb3JwaE5vcm1hbCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXMubW9ycGhfcG9zNCA9IFNFTUFOVElDX0FUVFIxMjtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGVzLm1vcnBoX3BvczUgPSBTRU1BTlRJQ19BVFRSMTM7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlcy5tb3JwaF9wb3M2ID0gU0VNQU5USUNfQVRUUjE0O1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXMubW9ycGhfcG9zNyA9IFNFTUFOVElDX0FUVFIxNTtcblxuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiI2RlZmluZSBNT1JQSElOR19QT1M0N1xcblwiO1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiYXR0cmlidXRlIHZlYzMgbW9ycGhfcG9zNDtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcImF0dHJpYnV0ZSB2ZWMzIG1vcnBoX3BvczU7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJhdHRyaWJ1dGUgdmVjMyBtb3JwaF9wb3M2O1xcblwiO1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiYXR0cmlidXRlIHZlYzMgbW9ycGhfcG9zNztcXG5cIjtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXMubW9ycGhfbnJtNCA9IFNFTUFOVElDX0FUVFIxMjtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGVzLm1vcnBoX25ybTUgPSBTRU1BTlRJQ19BVFRSMTM7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlcy5tb3JwaF9ucm02ID0gU0VNQU5USUNfQVRUUjE0O1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXMubW9ycGhfbnJtNyA9IFNFTUFOVElDX0FUVFIxNTtcblxuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiI2RlZmluZSBNT1JQSElOR19OUk00N1xcblwiO1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiYXR0cmlidXRlIHZlYzMgbW9ycGhfbnJtNDtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcImF0dHJpYnV0ZSB2ZWMzIG1vcnBoX25ybTU7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJhdHRyaWJ1dGUgdmVjMyBtb3JwaF9ucm02O1xcblwiO1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiYXR0cmlidXRlIHZlYzMgbW9ycGhfbnJtNztcXG5cIjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy5za2luKSB7XG4gICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXMudmVydGV4X2JvbmVXZWlnaHRzID0gU0VNQU5USUNfQkxFTkRXRUlHSFQ7XG4gICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXMudmVydGV4X2JvbmVJbmRpY2VzID0gU0VNQU5USUNfQkxFTkRJTkRJQ0VTO1xuICAgICAgICAgICAgY29kZSArPSBza2luQ29kZShkZXZpY2UsIGNodW5rcyk7XG4gICAgICAgICAgICBjb2RlICs9IFwiI2RlZmluZSBTS0lOXFxuXCI7XG4gICAgICAgIH0gZWxzZSBpZiAob3B0aW9ucy51c2VJbnN0YW5jaW5nKSB7XG4gICAgICAgICAgICBjb2RlICs9IFwiI2RlZmluZSBJTlNUQU5DSU5HXFxuXCI7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9wdGlvbnMuc2NyZWVuU3BhY2UpIHtcbiAgICAgICAgICAgIGNvZGUgKz0gXCIjZGVmaW5lIFNDUkVFTlNQQUNFXFxuXCI7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9wdGlvbnMucGl4ZWxTbmFwKSB7XG4gICAgICAgICAgICBjb2RlICs9IFwiI2RlZmluZSBQSVhFTFNOQVBcXG5cIjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvZGUgPSB0aGlzLl92c0FkZFRyYW5zZm9ybUNvZGUoY29kZSwgZGV2aWNlLCBjaHVua3MsIG9wdGlvbnMpO1xuXG4gICAgICAgIGlmICh0aGlzLm5lZWRzTm9ybWFsKSB7XG4gICAgICAgICAgICBjb2RlICs9IGNodW5rcy5ub3JtYWxWUztcbiAgICAgICAgfVxuXG4gICAgICAgIGNvZGUgKz0gXCJcXG5cIjtcbiAgICAgICAgY29kZSArPSBjaHVua3Muc3RhcnRWUztcbiAgICAgICAgY29kZSArPSBjb2RlQm9keTtcbiAgICAgICAgY29kZSArPSBjaHVua3MuZW5kVlM7XG4gICAgICAgIGNvZGUgKz0gXCJ9XCI7XG5cbiAgICAgICAgLy8gYnVpbGQgdmFyeWluZ3NcbiAgICAgICAgT2JqZWN0LmtleXMoYnVpbHRpblZhcnlpbmdzKS5mb3JFYWNoKCh2KSA9PiB7XG4gICAgICAgICAgICBpZiAoY29kZS5pbmRleE9mKHYpID49IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLnZhcnlpbmdzICs9IGB2YXJ5aW5nICR7YnVpbHRpblZhcnlpbmdzW3ZdfSAke3Z9O1xcbmA7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IHN0YXJ0Q29kZSA9IHZlcnRleEludHJvKGRldmljZSwgJ0xpdFNoYWRlcicsIHRoaXMub3B0aW9ucy5wYXNzLCBjaHVua3MuZXh0ZW5zaW9uVlMpO1xuICAgICAgICB0aGlzLnZzaGFkZXIgPSBzdGFydENvZGUgKyB0aGlzLnZhcnlpbmdzICsgY29kZTtcbiAgICB9XG5cbiAgICBfZnNHZXRCZWdpbkNvZGUoKSB7XG5cbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG4gICAgICAgIGNvbnN0IGNodW5rcyA9IHRoaXMuY2h1bmtzO1xuXG4gICAgICAgIGNvbnN0IHByZWNpc2lvbiA9IHRoaXMub3B0aW9ucy5mb3JjZUZyYWdtZW50UHJlY2lzaW9uO1xuICAgICAgICBsZXQgY29kZSA9IGZyYWdtZW50SW50cm8oZGV2aWNlLCAnTGl0U2hhZGVyJywgdGhpcy5vcHRpb25zLnBhc3MsIGNodW5rcy5leHRlbnNpb25QUywgcHJlY2lzaW9uKTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuZGVmaW5lcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29kZSArPSBgI2RlZmluZSAke3RoaXMuZGVmaW5lc1tpXX1cXG5gO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGNvZGU7XG4gICAgfVxuXG4gICAgX2ZzR2V0UGlja1Bhc3NDb2RlKCkge1xuICAgICAgICBsZXQgY29kZSA9IHRoaXMuX2ZzR2V0QmVnaW5Db2RlKCk7XG4gICAgICAgIGNvZGUgKz0gXCJ1bmlmb3JtIHZlYzQgdUNvbG9yO1xcblwiO1xuICAgICAgICBjb2RlICs9IHRoaXMudmFyeWluZ3M7XG4gICAgICAgIGNvZGUgKz0gdGhpcy5mcm9udGVuZERlY2w7XG4gICAgICAgIGNvZGUgKz0gdGhpcy5mcm9udGVuZENvZGU7XG4gICAgICAgIGNvZGUgKz0gYmVnaW4oKTtcbiAgICAgICAgY29kZSArPSB0aGlzLmZyb250ZW5kRnVuYztcbiAgICAgICAgY29kZSArPSBcIiAgICBnbF9GcmFnQ29sb3IgPSB1Q29sb3I7XFxuXCI7XG4gICAgICAgIGNvZGUgKz0gZW5kKCk7XG4gICAgICAgIHJldHVybiBjb2RlO1xuICAgIH1cblxuICAgIF9mc0dldERlcHRoUGFzc0NvZGUoKSB7XG4gICAgICAgIGNvbnN0IGNodW5rcyA9IHRoaXMuY2h1bmtzO1xuXG4gICAgICAgIGxldCBjb2RlID0gdGhpcy5fZnNHZXRCZWdpbkNvZGUoKTtcblxuICAgICAgICBjb2RlICs9ICd2YXJ5aW5nIGZsb2F0IHZEZXB0aDtcXG4nO1xuICAgICAgICBjb2RlICs9IHRoaXMudmFyeWluZ3M7XG4gICAgICAgIGNvZGUgKz0gY2h1bmtzLnBhY2tEZXB0aFBTO1xuICAgICAgICBjb2RlICs9IHRoaXMuZnJvbnRlbmREZWNsO1xuICAgICAgICBjb2RlICs9IHRoaXMuZnJvbnRlbmRDb2RlO1xuICAgICAgICBjb2RlICs9IGJlZ2luKCk7XG4gICAgICAgIGNvZGUgKz0gdGhpcy5mcm9udGVuZEZ1bmM7XG4gICAgICAgIGNvZGUgKz0gXCIgICAgZ2xfRnJhZ0NvbG9yID0gcGFja0Zsb2F0KHZEZXB0aCk7XFxuXCI7XG4gICAgICAgIGNvZGUgKz0gZW5kKCk7XG5cbiAgICAgICAgcmV0dXJuIGNvZGU7XG4gICAgfVxuXG4gICAgX2ZzR2V0U2hhZG93UGFzc0NvZGUoKSB7XG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuICAgICAgICBjb25zdCBvcHRpb25zID0gdGhpcy5vcHRpb25zO1xuICAgICAgICBjb25zdCBjaHVua3MgPSB0aGlzLmNodW5rcztcbiAgICAgICAgY29uc3QgdmFyeWluZ3MgPSB0aGlzLnZhcnlpbmdzO1xuXG4gICAgICAgIGNvbnN0IGxpZ2h0VHlwZSA9IFNoYWRlclBhc3MudG9MaWdodFR5cGUob3B0aW9ucy5wYXNzKTtcbiAgICAgICAgY29uc3Qgc2hhZG93VHlwZSA9IFNoYWRlclBhc3MudG9TaGFkb3dUeXBlKG9wdGlvbnMucGFzcyk7XG5cbiAgICAgICAgbGV0IGNvZGUgPSB0aGlzLl9mc0dldEJlZ2luQ29kZSgpO1xuXG4gICAgICAgIGlmIChkZXZpY2UuZXh0U3RhbmRhcmREZXJpdmF0aXZlcyAmJiAhZGV2aWNlLndlYmdsMikge1xuICAgICAgICAgICAgY29kZSArPSAndW5pZm9ybSB2ZWMyIHBvbHlnb25PZmZzZXQ7XFxuJztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzaGFkb3dUeXBlID09PSBTSEFET1dfVlNNMzIpIHtcbiAgICAgICAgICAgIGlmIChkZXZpY2UudGV4dHVyZUZsb2F0SGlnaFByZWNpc2lvbikge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gJyNkZWZpbmUgVlNNX0VYUE9ORU5UIDE1LjBcXG5cXG4nO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb2RlICs9ICcjZGVmaW5lIFZTTV9FWFBPTkVOVCA1LjU0XFxuXFxuJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChzaGFkb3dUeXBlID09PSBTSEFET1dfVlNNMTYpIHtcbiAgICAgICAgICAgIGNvZGUgKz0gJyNkZWZpbmUgVlNNX0VYUE9ORU5UIDUuNTRcXG5cXG4nO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGxpZ2h0VHlwZSAhPT0gTElHSFRUWVBFX0RJUkVDVElPTkFMKSB7XG4gICAgICAgICAgICBjb2RlICs9ICd1bmlmb3JtIHZlYzMgdmlld19wb3NpdGlvbjtcXG4nO1xuICAgICAgICAgICAgY29kZSArPSAndW5pZm9ybSBmbG9hdCBsaWdodF9yYWRpdXM7XFxuJztcbiAgICAgICAgfVxuXG4gICAgICAgIGNvZGUgKz0gdmFyeWluZ3M7XG4gICAgICAgIGNvZGUgKz0gdGhpcy5mcm9udGVuZERlY2w7XG4gICAgICAgIGNvZGUgKz0gdGhpcy5mcm9udGVuZENvZGU7XG5cbiAgICAgICAgaWYgKHNoYWRvd1R5cGUgPT09IFNIQURPV19QQ0YzICYmICghZGV2aWNlLndlYmdsMiB8fCBsaWdodFR5cGUgPT09IExJR0hUVFlQRV9PTU5JKSkge1xuICAgICAgICAgICAgY29kZSArPSBjaHVua3MucGFja0RlcHRoUFM7XG4gICAgICAgIH0gZWxzZSBpZiAoc2hhZG93VHlwZSA9PT0gU0hBRE9XX1ZTTTgpIHtcbiAgICAgICAgICAgIGNvZGUgKz0gXCJ2ZWMyIGVuY29kZUZsb2F0UkcoIGZsb2F0IHYgKSB7XFxuXCI7XG4gICAgICAgICAgICBjb2RlICs9IFwiICAgIHZlYzIgZW5jID0gdmVjMigxLjAsIDI1NS4wKSAqIHY7XFxuXCI7XG4gICAgICAgICAgICBjb2RlICs9IFwiICAgIGVuYyA9IGZyYWN0KGVuYyk7XFxuXCI7XG4gICAgICAgICAgICBjb2RlICs9IFwiICAgIGVuYyAtPSBlbmMueXkgKiB2ZWMyKDEuMC8yNTUuMCwgMS4wLzI1NS4wKTtcXG5cIjtcbiAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgcmV0dXJuIGVuYztcXG5cIjtcbiAgICAgICAgICAgIGNvZGUgKz0gXCJ9XFxuXFxuXCI7XG4gICAgICAgIH1cblxuICAgICAgICBjb2RlICs9IGJlZ2luKCk7XG5cbiAgICAgICAgY29kZSArPSB0aGlzLmZyb250ZW5kRnVuYztcblxuICAgICAgICBjb25zdCBpc1ZzbSA9IHNoYWRvd1R5cGUgPT09IFNIQURPV19WU004IHx8IHNoYWRvd1R5cGUgPT09IFNIQURPV19WU00xNiB8fCBzaGFkb3dUeXBlID09PSBTSEFET1dfVlNNMzI7XG4gICAgICAgIGNvbnN0IGFwcGx5U2xvcGVTY2FsZUJpYXMgPSAhZGV2aWNlLndlYmdsMiAmJiBkZXZpY2UuZXh0U3RhbmRhcmREZXJpdmF0aXZlcztcblxuICAgICAgICBpZiAobGlnaHRUeXBlID09PSBMSUdIVFRZUEVfT01OSSB8fCAoaXNWc20gJiYgbGlnaHRUeXBlICE9PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwpKSB7XG4gICAgICAgICAgICBjb2RlICs9IFwiICAgIGZsb2F0IGRlcHRoID0gbWluKGRpc3RhbmNlKHZpZXdfcG9zaXRpb24sIHZQb3NpdGlvblcpIC8gbGlnaHRfcmFkaXVzLCAwLjk5OTk5KTtcXG5cIjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZmxvYXQgZGVwdGggPSBnbF9GcmFnQ29vcmQuejtcXG5cIjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChhcHBseVNsb3BlU2NhbGVCaWFzKSB7XG4gICAgICAgICAgICBjb2RlICs9IFwiICAgIGZsb2F0IG1pblZhbHVlID0gMi4zMzc0MzcwNTAwMTUzMTg2ZS0xMDsgLy8oMS4wIC8gMjU1LjApIC8gKDI1Ni4wICogMjU2LjAgKiAyNTYuMCk7XFxuXCI7XG4gICAgICAgICAgICBjb2RlICs9IFwiICAgIGRlcHRoICs9IHBvbHlnb25PZmZzZXQueCAqIG1heChhYnMoZEZkeChkZXB0aCkpLCBhYnMoZEZkeShkZXB0aCkpKSArIG1pblZhbHVlICogcG9seWdvbk9mZnNldC55O1xcblwiO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHNoYWRvd1R5cGUgPT09IFNIQURPV19QQ0YzICYmICghZGV2aWNlLndlYmdsMiB8fCAobGlnaHRUeXBlID09PSBMSUdIVFRZUEVfT01OSSAmJiAhb3B0aW9ucy5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpKSkge1xuICAgICAgICAgICAgY29kZSArPSBcIiAgICBnbF9GcmFnQ29sb3IgPSBwYWNrRmxvYXQoZGVwdGgpO1xcblwiO1xuICAgICAgICB9IGVsc2UgaWYgKHNoYWRvd1R5cGUgPT09IFNIQURPV19QQ0YzIHx8IHNoYWRvd1R5cGUgPT09IFNIQURPV19QQ0Y1KSB7XG4gICAgICAgICAgICBjb2RlICs9IFwiICAgIGdsX0ZyYWdDb2xvciA9IHZlYzQoMS4wKTtcXG5cIjsgLy8ganVzdCB0aGUgc2ltcGxlc3QgY29kZSwgY29sb3IgaXMgbm90IHdyaXR0ZW4gYW55d2F5XG5cbiAgICAgICAgICAgIC8vIGNsdXN0ZXJlZCBvbW5pIGxpZ2h0IGlzIHVzaW5nIHNoYWRvdyBzYW1wbGVyIGFuZCBuZWVkcyB0byB3cml0ZSBjdXN0b20gZGVwdGhcbiAgICAgICAgICAgIGlmIChvcHRpb25zLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCAmJiBsaWdodFR5cGUgPT09IExJR0hUVFlQRV9PTU5JICYmIGRldmljZS53ZWJnbDIpIHtcbiAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGdsX0ZyYWdEZXB0aCA9IGRlcHRoO1xcblwiO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKHNoYWRvd1R5cGUgPT09IFNIQURPV19WU004KSB7XG4gICAgICAgICAgICBjb2RlICs9IFwiICAgIGdsX0ZyYWdDb2xvciA9IHZlYzQoZW5jb2RlRmxvYXRSRyhkZXB0aCksIGVuY29kZUZsb2F0UkcoZGVwdGgqZGVwdGgpKTtcXG5cIjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLnN0b3JlRVZTTVBTO1xuICAgICAgICB9XG5cbiAgICAgICAgY29kZSArPSBlbmQoKTtcblxuICAgICAgICByZXR1cm4gY29kZTtcbiAgICB9XG5cbiAgICAvLyB0aGUgYmlnIG9uZVxuICAgIF9mc0dldExpdFBhc3NDb2RlKCkge1xuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmRldmljZTtcbiAgICAgICAgY29uc3Qgb3B0aW9ucyA9IHRoaXMub3B0aW9ucztcbiAgICAgICAgY29uc3QgY2h1bmtzID0gdGhpcy5jaHVua3M7XG5cbiAgICAgICAgbGV0IGNvZGUgPSBcIlwiO1xuXG4gICAgICAgIGlmIChvcHRpb25zLm9wYWNpdHlGYWRlc1NwZWN1bGFyID09PSBmYWxzZSkge1xuICAgICAgICAgICAgY29kZSArPSAndW5pZm9ybSBmbG9hdCBtYXRlcmlhbF9hbHBoYUZhZGU7XFxuJztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLnVzZVNwZWN1bGFyKSB7XG4gICAgICAgICAgICB0aGlzLmRlZmluZXMucHVzaChcIkxJVF9TUEVDVUxBUlwiKTtcblxuICAgICAgICAgICAgaWYgKHRoaXMucmVmbGVjdGlvbnMpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmRlZmluZXMucHVzaChcIkxJVF9SRUZMRUNUSU9OU1wiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG9wdGlvbnMuY2xlYXJDb2F0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kZWZpbmVzLnB1c2goXCJMSVRfQ0xFQVJDT0FUXCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAob3B0aW9ucy5mcmVzbmVsTW9kZWwgPiAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kZWZpbmVzLnB1c2goXCJMSVRfU1BFQ1VMQVJfRlJFU05FTFwiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gZW5hYmxlIGNvbnNlcnZlIGVuZXJneSBwYXRoIGluIGNsdXN0ZXJlZCBjaHVua1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMuY29uc2VydmVFbmVyZ3kpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmRlZmluZXMucHVzaChcIkxJVF9DT05TRVJWRV9FTkVSR1lcIik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zLnNoZWVuKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kZWZpbmVzLnB1c2goXCJMSVRfU0hFRU5cIik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zLmlyaWRlc2NlbmNlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kZWZpbmVzLnB1c2goXCJMSVRfSVJJREVTQ0VOQ0VcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBGUkFHTUVOVCBTSEFERVIgSU5QVVRTOiBVTklGT1JNU1xuICAgICAgICBjb25zdCBzaGFkb3dUeXBlVXNlZCA9IFtdO1xuICAgICAgICBsZXQgbnVtU2hhZG93TGlnaHRzID0gMDtcbiAgICAgICAgbGV0IHNoYWRvd2VkRGlyZWN0aW9uYWxMaWdodFVzZWQgPSBmYWxzZTtcbiAgICAgICAgbGV0IHVzZVZzbSA9IGZhbHNlO1xuICAgICAgICBsZXQgdXNlUGVyc3BaYnVmZmVyU2hhZG93ID0gZmFsc2U7XG5cbiAgICAgICAgbGV0IGhhc0FyZWFMaWdodHMgPSBvcHRpb25zLmxpZ2h0cy5zb21lKGZ1bmN0aW9uIChsaWdodCkge1xuICAgICAgICAgICAgcmV0dXJuIGxpZ2h0Ll9zaGFwZSAmJiBsaWdodC5fc2hhcGUgIT09IExJR0hUU0hBUEVfUFVOQ1RVQUw7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIGlmIGNsdXN0ZXJlZCBsaWdodGluZyBoYXMgYXJlYSBsaWdodHMgZW5hYmxlZCwgaXQgYWx3YXlzIHJ1bnMgaW4gJ2FyZWEgbGlnaHRzIG1vZGUnXG4gICAgICAgIC8vIFRPRE86IG1heWJlIHdlIHNob3VsZCBhbHdheXMgdXNlIGl0IGFuZCByZW1vdmUgdGhlIG90aGVyIHdheT9cbiAgICAgICAgaWYgKG9wdGlvbnMuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkICYmIG9wdGlvbnMuY2x1c3RlcmVkTGlnaHRpbmdBcmVhTGlnaHRzRW5hYmxlZCkge1xuICAgICAgICAgICAgaGFzQXJlYUxpZ2h0cyA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgYXJlYUx1dHNQcmVjaXNpb24gPSAnaGlnaHAnO1xuICAgICAgICBpZiAoZGV2aWNlLmFyZWFMaWdodEx1dEZvcm1hdCA9PT0gUElYRUxGT1JNQVRfUjhfRzhfQjhfQTgpIHtcbiAgICAgICAgICAgIC8vIHVzZSBvZmZzZXQgYW5kIHNjYWxlIGZvciByZ2I4IGZvcm1hdCBsdXRzXG4gICAgICAgICAgICBjb2RlICs9IFwiI2RlZmluZSBBUkVBX1I4X0c4X0I4X0E4X0xVVFNcXG5cIjtcbiAgICAgICAgICAgIGFyZWFMdXRzUHJlY2lzaW9uID0gJ2xvd3AnO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGhhc0FyZWFMaWdodHMgfHwgb3B0aW9ucy5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpIHtcbiAgICAgICAgICAgIGNvZGUgKz0gXCIjZGVmaW5lIEFSRUFfTElHSFRTXFxuXCI7XG4gICAgICAgICAgICBjb2RlICs9IGB1bmlmb3JtICR7YXJlYUx1dHNQcmVjaXNpb259IHNhbXBsZXIyRCBhcmVhTGlnaHRzTHV0VGV4MTtcXG5gO1xuICAgICAgICAgICAgY29kZSArPSBgdW5pZm9ybSAke2FyZWFMdXRzUHJlY2lzaW9ufSBzYW1wbGVyMkQgYXJlYUxpZ2h0c0x1dFRleDI7XFxuYDtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgb3B0aW9ucy5saWdodHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxpZ2h0ID0gb3B0aW9ucy5saWdodHNbaV07XG4gICAgICAgICAgICBjb25zdCBsaWdodFR5cGUgPSBsaWdodC5fdHlwZTtcblxuICAgICAgICAgICAgLy8gc2tpcCB1bmlmb3JtIGdlbmVyYXRpb24gZm9yIGxvY2FsIGxpZ2h0cyBpZiBjbHVzdGVyZWQgbGlnaHRpbmcgaXMgZW5hYmxlZFxuICAgICAgICAgICAgaWYgKG9wdGlvbnMuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkICYmIGxpZ2h0VHlwZSAhPT0gTElHSFRUWVBFX0RJUkVDVElPTkFMKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICBjb25zdCBsaWdodFNoYXBlID0gKGhhc0FyZWFMaWdodHMgJiYgbGlnaHQuX3NoYXBlKSA/IGxpZ2h0Ll9zaGFwZSA6IExJR0hUU0hBUEVfUFVOQ1RVQUw7XG5cbiAgICAgICAgICAgIGNvZGUgKz0gXCJ1bmlmb3JtIHZlYzMgbGlnaHRcIiArIGkgKyBcIl9jb2xvcjtcXG5cIjtcbiAgICAgICAgICAgIGlmIChsaWdodFR5cGUgPT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCkge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJ1bmlmb3JtIHZlYzMgbGlnaHRcIiArIGkgKyBcIl9kaXJlY3Rpb247XFxuXCI7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJ1bmlmb3JtIHZlYzMgbGlnaHRcIiArIGkgKyBcIl9wb3NpdGlvbjtcXG5cIjtcbiAgICAgICAgICAgICAgICBjb2RlICs9IFwidW5pZm9ybSBmbG9hdCBsaWdodFwiICsgaSArIFwiX3JhZGl1cztcXG5cIjtcbiAgICAgICAgICAgICAgICBpZiAobGlnaHRUeXBlID09PSBMSUdIVFRZUEVfU1BPVCkge1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwidW5pZm9ybSB2ZWMzIGxpZ2h0XCIgKyBpICsgXCJfZGlyZWN0aW9uO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwidW5pZm9ybSBmbG9hdCBsaWdodFwiICsgaSArIFwiX2lubmVyQ29uZUFuZ2xlO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwidW5pZm9ybSBmbG9hdCBsaWdodFwiICsgaSArIFwiX291dGVyQ29uZUFuZ2xlO1xcblwiO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChsaWdodFNoYXBlICE9PSBMSUdIVFNIQVBFX1BVTkNUVUFMKSB7XG4gICAgICAgICAgICAgICAgaWYgKGxpZ2h0VHlwZSA9PT0gTElHSFRUWVBFX0RJUkVDVElPTkFMKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJ1bmlmb3JtIHZlYzMgbGlnaHRcIiArIGkgKyBcIl9wb3NpdGlvbjtcXG5cIjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29kZSArPSBcInVuaWZvcm0gdmVjMyBsaWdodFwiICsgaSArIFwiX2hhbGZXaWR0aDtcXG5cIjtcbiAgICAgICAgICAgICAgICBjb2RlICs9IFwidW5pZm9ybSB2ZWMzIGxpZ2h0XCIgKyBpICsgXCJfaGFsZkhlaWdodDtcXG5cIjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChsaWdodC5jYXN0U2hhZG93cyAmJiAhb3B0aW9ucy5ub1NoYWRvdykge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJ1bmlmb3JtIG1hdDQgbGlnaHRcIiArIGkgKyBcIl9zaGFkb3dNYXRyaXg7XFxuXCI7XG4gICAgICAgICAgICAgICAgY29kZSArPSBcInVuaWZvcm0gZmxvYXQgbGlnaHRcIiArIGkgKyBcIl9zaGFkb3dJbnRlbnNpdHk7XFxuXCI7XG5cbiAgICAgICAgICAgICAgICAvLyBkaXJlY3Rpb25hbCAoY2FzY2FkZWQpIHNoYWRvd3NcbiAgICAgICAgICAgICAgICBpZiAobGlnaHRUeXBlID09PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwpIHtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcInVuaWZvcm0gbWF0NCBsaWdodFwiICsgaSArIFwiX3NoYWRvd01hdHJpeFBhbGV0dGVbNF07XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJ1bmlmb3JtIGZsb2F0IGxpZ2h0XCIgKyBpICsgXCJfc2hhZG93Q2FzY2FkZURpc3RhbmNlc1s0XTtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcInVuaWZvcm0gZmxvYXQgbGlnaHRcIiArIGkgKyBcIl9zaGFkb3dDYXNjYWRlQ291bnQ7XFxuXCI7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGxpZ2h0VHlwZSAhPT0gTElHSFRUWVBFX0RJUkVDVElPTkFMKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJ1bmlmb3JtIHZlYzQgbGlnaHRcIiArIGkgKyBcIl9zaGFkb3dQYXJhbXM7XFxuXCI7IC8vIFdpZHRoLCBoZWlnaHQsIGJpYXMsIHJhZGl1c1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHNoYWRvd2VkRGlyZWN0aW9uYWxMaWdodFVzZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwidW5pZm9ybSB2ZWMzIGxpZ2h0XCIgKyBpICsgXCJfc2hhZG93UGFyYW1zO1xcblwiOyAvLyBXaWR0aCwgaGVpZ2h0LCBiaWFzXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChsaWdodFR5cGUgPT09IExJR0hUVFlQRV9PTU5JKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJ1bmlmb3JtIHNhbXBsZXJDdWJlIGxpZ2h0XCIgKyBpICsgXCJfc2hhZG93TWFwO1xcblwiO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChsaWdodC5faXNQY2YgJiYgZGV2aWNlLndlYmdsMikge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcInVuaWZvcm0gc2FtcGxlcjJEU2hhZG93IGxpZ2h0XCIgKyBpICsgXCJfc2hhZG93TWFwO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcInVuaWZvcm0gc2FtcGxlcjJEIGxpZ2h0XCIgKyBpICsgXCJfc2hhZG93TWFwO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIG51bVNoYWRvd0xpZ2h0cysrO1xuICAgICAgICAgICAgICAgIHNoYWRvd1R5cGVVc2VkW2xpZ2h0Ll9zaGFkb3dUeXBlXSA9IHRydWU7XG4gICAgICAgICAgICAgICAgaWYgKGxpZ2h0Ll9pc1ZzbSkgdXNlVnNtID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBpZiAobGlnaHQuX2lzUGNmICYmIChkZXZpY2Uud2ViZ2wyIHx8IGRldmljZS5leHRTdGFuZGFyZERlcml2YXRpdmVzKSAmJiBsaWdodFR5cGUgPT09IExJR0hUVFlQRV9TUE9UKSB1c2VQZXJzcFpidWZmZXJTaGFkb3cgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGxpZ2h0Ll9jb29raWUpIHtcbiAgICAgICAgICAgICAgICBpZiAobGlnaHQuX2Nvb2tpZS5fY3ViZW1hcCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAobGlnaHRUeXBlID09PSBMSUdIVFRZUEVfT01OSSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcInVuaWZvcm0gc2FtcGxlckN1YmUgbGlnaHRcIiArIGkgKyBcIl9jb29raWU7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwidW5pZm9ybSBmbG9hdCBsaWdodFwiICsgaSArIFwiX2Nvb2tpZUludGVuc2l0eTtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghbGlnaHQuY2FzdFNoYWRvd3MgfHwgb3B0aW9ucy5ub1NoYWRvdykgY29kZSArPSBcInVuaWZvcm0gbWF0NCBsaWdodFwiICsgaSArIFwiX3NoYWRvd01hdHJpeDtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChsaWdodFR5cGUgPT09IExJR0hUVFlQRV9TUE9UKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwidW5pZm9ybSBzYW1wbGVyMkQgbGlnaHRcIiArIGkgKyBcIl9jb29raWU7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwidW5pZm9ybSBmbG9hdCBsaWdodFwiICsgaSArIFwiX2Nvb2tpZUludGVuc2l0eTtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghbGlnaHQuY2FzdFNoYWRvd3MgfHwgb3B0aW9ucy5ub1NoYWRvdykgY29kZSArPSBcInVuaWZvcm0gbWF0NCBsaWdodFwiICsgaSArIFwiX3NoYWRvd01hdHJpeDtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsaWdodC5fY29va2llVHJhbnNmb3JtKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcInVuaWZvcm0gdmVjNCBsaWdodFwiICsgaSArIFwiX2Nvb2tpZU1hdHJpeDtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwidW5pZm9ybSB2ZWMyIGxpZ2h0XCIgKyBpICsgXCJfY29va2llT2Zmc2V0O1xcblwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29kZSArPSBcIlxcblwiOyAvLyBFbmQgb2YgdW5pZm9ybSBkZWNsYXJhdGlvbnNcblxuICAgICAgICAvLyBUQk5cbiAgICAgICAgY29uc3QgaGFzVEJOID0gdGhpcy5uZWVkc05vcm1hbCAmJiAob3B0aW9ucy5ub3JtYWxNYXAgfHwgb3B0aW9ucy5jbGVhckNvYXROb3JtYWxNYXAgfHwgKG9wdGlvbnMuZW5hYmxlR0dYU3BlY3VsYXIgJiYgIW9wdGlvbnMuaGVpZ2h0TWFwKSk7XG5cbiAgICAgICAgaWYgKGhhc1RCTikge1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMuaGFzVGFuZ2VudHMpIHtcbiAgICAgICAgICAgICAgICBjb2RlICs9IG9wdGlvbnMuZmFzdFRibiA/IGNodW5rcy5UQk5mYXN0UFMgOiBjaHVua3MuVEJOUFM7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChkZXZpY2UuZXh0U3RhbmRhcmREZXJpdmF0aXZlcyAmJiAob3B0aW9ucy5ub3JtYWxNYXAgfHwgb3B0aW9ucy5jbGVhckNvYXROb3JtYWxNYXApKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLlRCTmRlcml2YXRpdmVQUy5yZXBsYWNlKC9cXCRVVi9nLCB0aGlzLmxpZ2h0aW5nVXYpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLlRCTk9iamVjdFNwYWNlUFM7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gRklYTUU6IG9ubHkgYWRkIHRoZXNlIHdoZW4gbmVlZGVkXG4gICAgICAgIGNvZGUgKz0gY2h1bmtzLnNwaGVyaWNhbFBTO1xuICAgICAgICBjb2RlICs9IGNodW5rcy5kZWNvZGVQUztcbiAgICAgICAgY29kZSArPSBnYW1tYUNvZGUob3B0aW9ucy5nYW1tYSwgY2h1bmtzKTtcbiAgICAgICAgY29kZSArPSB0b25lbWFwQ29kZShvcHRpb25zLnRvbmVNYXAsIGNodW5rcyk7XG4gICAgICAgIGNvZGUgKz0gZm9nQ29kZShvcHRpb25zLmZvZywgY2h1bmtzKTtcblxuXG4gICAgICAgIC8vIGZyb250ZW5kXG4gICAgICAgIGNvZGUgKz0gdGhpcy5mcm9udGVuZENvZGU7XG5cbiAgICAgICAgaWYgKG9wdGlvbnMudXNlQ3ViZU1hcFJvdGF0aW9uKSB7XG4gICAgICAgICAgICBjb2RlICs9IFwiI2RlZmluZSBDVUJFTUFQX1JPVEFUSU9OXFxuXCI7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5uZWVkc05vcm1hbCkge1xuICAgICAgICAgICAgY29kZSArPSBjaHVua3MuY3ViZU1hcFJvdGF0ZVBTO1xuICAgICAgICAgICAgY29kZSArPSBvcHRpb25zLmN1YmVNYXBQcm9qZWN0aW9uID4gMCA/IGNodW5rcy5jdWJlTWFwUHJvamVjdEJveFBTIDogY2h1bmtzLmN1YmVNYXBQcm9qZWN0Tm9uZVBTO1xuICAgICAgICAgICAgY29kZSArPSBvcHRpb25zLnNreWJveEludGVuc2l0eSA/IGNodW5rcy5lbnZNdWx0aXBseVBTIDogY2h1bmtzLmVudkNvbnN0UFM7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoKHRoaXMubGlnaHRpbmcgJiYgb3B0aW9ucy51c2VTcGVjdWxhcikgfHwgdGhpcy5yZWZsZWN0aW9ucykge1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMudXNlTWV0YWxuZXNzKSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBjaHVua3MubWV0YWxuZXNzTW9kdWxhdGVQUztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG9wdGlvbnMuZnJlc25lbE1vZGVsID09PSBGUkVTTkVMX1NDSExJQ0spIHtcbiAgICAgICAgICAgICAgICBjb2RlICs9IGNodW5rcy5mcmVzbmVsU2NobGlja1BTO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAob3B0aW9ucy5pcmlkZXNjZW5jZSkge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLmlyaWRlc2NlbmNlRGlmZnJhY3Rpb25QUztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHVzZUFvID0gb3B0aW9ucy5hb01hcCB8fCBvcHRpb25zLmFvVmVydGV4Q29sb3I7XG5cbiAgICAgICAgaWYgKHVzZUFvKSB7XG4gICAgICAgICAgICBjb2RlICs9IGNodW5rcy5hb0RpZmZ1c2VPY2NQUztcbiAgICAgICAgICAgIHN3aXRjaCAob3B0aW9ucy5vY2NsdWRlU3BlY3VsYXIpIHtcbiAgICAgICAgICAgICAgICBjYXNlIFNQRUNPQ0NfQU86XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gb3B0aW9ucy5vY2NsdWRlU3BlY3VsYXJGbG9hdCA/IGNodW5rcy5hb1NwZWNPY2NTaW1wbGVQUyA6IGNodW5rcy5hb1NwZWNPY2NDb25zdFNpbXBsZVBTO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIFNQRUNPQ0NfR0xPU1NERVBFTkRFTlQ6XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gb3B0aW9ucy5vY2NsdWRlU3BlY3VsYXJGbG9hdCA/IGNodW5rcy5hb1NwZWNPY2NQUyA6IGNodW5rcy5hb1NwZWNPY2NDb25zdFBTO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLnJlZmxlY3Rpb25Tb3VyY2UgPT09ICdlbnZBdGxhc0hRJykge1xuICAgICAgICAgICAgY29kZSArPSBvcHRpb25zLmZpeFNlYW1zID8gY2h1bmtzLmZpeEN1YmVtYXBTZWFtc1N0cmV0Y2hQUyA6IGNodW5rcy5maXhDdWJlbWFwU2VhbXNOb25lUFM7XG4gICAgICAgICAgICBjb2RlICs9IGNodW5rcy5lbnZBdGxhc1BTO1xuICAgICAgICAgICAgY29kZSArPSBjaHVua3MucmVmbGVjdGlvbkVudkhRUFMucmVwbGFjZSgvXFwkREVDT0RFL2csIENodW5rVXRpbHMuZGVjb2RlRnVuYyhvcHRpb25zLnJlZmxlY3Rpb25FbmNvZGluZykpO1xuICAgICAgICB9IGVsc2UgaWYgKG9wdGlvbnMucmVmbGVjdGlvblNvdXJjZSA9PT0gJ2VudkF0bGFzJykge1xuICAgICAgICAgICAgY29kZSArPSBjaHVua3MuZW52QXRsYXNQUztcbiAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLnJlZmxlY3Rpb25FbnZQUy5yZXBsYWNlKC9cXCRERUNPREUvZywgQ2h1bmtVdGlscy5kZWNvZGVGdW5jKG9wdGlvbnMucmVmbGVjdGlvbkVuY29kaW5nKSk7XG4gICAgICAgIH0gZWxzZSBpZiAob3B0aW9ucy5yZWZsZWN0aW9uU291cmNlID09PSAnY3ViZU1hcCcpIHtcbiAgICAgICAgICAgIGNvZGUgKz0gb3B0aW9ucy5maXhTZWFtcyA/IGNodW5rcy5maXhDdWJlbWFwU2VhbXNTdHJldGNoUFMgOiBjaHVua3MuZml4Q3ViZW1hcFNlYW1zTm9uZVBTO1xuICAgICAgICAgICAgY29kZSArPSBjaHVua3MucmVmbGVjdGlvbkN1YmVQUy5yZXBsYWNlKC9cXCRERUNPREUvZywgQ2h1bmtVdGlscy5kZWNvZGVGdW5jKG9wdGlvbnMucmVmbGVjdGlvbkVuY29kaW5nKSk7XG4gICAgICAgIH0gZWxzZSBpZiAob3B0aW9ucy5yZWZsZWN0aW9uU291cmNlID09PSAnc3BoZXJlTWFwJykge1xuICAgICAgICAgICAgY29uc3Qgc2NvZGUgPSBkZXZpY2UuZnJhZ21lbnRVbmlmb3Jtc0NvdW50ID4gMTYgPyBjaHVua3MucmVmbGVjdGlvblNwaGVyZVBTIDogY2h1bmtzLnJlZmxlY3Rpb25TcGhlcmVMb3dQUztcbiAgICAgICAgICAgIGNvZGUgKz0gc2NvZGUucmVwbGFjZSgvXFwkREVDT0RFL2csIENodW5rVXRpbHMuZGVjb2RlRnVuYyhvcHRpb25zLnJlZmxlY3Rpb25FbmNvZGluZykpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMucmVmbGVjdGlvbnMpIHtcbiAgICAgICAgICAgIGlmIChvcHRpb25zLmNsZWFyQ29hdCkge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLnJlZmxlY3Rpb25DQ1BTO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKG9wdGlvbnMuc2hlZW4pIHtcbiAgICAgICAgICAgICAgICBjb2RlICs9IGNodW5rcy5yZWZsZWN0aW9uU2hlZW5QUztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLnJlZnJhY3Rpb24pIHtcbiAgICAgICAgICAgIGlmIChvcHRpb25zLnVzZUR5bmFtaWNSZWZyYWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBjaHVua3MucmVmcmFjdGlvbkR5bmFtaWNQUztcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5yZWZsZWN0aW9ucykge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLnJlZnJhY3Rpb25DdWJlUFM7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy5zaGVlbikge1xuICAgICAgICAgICAgY29kZSArPSBjaHVua3MubGlnaHRTaGVlblBTO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gY2x1c3RlcmVkIGxpZ2h0aW5nXG4gICAgICAgIGlmIChvcHRpb25zLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCkge1xuXG4gICAgICAgICAgICAvLyBpbmNsdWRlIHRoaXMgYmVmb3JlIHNoYWRvdyAvIGNvb2tpZSBjb2RlXG4gICAgICAgICAgICBjb2RlICs9IGNodW5rcy5jbHVzdGVyZWRMaWdodFV0aWxzUFM7XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5jbHVzdGVyZWRMaWdodGluZ0Nvb2tpZXNFbmFibGVkKVxuICAgICAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLmNsdXN0ZXJlZExpZ2h0Q29va2llc1BTO1xuXG4gICAgICAgICAgICAvLyBpbmNsdWRlIHNoYWRvdyBjaHVua3MgY2x1c3RlcmVkIGxpZ2h0cyBzdXBwb3J0XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5jbHVzdGVyZWRMaWdodGluZ1NoYWRvd3NFbmFibGVkICYmICFvcHRpb25zLm5vU2hhZG93KSB7XG4gICAgICAgICAgICAgICAgc2hhZG93VHlwZVVzZWRbU0hBRE9XX1BDRjNdID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBzaGFkb3dUeXBlVXNlZFtTSEFET1dfUENGNV0gPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdXNlUGVyc3BaYnVmZmVyU2hhZG93ID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChudW1TaGFkb3dMaWdodHMgPiAwIHx8IG9wdGlvbnMuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkKSB7XG4gICAgICAgICAgICBpZiAoc2hhZG93ZWREaXJlY3Rpb25hbExpZ2h0VXNlZCkge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLnNoYWRvd0Nhc2NhZGVzUFM7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoc2hhZG93VHlwZVVzZWRbU0hBRE9XX1BDRjNdKSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBjaHVua3Muc2hhZG93U3RhbmRhcmRQUztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzaGFkb3dUeXBlVXNlZFtTSEFET1dfUENGNV0gJiYgZGV2aWNlLndlYmdsMikge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLnNoYWRvd1N0YW5kYXJkR0wyUFM7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodXNlVnNtKSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBjaHVua3Muc2hhZG93VlNNX2NvbW1vblBTO1xuICAgICAgICAgICAgICAgIGlmIChzaGFkb3dUeXBlVXNlZFtTSEFET1dfVlNNOF0pIHtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBjaHVua3Muc2hhZG93VlNNOFBTO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoc2hhZG93VHlwZVVzZWRbU0hBRE9XX1ZTTTE2XSkge1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IGRldmljZS5leHRUZXh0dXJlSGFsZkZsb2F0TGluZWFyID8gY2h1bmtzLnNoYWRvd0VWU01QUy5yZXBsYWNlKC9cXCQvZywgXCIxNlwiKSA6IGNodW5rcy5zaGFkb3dFVlNNblBTLnJlcGxhY2UoL1xcJC9nLCBcIjE2XCIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoc2hhZG93VHlwZVVzZWRbU0hBRE9XX1ZTTTMyXSkge1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IGRldmljZS5leHRUZXh0dXJlRmxvYXRMaW5lYXIgPyBjaHVua3Muc2hhZG93RVZTTVBTLnJlcGxhY2UoL1xcJC9nLCBcIjMyXCIpIDogY2h1bmtzLnNoYWRvd0VWU01uUFMucmVwbGFjZSgvXFwkL2csIFwiMzJcIik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIShkZXZpY2Uud2ViZ2wyIHx8IGRldmljZS5leHRTdGFuZGFyZERlcml2YXRpdmVzKSkge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLmJpYXNDb25zdFBTO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBvdGhlcndpc2UgYmlhcyBpcyBhcHBsaWVkIG9uIHJlbmRlclxuICAgICAgICAgICAgY29kZSArPSBjaHVua3Muc2hhZG93Q29vcmRQUyArIGNodW5rcy5zaGFkb3dDb21tb25QUztcbiAgICAgICAgICAgIGlmICh1c2VQZXJzcFpidWZmZXJTaGFkb3cpIGNvZGUgKz0gY2h1bmtzLnNoYWRvd0Nvb3JkUGVyc3BaYnVmZmVyUFM7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy5lbmFibGVHR1hTcGVjdWxhcikgY29kZSArPSBcInVuaWZvcm0gZmxvYXQgbWF0ZXJpYWxfYW5pc290cm9weTtcXG5cIjtcblxuICAgICAgICBpZiAodGhpcy5saWdodGluZykge1xuICAgICAgICAgICAgY29kZSArPSBjaHVua3MubGlnaHREaWZmdXNlTGFtYmVydFBTO1xuICAgICAgICAgICAgaWYgKGhhc0FyZWFMaWdodHMgfHwgb3B0aW9ucy5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpIGNvZGUgKz0gY2h1bmtzLmx0YztcbiAgICAgICAgfVxuXG4gICAgICAgIGNvZGUgKz0gJ1xcbic7XG5cbiAgICAgICAgbGV0IHVzZU9sZEFtYmllbnQgPSBmYWxzZTtcbiAgICAgICAgaWYgKG9wdGlvbnMudXNlU3BlY3VsYXIpIHtcblxuICAgICAgICAgICAgaWYgKHRoaXMubGlnaHRpbmcpIHtcbiAgICAgICAgICAgICAgICBjb2RlICs9IG9wdGlvbnMuc2hhZGluZ01vZGVsID09PSBTUEVDVUxBUl9QSE9ORyA/IGNodW5rcy5saWdodFNwZWN1bGFyUGhvbmdQUyA6IChvcHRpb25zLmVuYWJsZUdHWFNwZWN1bGFyID8gY2h1bmtzLmxpZ2h0U3BlY3VsYXJBbmlzb0dHWFBTIDogY2h1bmtzLmxpZ2h0U3BlY3VsYXJCbGlublBTKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFvcHRpb25zLmZyZXNuZWxNb2RlbCAmJiAhdGhpcy5yZWZsZWN0aW9ucyAmJiAhb3B0aW9ucy5kaWZmdXNlTWFwKSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICB1bmlmb3JtIHZlYzMgbWF0ZXJpYWxfYW1iaWVudDtcXG5cIjtcbiAgICAgICAgICAgICAgICBjb2RlICs9IFwiI2RlZmluZSBMSVRfT0xEX0FNQklFTlRcIjtcbiAgICAgICAgICAgICAgICB1c2VPbGRBbWJpZW50ID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvZGUgKz0gY2h1bmtzLmNvbWJpbmVQUztcblxuICAgICAgICAvLyBsaWdodG1hcCBzdXBwb3J0XG4gICAgICAgIGlmIChvcHRpb25zLmxpZ2h0TWFwIHx8IG9wdGlvbnMubGlnaHRWZXJ0ZXhDb2xvcikge1xuICAgICAgICAgICAgY29kZSArPSAob3B0aW9ucy51c2VTcGVjdWxhciAmJiBvcHRpb25zLmRpckxpZ2h0TWFwKSA/IGNodW5rcy5saWdodG1hcERpckFkZFBTIDogY2h1bmtzLmxpZ2h0bWFwQWRkUFM7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBhZGRBbWJpZW50ID0gKCFvcHRpb25zLmxpZ2h0TWFwICYmICFvcHRpb25zLmxpZ2h0VmVydGV4Q29sb3IpIHx8IG9wdGlvbnMubGlnaHRNYXBXaXRob3V0QW1iaWVudDtcblxuICAgICAgICBpZiAoYWRkQW1iaWVudCkge1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMuYW1iaWVudFNvdXJjZSA9PT0gJ2FtYmllbnRTSCcpIHtcbiAgICAgICAgICAgICAgICBjb2RlICs9IGNodW5rcy5hbWJpZW50U0hQUztcbiAgICAgICAgICAgIH0gZWxzZSBpZiAob3B0aW9ucy5hbWJpZW50U291cmNlID09PSAnZW52QXRsYXMnKSB7XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMucmVmbGVjdGlvblNvdXJjZSAhPT0gJ2VudkF0bGFzJyAmJiBvcHRpb25zLnJlZmxlY3Rpb25Tb3VyY2UgIT09ICdlbnZBdGxhc0hRJykge1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IGNodW5rcy5lbnZBdGxhc1BTO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb2RlICs9IGNodW5rcy5hbWJpZW50RW52UFMucmVwbGFjZSgvXFwkREVDT0RFL2csIENodW5rVXRpbHMuZGVjb2RlRnVuYyhvcHRpb25zLmFtYmllbnRFbmNvZGluZykpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb2RlICs9IGNodW5rcy5hbWJpZW50Q29uc3RhbnRQUztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLmFtYmllbnRUaW50ICYmICF1c2VPbGRBbWJpZW50KSB7XG4gICAgICAgICAgICBjb2RlICs9IFwidW5pZm9ybSB2ZWMzIG1hdGVyaWFsX2FtYmllbnQ7XFxuXCI7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy5tc2RmKSB7XG4gICAgICAgICAgICBpZiAoIW9wdGlvbnMubXNkZlRleHRBdHRyaWJ1dGUpIHtcbiAgICAgICAgICAgICAgICBjb2RlICs9IFwiXFxuI2RlZmluZSBVTklGT1JNX1RFWFRfUEFSQU1FVEVSU1wiO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29kZSArPSBjaHVua3MubXNkZlBTO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMubmVlZHNOb3JtYWwpIHtcbiAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLnZpZXdEaXJQUztcbiAgICAgICAgICAgIGlmIChvcHRpb25zLnVzZVNwZWN1bGFyKSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSAob3B0aW9ucy5lbmFibGVHR1hTcGVjdWxhcikgPyBjaHVua3MucmVmbERpckFuaXNvUFMgOiBjaHVua3MucmVmbERpclBTO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGhhc1BvaW50TGlnaHRzID0gZmFsc2U7XG4gICAgICAgIGxldCB1c2VzTGluZWFyRmFsbG9mZiA9IGZhbHNlO1xuICAgICAgICBsZXQgdXNlc0ludlNxdWFyZWRGYWxsb2ZmID0gZmFsc2U7XG4gICAgICAgIGxldCB1c2VzU3BvdCA9IGZhbHNlO1xuICAgICAgICBsZXQgdXNlc0Nvb2tpZSA9IGZhbHNlO1xuICAgICAgICBsZXQgdXNlc0Nvb2tpZU5vdztcblxuICAgICAgICAvLyBjbHVzdGVyZWQgbGlnaHRpbmdcbiAgICAgICAgaWYgKG9wdGlvbnMuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkICYmIHRoaXMubGlnaHRpbmcpIHtcblxuICAgICAgICAgICAgdXNlc1Nwb3QgPSB0cnVlO1xuICAgICAgICAgICAgaGFzUG9pbnRMaWdodHMgPSB0cnVlO1xuICAgICAgICAgICAgdXNlc0xpbmVhckZhbGxvZmYgPSB0cnVlO1xuICAgICAgICAgICAgdXNlc0Nvb2tpZSA9IHRydWU7XG5cbiAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLmZsb2F0VW5wYWNraW5nUFM7XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zLmxpZ2h0TWFza0R5bmFtaWMpXG4gICAgICAgICAgICAgICAgY29kZSArPSBcIlxcbiNkZWZpbmUgQ0xVU1RFUl9NRVNIX0RZTkFNSUNfTElHSFRTXCI7XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zLmNsdXN0ZXJlZExpZ2h0aW5nQ29va2llc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgY29kZSArPSBcIlxcbiNkZWZpbmUgQ0xVU1RFUl9DT09LSUVTXCI7XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5jbHVzdGVyZWRMaWdodGluZ1NoYWRvd3NFbmFibGVkICYmICFvcHRpb25zLm5vU2hhZG93KSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBcIlxcbiNkZWZpbmUgQ0xVU1RFUl9TSEFET1dTXCI7XG4gICAgICAgICAgICAgICAgY29kZSArPSBcIlxcbiNkZWZpbmUgQ0xVU1RFUl9TSEFET1dfVFlQRV9cIiArIHNoYWRvd1R5cGVUb1N0cmluZ1tvcHRpb25zLmNsdXN0ZXJlZExpZ2h0aW5nU2hhZG93VHlwZV07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zLmNsdXN0ZXJlZExpZ2h0aW5nQXJlYUxpZ2h0c0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgY29kZSArPSBcIlxcbiNkZWZpbmUgQ0xVU1RFUl9BUkVBTElHSFRTXCI7XG5cbiAgICAgICAgICAgIGNvZGUgKz0gTGlnaHRzQnVmZmVyLnNoYWRlckRlZmluZXM7XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zLmNsdXN0ZXJlZExpZ2h0aW5nU2hhZG93c0VuYWJsZWQgJiYgIW9wdGlvbnMubm9TaGFkb3cpIHtcbiAgICAgICAgICAgICAgICBjb2RlICs9IGNodW5rcy5jbHVzdGVyZWRMaWdodFNoYWRvd3NQUztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29kZSArPSBjaHVua3MuY2x1c3RlcmVkTGlnaHRQUztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLnR3b1NpZGVkTGlnaHRpbmcpIGNvZGUgKz0gXCJ1bmlmb3JtIGZsb2F0IHR3b1NpZGVkTGlnaHRpbmdOZWdTY2FsZUZhY3RvcjtcXG5cIjtcblxuICAgICAgICAvLyBGUkFHTUVOVCBTSEFERVIgQk9EWVxuXG4gICAgICAgIGNvZGUgKz0gdGhpcy5fZnNHZXRTdGFydENvZGUoY29kZSwgZGV2aWNlLCBjaHVua3MsIG9wdGlvbnMpO1xuXG4gICAgICAgIGlmICh0aGlzLm5lZWRzTm9ybWFsKSB7XG4gICAgICAgICAgICBpZiAob3B0aW9ucy50d29TaWRlZExpZ2h0aW5nKSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBkVmVydGV4Tm9ybWFsVyA9IG5vcm1hbGl6ZShnbF9Gcm9udEZhY2luZyA/IHZOb3JtYWxXICogdHdvU2lkZWRMaWdodGluZ05lZ1NjYWxlRmFjdG9yIDogLXZOb3JtYWxXICogdHdvU2lkZWRMaWdodGluZ05lZ1NjYWxlRmFjdG9yKTtcXG5cIjtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBkVmVydGV4Tm9ybWFsVyA9IG5vcm1hbGl6ZSh2Tm9ybWFsVyk7XFxuXCI7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICgob3B0aW9ucy5oZWlnaHRNYXAgfHwgb3B0aW9ucy5ub3JtYWxNYXApICYmIG9wdGlvbnMuaGFzVGFuZ2VudHMpIHtcbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy50d29TaWRlZExpZ2h0aW5nKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZFRhbmdlbnRXID0gZ2xfRnJvbnRGYWNpbmcgPyB2VGFuZ2VudFcgKiB0d29TaWRlZExpZ2h0aW5nTmVnU2NhbGVGYWN0b3IgOiAtdlRhbmdlbnRXICogdHdvU2lkZWRMaWdodGluZ05lZ1NjYWxlRmFjdG9yO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGRCaW5vcm1hbFcgPSBnbF9Gcm9udEZhY2luZyA/IHZCaW5vcm1hbFcgKiB0d29TaWRlZExpZ2h0aW5nTmVnU2NhbGVGYWN0b3IgOiAtdkJpbm9ybWFsVyAqIHR3b1NpZGVkTGlnaHRpbmdOZWdTY2FsZUZhY3RvcjtcXG5cIjtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGRUYW5nZW50VyA9IHZUYW5nZW50VztcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBkQmlub3JtYWxXID0gdkJpbm9ybWFsVztcXG5cIjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZ2V0Vmlld0RpcigpO1xcblwiO1xuICAgICAgICAgICAgaWYgKGhhc1RCTikge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZ2V0VEJOKCk7XFxuXCI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpbnZva2UgZnJvbnRlbmQgZnVuY3Rpb25zXG4gICAgICAgIGNvZGUgKz0gdGhpcy5mcm9udGVuZEZ1bmM7XG5cbiAgICAgICAgLy8gdHJhbnNmb3JtIHRhbmdlbnQgc3BhY2Ugbm9ybWFscyB0byB3b3JsZCBzcGFjZVxuICAgICAgICBpZiAodGhpcy5uZWVkc05vcm1hbCkge1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMudXNlU3BlY3VsYXIpIHtcbiAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGdldFJlZmxEaXIoKTtcXG5cIjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG9wdGlvbnMuY2xlYXJDb2F0KSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBjY1JlZmxEaXJXID0gbm9ybWFsaXplKC1yZWZsZWN0KGRWaWV3RGlyVywgY2NOb3JtYWxXKSk7XFxuXCI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoKHRoaXMubGlnaHRpbmcgJiYgb3B0aW9ucy51c2VTcGVjdWxhcikgfHwgdGhpcy5yZWZsZWN0aW9ucykge1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMudXNlTWV0YWxuZXNzKSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBnZXRNZXRhbG5lc3NNb2R1bGF0ZSgpO1xcblwiO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAob3B0aW9ucy5pcmlkZXNjZW5jZSkge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZ2V0SXJpZGVzY2VuY2Uoc2F0dXJhdGUoZG90KGRWaWV3RGlyVywgZE5vcm1hbFcpKSk7XFxuXCI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoYWRkQW1iaWVudCkge1xuICAgICAgICAgICAgY29kZSArPSBcIiAgICBhZGRBbWJpZW50KCk7XFxuXCI7XG5cbiAgICAgICAgICAgIC8vIG1vdmUgYW1iaWVudCBjb2xvciBvdXQgb2YgZGlmZnVzZSAodXNlZCBieSBMaWdodG1hcHBlciwgdG8gbXVsdGlwbHkgYW1iaWVudCBjb2xvciBieSBhY2N1bXVsYXRlZCBBTylcbiAgICAgICAgICAgIGlmIChvcHRpb25zLnNlcGFyYXRlQW1iaWVudCkge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gYFxuICAgICAgICAgICAgICAgICAgICB2ZWMzIGRBbWJpZW50TGlnaHQgPSBkRGlmZnVzZUxpZ2h0O1xuICAgICAgICAgICAgICAgICAgICBkRGlmZnVzZUxpZ2h0ID0gdmVjMygwKTtcbiAgICAgICAgICAgICAgICBgO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdGlvbnMuYW1iaWVudFRpbnQgJiYgIXVzZU9sZEFtYmllbnQpIHtcbiAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZERpZmZ1c2VMaWdodCAqPSBtYXRlcmlhbF9hbWJpZW50O1xcblwiO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHVzZUFvICYmICFvcHRpb25zLm9jY2x1ZGVEaXJlY3QpIHtcbiAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgb2NjbHVkZURpZmZ1c2UoKTtcXG5cIjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLmxpZ2h0TWFwIHx8IG9wdGlvbnMubGlnaHRWZXJ0ZXhDb2xvcikge1xuICAgICAgICAgICAgY29kZSArPSBcIiAgICBhZGRMaWdodE1hcCgpO1xcblwiO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMubGlnaHRpbmcgfHwgdGhpcy5yZWZsZWN0aW9ucykge1xuICAgICAgICAgICAgaWYgKHRoaXMucmVmbGVjdGlvbnMpIHtcbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5jbGVhckNvYXQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBhZGRSZWZsZWN0aW9uQ0MoKTtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMuZnJlc25lbE1vZGVsID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBjY0ZyZXNuZWwgPSBnZXRGcmVzbmVsQ0MoZG90KGRWaWV3RGlyVywgY2NOb3JtYWxXKSk7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGNjUmVmbGVjdGlvbi5yZ2IgKj0gY2NGcmVzbmVsO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICB9ICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgY2NGcmVzbmVsID0gMC4wO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBjY1JlZmxlY3Rpb24ucmdiICo9IGNjU3BlY3VsYXJpdHk7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMudXNlU3BlY3VsYXJpdHlGYWN0b3IpIHtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBjY1JlZmxlY3Rpb24ucmdiICo9IGRTcGVjdWxhcml0eUZhY3RvcjtcXG5cIjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5zaGVlbikge1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGFkZFJlZmxlY3Rpb25TaGVlbigpO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIHNSZWZsZWN0aW9uLnJnYiAqPSBzU3BlY3VsYXJpdHk7XFxuXCI7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gRnJlc25lbCBoYXMgdG8gYmUgYXBwbGllZCB0byByZWZsZWN0aW9uc1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgYWRkUmVmbGVjdGlvbigpO1xcblwiO1xuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLmZyZXNuZWxNb2RlbCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBkUmVmbGVjdGlvbi5yZ2IgKj0gZ2V0RnJlc25lbChkb3QoZFZpZXdEaXJXLCBkTm9ybWFsVyksIGRTcGVjdWxhcml0eSk7XFxuXCI7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBkUmVmbGVjdGlvbi5yZ2IgKj0gZFNwZWN1bGFyaXR5O1xcblwiO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy51c2VTcGVjdWxhcml0eUZhY3Rvcikge1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGRSZWZsZWN0aW9uLnJnYiAqPSBkU3BlY3VsYXJpdHlGYWN0b3I7XFxuXCI7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoaGFzQXJlYUxpZ2h0cykge1xuICAgICAgICAgICAgICAgIC8vIHNwZWN1bGFyIGhhcyB0byBiZSBhY2N1bXVsYXRlZCBkaWZmZXJlbnRseSBpZiB3ZSB3YW50IGFyZWEgbGlnaHRzIHRvIGxvb2sgY29ycmVjdFxuICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZFNwZWN1bGFyTGlnaHQgKj0gZFNwZWN1bGFyaXR5O1xcblwiO1xuICAgICAgICAgICAgICAgIC8vIGNvZGUgKz0gXCIgICAgZmxvYXQgcm91Z2huZXNzID0gbWF4KCgxLjAgLSBkR2xvc3NpbmVzcykgKiAoMS4wIC0gZEdsb3NzaW5lc3MpLCAwLjAwMSk7XFxuXCI7XG5cbiAgICAgICAgICAgICAgICAvLyBldmFsdWF0ZSBtYXRlcmlhbCBiYXNlZCBhcmVhIGxpZ2h0cyBkYXRhLCBzaGFyZWQgYnkgYWxsIGFyZWEgbGlnaHRzXG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMudXNlU3BlY3VsYXIpIHtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBjYWxjTFRDTGlnaHRWYWx1ZXMoKTtcXG5cIjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgb3B0aW9ucy5saWdodHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBsaWdodCA9IG9wdGlvbnMubGlnaHRzW2ldO1xuICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0VHlwZSA9IGxpZ2h0Ll90eXBlO1xuXG4gICAgICAgICAgICAgICAgLy8gaWYgY2x1c3RlcmVkIGxpZ2h0cyBhcmUgdXNlZCwgc2tpcCBub3JtYWwgbGlnaHRzIG90aGVyIHRoYW4gZGlyZWN0aW9uYWxcbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQgJiYgbGlnaHRUeXBlICE9PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwpIHtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gVGhlIGZvbGxvd2luZyBjb2RlIGlzIG5vdCBkZWNvdXBsZWQgdG8gc2VwYXJhdGUgc2hhZGVyIGZpbGVzLCBiZWNhdXNlIG1vc3Qgb2YgaXQgY2FuIGJlIGFjdHVhbGx5IGNoYW5nZWQgdG8gYWNoaWV2ZSBkaWZmZXJlbnQgYmVoYXZpb3JzIGxpa2U6XG4gICAgICAgICAgICAgICAgLy8gLSBkaWZmZXJlbnQgZmFsbG9mZnNcbiAgICAgICAgICAgICAgICAvLyAtIGRpZmZlcmVudCBzaGFkb3cgY29vcmRzIChvbW5pIHNoYWRvd3Mgd2lsbCB1c2UgZHJhc3RpY2FsbHkgZGlmZmVyZW50IGdlblNoYWRvd0Nvb3JkKVxuICAgICAgICAgICAgICAgIC8vIC0gZGlmZmVyZW50IHNoYWRvdyBmaWx0ZXIgbW9kZXNcbiAgICAgICAgICAgICAgICAvLyAtIGRpZmZlcmVudCBsaWdodCBzb3VyY2Ugc2hhcGVzXG5cbiAgICAgICAgICAgICAgICAvLyBnZXRMaWdodERpZmZ1c2UgYW5kIGdldExpZ2h0U3BlY3VsYXIgaXMgQlJERiBpdHNlbGYuXG5cbiAgICAgICAgICAgICAgICB1c2VzQ29va2llTm93ID0gZmFsc2U7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBsaWdodFNoYXBlID0gKGhhc0FyZWFMaWdodHMgJiYgbGlnaHQuX3NoYXBlKSA/IGxpZ2h0LnNoYXBlIDogTElHSFRTSEFQRV9QVU5DVFVBTDtcbiAgICAgICAgICAgICAgICBjb25zdCBzaGFwZVN0cmluZyA9IChoYXNBcmVhTGlnaHRzICYmIGxpZ2h0Ll9zaGFwZSkgPyB0aGlzLl9nZXRMaWdodFNvdXJjZVNoYXBlU3RyaW5nKGxpZ2h0U2hhcGUpIDogJyc7XG5cbiAgICAgICAgICAgICAgICBpZiAobGlnaHRTaGFwZSAhPT0gTElHSFRTSEFQRV9QVU5DVFVBTCkge1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGNhbGNcIiArIHNoYXBlU3RyaW5nICsgXCJMaWdodFZhbHVlcyhsaWdodFwiICsgaSArIFwiX3Bvc2l0aW9uLCBsaWdodFwiICsgaSArIFwiX2hhbGZXaWR0aCwgbGlnaHRcIiArIGkgKyBcIl9oYWxmSGVpZ2h0KTtcXG5cIjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAobGlnaHRUeXBlID09PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gZGlyZWN0aW9uYWxcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBkTGlnaHREaXJOb3JtVyA9IGxpZ2h0XCIgKyBpICsgXCJfZGlyZWN0aW9uO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGRBdHRlbiA9IDEuMDtcXG5cIjtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChsaWdodC5fY29va2llKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobGlnaHRUeXBlID09PSBMSUdIVFRZUEVfU1BPVCAmJiAhbGlnaHQuX2Nvb2tpZS5fY3ViZW1hcCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVzZXNDb29raWUgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVzZXNDb29raWVOb3cgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChsaWdodFR5cGUgPT09IExJR0hUVFlQRV9PTU5JICYmIGxpZ2h0Ll9jb29raWUuX2N1YmVtYXApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB1c2VzQ29va2llID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB1c2VzQ29va2llTm93ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZ2V0TGlnaHREaXJQb2ludChsaWdodFwiICsgaSArIFwiX3Bvc2l0aW9uKTtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgaGFzUG9pbnRMaWdodHMgPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICh1c2VzQ29va2llTm93KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobGlnaHRUeXBlID09PSBMSUdIVFRZUEVfU1BPVCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZEF0dGVuMyA9IGdldENvb2tpZTJEXCIgKyAobGlnaHQuX2Nvb2tpZUZhbGxvZmYgPyBcIlwiIDogXCJDbGlwXCIpICsgKGxpZ2h0Ll9jb29raWVUcmFuc2Zvcm0gPyBcIlhmb3JtXCIgOiBcIlwiKSArIFwiKGxpZ2h0XCIgKyBpICsgXCJfY29va2llLCBsaWdodFwiICsgaSArIFwiX3NoYWRvd01hdHJpeCwgbGlnaHRcIiArIGkgKyBcIl9jb29raWVJbnRlbnNpdHlcIiArIChsaWdodC5fY29va2llVHJhbnNmb3JtID8gXCIsIGxpZ2h0XCIgKyBpICsgXCJfY29va2llTWF0cml4LCBsaWdodFwiICsgaSArIFwiX2Nvb2tpZU9mZnNldFwiIDogXCJcIikgKyBcIikuXCIgKyBsaWdodC5fY29va2llQ2hhbm5lbCArIFwiO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGRBdHRlbjMgPSBnZXRDb29raWVDdWJlKGxpZ2h0XCIgKyBpICsgXCJfY29va2llLCBsaWdodFwiICsgaSArIFwiX3NoYWRvd01hdHJpeCwgbGlnaHRcIiArIGkgKyBcIl9jb29raWVJbnRlbnNpdHkpLlwiICsgbGlnaHQuX2Nvb2tpZUNoYW5uZWwgKyBcIjtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmIChsaWdodFNoYXBlID09PSBMSUdIVFNIQVBFX1BVTkNUVUFMKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobGlnaHQuX2ZhbGxvZmZNb2RlID09PSBMSUdIVEZBTExPRkZfTElORUFSKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBkQXR0ZW4gPSBnZXRGYWxsb2ZmTGluZWFyKGxpZ2h0XCIgKyBpICsgXCJfcmFkaXVzKTtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB1c2VzTGluZWFyRmFsbG9mZiA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZEF0dGVuID0gZ2V0RmFsbG9mZkludlNxdWFyZWQobGlnaHRcIiArIGkgKyBcIl9yYWRpdXMpO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVzZXNJbnZTcXVhcmVkRmFsbG9mZiA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBub24gcHVuY3R1YWwgbGlnaHRzIG9ubHkgZ2V0cyB0aGUgcmFuZ2Ugd2luZG93IGhlcmVcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZEF0dGVuID0gZ2V0RmFsbG9mZldpbmRvdyhsaWdodFwiICsgaSArIFwiX3JhZGl1cyk7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgICAgICB1c2VzSW52U3F1YXJlZEZhbGxvZmYgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBpZiAoZEF0dGVuID4gMC4wMDAwMSkge1xcblwiOyAvLyBCUkFOQ0ggU1RBUlRcblxuICAgICAgICAgICAgICAgICAgICBpZiAobGlnaHRUeXBlID09PSBMSUdIVFRZUEVfU1BPVCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCEodXNlc0Nvb2tpZU5vdyAmJiAhbGlnaHQuX2Nvb2tpZUZhbGxvZmYpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBkQXR0ZW4gKj0gZ2V0U3BvdEVmZmVjdChsaWdodFwiICsgaSArIFwiX2RpcmVjdGlvbiwgbGlnaHRcIiArIGkgKyBcIl9pbm5lckNvbmVBbmdsZSwgbGlnaHRcIiArIGkgKyBcIl9vdXRlckNvbmVBbmdsZSk7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdXNlc1Nwb3QgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gZGlmZnVzZSBsaWdodGluZyAtIExUQyBsaWdodHMgZG8gbm90IG1peCBkaWZmdXNlIGxpZ2h0aW5nIGludG8gYXR0ZW51YXRpb24gdGhhdCBhZmZlY3RzIHNwZWN1bGFyXG4gICAgICAgICAgICAgICAgaWYgKGxpZ2h0U2hhcGUgIT09IExJR0hUU0hBUEVfUFVOQ1RVQUwpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGxpZ2h0VHlwZSA9PT0gTElHSFRUWVBFX0RJUkVDVElPTkFMKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBOQjogQSBiZXR0ZXIgYXByb3hpbWF0aW9uIHBlcmhhcHMgdXNpbmcgd3JhcCBsaWdodGluZyBjb3VsZCBiZSBpbXBsZW1lbnRlZCBoZXJlXG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGRBdHRlbkQgPSBnZXRMaWdodERpZmZ1c2UoKTtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIDE2LjAgaXMgYSBjb25zdGFudCB0aGF0IGlzIGluIGdldEZhbGxvZmZJbnZTcXVhcmVkKClcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZEF0dGVuRCA9IGdldFwiICsgc2hhcGVTdHJpbmcgKyBcIkxpZ2h0RGlmZnVzZSgpICogMTYuMDtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZEF0dGVuICo9IGdldExpZ2h0RGlmZnVzZSgpO1xcblwiO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChsaWdodC5jYXN0U2hhZG93cyAmJiAhb3B0aW9ucy5ub1NoYWRvdykge1xuICAgICAgICAgICAgICAgICAgICBsZXQgc2hhZG93UmVhZE1vZGUgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICBsZXQgZXZzbUV4cDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGxpZ2h0Ll9zaGFkb3dUeXBlID09PSBTSEFET1dfVlNNOCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2hhZG93UmVhZE1vZGUgPSBcIlZTTThcIjtcbiAgICAgICAgICAgICAgICAgICAgICAgIGV2c21FeHAgPSBcIjAuMFwiO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGxpZ2h0Ll9zaGFkb3dUeXBlID09PSBTSEFET1dfVlNNMTYpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNoYWRvd1JlYWRNb2RlID0gXCJWU00xNlwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgZXZzbUV4cCA9IFwiNS41NFwiO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGxpZ2h0Ll9zaGFkb3dUeXBlID09PSBTSEFET1dfVlNNMzIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNoYWRvd1JlYWRNb2RlID0gXCJWU00zMlwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGRldmljZS50ZXh0dXJlRmxvYXRIaWdoUHJlY2lzaW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZXZzbUV4cCA9IFwiMTUuMFwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBldnNtRXhwID0gXCI1LjU0XCI7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobGlnaHQuX3NoYWRvd1R5cGUgPT09IFNIQURPV19QQ0Y1KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzaGFkb3dSZWFkTW9kZSA9IFwiUENGNXg1XCI7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzaGFkb3dSZWFkTW9kZSA9IFwiUENGM3gzXCI7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAoc2hhZG93UmVhZE1vZGUgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsaWdodFR5cGUgPT09IExJR0hUVFlQRV9PTU5JKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2hhZG93Q29vcmRBcmdzID0gXCIobGlnaHRcIiArIGkgKyBcIl9zaGFkb3dNYXAsIGxpZ2h0XCIgKyBpICsgXCJfc2hhZG93UGFyYW1zKTtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobGlnaHQuX25vcm1hbE9mZnNldEJpYXMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBub3JtYWxPZmZzZXRQb2ludFNoYWRvdyhsaWdodFwiICsgaSArIFwiX3NoYWRvd1BhcmFtcyk7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gYCAgICBmbG9hdCBzaGFkb3cke2l9ID0gZ2V0U2hhZG93UG9pbnQke3NoYWRvd1JlYWRNb2RlfSR7c2hhZG93Q29vcmRBcmdzfWA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSBgICAgIGRBdHRlbiAqPSBtaXgoMS4wLCBzaGFkb3cke2l9LCBsaWdodCR7aX1fc2hhZG93SW50ZW5zaXR5KTtcXG5gO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzaGFkb3dNYXRBcmcgPSBgbGlnaHQke2l9X3NoYWRvd01hdHJpeGA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2hhZG93UGFyYW1BcmcgPSBgbGlnaHQke2l9X3NoYWRvd1BhcmFtc2A7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSB0aGlzLl9ub25Qb2ludFNoYWRvd01hcFByb2plY3Rpb24oZGV2aWNlLCBvcHRpb25zLmxpZ2h0c1tpXSwgc2hhZG93TWF0QXJnLCBzaGFkb3dQYXJhbUFyZywgaSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobGlnaHRUeXBlID09PSBMSUdIVFRZUEVfU1BPVCkgc2hhZG93UmVhZE1vZGUgPSBcIlNwb3RcIiArIHNoYWRvd1JlYWRNb2RlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gYCAgICBmbG9hdCBzaGFkb3cke2l9ID0gZ2V0U2hhZG93JHtzaGFkb3dSZWFkTW9kZX0obGlnaHQke2l9X3NoYWRvd01hcCwgbGlnaHQke2l9X3NoYWRvd1BhcmFtcyR7KGxpZ2h0Ll9pc1ZzbSA/IFwiLCBcIiArIGV2c21FeHAgOiBcIlwiKX0pO1xcbmA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSBgICAgIGRBdHRlbiAqPSBtaXgoMS4wLCBzaGFkb3cke2l9LCBsaWdodCR7aX1fc2hhZG93SW50ZW5zaXR5KTtcXG5gO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGxpZ2h0U2hhcGUgIT09IExJR0hUU0hBUEVfUFVOQ1RVQUwpIHtcblxuICAgICAgICAgICAgICAgICAgICAvLyBhcmVhIGxpZ2h0IC0gdGhleSBkbyBub3QgbWl4IGRpZmZ1c2UgbGlnaHRpbmcgaW50byBzcGVjdWxhciBhdHRlbnVhdGlvblxuICAgICAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5jb25zZXJ2ZUVuZXJneSAmJiBvcHRpb25zLnVzZVNwZWN1bGFyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGREaWZmdXNlTGlnaHQgKz0gbWl4KChkQXR0ZW5EICogZEF0dGVuKSAqIGxpZ2h0XCIgKyBpICsgXCJfY29sb3JcIiArICh1c2VzQ29va2llTm93ID8gXCIgKiBkQXR0ZW4zXCIgOiBcIlwiKSArIFwiLCB2ZWMzKDApLCBkTFRDU3BlY0ZyZXMpO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBkRGlmZnVzZUxpZ2h0ICs9IChkQXR0ZW5EICogZEF0dGVuKSAqIGxpZ2h0XCIgKyBpICsgXCJfY29sb3JcIiArICh1c2VzQ29va2llTm93ID8gXCIgKiBkQXR0ZW4zXCIgOiBcIlwiKSArIFwiO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgICAgICAgICAvLyBwdW5jdHVhbCBsaWdodFxuICAgICAgICAgICAgICAgICAgICBpZiAoaGFzQXJlYUxpZ2h0cyAmJiBvcHRpb25zLmNvbnNlcnZlRW5lcmd5ICYmIG9wdGlvbnMudXNlU3BlY3VsYXIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZERpZmZ1c2VMaWdodCArPSBtaXgoZEF0dGVuICogbGlnaHRcIiArIGkgKyBcIl9jb2xvclwiICsgKHVzZXNDb29raWVOb3cgPyBcIiAqIGRBdHRlbjNcIiA6IFwiXCIpICsgXCIsIHZlYzMoMCksIGRTcGVjdWxhcml0eSk7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGREaWZmdXNlTGlnaHQgKz0gZEF0dGVuICogbGlnaHRcIiArIGkgKyBcIl9jb2xvclwiICsgKHVzZXNDb29raWVOb3cgPyBcIiAqIGRBdHRlbjNcIiA6IFwiXCIpICsgXCI7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy51c2VTcGVjdWxhcikge1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGRIYWxmRGlyVyA9IG5vcm1hbGl6ZSgtZExpZ2h0RGlyTm9ybVcgKyBkVmlld0RpclcpO1xcblwiO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIHNwZWN1bGFyIC8gY2xlYXIgY29hdFxuICAgICAgICAgICAgICAgIGlmIChsaWdodFNoYXBlICE9PSBMSUdIVFNIQVBFX1BVTkNUVUFMKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gYXJlYSBsaWdodFxuICAgICAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5jbGVhckNvYXQpIGNvZGUgKz0gXCIgICAgY2NTcGVjdWxhckxpZ2h0ICs9IGNjTFRDU3BlY0ZyZXMgKiBnZXRcIiArIHNoYXBlU3RyaW5nICsgXCJMaWdodFNwZWN1bGFyQ0MoKSAqIGRBdHRlbiAqIGxpZ2h0XCIgKyBpICsgXCJfY29sb3JcIiArICh1c2VzQ29va2llTm93ID8gXCIgKiBkQXR0ZW4zXCIgOiBcIlwiKSArIFwiO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy51c2VTcGVjdWxhcikgY29kZSArPSBcIiAgICBkU3BlY3VsYXJMaWdodCArPSBkTFRDU3BlY0ZyZXMgKiBnZXRcIiArIHNoYXBlU3RyaW5nICsgXCJMaWdodFNwZWN1bGFyKCkgKiBkQXR0ZW4gKiBsaWdodFwiICsgaSArIFwiX2NvbG9yXCIgKyAodXNlc0Nvb2tpZU5vdyA/IFwiICogZEF0dGVuM1wiIDogXCJcIikgKyBcIjtcXG5cIjtcblxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBjYWxjRnJlc25lbCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICBpZiAobGlnaHRUeXBlID09PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwgJiYgb3B0aW9ucy5mcmVzbmVsTW9kZWwgPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxjRnJlc25lbCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBpZiBMVEMgbGlnaHRzIGFyZSBwcmVzZW50LCBzcGVjdWxhciBtdXN0IGJlIGFjY3VtdWxhdGVkIHdpdGggc3BlY3VsYXJpdHkgKHNwZWN1bGFyaXR5IGlzIHByZSBtdWx0aXBsaWVkIGJ5IHB1bmN0dWFsIGxpZ2h0IGZyZXNuZWwpXG4gICAgICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLmNsZWFyQ29hdCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBjY1NwZWN1bGFyTGlnaHQgKz0gZ2V0TGlnaHRTcGVjdWxhckNDKGRIYWxmRGlyVykgKiBkQXR0ZW4gKiBsaWdodFwiICsgaSArIFwiX2NvbG9yXCI7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlICs9IHVzZXNDb29raWVOb3cgPyBcIiAqIGRBdHRlbjNcIiA6IFwiXCI7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlICs9IGNhbGNGcmVzbmVsID8gXCIgKiBnZXRGcmVzbmVsKGRvdChkVmlld0RpclcsIGRIYWxmRGlyVyksIHZlYzMoY2NTcGVjdWxhcml0eSkpXCIgOiBcIiAqIHZlYzMoY2NTcGVjdWxhcml0eSlcIjtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gIFwiO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLnNoZWVuKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIHNTcGVjdWxhckxpZ2h0ICs9IGdldExpZ2h0U3BlY3VsYXJTaGVlbihkSGFsZkRpclcpICogZEF0dGVuICogbGlnaHRcIiArIGkgKyBcIl9jb2xvciAqIHNTcGVjdWxhcml0eVwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSB1c2VzQ29va2llTm93ID8gXCIgKiBkQXR0ZW4zXCIgOiBcIlwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSAgXCI7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMudXNlU3BlY3VsYXIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZFNwZWN1bGFyTGlnaHQgKz0gZ2V0TGlnaHRTcGVjdWxhcihkSGFsZkRpclcpICogZEF0dGVuICogbGlnaHRcIiArIGkgKyBcIl9jb2xvclwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSB1c2VzQ29va2llTm93ID8gXCIgKiBkQXR0ZW4zXCIgOiBcIlwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSBjYWxjRnJlc25lbCA/IFwiICogZ2V0RnJlc25lbChkb3QoZFZpZXdEaXJXLCBkSGFsZkRpclcpLCBkU3BlY3VsYXJpdHkpXCIgOiBcIiAqIGRTcGVjdWxhcml0eVwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIjtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChsaWdodFR5cGUgIT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCkge1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIH1cXG5cIjsgLy8gQlJBTkNIIEVORFxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJcXG5cIjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gY2x1c3RlcmVkIGxpZ2h0aW5nXG4gICAgICAgICAgICBpZiAob3B0aW9ucy5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQgJiYgdGhpcy5saWdodGluZykge1xuICAgICAgICAgICAgICAgIHVzZXNMaW5lYXJGYWxsb2ZmID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB1c2VzSW52U3F1YXJlZEZhbGxvZmYgPSB0cnVlO1xuICAgICAgICAgICAgICAgIGhhc1BvaW50TGlnaHRzID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGFkZENsdXN0ZXJlZExpZ2h0cygpO1xcblwiO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoaGFzQXJlYUxpZ2h0cykge1xuICAgICAgICAgICAgICAgIC8vIHNwZWN1bGFyIGhhcyB0byBiZSBhY2N1bXVsYXRlZCBkaWZmZXJlbnRseSBpZiB3ZSB3YW50IGFyZWEgbGlnaHRzIHRvIGxvb2sgY29ycmVjdFxuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLmNsZWFyQ29hdCkge1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGNjU3BlY3VsYXJpdHkgPSAxLjA7XFxuXCI7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLnVzZVNwZWN1bGFyKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZFNwZWN1bGFyaXR5ID0gdmVjMygxKTtcXG5cIjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zLnJlZnJhY3Rpb24pIHtcbiAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGFkZFJlZnJhY3Rpb24oKTtcXG5cIjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjb2RlICs9IFwiXFxuXCI7XG5cbiAgICAgICAgaWYgKHVzZUFvKSB7XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5vY2NsdWRlRGlyZWN0KSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBvY2NsdWRlRGlmZnVzZSgpO1xcblwiO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKG9wdGlvbnMub2NjbHVkZVNwZWN1bGFyID09PSBTUEVDT0NDX0FPIHx8IG9wdGlvbnMub2NjbHVkZVNwZWN1bGFyID09PSBTUEVDT0NDX0dMT1NTREVQRU5ERU5UKSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBvY2NsdWRlU3BlY3VsYXIoKTtcXG5cIjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLnVzZVNwZWN1bGFyaXR5RmFjdG9yKSB7XG4gICAgICAgICAgICBjb2RlICs9IFwiICAgIGRTcGVjdWxhckxpZ2h0ICo9IGRTcGVjdWxhcml0eUZhY3RvcjtcXG5cIjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLm9wYWNpdHlGYWRlc1NwZWN1bGFyID09PSBmYWxzZSkge1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMuYmxlbmRUeXBlID09PSBCTEVORF9OT1JNQUwgfHwgb3B0aW9ucy5ibGVuZFR5cGUgPT09IEJMRU5EX1BSRU1VTFRJUExJRUQpIHtcbiAgICAgICAgICAgICAgICBjb2RlICs9IFwiZmxvYXQgc3BlY0x1bSA9IGRvdCgoZFNwZWN1bGFyTGlnaHQgKyBkUmVmbGVjdGlvbi5yZ2IgKiBkUmVmbGVjdGlvbi5hKSwgdmVjMyggMC4yMTI2LCAwLjcxNTIsIDAuMDcyMiApKTtcXG5cIjtcbiAgICAgICAgICAgICAgICBjb2RlICs9IFwiI2lmZGVmIExJVF9DTEVBUkNPQVRcXG4gc3BlY0x1bSArPSBkb3QoY2NTcGVjdWxhckxpZ2h0ICogY2NTcGVjdWxhcml0eSArIGNjUmVmbGVjdGlvbi5yZ2IgKiBjY1NwZWN1bGFyaXR5LCB2ZWMzKCAwLjIxMjYsIDAuNzE1MiwgMC4wNzIyICkpO1xcbiNlbmRpZlxcblwiO1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJkQWxwaGEgPSBjbGFtcChkQWxwaGEgKyBnYW1tYUNvcnJlY3RJbnB1dChzcGVjTHVtKSwgMC4wLCAxLjApO1xcblwiO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29kZSArPSBcImRBbHBoYSAqPSBtYXRlcmlhbF9hbHBoYUZhZGU7XFxuXCI7XG4gICAgICAgIH1cblxuICAgICAgICBjb2RlICs9IGNodW5rcy5lbmRQUztcbiAgICAgICAgaWYgKG9wdGlvbnMuYmxlbmRUeXBlID09PSBCTEVORF9OT1JNQUwgfHwgb3B0aW9ucy5ibGVuZFR5cGUgPT09IEJMRU5EX0FERElUSVZFQUxQSEEgfHwgb3B0aW9ucy5hbHBoYVRvQ292ZXJhZ2UpIHtcbiAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLm91dHB1dEFscGhhUFM7XG4gICAgICAgIH0gZWxzZSBpZiAob3B0aW9ucy5ibGVuZFR5cGUgPT09IEJMRU5EX1BSRU1VTFRJUExJRUQpIHtcbiAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLm91dHB1dEFscGhhUHJlbXVsUFM7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb2RlICs9IGNodW5rcy5vdXRwdXRBbHBoYU9wYXF1ZVBTO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdGlvbnMubXNkZikge1xuICAgICAgICAgICAgY29kZSArPSBcIiAgICBnbF9GcmFnQ29sb3IgPSBhcHBseU1zZGYoZ2xfRnJhZ0NvbG9yKTtcXG5cIjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvZGUgKz0gXCJcXG5cIjtcbiAgICAgICAgY29kZSArPSBlbmQoKTtcblxuICAgICAgICBpZiAoaGFzUG9pbnRMaWdodHMpIHtcbiAgICAgICAgICAgIGNvZGUgPSBjaHVua3MubGlnaHREaXJQb2ludFBTICsgY29kZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodXNlc0xpbmVhckZhbGxvZmYpIHtcbiAgICAgICAgICAgIGNvZGUgPSBjaHVua3MuZmFsbG9mZkxpbmVhclBTICsgY29kZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodXNlc0ludlNxdWFyZWRGYWxsb2ZmKSB7XG4gICAgICAgICAgICBjb2RlID0gY2h1bmtzLmZhbGxvZmZJbnZTcXVhcmVkUFMgKyBjb2RlO1xuICAgICAgICB9XG4gICAgICAgIGlmICh1c2VzU3BvdCkge1xuICAgICAgICAgICAgY29kZSA9IGNodW5rcy5zcG90UFMgKyBjb2RlO1xuICAgICAgICB9XG4gICAgICAgIGlmICh1c2VzQ29va2llICYmICFvcHRpb25zLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCkge1xuICAgICAgICAgICAgLy8gbm9uLWNsdXN0ZXJlZCBsaWdodHMgY29va2llIGNvZGVcbiAgICAgICAgICAgIGNvZGUgPSBjaHVua3MuY29va2llUFMgKyBjb2RlO1xuICAgICAgICB9XG4gICAgICAgIGxldCBzdHJ1Y3RDb2RlID0gXCJcIjtcbiAgICAgICAgaWYgKGNvZGUuaW5jbHVkZXMoXCJkUmVmbGVjdGlvblwiKSkgc3RydWN0Q29kZSArPSBcInZlYzQgZFJlZmxlY3Rpb247XFxuXCI7XG4gICAgICAgIGlmIChjb2RlLmluY2x1ZGVzKFwiZFRCTlwiKSkgc3RydWN0Q29kZSArPSBcIm1hdDMgZFRCTjtcXG5cIjtcbiAgICAgICAgaWYgKGNvZGUuaW5jbHVkZXMoXCJkVmVydGV4Tm9ybWFsV1wiKSkgc3RydWN0Q29kZSArPSBcInZlYzMgZFZlcnRleE5vcm1hbFc7XFxuXCI7XG4gICAgICAgIGlmIChjb2RlLmluY2x1ZGVzKFwiZFRhbmdlbnRXXCIpKSBzdHJ1Y3RDb2RlICs9IFwidmVjMyBkVGFuZ2VudFc7XFxuXCI7XG4gICAgICAgIGlmIChjb2RlLmluY2x1ZGVzKFwiZEJpbm9ybWFsV1wiKSkgc3RydWN0Q29kZSArPSBcInZlYzMgZEJpbm9ybWFsVztcXG5cIjtcbiAgICAgICAgaWYgKGNvZGUuaW5jbHVkZXMoXCJkVmlld0RpcldcIikpIHN0cnVjdENvZGUgKz0gXCJ2ZWMzIGRWaWV3RGlyVztcXG5cIjtcbiAgICAgICAgaWYgKGNvZGUuaW5jbHVkZXMoXCJkUmVmbERpcldcIikpIHN0cnVjdENvZGUgKz0gXCJ2ZWMzIGRSZWZsRGlyVztcXG5cIjtcbiAgICAgICAgaWYgKGNvZGUuaW5jbHVkZXMoXCJkSGFsZkRpcldcIikpIHN0cnVjdENvZGUgKz0gXCJ2ZWMzIGRIYWxmRGlyVztcXG5cIjtcbiAgICAgICAgaWYgKGNvZGUuaW5jbHVkZXMoXCJkRGlmZnVzZUxpZ2h0XCIpKSBzdHJ1Y3RDb2RlICs9IFwidmVjMyBkRGlmZnVzZUxpZ2h0O1xcblwiO1xuICAgICAgICBpZiAoY29kZS5pbmNsdWRlcyhcImRTcGVjdWxhckxpZ2h0XCIpKSBzdHJ1Y3RDb2RlICs9IFwidmVjMyBkU3BlY3VsYXJMaWdodDtcXG5cIjtcbiAgICAgICAgaWYgKGNvZGUuaW5jbHVkZXMoXCJkTGlnaHREaXJOb3JtV1wiKSkgc3RydWN0Q29kZSArPSBcInZlYzMgZExpZ2h0RGlyTm9ybVc7XFxuXCI7XG4gICAgICAgIGlmIChjb2RlLmluY2x1ZGVzKFwiZExpZ2h0RGlyV1wiKSkgc3RydWN0Q29kZSArPSBcInZlYzMgZExpZ2h0RGlyVztcXG5cIjtcbiAgICAgICAgaWYgKGNvZGUuaW5jbHVkZXMoXCJkTGlnaHRQb3NXXCIpKSBzdHJ1Y3RDb2RlICs9IFwidmVjMyBkTGlnaHRQb3NXO1xcblwiO1xuICAgICAgICBpZiAoY29kZS5pbmNsdWRlcyhcImRTaGFkb3dDb29yZFwiKSkgc3RydWN0Q29kZSArPSBcInZlYzMgZFNoYWRvd0Nvb3JkO1xcblwiO1xuICAgICAgICBpZiAoY29kZS5pbmNsdWRlcyhcImRBdHRlblwiKSkgc3RydWN0Q29kZSArPSBcImZsb2F0IGRBdHRlbjtcXG5cIjtcbiAgICAgICAgaWYgKGNvZGUuaW5jbHVkZXMoXCJkQXR0ZW5EXCIpKSBzdHJ1Y3RDb2RlICs9IFwiZmxvYXQgZEF0dGVuRDtcXG5cIjsgLy8gc2VwYXJhdGUgZGlmZnVzZSBhdHRlbnVhdGlvbiBmb3Igbm9uLXB1bmN0dWFsIGxpZ2h0IHNvdXJjZXNcbiAgICAgICAgaWYgKGNvZGUuaW5jbHVkZXMoXCJkQXR0ZW4zXCIpKSBzdHJ1Y3RDb2RlICs9IFwidmVjMyBkQXR0ZW4zO1xcblwiO1xuICAgICAgICBpZiAoY29kZS5pbmNsdWRlcyhcImRNc2RmXCIpKSBzdHJ1Y3RDb2RlICs9IFwidmVjNCBkTXNkZjtcXG5cIjtcbiAgICAgICAgaWYgKGNvZGUuaW5jbHVkZXMoXCJjY0ZyZXNuZWxcIikpIHN0cnVjdENvZGUgKz0gXCJmbG9hdCBjY0ZyZXNuZWw7XFxuXCI7XG4gICAgICAgIGlmIChjb2RlLmluY2x1ZGVzKFwiY2NSZWZsZWN0aW9uXCIpKSBzdHJ1Y3RDb2RlICs9IFwidmVjMyBjY1JlZmxlY3Rpb247XFxuXCI7XG4gICAgICAgIGlmIChjb2RlLmluY2x1ZGVzKFwiY2NSZWZsRGlyV1wiKSkgc3RydWN0Q29kZSArPSBcInZlYzMgY2NSZWZsRGlyVztcXG5cIjtcbiAgICAgICAgaWYgKGNvZGUuaW5jbHVkZXMoXCJjY1NwZWN1bGFyTGlnaHRcIikpIHN0cnVjdENvZGUgKz0gXCJ2ZWMzIGNjU3BlY3VsYXJMaWdodDtcXG5cIjtcbiAgICAgICAgaWYgKGNvZGUuaW5jbHVkZXMoXCJjY1NwZWN1bGFyaXR5Tm9GcmVzXCIpKSBzdHJ1Y3RDb2RlICs9IFwiZmxvYXQgY2NTcGVjdWxhcml0eU5vRnJlcztcXG5cIjtcbiAgICAgICAgaWYgKGNvZGUuaW5jbHVkZXMoXCJzU3BlY3VsYXJMaWdodFwiKSkgc3RydWN0Q29kZSArPSBcInZlYzMgc1NwZWN1bGFyTGlnaHQ7XFxuXCI7XG4gICAgICAgIGlmIChjb2RlLmluY2x1ZGVzKFwic1JlZmxlY3Rpb25cIikpIHN0cnVjdENvZGUgKz0gXCJ2ZWM0IHNSZWZsZWN0aW9uO1xcblwiO1xuXG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMuX2ZzR2V0QmVnaW5Db2RlKCkgK1xuICAgICAgICAgICAgdGhpcy52YXJ5aW5ncyArXG4gICAgICAgICAgICB0aGlzLl9mc0dldEJhc2VDb2RlKCkgK1xuICAgICAgICAgICAgKG9wdGlvbnMuZGV0YWlsTW9kZXMgPyBjaHVua3MuZGV0YWlsTW9kZXNQUyA6IFwiXCIpICtcbiAgICAgICAgICAgIHN0cnVjdENvZGUgK1xuICAgICAgICAgICAgdGhpcy5mcm9udGVuZERlY2wgK1xuICAgICAgICAgICAgY29kZTtcblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIGdlbmVyYXRlRnJhZ21lbnRTaGFkZXIoZnJvbnRlbmREZWNsLCBmcm9udGVuZENvZGUsIGZyb250ZW5kRnVuYywgbGlnaHRpbmdVdikge1xuICAgICAgICBjb25zdCBvcHRpb25zID0gdGhpcy5vcHRpb25zO1xuXG4gICAgICAgIHRoaXMuZnJvbnRlbmREZWNsID0gZnJvbnRlbmREZWNsO1xuICAgICAgICB0aGlzLmZyb250ZW5kQ29kZSA9IGZyb250ZW5kQ29kZTtcbiAgICAgICAgdGhpcy5mcm9udGVuZEZ1bmMgPSBmcm9udGVuZEZ1bmM7XG4gICAgICAgIHRoaXMubGlnaHRpbmdVdiA9IGxpZ2h0aW5nVXY7XG5cbiAgICAgICAgaWYgKG9wdGlvbnMucGFzcyA9PT0gU0hBREVSX1BJQ0spIHtcbiAgICAgICAgICAgIHRoaXMuZnNoYWRlciA9IHRoaXMuX2ZzR2V0UGlja1Bhc3NDb2RlKCk7XG4gICAgICAgIH0gZWxzZSBpZiAob3B0aW9ucy5wYXNzID09PSBTSEFERVJfREVQVEgpIHtcbiAgICAgICAgICAgIHRoaXMuZnNoYWRlciA9IHRoaXMuX2ZzR2V0RGVwdGhQYXNzQ29kZSgpO1xuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuc2hhZG93UGFzcykge1xuICAgICAgICAgICAgdGhpcy5mc2hhZGVyID0gdGhpcy5fZnNHZXRTaGFkb3dQYXNzQ29kZSgpO1xuICAgICAgICB9IGVsc2UgaWYgKG9wdGlvbnMuY3VzdG9tRnJhZ21lbnRTaGFkZXIpIHtcbiAgICAgICAgICAgIHRoaXMuZnNoYWRlciA9IHRoaXMuX2ZzR2V0QmVnaW5Db2RlKCkgKyBvcHRpb25zLmN1c3RvbUZyYWdtZW50U2hhZGVyO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5mc2hhZGVyID0gdGhpcy5fZnNHZXRMaXRQYXNzQ29kZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0RGVmaW5pdGlvbigpIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgICAgICAgYXR0cmlidXRlczogdGhpcy5hdHRyaWJ1dGVzLFxuICAgICAgICAgICAgdnNoYWRlcjogdGhpcy52c2hhZGVyLFxuICAgICAgICAgICAgZnNoYWRlcjogdGhpcy5mc2hhZGVyXG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKFNoYWRlclBhc3MuaXNGb3J3YXJkKHRoaXMub3B0aW9ucy5wYXNzKSkge1xuICAgICAgICAgICAgcmVzdWx0LnRhZyA9IFNIQURFUlRBR19NQVRFUklBTDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxufVxuXG5leHBvcnQge1xuICAgIExpdFNoYWRlclxufTtcbiJdLCJuYW1lcyI6WyJidWlsdGluQXR0cmlidXRlcyIsInZlcnRleF9ub3JtYWwiLCJTRU1BTlRJQ19OT1JNQUwiLCJ2ZXJ0ZXhfdGFuZ2VudCIsIlNFTUFOVElDX1RBTkdFTlQiLCJ2ZXJ0ZXhfdGV4Q29vcmQwIiwiU0VNQU5USUNfVEVYQ09PUkQwIiwidmVydGV4X3RleENvb3JkMSIsIlNFTUFOVElDX1RFWENPT1JEMSIsInZlcnRleF9jb2xvciIsIlNFTUFOVElDX0NPTE9SIiwidmVydGV4X2JvbmVXZWlnaHRzIiwiU0VNQU5USUNfQkxFTkRXRUlHSFQiLCJ2ZXJ0ZXhfYm9uZUluZGljZXMiLCJTRU1BTlRJQ19CTEVORElORElDRVMiLCJidWlsdGluVmFyeWluZ3MiLCJ2VmVydGV4Q29sb3IiLCJ2UG9zaXRpb25XIiwidk5vcm1hbFYiLCJ2Tm9ybWFsVyIsInZUYW5nZW50VyIsInZCaW5vcm1hbFciLCJ2T2JqZWN0U3BhY2VVcFciLCJ2VXYwIiwidlV2MSIsIkxpdFNoYWRlciIsImNvbnN0cnVjdG9yIiwiZGV2aWNlIiwib3B0aW9ucyIsImF0dHJpYnV0ZXMiLCJ2ZXJ0ZXhfcG9zaXRpb24iLCJTRU1BTlRJQ19QT1NJVElPTiIsImNodW5rcyIsInVzZXJDaHVua3MiLCJ2YWxpZGF0ZVVzZXJDaHVua3MiLCJjaHVua05hbWUiLCJzaGFkZXJDaHVua3MiLCJoYXNPd25Qcm9wZXJ0eSIsImNodW5rIiwiYSIsImluZGV4T2YiLCJsaWdodGluZyIsImxpZ2h0cyIsImxlbmd0aCIsImRpckxpZ2h0TWFwIiwiY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkIiwicmVmbGVjdGlvbnMiLCJyZWZsZWN0aW9uU291cmNlIiwidXNlU3BlY3VsYXIiLCJzcGVjdWxhck1hcCIsImdsb3NzTWFwIiwic2hhZG93UGFzcyIsIlNoYWRlclBhc3MiLCJpc1NoYWRvdyIsInBhc3MiLCJuZWVkc05vcm1hbCIsImFtYmllbnRTSCIsImhlaWdodE1hcCIsImVuYWJsZUdHWFNwZWN1bGFyIiwiY2xlYXJDb2F0Tm9ybWFsTWFwIiwibmVlZHNTY2VuZUNvbG9yIiwidXNlRHluYW1pY1JlZnJhY3Rpb24iLCJuZWVkc1NjcmVlblNpemUiLCJuZWVkc1RyYW5zZm9ybXMiLCJ2YXJ5aW5ncyIsInZzaGFkZXIiLCJmcm9udGVuZERlY2wiLCJmcm9udGVuZENvZGUiLCJmcm9udGVuZEZ1bmMiLCJsaWdodGluZ1V2IiwiZGVmaW5lcyIsImZzaGFkZXIiLCJfdnNBZGRCYXNlQ29kZSIsImNvZGUiLCJiYXNlVlMiLCJuaW5lU2xpY2VkTW9kZSIsIlNQUklURV9SRU5ERVJNT0RFX1NMSUNFRCIsIlNQUklURV9SRU5ERVJNT0RFX1RJTEVEIiwiYmFzZU5pbmVTbGljZWRWUyIsIl92c0FkZFRyYW5zZm9ybUNvZGUiLCJ0cmFuc2Zvcm1WUyIsIl9zZXRNYXBUcmFuc2Zvcm0iLCJjb2RlcyIsIm5hbWUiLCJpZCIsInV2IiwiY2hlY2tJZCIsInZhck5hbWUiLCJfZnNHZXRCYXNlQ29kZSIsInJlc3VsdCIsImJhc2VQUyIsImJhc2VOaW5lU2xpY2VkUFMiLCJiYXNlTmluZVNsaWNlZFRpbGVkUFMiLCJfZnNHZXRTdGFydENvZGUiLCJzdGFydFBTIiwic3RhcnROaW5lU2xpY2VkUFMiLCJzdGFydE5pbmVTbGljZWRUaWxlZFBTIiwiX2RpcmVjdGlvbmFsU2hhZG93TWFwUHJvamVjdGlvbiIsImxpZ2h0Iiwic2hhZG93Q29vcmRBcmdzIiwic2hhZG93UGFyYW1BcmciLCJsaWdodEluZGV4IiwiY29vcmRzRnVuY3Rpb25OYW1lIiwibnVtQ2FzY2FkZXMiLCJfbm9uUG9pbnRTaGFkb3dNYXBQcm9qZWN0aW9uIiwic2hhZG93TWF0QXJnIiwiX25vcm1hbE9mZnNldEJpYXMiLCJfaXNWc20iLCJfdHlwZSIsIkxJR0hUVFlQRV9TUE9UIiwiX2lzUGNmIiwid2ViZ2wyIiwiZXh0U3RhbmRhcmREZXJpdmF0aXZlcyIsIl9nZXRMaWdodFNvdXJjZVNoYXBlU3RyaW5nIiwic2hhcGUiLCJMSUdIVFNIQVBFX1JFQ1QiLCJMSUdIVFNIQVBFX0RJU0siLCJMSUdIVFNIQVBFX1NQSEVSRSIsImdlbmVyYXRlVmVydGV4U2hhZGVyIiwidXNlVXYiLCJ1c2VVbm1vZGlmaWVkVXYiLCJtYXBUcmFuc2Zvcm1zIiwiY29kZUJvZHkiLCJTSEFERVJfREVQVEgiLCJ1c2VJbnN0YW5jaW5nIiwiaW5zdGFuY2VfbGluZTEiLCJTRU1BTlRJQ19BVFRSMTIiLCJpbnN0YW5jZV9saW5lMiIsIlNFTUFOVElDX0FUVFIxMyIsImluc3RhbmNlX2xpbmUzIiwiU0VNQU5USUNfQVRUUjE0IiwiaW5zdGFuY2VfbGluZTQiLCJTRU1BTlRJQ19BVFRSMTUiLCJpbnN0YW5jaW5nVlMiLCJmcmFnbWVudFVuaWZvcm1zQ291bnQiLCJ2aWV3Tm9ybWFsVlMiLCJoYXNUYW5nZW50cyIsIm5vcm1hbE1hcCIsInRhbmdlbnRCaW5vcm1hbFZTIiwibWF4VXZTZXRzIiwiaSIsImZvckVhY2giLCJtYXBUcmFuc2Zvcm0iLCJ2ZXJ0ZXhDb2xvcnMiLCJtc2RmIiwibXNkZlRleHRBdHRyaWJ1dGUiLCJ2ZXJ0ZXhfb3V0bGluZVBhcmFtZXRlcnMiLCJTRU1BTlRJQ19BVFRSOCIsInZlcnRleF9zaGFkb3dQYXJhbWV0ZXJzIiwiU0VNQU5USUNfQVRUUjkiLCJtc2RmVlMiLCJ1c2VNb3JwaFBvc2l0aW9uIiwidXNlTW9ycGhOb3JtYWwiLCJ1c2VNb3JwaFRleHR1cmVCYXNlZCIsIm1vcnBoX3ZlcnRleF9pZCIsIm1vcnBoX3BvczAiLCJtb3JwaF9wb3MxIiwibW9ycGhfcG9zMiIsIlNFTUFOVElDX0FUVFIxMCIsIm1vcnBoX3BvczMiLCJTRU1BTlRJQ19BVFRSMTEiLCJtb3JwaF9ucm0wIiwibW9ycGhfbnJtMSIsIm1vcnBoX25ybTIiLCJtb3JwaF9ucm0zIiwibW9ycGhfcG9zNCIsIm1vcnBoX3BvczUiLCJtb3JwaF9wb3M2IiwibW9ycGhfcG9zNyIsIm1vcnBoX25ybTQiLCJtb3JwaF9ucm01IiwibW9ycGhfbnJtNiIsIm1vcnBoX25ybTciLCJza2luIiwic2tpbkNvZGUiLCJzY3JlZW5TcGFjZSIsInBpeGVsU25hcCIsIm5vcm1hbFZTIiwic3RhcnRWUyIsImVuZFZTIiwiT2JqZWN0Iiwia2V5cyIsInYiLCJzdGFydENvZGUiLCJ2ZXJ0ZXhJbnRybyIsImV4dGVuc2lvblZTIiwiX2ZzR2V0QmVnaW5Db2RlIiwicHJlY2lzaW9uIiwiZm9yY2VGcmFnbWVudFByZWNpc2lvbiIsImZyYWdtZW50SW50cm8iLCJleHRlbnNpb25QUyIsIl9mc0dldFBpY2tQYXNzQ29kZSIsImJlZ2luIiwiZW5kIiwiX2ZzR2V0RGVwdGhQYXNzQ29kZSIsInBhY2tEZXB0aFBTIiwiX2ZzR2V0U2hhZG93UGFzc0NvZGUiLCJsaWdodFR5cGUiLCJ0b0xpZ2h0VHlwZSIsInNoYWRvd1R5cGUiLCJ0b1NoYWRvd1R5cGUiLCJTSEFET1dfVlNNMzIiLCJ0ZXh0dXJlRmxvYXRIaWdoUHJlY2lzaW9uIiwiU0hBRE9XX1ZTTTE2IiwiTElHSFRUWVBFX0RJUkVDVElPTkFMIiwiU0hBRE9XX1BDRjMiLCJMSUdIVFRZUEVfT01OSSIsIlNIQURPV19WU004IiwiaXNWc20iLCJhcHBseVNsb3BlU2NhbGVCaWFzIiwiU0hBRE9XX1BDRjUiLCJzdG9yZUVWU01QUyIsIl9mc0dldExpdFBhc3NDb2RlIiwib3BhY2l0eUZhZGVzU3BlY3VsYXIiLCJwdXNoIiwiY2xlYXJDb2F0IiwiZnJlc25lbE1vZGVsIiwiY29uc2VydmVFbmVyZ3kiLCJzaGVlbiIsImlyaWRlc2NlbmNlIiwic2hhZG93VHlwZVVzZWQiLCJudW1TaGFkb3dMaWdodHMiLCJzaGFkb3dlZERpcmVjdGlvbmFsTGlnaHRVc2VkIiwidXNlVnNtIiwidXNlUGVyc3BaYnVmZmVyU2hhZG93IiwiaGFzQXJlYUxpZ2h0cyIsInNvbWUiLCJfc2hhcGUiLCJMSUdIVFNIQVBFX1BVTkNUVUFMIiwiY2x1c3RlcmVkTGlnaHRpbmdBcmVhTGlnaHRzRW5hYmxlZCIsImFyZWFMdXRzUHJlY2lzaW9uIiwiYXJlYUxpZ2h0THV0Rm9ybWF0IiwiUElYRUxGT1JNQVRfUjhfRzhfQjhfQTgiLCJsaWdodFNoYXBlIiwiY2FzdFNoYWRvd3MiLCJub1NoYWRvdyIsIl9zaGFkb3dUeXBlIiwiX2Nvb2tpZSIsIl9jdWJlbWFwIiwiX2Nvb2tpZVRyYW5zZm9ybSIsImhhc1RCTiIsImZhc3RUYm4iLCJUQk5mYXN0UFMiLCJUQk5QUyIsIlRCTmRlcml2YXRpdmVQUyIsInJlcGxhY2UiLCJUQk5PYmplY3RTcGFjZVBTIiwic3BoZXJpY2FsUFMiLCJkZWNvZGVQUyIsImdhbW1hQ29kZSIsImdhbW1hIiwidG9uZW1hcENvZGUiLCJ0b25lTWFwIiwiZm9nQ29kZSIsImZvZyIsInVzZUN1YmVNYXBSb3RhdGlvbiIsImN1YmVNYXBSb3RhdGVQUyIsImN1YmVNYXBQcm9qZWN0aW9uIiwiY3ViZU1hcFByb2plY3RCb3hQUyIsImN1YmVNYXBQcm9qZWN0Tm9uZVBTIiwic2t5Ym94SW50ZW5zaXR5IiwiZW52TXVsdGlwbHlQUyIsImVudkNvbnN0UFMiLCJ1c2VNZXRhbG5lc3MiLCJtZXRhbG5lc3NNb2R1bGF0ZVBTIiwiRlJFU05FTF9TQ0hMSUNLIiwiZnJlc25lbFNjaGxpY2tQUyIsImlyaWRlc2NlbmNlRGlmZnJhY3Rpb25QUyIsInVzZUFvIiwiYW9NYXAiLCJhb1ZlcnRleENvbG9yIiwiYW9EaWZmdXNlT2NjUFMiLCJvY2NsdWRlU3BlY3VsYXIiLCJTUEVDT0NDX0FPIiwib2NjbHVkZVNwZWN1bGFyRmxvYXQiLCJhb1NwZWNPY2NTaW1wbGVQUyIsImFvU3BlY09jY0NvbnN0U2ltcGxlUFMiLCJTUEVDT0NDX0dMT1NTREVQRU5ERU5UIiwiYW9TcGVjT2NjUFMiLCJhb1NwZWNPY2NDb25zdFBTIiwiZml4U2VhbXMiLCJmaXhDdWJlbWFwU2VhbXNTdHJldGNoUFMiLCJmaXhDdWJlbWFwU2VhbXNOb25lUFMiLCJlbnZBdGxhc1BTIiwicmVmbGVjdGlvbkVudkhRUFMiLCJDaHVua1V0aWxzIiwiZGVjb2RlRnVuYyIsInJlZmxlY3Rpb25FbmNvZGluZyIsInJlZmxlY3Rpb25FbnZQUyIsInJlZmxlY3Rpb25DdWJlUFMiLCJzY29kZSIsInJlZmxlY3Rpb25TcGhlcmVQUyIsInJlZmxlY3Rpb25TcGhlcmVMb3dQUyIsInJlZmxlY3Rpb25DQ1BTIiwicmVmbGVjdGlvblNoZWVuUFMiLCJyZWZyYWN0aW9uIiwicmVmcmFjdGlvbkR5bmFtaWNQUyIsInJlZnJhY3Rpb25DdWJlUFMiLCJsaWdodFNoZWVuUFMiLCJjbHVzdGVyZWRMaWdodFV0aWxzUFMiLCJjbHVzdGVyZWRMaWdodGluZ0Nvb2tpZXNFbmFibGVkIiwiY2x1c3RlcmVkTGlnaHRDb29raWVzUFMiLCJjbHVzdGVyZWRMaWdodGluZ1NoYWRvd3NFbmFibGVkIiwic2hhZG93Q2FzY2FkZXNQUyIsInNoYWRvd1N0YW5kYXJkUFMiLCJzaGFkb3dTdGFuZGFyZEdMMlBTIiwic2hhZG93VlNNX2NvbW1vblBTIiwic2hhZG93VlNNOFBTIiwiZXh0VGV4dHVyZUhhbGZGbG9hdExpbmVhciIsInNoYWRvd0VWU01QUyIsInNoYWRvd0VWU01uUFMiLCJleHRUZXh0dXJlRmxvYXRMaW5lYXIiLCJiaWFzQ29uc3RQUyIsInNoYWRvd0Nvb3JkUFMiLCJzaGFkb3dDb21tb25QUyIsInNoYWRvd0Nvb3JkUGVyc3BaYnVmZmVyUFMiLCJsaWdodERpZmZ1c2VMYW1iZXJ0UFMiLCJsdGMiLCJ1c2VPbGRBbWJpZW50Iiwic2hhZGluZ01vZGVsIiwiU1BFQ1VMQVJfUEhPTkciLCJsaWdodFNwZWN1bGFyUGhvbmdQUyIsImxpZ2h0U3BlY3VsYXJBbmlzb0dHWFBTIiwibGlnaHRTcGVjdWxhckJsaW5uUFMiLCJkaWZmdXNlTWFwIiwiY29tYmluZVBTIiwibGlnaHRNYXAiLCJsaWdodFZlcnRleENvbG9yIiwibGlnaHRtYXBEaXJBZGRQUyIsImxpZ2h0bWFwQWRkUFMiLCJhZGRBbWJpZW50IiwibGlnaHRNYXBXaXRob3V0QW1iaWVudCIsImFtYmllbnRTb3VyY2UiLCJhbWJpZW50U0hQUyIsImFtYmllbnRFbnZQUyIsImFtYmllbnRFbmNvZGluZyIsImFtYmllbnRDb25zdGFudFBTIiwiYW1iaWVudFRpbnQiLCJtc2RmUFMiLCJ2aWV3RGlyUFMiLCJyZWZsRGlyQW5pc29QUyIsInJlZmxEaXJQUyIsImhhc1BvaW50TGlnaHRzIiwidXNlc0xpbmVhckZhbGxvZmYiLCJ1c2VzSW52U3F1YXJlZEZhbGxvZmYiLCJ1c2VzU3BvdCIsInVzZXNDb29raWUiLCJ1c2VzQ29va2llTm93IiwiZmxvYXRVbnBhY2tpbmdQUyIsImxpZ2h0TWFza0R5bmFtaWMiLCJzaGFkb3dUeXBlVG9TdHJpbmciLCJjbHVzdGVyZWRMaWdodGluZ1NoYWRvd1R5cGUiLCJMaWdodHNCdWZmZXIiLCJzaGFkZXJEZWZpbmVzIiwiY2x1c3RlcmVkTGlnaHRTaGFkb3dzUFMiLCJjbHVzdGVyZWRMaWdodFBTIiwidHdvU2lkZWRMaWdodGluZyIsInNlcGFyYXRlQW1iaWVudCIsIm9jY2x1ZGVEaXJlY3QiLCJ1c2VTcGVjdWxhcml0eUZhY3RvciIsInNoYXBlU3RyaW5nIiwiX2Nvb2tpZUZhbGxvZmYiLCJfY29va2llQ2hhbm5lbCIsIl9mYWxsb2ZmTW9kZSIsIkxJR0hURkFMTE9GRl9MSU5FQVIiLCJzaGFkb3dSZWFkTW9kZSIsImV2c21FeHAiLCJjYWxjRnJlc25lbCIsImJsZW5kVHlwZSIsIkJMRU5EX05PUk1BTCIsIkJMRU5EX1BSRU1VTFRJUExJRUQiLCJlbmRQUyIsIkJMRU5EX0FERElUSVZFQUxQSEEiLCJhbHBoYVRvQ292ZXJhZ2UiLCJvdXRwdXRBbHBoYVBTIiwib3V0cHV0QWxwaGFQcmVtdWxQUyIsIm91dHB1dEFscGhhT3BhcXVlUFMiLCJsaWdodERpclBvaW50UFMiLCJmYWxsb2ZmTGluZWFyUFMiLCJmYWxsb2ZmSW52U3F1YXJlZFBTIiwic3BvdFBTIiwiY29va2llUFMiLCJzdHJ1Y3RDb2RlIiwiaW5jbHVkZXMiLCJkZXRhaWxNb2RlcyIsImRldGFpbE1vZGVzUFMiLCJnZW5lcmF0ZUZyYWdtZW50U2hhZGVyIiwiU0hBREVSX1BJQ0siLCJjdXN0b21GcmFnbWVudFNoYWRlciIsImdldERlZmluaXRpb24iLCJpc0ZvcndhcmQiLCJ0YWciLCJTSEFERVJUQUdfTUFURVJJQUwiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7O0FBNEJBLE1BQU1BLGlCQUFpQixHQUFHO0FBQ3RCQyxFQUFBQSxhQUFhLEVBQUVDLGVBRE87QUFFdEJDLEVBQUFBLGNBQWMsRUFBRUMsZ0JBRk07QUFHdEJDLEVBQUFBLGdCQUFnQixFQUFFQyxrQkFISTtBQUl0QkMsRUFBQUEsZ0JBQWdCLEVBQUVDLGtCQUpJO0FBS3RCQyxFQUFBQSxZQUFZLEVBQUVDLGNBTFE7QUFNdEJDLEVBQUFBLGtCQUFrQixFQUFFQyxvQkFORTtBQU90QkMsRUFBQUEsa0JBQWtCLEVBQUVDLHFCQUFBQTtBQVBFLENBQTFCLENBQUE7QUFVQSxNQUFNQyxlQUFlLEdBQUc7QUFDcEJDLEVBQUFBLFlBQVksRUFBRSxNQURNO0FBRXBCQyxFQUFBQSxVQUFVLEVBQUUsTUFGUTtBQUdwQkMsRUFBQUEsUUFBUSxFQUFFLE1BSFU7QUFJcEJDLEVBQUFBLFFBQVEsRUFBRSxNQUpVO0FBS3BCQyxFQUFBQSxTQUFTLEVBQUUsTUFMUztBQU1wQkMsRUFBQUEsVUFBVSxFQUFFLE1BTlE7QUFPcEJDLEVBQUFBLGVBQWUsRUFBRSxNQVBHO0FBUXBCQyxFQUFBQSxJQUFJLEVBQUUsTUFSYztBQVNwQkMsRUFBQUEsSUFBSSxFQUFFLE1BQUE7QUFUYyxDQUF4QixDQUFBOztBQVlBLE1BQU1DLFNBQU4sQ0FBZ0I7QUFDWkMsRUFBQUEsV0FBVyxDQUFDQyxNQUFELEVBQVNDLE9BQVQsRUFBa0I7SUFDekIsSUFBS0QsQ0FBQUEsTUFBTCxHQUFjQSxNQUFkLENBQUE7SUFDQSxJQUFLQyxDQUFBQSxPQUFMLEdBQWVB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
