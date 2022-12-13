/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { SEMANTIC_POSITION, SEMANTIC_ATTR12, SEMANTIC_ATTR13, SEMANTIC_ATTR14, SEMANTIC_ATTR15, SEMANTIC_NORMAL, SEMANTIC_TANGENT, SEMANTIC_COLOR, SEMANTIC_ATTR8, SEMANTIC_ATTR9, SEMANTIC_ATTR10, SEMANTIC_ATTR11, SEMANTIC_BLENDWEIGHT, SEMANTIC_BLENDINDICES, PIXELFORMAT_RGBA8, SHADERTAG_MATERIAL, SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD1 } from '../../../platform/graphics/constants.js';
import { shaderChunks } from '../chunks/chunks.js';
import { ChunkUtils } from '../chunk-utils.js';
import { SPRITE_RENDERMODE_SLICED, SPRITE_RENDERMODE_TILED, LIGHTTYPE_SPOT, LIGHTSHAPE_SPHERE, LIGHTSHAPE_DISK, LIGHTSHAPE_RECT, SHADER_DEPTH, SHADOW_VSM32, SHADOW_PCF3, LIGHTTYPE_OMNI, SHADOW_VSM8, LIGHTTYPE_DIRECTIONAL, SHADOW_PCF5, LIGHTSHAPE_PUNCTUAL, FRESNEL_SCHLICK, SPECOCC_GLOSSDEPENDENT, SPECOCC_AO, SHADOW_VSM16, SPECULAR_PHONG, shadowTypeToString, LIGHTFALLOFF_LINEAR, BLEND_NORMAL, BLEND_PREMULTIPLIED, BLEND_ADDITIVEALPHA, SHADER_PICK } from '../../constants.js';
import { LightsBuffer } from '../../lighting/lights-buffer.js';
import { ShaderPass } from '../../shader-pass.js';
import { skinCode, begin, end, gammaCode, tonemapCode, fogCode } from './common.js';
import { validateUserChunks } from '../chunks/chunk-validation.js';
import { ShaderUtils } from '../../../platform/graphics/shader-utils.js';

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
    this.lighting = options.lights.length > 0 || options.dirLightMapEnabled || options.clusteredLightingEnabled;
    this.reflections = !!options.reflectionSource;
    this.shadowPass = ShaderPass.isShadow(options.pass);
    this.needsNormal = this.lighting || this.reflections || options.useSpecular || options.ambientSH || options.heightMapEnabled || options.enableGGXSpecular || options.clusteredLightingEnabled && !this.shadowPass || options.clearCoatNormalMapEnabled;
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
      if (options.hasTangents && (options.heightMapEnabled || options.normalMapEnabled || options.enableGGXSpecular)) {
        this.attributes.vertex_tangent = SEMANTIC_TANGENT;
        code += chunks.tangentBinormalVS;
        codeBody += "   vTangentW   = getTangent();\n";
        codeBody += "   vBinormalW  = getBinormal();\n";
      } else if (options.enableGGXSpecular || !device.extStandardDerivatives) {
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
    if (options.useMsdf && options.msdfTextAttribute) {
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
    const shaderPassDefine = ShaderPass.getPassShaderDefine(this.options.pass);
    this.vshader = shaderPassDefine + this.varyings + code;
  }
  _fsGetBeginCode() {
    let code = ShaderPass.getPassShaderDefine(this.options.pass);
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
      if (options.useClearCoat) {
        this.defines.push("LIT_CLEARCOAT");
      }
      if (options.fresnelModel > 0) {
        this.defines.push("LIT_SPECULAR_FRESNEL");
      }

      if (options.conserveEnergy) {
        this.defines.push("LIT_CONSERVE_ENERGY");
      }
      if (options.useSheen) {
        this.defines.push("LIT_SHEEN");
      }
      if (options.useIridescence) {
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
    if (device.areaLightLutFormat === PIXELFORMAT_RGBA8) {
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

    const hasTBN = this.needsNormal && (options.normalMapEnabled || options.clearCoatNormalMapEnabled || options.enableGGXSpecular && !options.heightMapEnabled);
    if (hasTBN) {
      if (options.hasTangents) {
        code += options.fastTbn ? chunks.TBNfastPS : chunks.TBNPS;
      } else {
        if (device.extStandardDerivatives && (options.normalMapEnabled || options.clearCoatNormalMapEnabled)) {
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
      if (options.useIridescence) {
        code += chunks.iridescenceDiffractionPS;
      }
    }
    const useAo = options.aoMapEnabled || options.useAoVertexColors;
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
      if (options.useClearCoat) {
        code += chunks.reflectionCCPS;
      }
      if (options.useSheen) {
        code += chunks.reflectionSheenPS;
      }
    }
    if (options.useRefraction) {
      if (options.useDynamicRefraction) {
        code += chunks.refractionDynamicPS;
      } else if (this.reflections) {
        code += chunks.refractionCubePS;
      }
    }
    if (options.useSheen) {
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
      if (!options.fresnelModel && !this.reflections && !options.diffuseMapEnabled) {
        code += "    uniform vec3 material_ambient;\n";
        code += "#define LIT_OLD_AMBIENT";
        useOldAmbient = true;
      }
    }
    code += chunks.combinePS;

    if (options.lightMapEnabled || options.useLightMapVertexColors) {
      code += options.useSpecular && options.dirLightMapEnabled ? chunks.lightmapDirAddPS : chunks.lightmapAddPS;
    }
    const addAmbient = !options.lightMapEnabled && !options.useLightMapVertexColors || options.lightMapWithoutAmbient;
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
    if (options.useAmbientTint && !useOldAmbient) {
      code += "uniform vec3 material_ambient;\n";
    }
    if (options.useMsdf) {
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
      if ((options.heightMapEnabled || options.normalMapEnabled) && options.hasTangents) {
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
      if (options.useClearCoat) {
        code += "    ccReflDirW = normalize(-reflect(dViewDirW, ccNormalW));\n";
      }
    }
    if (this.lighting && options.useSpecular || this.reflections) {
      if (options.useMetalness) {
        code += "    getMetalnessModulate();\n";
      }
      if (options.useIridescence) {
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
    if (options.useAmbientTint && !useOldAmbient) {
      code += "    dDiffuseLight *= material_ambient;\n";
    }
    if (useAo && !options.occludeDirect) {
      code += "    occludeDiffuse();\n";
    }
    if (options.lightMapEnabled || options.useLightMapVertexColors) {
      code += "    addLightMap();\n";
    }
    if (this.lighting || this.reflections) {
      if (this.reflections) {
        if (options.useClearCoat) {
          code += "    addReflectionCC();\n";
          if (options.fresnelModel > 0) {
            code += "    ccFresnel = getFresnelCC(dot(dViewDirW, ccNormalW));\n";
            code += "    ccReflection.rgb *= ccFresnel;\n";
          } else {
            code += "    ccFresnel = 0.0;\n";
          }
        }
        if (options.useSpecularityFactor) {
          code += "    ccReflection.rgb *= dSpecularityFactor;\n";
        }
        if (options.useSheen) {
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
          if (options.useClearCoat) code += "    ccSpecularLight += ccLTCSpecFres * get" + shapeString + "LightSpecularCC() * dAtten * light" + i + "_color" + (usesCookieNow ? " * dAtten3" : "") + ";\n";
          if (options.useSpecular) code += "    dSpecularLight += dLTCSpecFres * get" + shapeString + "LightSpecular() * dAtten * light" + i + "_color" + (usesCookieNow ? " * dAtten3" : "") + ";\n";
        } else {
          var calcFresnel = false;
          if (lightType === LIGHTTYPE_DIRECTIONAL && options.fresnelModel > 0) {
            calcFresnel = true;
          }

          if (options.useClearCoat) {
            code += "    ccSpecularLight += getLightSpecularCC(dHalfDirW) * dAtten * light" + i + "_color";
            code += usesCookieNow ? " * dAtten3" : "";
            code += calcFresnel ? " * getFresnelCC(dot(dViewDirW, dHalfDirW))" : "";
            code += ";\n";
          }
          if (options.useSheen) {
            code += "    sSpecularLight += getLightSpecularSheen(dHalfDirW) * dAtten * light" + i + "_color";
            code += usesCookieNow ? " * dAtten3" : "";
            code += ";\n";
          }
          if (options.useSpecular) {
            code += "    dSpecularLight += getLightSpecular(dHalfDirW) * dAtten * light" + i + "_color";
            code += usesCookieNow ? " * dAtten3" : "";
            code += calcFresnel ? " * getFresnel(dot(dViewDirW, dHalfDirW), dSpecularity)" : "* dSpecularity";
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
        if (options.useClearCoat) {
          code += "    ccSpecularity = 1.0;\n";
        }
        if (options.useSpecular) {
          code += "    dSpecularity = vec3(1);\n";
        }
      }
      if (options.useRefraction) {
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
    if (options.useMsdf) {
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
    const definition = ShaderUtils.createDefinition(this.device, {
      name: 'LitShader',
      attributes: this.attributes,
      vertexCode: this.vshader,
      fragmentCode: this.fshader
    });
    if (ShaderPass.isForward(this.options.pass)) {
      definition.tag = SHADERTAG_MATERIAL;
    }
    return definition;
  }
}

export { LitShader };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGl0LXNoYWRlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvcHJvZ3JhbXMvbGl0LXNoYWRlci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge1xuICAgIFNFTUFOVElDX0FUVFI4LCBTRU1BTlRJQ19BVFRSOSwgU0VNQU5USUNfQVRUUjEwLCBTRU1BTlRJQ19BVFRSMTEsIFNFTUFOVElDX0FUVFIxMiwgU0VNQU5USUNfQVRUUjEzLCBTRU1BTlRJQ19BVFRSMTQsIFNFTUFOVElDX0FUVFIxNSxcbiAgICBTRU1BTlRJQ19CTEVORElORElDRVMsIFNFTUFOVElDX0JMRU5EV0VJR0hULCBTRU1BTlRJQ19DT0xPUiwgU0VNQU5USUNfTk9STUFMLCBTRU1BTlRJQ19QT1NJVElPTiwgU0VNQU5USUNfVEFOR0VOVCxcbiAgICBTRU1BTlRJQ19URVhDT09SRDAsIFNFTUFOVElDX1RFWENPT1JEMSxcbiAgICBTSEFERVJUQUdfTUFURVJJQUwsXG4gICAgUElYRUxGT1JNQVRfUkdCQThcbn0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IHNoYWRlckNodW5rcyB9IGZyb20gJy4uL2NodW5rcy9jaHVua3MuanMnO1xuaW1wb3J0IHsgQ2h1bmtVdGlscyB9IGZyb20gJy4uL2NodW5rLXV0aWxzLmpzJztcblxuaW1wb3J0IHtcbiAgICBCTEVORF9BRERJVElWRUFMUEhBLCBCTEVORF9OT1JNQUwsIEJMRU5EX1BSRU1VTFRJUExJRUQsXG4gICAgRlJFU05FTF9TQ0hMSUNLLFxuICAgIExJR0hURkFMTE9GRl9MSU5FQVIsXG4gICAgTElHSFRTSEFQRV9QVU5DVFVBTCwgTElHSFRTSEFQRV9SRUNULCBMSUdIVFNIQVBFX0RJU0ssIExJR0hUU0hBUEVfU1BIRVJFLFxuICAgIExJR0hUVFlQRV9ESVJFQ1RJT05BTCwgTElHSFRUWVBFX09NTkksIExJR0hUVFlQRV9TUE9ULFxuICAgIFNIQURFUl9ERVBUSCwgU0hBREVSX1BJQ0ssXG4gICAgU0hBRE9XX1BDRjMsIFNIQURPV19QQ0Y1LCBTSEFET1dfVlNNOCwgU0hBRE9XX1ZTTTE2LCBTSEFET1dfVlNNMzIsXG4gICAgU1BFQ09DQ19BTywgU1BFQ09DQ19HTE9TU0RFUEVOREVOVCxcbiAgICBTUEVDVUxBUl9QSE9ORyxcbiAgICBTUFJJVEVfUkVOREVSTU9ERV9TTElDRUQsIFNQUklURV9SRU5ERVJNT0RFX1RJTEVELCBzaGFkb3dUeXBlVG9TdHJpbmdcbn0gZnJvbSAnLi4vLi4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IExpZ2h0c0J1ZmZlciB9IGZyb20gJy4uLy4uL2xpZ2h0aW5nL2xpZ2h0cy1idWZmZXIuanMnO1xuaW1wb3J0IHsgU2hhZGVyUGFzcyB9IGZyb20gJy4uLy4uL3NoYWRlci1wYXNzLmpzJztcblxuaW1wb3J0IHsgYmVnaW4sIGVuZCwgZm9nQ29kZSwgZ2FtbWFDb2RlLCBza2luQ29kZSwgdG9uZW1hcENvZGUgfSBmcm9tICcuL2NvbW1vbi5qcyc7XG5pbXBvcnQgeyB2YWxpZGF0ZVVzZXJDaHVua3MgfSBmcm9tICcuLi9jaHVua3MvY2h1bmstdmFsaWRhdGlvbi5qcyc7XG5pbXBvcnQgeyBTaGFkZXJVdGlscyB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3NoYWRlci11dGlscy5qcyc7XG5cbmNvbnN0IGJ1aWx0aW5BdHRyaWJ1dGVzID0ge1xuICAgIHZlcnRleF9ub3JtYWw6IFNFTUFOVElDX05PUk1BTCxcbiAgICB2ZXJ0ZXhfdGFuZ2VudDogU0VNQU5USUNfVEFOR0VOVCxcbiAgICB2ZXJ0ZXhfdGV4Q29vcmQwOiBTRU1BTlRJQ19URVhDT09SRDAsXG4gICAgdmVydGV4X3RleENvb3JkMTogU0VNQU5USUNfVEVYQ09PUkQxLFxuICAgIHZlcnRleF9jb2xvcjogU0VNQU5USUNfQ09MT1IsXG4gICAgdmVydGV4X2JvbmVXZWlnaHRzOiBTRU1BTlRJQ19CTEVORFdFSUdIVCxcbiAgICB2ZXJ0ZXhfYm9uZUluZGljZXM6IFNFTUFOVElDX0JMRU5ESU5ESUNFU1xufTtcblxuY29uc3QgYnVpbHRpblZhcnlpbmdzID0ge1xuICAgIHZWZXJ0ZXhDb2xvcjogXCJ2ZWM0XCIsXG4gICAgdlBvc2l0aW9uVzogXCJ2ZWMzXCIsXG4gICAgdk5vcm1hbFY6IFwidmVjM1wiLFxuICAgIHZOb3JtYWxXOiBcInZlYzNcIixcbiAgICB2VGFuZ2VudFc6IFwidmVjM1wiLFxuICAgIHZCaW5vcm1hbFc6IFwidmVjM1wiLFxuICAgIHZPYmplY3RTcGFjZVVwVzogXCJ2ZWMzXCIsXG4gICAgdlV2MDogXCJ2ZWMyXCIsXG4gICAgdlV2MTogXCJ2ZWMyXCJcbn07XG5cbmNsYXNzIExpdFNoYWRlciB7XG4gICAgY29uc3RydWN0b3IoZGV2aWNlLCBvcHRpb25zKSB7XG4gICAgICAgIHRoaXMuZGV2aWNlID0gZGV2aWNlO1xuICAgICAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuXG4gICAgICAgIC8vIHJlc29sdmUgY3VzdG9tIGNodW5rIGF0dHJpYnV0ZXNcbiAgICAgICAgdGhpcy5hdHRyaWJ1dGVzID0ge1xuICAgICAgICAgICAgdmVydGV4X3Bvc2l0aW9uOiBTRU1BTlRJQ19QT1NJVElPTlxuICAgICAgICB9O1xuXG4gICAgICAgIGlmIChvcHRpb25zLmNodW5rcykge1xuICAgICAgICAgICAgdGhpcy5jaHVua3MgPSB7fTtcblxuICAgICAgICAgICAgY29uc3QgdXNlckNodW5rcyA9IG9wdGlvbnMuY2h1bmtzO1xuXG4gICAgICAgICAgICAvLyAjaWYgX0RFQlVHXG4gICAgICAgICAgICB2YWxpZGF0ZVVzZXJDaHVua3Mob3B0aW9ucy5jaHVua3MpO1xuICAgICAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgICAgIGZvciAoY29uc3QgY2h1bmtOYW1lIGluIHNoYWRlckNodW5rcykge1xuICAgICAgICAgICAgICAgIGlmICh1c2VyQ2h1bmtzLmhhc093blByb3BlcnR5KGNodW5rTmFtZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY2h1bmsgPSB1c2VyQ2h1bmtzW2NodW5rTmFtZV07XG4gICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgYSBpbiBidWlsdGluQXR0cmlidXRlcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGJ1aWx0aW5BdHRyaWJ1dGVzLmhhc093blByb3BlcnR5KGEpICYmIGNodW5rLmluZGV4T2YoYSkgPj0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlc1thXSA9IGJ1aWx0aW5BdHRyaWJ1dGVzW2FdO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY2h1bmtzW2NodW5rTmFtZV0gPSBjaHVuaztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmNodW5rc1tjaHVua05hbWVdID0gc2hhZGVyQ2h1bmtzW2NodW5rTmFtZV07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5jaHVua3MgPSBzaGFkZXJDaHVua3M7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmxpZ2h0aW5nID0gKG9wdGlvbnMubGlnaHRzLmxlbmd0aCA+IDApIHx8IG9wdGlvbnMuZGlyTGlnaHRNYXBFbmFibGVkIHx8IG9wdGlvbnMuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkO1xuICAgICAgICB0aGlzLnJlZmxlY3Rpb25zID0gISFvcHRpb25zLnJlZmxlY3Rpb25Tb3VyY2U7XG4gICAgICAgIHRoaXMuc2hhZG93UGFzcyA9IFNoYWRlclBhc3MuaXNTaGFkb3cob3B0aW9ucy5wYXNzKTtcbiAgICAgICAgdGhpcy5uZWVkc05vcm1hbCA9IHRoaXMubGlnaHRpbmcgfHwgdGhpcy5yZWZsZWN0aW9ucyB8fCBvcHRpb25zLnVzZVNwZWN1bGFyIHx8IG9wdGlvbnMuYW1iaWVudFNIIHx8IG9wdGlvbnMuaGVpZ2h0TWFwRW5hYmxlZCB8fCBvcHRpb25zLmVuYWJsZUdHWFNwZWN1bGFyIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKG9wdGlvbnMuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkICYmICF0aGlzLnNoYWRvd1Bhc3MpIHx8IG9wdGlvbnMuY2xlYXJDb2F0Tm9ybWFsTWFwRW5hYmxlZDtcbiAgICAgICAgdGhpcy5uZWVkc1NjZW5lQ29sb3IgPSBvcHRpb25zLnVzZUR5bmFtaWNSZWZyYWN0aW9uO1xuICAgICAgICB0aGlzLm5lZWRzU2NyZWVuU2l6ZSA9IG9wdGlvbnMudXNlRHluYW1pY1JlZnJhY3Rpb247XG4gICAgICAgIHRoaXMubmVlZHNUcmFuc2Zvcm1zID0gb3B0aW9ucy51c2VEeW5hbWljUmVmcmFjdGlvbjtcblxuICAgICAgICAvLyBnZW5lcmF0ZWQgYnkgdnNoYWRlclxuICAgICAgICB0aGlzLnZhcnlpbmdzID0gXCJcIjtcbiAgICAgICAgdGhpcy52c2hhZGVyID0gbnVsbDtcblxuICAgICAgICAvLyBzdXBwbGllZCBieSBjYWxsZXJcbiAgICAgICAgdGhpcy5mcm9udGVuZERlY2wgPSBudWxsO1xuICAgICAgICB0aGlzLmZyb250ZW5kQ29kZSA9IG51bGw7XG4gICAgICAgIHRoaXMuZnJvbnRlbmRGdW5jID0gbnVsbDtcbiAgICAgICAgdGhpcy5saWdodGluZ1V2ID0gbnVsbDtcblxuICAgICAgICAvLyBkZWZpbmVzIHNldCBieSB0aGUgc2hhZGVyIGdlbmVyYXRpb25cbiAgICAgICAgdGhpcy5kZWZpbmVzID0gW107XG5cbiAgICAgICAgLy8gZ2VuZXJhdGVkIGJ5IGZzaGFkZXJcbiAgICAgICAgdGhpcy5mc2hhZGVyID0gbnVsbDtcbiAgICB9XG5cbiAgICBfdnNBZGRCYXNlQ29kZShjb2RlLCBjaHVua3MsIG9wdGlvbnMpIHtcbiAgICAgICAgY29kZSArPSBjaHVua3MuYmFzZVZTO1xuICAgICAgICBpZiAob3B0aW9ucy5uaW5lU2xpY2VkTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VEIHx8XG4gICAgICAgICAgICBvcHRpb25zLm5pbmVTbGljZWRNb2RlID09PSBTUFJJVEVfUkVOREVSTU9ERV9USUxFRCkge1xuICAgICAgICAgICAgY29kZSArPSBjaHVua3MuYmFzZU5pbmVTbGljZWRWUztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY29kZTtcbiAgICB9XG5cbiAgICBfdnNBZGRUcmFuc2Zvcm1Db2RlKGNvZGUsIGRldmljZSwgY2h1bmtzLCBvcHRpb25zKSB7XG4gICAgICAgIGNvZGUgKz0gdGhpcy5jaHVua3MudHJhbnNmb3JtVlM7XG4gICAgICAgIHJldHVybiBjb2RlO1xuICAgIH1cblxuICAgIF9zZXRNYXBUcmFuc2Zvcm0oY29kZXMsIG5hbWUsIGlkLCB1dikge1xuICAgICAgICBjb25zdCBjaGVja0lkID0gaWQgKyB1diAqIDEwMDtcbiAgICAgICAgaWYgKCFjb2Rlc1szXVtjaGVja0lkXSkge1xuICAgICAgICAgICAgLy8gdXBsb2FkIGEgM3gyIG1hdHJpeCBhbmQgbWFudWFsbHkgcGVyZm9ybSB0aGUgbXVsdGlwbGljYXRpb25cbiAgICAgICAgICAgIGNvbnN0IHZhck5hbWUgPSBgdGV4dHVyZV8ke25hbWV9TWFwVHJhbnNmb3JtYDtcbiAgICAgICAgICAgIGNvZGVzWzBdICs9IGB1bmlmb3JtIHZlYzMgJHt2YXJOYW1lfTA7XFxuYDtcbiAgICAgICAgICAgIGNvZGVzWzBdICs9IGB1bmlmb3JtIHZlYzMgJHt2YXJOYW1lfTE7XFxuYDtcbiAgICAgICAgICAgIGNvZGVzWzFdICs9IGB2YXJ5aW5nIHZlYzIgdlVWJHt1dn1fJHtpZH07XFxuYDtcbiAgICAgICAgICAgIGNvZGVzWzJdICs9IGAgICB2VVYke3V2fV8ke2lkfSA9IHZlYzIoZG90KHZlYzModXYke3V2fSwgMSksICR7dmFyTmFtZX0wKSwgZG90KHZlYzModXYke3V2fSwgMSksICR7dmFyTmFtZX0xKSk7XFxuYDtcbiAgICAgICAgICAgIGNvZGVzWzNdW2NoZWNrSWRdID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY29kZXM7XG4gICAgfVxuXG4gICAgLy8gQWRkIFwiQmFzZVwiIENvZGUgc2VjdGlvbiB0byBmcmFnbWVudCBzaGFkZXIuXG4gICAgX2ZzR2V0QmFzZUNvZGUoKSB7XG4gICAgICAgIGNvbnN0IG9wdGlvbnMgPSB0aGlzLm9wdGlvbnM7XG4gICAgICAgIGNvbnN0IGNodW5rcyA9IHRoaXMuY2h1bmtzO1xuICAgICAgICBsZXQgcmVzdWx0ID0gdGhpcy5jaHVua3MuYmFzZVBTO1xuICAgICAgICBpZiAob3B0aW9ucy5uaW5lU2xpY2VkTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VEKSB7XG4gICAgICAgICAgICByZXN1bHQgKz0gY2h1bmtzLmJhc2VOaW5lU2xpY2VkUFM7XG4gICAgICAgIH0gZWxzZSBpZiAob3B0aW9ucy5uaW5lU2xpY2VkTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfVElMRUQpIHtcbiAgICAgICAgICAgIHJlc3VsdCArPSBjaHVua3MuYmFzZU5pbmVTbGljZWRUaWxlZFBTO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgLy8gQWRkIFwiU3RhcnRcIiBDb2RlIHNlY3Rpb24gdG8gZnJhZ21lbnQgc2hhZGVyLlxuICAgIF9mc0dldFN0YXJ0Q29kZShjb2RlLCBkZXZpY2UsIGNodW5rcywgb3B0aW9ucykge1xuICAgICAgICBsZXQgcmVzdWx0ID0gY2h1bmtzLnN0YXJ0UFM7XG4gICAgICAgIGlmIChvcHRpb25zLm5pbmVTbGljZWRNb2RlID09PSBTUFJJVEVfUkVOREVSTU9ERV9TTElDRUQpIHtcbiAgICAgICAgICAgIHJlc3VsdCArPSBjaHVua3Muc3RhcnROaW5lU2xpY2VkUFM7XG4gICAgICAgIH0gZWxzZSBpZiAob3B0aW9ucy5uaW5lU2xpY2VkTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfVElMRUQpIHtcbiAgICAgICAgICAgIHJlc3VsdCArPSBjaHVua3Muc3RhcnROaW5lU2xpY2VkVGlsZWRQUztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIC8vIGhhbmRsZXMgZGlyZWN0aW9uYWwgbWFwIHNoYWRvdyBjb29yZGluYXRlIGdlbmVyYXRpb24sIGluY2x1ZGluZyBjYXNjYWRlZCBzaGFkb3dzXG4gICAgX2RpcmVjdGlvbmFsU2hhZG93TWFwUHJvamVjdGlvbihsaWdodCwgc2hhZG93Q29vcmRBcmdzLCBzaGFkb3dQYXJhbUFyZywgbGlnaHRJbmRleCwgY29vcmRzRnVuY3Rpb25OYW1lKSB7XG5cbiAgICAgICAgLy8gZm9yIHNoYWRvdyBjYXNjYWRlc1xuICAgICAgICBsZXQgY29kZSA9IFwiXCI7XG4gICAgICAgIGlmIChsaWdodC5udW1DYXNjYWRlcyA+IDEpIHtcbiAgICAgICAgICAgIC8vIGNvbXB1dGUgd2hpY2ggY2FzY2FkZSBtYXRyaXggbmVlZHMgdG8gYmUgdXNlZFxuICAgICAgICAgICAgY29kZSArPSBgZ2V0U2hhZG93Q2FzY2FkZU1hdHJpeChsaWdodCR7bGlnaHRJbmRleH1fc2hhZG93TWF0cml4UGFsZXR0ZSwgbGlnaHQke2xpZ2h0SW5kZXh9X3NoYWRvd0Nhc2NhZGVEaXN0YW5jZXMsIGxpZ2h0JHtsaWdodEluZGV4fV9zaGFkb3dDYXNjYWRlQ291bnQpO1xcbmA7XG4gICAgICAgICAgICBzaGFkb3dDb29yZEFyZ3MgPSBgKGNhc2NhZGVTaGFkb3dNYXQsICR7c2hhZG93UGFyYW1Bcmd9KTtcXG5gO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gc2hhZG93IGNvb3JkaW5hdGUgZ2VuZXJhdGlvblxuICAgICAgICBjb2RlICs9IGNvb3Jkc0Z1bmN0aW9uTmFtZSArIHNoYWRvd0Nvb3JkQXJncztcblxuICAgICAgICAvLyBzdG9wIHNoYWRvdyBhdCB0aGUgZmFyIGRpc3RhbmNlXG4gICAgICAgIGNvZGUgKz0gYGZhZGVTaGFkb3cobGlnaHQke2xpZ2h0SW5kZXh9X3NoYWRvd0Nhc2NhZGVEaXN0YW5jZXMpO1xcbmA7XG4gICAgICAgIHJldHVybiBjb2RlO1xuICAgIH1cblxuICAgIF9ub25Qb2ludFNoYWRvd01hcFByb2plY3Rpb24oZGV2aWNlLCBsaWdodCwgc2hhZG93TWF0QXJnLCBzaGFkb3dQYXJhbUFyZywgbGlnaHRJbmRleCkge1xuICAgICAgICBjb25zdCBzaGFkb3dDb29yZEFyZ3MgPSBgKCR7c2hhZG93TWF0QXJnfSwgJHtzaGFkb3dQYXJhbUFyZ30pO1xcbmA7XG4gICAgICAgIGlmICghbGlnaHQuX25vcm1hbE9mZnNldEJpYXMgfHwgbGlnaHQuX2lzVnNtKSB7XG4gICAgICAgICAgICBpZiAobGlnaHQuX3R5cGUgPT09IExJR0hUVFlQRV9TUE9UKSB7XG4gICAgICAgICAgICAgICAgaWYgKGxpZ2h0Ll9pc1BjZiAmJiAoZGV2aWNlLndlYmdsMiB8fCBkZXZpY2UuZXh0U3RhbmRhcmREZXJpdmF0aXZlcykpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFwiICAgICAgIGdldFNoYWRvd0Nvb3JkUGVyc3BaYnVmZmVyXCIgKyBzaGFkb3dDb29yZEFyZ3M7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBcIiAgICAgICBnZXRTaGFkb3dDb29yZFBlcnNwXCIgKyBzaGFkb3dDb29yZEFyZ3M7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fZGlyZWN0aW9uYWxTaGFkb3dNYXBQcm9qZWN0aW9uKGxpZ2h0LCBzaGFkb3dDb29yZEFyZ3MsIHNoYWRvd1BhcmFtQXJnLCBsaWdodEluZGV4LCBcImdldFNoYWRvd0Nvb3JkT3J0aG9cIik7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGxpZ2h0Ll90eXBlID09PSBMSUdIVFRZUEVfU1BPVCkge1xuICAgICAgICAgICAgaWYgKGxpZ2h0Ll9pc1BjZiAmJiAoZGV2aWNlLndlYmdsMiB8fCBkZXZpY2UuZXh0U3RhbmRhcmREZXJpdmF0aXZlcykpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gXCIgICAgICAgZ2V0U2hhZG93Q29vcmRQZXJzcFpidWZmZXJOb3JtYWxPZmZzZXRcIiArIHNoYWRvd0Nvb3JkQXJncztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBcIiAgICAgICBnZXRTaGFkb3dDb29yZFBlcnNwTm9ybWFsT2Zmc2V0XCIgKyBzaGFkb3dDb29yZEFyZ3M7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX2RpcmVjdGlvbmFsU2hhZG93TWFwUHJvamVjdGlvbihsaWdodCwgc2hhZG93Q29vcmRBcmdzLCBzaGFkb3dQYXJhbUFyZywgbGlnaHRJbmRleCwgXCJnZXRTaGFkb3dDb29yZE9ydGhvTm9ybWFsT2Zmc2V0XCIpO1xuICAgIH1cblxuICAgIF9nZXRMaWdodFNvdXJjZVNoYXBlU3RyaW5nKHNoYXBlKSB7XG4gICAgICAgIHN3aXRjaCAoc2hhcGUpIHtcbiAgICAgICAgICAgIGNhc2UgTElHSFRTSEFQRV9SRUNUOlxuICAgICAgICAgICAgICAgIHJldHVybiAnUmVjdCc7XG4gICAgICAgICAgICBjYXNlIExJR0hUU0hBUEVfRElTSzpcbiAgICAgICAgICAgICAgICByZXR1cm4gJ0Rpc2snO1xuICAgICAgICAgICAgY2FzZSBMSUdIVFNIQVBFX1NQSEVSRTpcbiAgICAgICAgICAgICAgICByZXR1cm4gJ1NwaGVyZSc7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIHJldHVybiAnJztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdlbmVyYXRlVmVydGV4U2hhZGVyKHVzZVV2LCB1c2VVbm1vZGlmaWVkVXYsIG1hcFRyYW5zZm9ybXMpIHtcbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG4gICAgICAgIGNvbnN0IG9wdGlvbnMgPSB0aGlzLm9wdGlvbnM7XG4gICAgICAgIGNvbnN0IGNodW5rcyA9IHRoaXMuY2h1bmtzO1xuXG4gICAgICAgIGxldCBjb2RlID0gJyc7XG4gICAgICAgIGxldCBjb2RlQm9keSA9ICcnO1xuXG4gICAgICAgIC8vIGNvZGUgKz0gY2h1bmtzLmJhc2VWUztcbiAgICAgICAgY29kZSA9IHRoaXMuX3ZzQWRkQmFzZUNvZGUoY29kZSwgY2h1bmtzLCBvcHRpb25zKTtcblxuICAgICAgICBjb2RlQm9keSArPSBcIiAgIHZQb3NpdGlvblcgICAgPSBnZXRXb3JsZFBvc2l0aW9uKCk7XFxuXCI7XG5cbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5wYXNzID09PSBTSEFERVJfREVQVEgpIHtcbiAgICAgICAgICAgIGNvZGUgKz0gJ3ZhcnlpbmcgZmxvYXQgdkRlcHRoO1xcbic7XG4gICAgICAgICAgICBjb2RlICs9ICcjaWZuZGVmIFZJRVdNQVRSSVhcXG4nO1xuICAgICAgICAgICAgY29kZSArPSAnI2RlZmluZSBWSUVXTUFUUklYXFxuJztcbiAgICAgICAgICAgIGNvZGUgKz0gJ3VuaWZvcm0gbWF0NCBtYXRyaXhfdmlldztcXG4nO1xuICAgICAgICAgICAgY29kZSArPSAnI2VuZGlmXFxuJztcbiAgICAgICAgICAgIGNvZGUgKz0gJyNpZm5kZWYgQ0FNRVJBUExBTkVTXFxuJztcbiAgICAgICAgICAgIGNvZGUgKz0gJyNkZWZpbmUgQ0FNRVJBUExBTkVTXFxuJztcbiAgICAgICAgICAgIGNvZGUgKz0gJ3VuaWZvcm0gdmVjNCBjYW1lcmFfcGFyYW1zO1xcblxcbic7XG4gICAgICAgICAgICBjb2RlICs9ICcjZW5kaWZcXG4nO1xuICAgICAgICAgICAgY29kZUJvZHkgKz0gXCIgICAgdkRlcHRoID0gLShtYXRyaXhfdmlldyAqIHZlYzQodlBvc2l0aW9uVywxLjApKS56ICogY2FtZXJhX3BhcmFtcy54O1xcblwiO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy51c2VJbnN0YW5jaW5nKSB7XG4gICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXMuaW5zdGFuY2VfbGluZTEgPSBTRU1BTlRJQ19BVFRSMTI7XG4gICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXMuaW5zdGFuY2VfbGluZTIgPSBTRU1BTlRJQ19BVFRSMTM7XG4gICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXMuaW5zdGFuY2VfbGluZTMgPSBTRU1BTlRJQ19BVFRSMTQ7XG4gICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXMuaW5zdGFuY2VfbGluZTQgPSBTRU1BTlRJQ19BVFRSMTU7XG4gICAgICAgICAgICBjb2RlICs9IGNodW5rcy5pbnN0YW5jaW5nVlM7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5uZWVkc05vcm1hbCkge1xuICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGVzLnZlcnRleF9ub3JtYWwgPSBTRU1BTlRJQ19OT1JNQUw7XG4gICAgICAgICAgICBjb2RlQm9keSArPSBcIiAgIHZOb3JtYWxXID0gZ2V0Tm9ybWFsKCk7XFxuXCI7XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zLnJlZmxlY3Rpb25Tb3VyY2UgPT09ICdzcGhlcmVNYXAnICYmIGRldmljZS5mcmFnbWVudFVuaWZvcm1zQ291bnQgPD0gMTYpIHtcbiAgICAgICAgICAgICAgICBjb2RlICs9IGNodW5rcy52aWV3Tm9ybWFsVlM7XG4gICAgICAgICAgICAgICAgY29kZUJvZHkgKz0gXCIgICB2Tm9ybWFsViAgICA9IGdldFZpZXdOb3JtYWwoKTtcXG5cIjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG9wdGlvbnMuaGFzVGFuZ2VudHMgJiYgKG9wdGlvbnMuaGVpZ2h0TWFwRW5hYmxlZCB8fCBvcHRpb25zLm5vcm1hbE1hcEVuYWJsZWQgfHwgb3B0aW9ucy5lbmFibGVHR1hTcGVjdWxhcikpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXMudmVydGV4X3RhbmdlbnQgPSBTRU1BTlRJQ19UQU5HRU5UO1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLnRhbmdlbnRCaW5vcm1hbFZTO1xuICAgICAgICAgICAgICAgIGNvZGVCb2R5ICs9IFwiICAgdlRhbmdlbnRXICAgPSBnZXRUYW5nZW50KCk7XFxuXCI7XG4gICAgICAgICAgICAgICAgY29kZUJvZHkgKz0gXCIgICB2Qmlub3JtYWxXICA9IGdldEJpbm9ybWFsKCk7XFxuXCI7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKG9wdGlvbnMuZW5hYmxlR0dYU3BlY3VsYXIgfHwgIWRldmljZS5leHRTdGFuZGFyZERlcml2YXRpdmVzKSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBjaHVua3MudGFuZ2VudEJpbm9ybWFsVlM7XG4gICAgICAgICAgICAgICAgY29kZUJvZHkgKz0gXCIgICB2T2JqZWN0U3BhY2VVcFcgID0gZ2V0T2JqZWN0U3BhY2VVcCgpO1xcblwiO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgbWF4VXZTZXRzID0gMjtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1heFV2U2V0czsgaSsrKSB7XG4gICAgICAgICAgICBpZiAodXNlVXZbaV0pIHtcbiAgICAgICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXNbXCJ2ZXJ0ZXhfdGV4Q29vcmRcIiArIGldID0gXCJURVhDT09SRFwiICsgaTtcbiAgICAgICAgICAgICAgICBjb2RlICs9IGNodW5rc1tcInV2XCIgKyBpICsgXCJWU1wiXTtcbiAgICAgICAgICAgICAgICBjb2RlQm9keSArPSBcIiAgIHZlYzIgdXZcIiArIGkgKyBcIiA9IGdldFV2XCIgKyBpICsgXCIoKTtcXG5cIjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh1c2VVbm1vZGlmaWVkVXZbaV0pIHtcbiAgICAgICAgICAgICAgICBjb2RlQm9keSArPSBcIiAgIHZVdlwiICsgaSArIFwiID0gdXZcIiArIGkgKyBcIjtcXG5cIjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGNvZGVzID0gW2NvZGUsIHRoaXMudmFyeWluZ3MsIGNvZGVCb2R5LCBbXV07XG5cbiAgICAgICAgbWFwVHJhbnNmb3Jtcy5mb3JFYWNoKChtYXBUcmFuc2Zvcm0pID0+IHtcbiAgICAgICAgICAgIHRoaXMuX3NldE1hcFRyYW5zZm9ybShjb2RlcywgbWFwVHJhbnNmb3JtLm5hbWUsIG1hcFRyYW5zZm9ybS5pZCwgbWFwVHJhbnNmb3JtLnV2KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29kZSA9IGNvZGVzWzBdO1xuICAgICAgICB0aGlzLnZhcnlpbmdzID0gY29kZXNbMV07XG4gICAgICAgIGNvZGVCb2R5ID0gY29kZXNbMl07XG5cbiAgICAgICAgaWYgKG9wdGlvbnMudmVydGV4Q29sb3JzKSB7XG4gICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXMudmVydGV4X2NvbG9yID0gU0VNQU5USUNfQ09MT1I7XG4gICAgICAgICAgICBjb2RlQm9keSArPSBcIiAgIHZWZXJ0ZXhDb2xvciA9IHZlcnRleF9jb2xvcjtcXG5cIjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLnVzZU1zZGYgJiYgb3B0aW9ucy5tc2RmVGV4dEF0dHJpYnV0ZSkge1xuICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGVzLnZlcnRleF9vdXRsaW5lUGFyYW1ldGVycyA9IFNFTUFOVElDX0FUVFI4O1xuICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGVzLnZlcnRleF9zaGFkb3dQYXJhbWV0ZXJzID0gU0VNQU5USUNfQVRUUjk7XG5cbiAgICAgICAgICAgIGNvZGVCb2R5ICs9IFwiICAgIHVucGFja01zZGZQYXJhbXMoKTtcXG5cIjtcblxuICAgICAgICAgICAgY29kZSArPSBjaHVua3MubXNkZlZTO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gbW9ycGhpbmdcbiAgICAgICAgaWYgKG9wdGlvbnMudXNlTW9ycGhQb3NpdGlvbiB8fCBvcHRpb25zLnVzZU1vcnBoTm9ybWFsKSB7XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zLnVzZU1vcnBoVGV4dHVyZUJhc2VkKSB7XG5cbiAgICAgICAgICAgICAgICBjb2RlICs9IFwiI2RlZmluZSBNT1JQSElOR19URVhUVVJFX0JBU0VEXFxuXCI7XG5cbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy51c2VNb3JwaFBvc2l0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIjZGVmaW5lIE1PUlBISU5HX1RFWFRVUkVfQkFTRURfUE9TSVRJT05cXG5cIjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy51c2VNb3JwaE5vcm1hbCkge1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiI2RlZmluZSBNT1JQSElOR19URVhUVVJFX0JBU0VEX05PUk1BTFxcblwiO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIHZlcnRleCBpZHMgYXR0cmlidXRlc1xuICAgICAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlcy5tb3JwaF92ZXJ0ZXhfaWQgPSBTRU1BTlRJQ19BVFRSMTU7XG4gICAgICAgICAgICAgICAgY29kZSArPSBcImF0dHJpYnV0ZSBmbG9hdCBtb3JwaF92ZXJ0ZXhfaWQ7XFxuXCI7XG5cbiAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICAvLyBzZXQgdXAgOCBzbG90cyBmb3IgbW9ycGhpbmcuIHRoZXNlIGFyZSBzdXBwb3J0ZWQgY29tYmluYXRpb25zOiBQUFBQUFBQUCwgTk5OTk5OTk4sIFBQUFBOTk5OXG4gICAgICAgICAgICAgICAgY29kZSArPSBcIiNkZWZpbmUgTU9SUEhJTkdcXG5cIjtcblxuICAgICAgICAgICAgICAgIC8vIGZpcnN0IDQgc2xvdHMgYXJlIGVpdGhlciBwb3NpdGlvbiBvciBub3JtYWxcbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy51c2VNb3JwaFBvc2l0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlcy5tb3JwaF9wb3MwID0gU0VNQU5USUNfQVRUUjg7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlcy5tb3JwaF9wb3MxID0gU0VNQU5USUNfQVRUUjk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlcy5tb3JwaF9wb3MyID0gU0VNQU5USUNfQVRUUjEwO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXMubW9ycGhfcG9zMyA9IFNFTUFOVElDX0FUVFIxMTtcblxuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiI2RlZmluZSBNT1JQSElOR19QT1MwM1xcblwiO1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiYXR0cmlidXRlIHZlYzMgbW9ycGhfcG9zMDtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcImF0dHJpYnV0ZSB2ZWMzIG1vcnBoX3BvczE7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJhdHRyaWJ1dGUgdmVjMyBtb3JwaF9wb3MyO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiYXR0cmlidXRlIHZlYzMgbW9ycGhfcG9zMztcXG5cIjtcblxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAob3B0aW9ucy51c2VNb3JwaE5vcm1hbCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXMubW9ycGhfbnJtMCA9IFNFTUFOVElDX0FUVFI4O1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXMubW9ycGhfbnJtMSA9IFNFTUFOVElDX0FUVFI5O1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXMubW9ycGhfbnJtMiA9IFNFTUFOVElDX0FUVFIxMDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGVzLm1vcnBoX25ybTMgPSBTRU1BTlRJQ19BVFRSMTE7XG5cbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiNkZWZpbmUgTU9SUEhJTkdfTlJNMDNcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcImF0dHJpYnV0ZSB2ZWMzIG1vcnBoX25ybTA7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJhdHRyaWJ1dGUgdmVjMyBtb3JwaF9ucm0xO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiYXR0cmlidXRlIHZlYzMgbW9ycGhfbnJtMjtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcImF0dHJpYnV0ZSB2ZWMzIG1vcnBoX25ybTM7XFxuXCI7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gbmV4dCA0IHNsb3RzIGFyZSBlaXRoZXIgcG9zaXRpb24gb3Igbm9ybWFsXG4gICAgICAgICAgICAgICAgaWYgKCFvcHRpb25zLnVzZU1vcnBoTm9ybWFsKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlcy5tb3JwaF9wb3M0ID0gU0VNQU5USUNfQVRUUjEyO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXMubW9ycGhfcG9zNSA9IFNFTUFOVElDX0FUVFIxMztcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGVzLm1vcnBoX3BvczYgPSBTRU1BTlRJQ19BVFRSMTQ7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlcy5tb3JwaF9wb3M3ID0gU0VNQU5USUNfQVRUUjE1O1xuXG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIjZGVmaW5lIE1PUlBISU5HX1BPUzQ3XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJhdHRyaWJ1dGUgdmVjMyBtb3JwaF9wb3M0O1xcblwiO1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiYXR0cmlidXRlIHZlYzMgbW9ycGhfcG9zNTtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcImF0dHJpYnV0ZSB2ZWMzIG1vcnBoX3BvczY7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJhdHRyaWJ1dGUgdmVjMyBtb3JwaF9wb3M3O1xcblwiO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlcy5tb3JwaF9ucm00ID0gU0VNQU5USUNfQVRUUjEyO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXMubW9ycGhfbnJtNSA9IFNFTUFOVElDX0FUVFIxMztcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGVzLm1vcnBoX25ybTYgPSBTRU1BTlRJQ19BVFRSMTQ7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlcy5tb3JwaF9ucm03ID0gU0VNQU5USUNfQVRUUjE1O1xuXG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIjZGVmaW5lIE1PUlBISU5HX05STTQ3XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJhdHRyaWJ1dGUgdmVjMyBtb3JwaF9ucm00O1xcblwiO1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiYXR0cmlidXRlIHZlYzMgbW9ycGhfbnJtNTtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcImF0dHJpYnV0ZSB2ZWMzIG1vcnBoX25ybTY7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJhdHRyaWJ1dGUgdmVjMyBtb3JwaF9ucm03O1xcblwiO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLnNraW4pIHtcbiAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlcy52ZXJ0ZXhfYm9uZVdlaWdodHMgPSBTRU1BTlRJQ19CTEVORFdFSUdIVDtcbiAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlcy52ZXJ0ZXhfYm9uZUluZGljZXMgPSBTRU1BTlRJQ19CTEVORElORElDRVM7XG4gICAgICAgICAgICBjb2RlICs9IHNraW5Db2RlKGRldmljZSwgY2h1bmtzKTtcbiAgICAgICAgICAgIGNvZGUgKz0gXCIjZGVmaW5lIFNLSU5cXG5cIjtcbiAgICAgICAgfSBlbHNlIGlmIChvcHRpb25zLnVzZUluc3RhbmNpbmcpIHtcbiAgICAgICAgICAgIGNvZGUgKz0gXCIjZGVmaW5lIElOU1RBTkNJTkdcXG5cIjtcbiAgICAgICAgfVxuICAgICAgICBpZiAob3B0aW9ucy5zY3JlZW5TcGFjZSkge1xuICAgICAgICAgICAgY29kZSArPSBcIiNkZWZpbmUgU0NSRUVOU1BBQ0VcXG5cIjtcbiAgICAgICAgfVxuICAgICAgICBpZiAob3B0aW9ucy5waXhlbFNuYXApIHtcbiAgICAgICAgICAgIGNvZGUgKz0gXCIjZGVmaW5lIFBJWEVMU05BUFxcblwiO1xuICAgICAgICB9XG5cbiAgICAgICAgY29kZSA9IHRoaXMuX3ZzQWRkVHJhbnNmb3JtQ29kZShjb2RlLCBkZXZpY2UsIGNodW5rcywgb3B0aW9ucyk7XG5cbiAgICAgICAgaWYgKHRoaXMubmVlZHNOb3JtYWwpIHtcbiAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLm5vcm1hbFZTO1xuICAgICAgICB9XG5cbiAgICAgICAgY29kZSArPSBcIlxcblwiO1xuICAgICAgICBjb2RlICs9IGNodW5rcy5zdGFydFZTO1xuICAgICAgICBjb2RlICs9IGNvZGVCb2R5O1xuICAgICAgICBjb2RlICs9IGNodW5rcy5lbmRWUztcbiAgICAgICAgY29kZSArPSBcIn1cIjtcblxuICAgICAgICAvLyBidWlsZCB2YXJ5aW5nc1xuICAgICAgICBPYmplY3Qua2V5cyhidWlsdGluVmFyeWluZ3MpLmZvckVhY2goKHYpID0+IHtcbiAgICAgICAgICAgIGlmIChjb2RlLmluZGV4T2YodikgPj0gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMudmFyeWluZ3MgKz0gYHZhcnlpbmcgJHtidWlsdGluVmFyeWluZ3Nbdl19ICR7dn07XFxuYDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3Qgc2hhZGVyUGFzc0RlZmluZSA9IFNoYWRlclBhc3MuZ2V0UGFzc1NoYWRlckRlZmluZSh0aGlzLm9wdGlvbnMucGFzcyk7XG4gICAgICAgIHRoaXMudnNoYWRlciA9IHNoYWRlclBhc3NEZWZpbmUgKyB0aGlzLnZhcnlpbmdzICsgY29kZTtcbiAgICB9XG5cbiAgICBfZnNHZXRCZWdpbkNvZGUoKSB7XG5cbiAgICAgICAgbGV0IGNvZGUgPSBTaGFkZXJQYXNzLmdldFBhc3NTaGFkZXJEZWZpbmUodGhpcy5vcHRpb25zLnBhc3MpO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5kZWZpbmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb2RlICs9IGAjZGVmaW5lICR7dGhpcy5kZWZpbmVzW2ldfVxcbmA7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gY29kZTtcbiAgICB9XG5cbiAgICBfZnNHZXRQaWNrUGFzc0NvZGUoKSB7XG4gICAgICAgIGxldCBjb2RlID0gdGhpcy5fZnNHZXRCZWdpbkNvZGUoKTtcbiAgICAgICAgY29kZSArPSBcInVuaWZvcm0gdmVjNCB1Q29sb3I7XFxuXCI7XG4gICAgICAgIGNvZGUgKz0gdGhpcy52YXJ5aW5ncztcbiAgICAgICAgY29kZSArPSB0aGlzLmZyb250ZW5kRGVjbDtcbiAgICAgICAgY29kZSArPSB0aGlzLmZyb250ZW5kQ29kZTtcbiAgICAgICAgY29kZSArPSBiZWdpbigpO1xuICAgICAgICBjb2RlICs9IHRoaXMuZnJvbnRlbmRGdW5jO1xuICAgICAgICBjb2RlICs9IFwiICAgIGdsX0ZyYWdDb2xvciA9IHVDb2xvcjtcXG5cIjtcbiAgICAgICAgY29kZSArPSBlbmQoKTtcbiAgICAgICAgcmV0dXJuIGNvZGU7XG4gICAgfVxuXG4gICAgX2ZzR2V0RGVwdGhQYXNzQ29kZSgpIHtcbiAgICAgICAgY29uc3QgY2h1bmtzID0gdGhpcy5jaHVua3M7XG5cbiAgICAgICAgbGV0IGNvZGUgPSB0aGlzLl9mc0dldEJlZ2luQ29kZSgpO1xuXG4gICAgICAgIGNvZGUgKz0gJ3ZhcnlpbmcgZmxvYXQgdkRlcHRoO1xcbic7XG4gICAgICAgIGNvZGUgKz0gdGhpcy52YXJ5aW5ncztcbiAgICAgICAgY29kZSArPSBjaHVua3MucGFja0RlcHRoUFM7XG4gICAgICAgIGNvZGUgKz0gdGhpcy5mcm9udGVuZERlY2w7XG4gICAgICAgIGNvZGUgKz0gdGhpcy5mcm9udGVuZENvZGU7XG4gICAgICAgIGNvZGUgKz0gYmVnaW4oKTtcbiAgICAgICAgY29kZSArPSB0aGlzLmZyb250ZW5kRnVuYztcbiAgICAgICAgY29kZSArPSBcIiAgICBnbF9GcmFnQ29sb3IgPSBwYWNrRmxvYXQodkRlcHRoKTtcXG5cIjtcbiAgICAgICAgY29kZSArPSBlbmQoKTtcblxuICAgICAgICByZXR1cm4gY29kZTtcbiAgICB9XG5cbiAgICBfZnNHZXRTaGFkb3dQYXNzQ29kZSgpIHtcbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG4gICAgICAgIGNvbnN0IG9wdGlvbnMgPSB0aGlzLm9wdGlvbnM7XG4gICAgICAgIGNvbnN0IGNodW5rcyA9IHRoaXMuY2h1bmtzO1xuICAgICAgICBjb25zdCB2YXJ5aW5ncyA9IHRoaXMudmFyeWluZ3M7XG5cbiAgICAgICAgY29uc3QgbGlnaHRUeXBlID0gU2hhZGVyUGFzcy50b0xpZ2h0VHlwZShvcHRpb25zLnBhc3MpO1xuICAgICAgICBjb25zdCBzaGFkb3dUeXBlID0gU2hhZGVyUGFzcy50b1NoYWRvd1R5cGUob3B0aW9ucy5wYXNzKTtcblxuICAgICAgICBsZXQgY29kZSA9IHRoaXMuX2ZzR2V0QmVnaW5Db2RlKCk7XG5cbiAgICAgICAgaWYgKGRldmljZS5leHRTdGFuZGFyZERlcml2YXRpdmVzICYmICFkZXZpY2Uud2ViZ2wyKSB7XG4gICAgICAgICAgICBjb2RlICs9ICd1bmlmb3JtIHZlYzIgcG9seWdvbk9mZnNldDtcXG4nO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHNoYWRvd1R5cGUgPT09IFNIQURPV19WU00zMikge1xuICAgICAgICAgICAgaWYgKGRldmljZS50ZXh0dXJlRmxvYXRIaWdoUHJlY2lzaW9uKSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSAnI2RlZmluZSBWU01fRVhQT05FTlQgMTUuMFxcblxcbic7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gJyNkZWZpbmUgVlNNX0VYUE9ORU5UIDUuNTRcXG5cXG4nO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKHNoYWRvd1R5cGUgPT09IFNIQURPV19WU00xNikge1xuICAgICAgICAgICAgY29kZSArPSAnI2RlZmluZSBWU01fRVhQT05FTlQgNS41NFxcblxcbic7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobGlnaHRUeXBlICE9PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwpIHtcbiAgICAgICAgICAgIGNvZGUgKz0gJ3VuaWZvcm0gdmVjMyB2aWV3X3Bvc2l0aW9uO1xcbic7XG4gICAgICAgICAgICBjb2RlICs9ICd1bmlmb3JtIGZsb2F0IGxpZ2h0X3JhZGl1cztcXG4nO1xuICAgICAgICB9XG5cbiAgICAgICAgY29kZSArPSB2YXJ5aW5ncztcbiAgICAgICAgY29kZSArPSB0aGlzLmZyb250ZW5kRGVjbDtcbiAgICAgICAgY29kZSArPSB0aGlzLmZyb250ZW5kQ29kZTtcblxuICAgICAgICBpZiAoc2hhZG93VHlwZSA9PT0gU0hBRE9XX1BDRjMgJiYgKCFkZXZpY2Uud2ViZ2wyIHx8IGxpZ2h0VHlwZSA9PT0gTElHSFRUWVBFX09NTkkpKSB7XG4gICAgICAgICAgICBjb2RlICs9IGNodW5rcy5wYWNrRGVwdGhQUztcbiAgICAgICAgfSBlbHNlIGlmIChzaGFkb3dUeXBlID09PSBTSEFET1dfVlNNOCkge1xuICAgICAgICAgICAgY29kZSArPSBcInZlYzIgZW5jb2RlRmxvYXRSRyggZmxvYXQgdiApIHtcXG5cIjtcbiAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgdmVjMiBlbmMgPSB2ZWMyKDEuMCwgMjU1LjApICogdjtcXG5cIjtcbiAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZW5jID0gZnJhY3QoZW5jKTtcXG5cIjtcbiAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZW5jIC09IGVuYy55eSAqIHZlYzIoMS4wLzI1NS4wLCAxLjAvMjU1LjApO1xcblwiO1xuICAgICAgICAgICAgY29kZSArPSBcIiAgICByZXR1cm4gZW5jO1xcblwiO1xuICAgICAgICAgICAgY29kZSArPSBcIn1cXG5cXG5cIjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvZGUgKz0gYmVnaW4oKTtcblxuICAgICAgICBjb2RlICs9IHRoaXMuZnJvbnRlbmRGdW5jO1xuXG4gICAgICAgIGNvbnN0IGlzVnNtID0gc2hhZG93VHlwZSA9PT0gU0hBRE9XX1ZTTTggfHwgc2hhZG93VHlwZSA9PT0gU0hBRE9XX1ZTTTE2IHx8IHNoYWRvd1R5cGUgPT09IFNIQURPV19WU00zMjtcbiAgICAgICAgY29uc3QgYXBwbHlTbG9wZVNjYWxlQmlhcyA9ICFkZXZpY2Uud2ViZ2wyICYmIGRldmljZS5leHRTdGFuZGFyZERlcml2YXRpdmVzO1xuXG4gICAgICAgIGlmIChsaWdodFR5cGUgPT09IExJR0hUVFlQRV9PTU5JIHx8IChpc1ZzbSAmJiBsaWdodFR5cGUgIT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCkpIHtcbiAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZmxvYXQgZGVwdGggPSBtaW4oZGlzdGFuY2Uodmlld19wb3NpdGlvbiwgdlBvc2l0aW9uVykgLyBsaWdodF9yYWRpdXMsIDAuOTk5OTkpO1xcblwiO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29kZSArPSBcIiAgICBmbG9hdCBkZXB0aCA9IGdsX0ZyYWdDb29yZC56O1xcblwiO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGFwcGx5U2xvcGVTY2FsZUJpYXMpIHtcbiAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZmxvYXQgbWluVmFsdWUgPSAyLjMzNzQzNzA1MDAxNTMxODZlLTEwOyAvLygxLjAgLyAyNTUuMCkgLyAoMjU2LjAgKiAyNTYuMCAqIDI1Ni4wKTtcXG5cIjtcbiAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZGVwdGggKz0gcG9seWdvbk9mZnNldC54ICogbWF4KGFicyhkRmR4KGRlcHRoKSksIGFicyhkRmR5KGRlcHRoKSkpICsgbWluVmFsdWUgKiBwb2x5Z29uT2Zmc2V0Lnk7XFxuXCI7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc2hhZG93VHlwZSA9PT0gU0hBRE9XX1BDRjMgJiYgKCFkZXZpY2Uud2ViZ2wyIHx8IChsaWdodFR5cGUgPT09IExJR0hUVFlQRV9PTU5JICYmICFvcHRpb25zLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCkpKSB7XG4gICAgICAgICAgICBjb2RlICs9IFwiICAgIGdsX0ZyYWdDb2xvciA9IHBhY2tGbG9hdChkZXB0aCk7XFxuXCI7XG4gICAgICAgIH0gZWxzZSBpZiAoc2hhZG93VHlwZSA9PT0gU0hBRE9XX1BDRjMgfHwgc2hhZG93VHlwZSA9PT0gU0hBRE9XX1BDRjUpIHtcbiAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZ2xfRnJhZ0NvbG9yID0gdmVjNCgxLjApO1xcblwiOyAvLyBqdXN0IHRoZSBzaW1wbGVzdCBjb2RlLCBjb2xvciBpcyBub3Qgd3JpdHRlbiBhbnl3YXlcblxuICAgICAgICAgICAgLy8gY2x1c3RlcmVkIG9tbmkgbGlnaHQgaXMgdXNpbmcgc2hhZG93IHNhbXBsZXIgYW5kIG5lZWRzIHRvIHdyaXRlIGN1c3RvbSBkZXB0aFxuICAgICAgICAgICAgaWYgKG9wdGlvbnMuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkICYmIGxpZ2h0VHlwZSA9PT0gTElHSFRUWVBFX09NTkkgJiYgZGV2aWNlLndlYmdsMikge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZ2xfRnJhZ0RlcHRoID0gZGVwdGg7XFxuXCI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoc2hhZG93VHlwZSA9PT0gU0hBRE9XX1ZTTTgpIHtcbiAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZ2xfRnJhZ0NvbG9yID0gdmVjNChlbmNvZGVGbG9hdFJHKGRlcHRoKSwgZW5jb2RlRmxvYXRSRyhkZXB0aCpkZXB0aCkpO1xcblwiO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29kZSArPSBjaHVua3Muc3RvcmVFVlNNUFM7XG4gICAgICAgIH1cblxuICAgICAgICBjb2RlICs9IGVuZCgpO1xuXG4gICAgICAgIHJldHVybiBjb2RlO1xuICAgIH1cblxuICAgIC8vIHRoZSBiaWcgb25lXG4gICAgX2ZzR2V0TGl0UGFzc0NvZGUoKSB7XG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuICAgICAgICBjb25zdCBvcHRpb25zID0gdGhpcy5vcHRpb25zO1xuICAgICAgICBjb25zdCBjaHVua3MgPSB0aGlzLmNodW5rcztcblxuICAgICAgICBsZXQgY29kZSA9IFwiXCI7XG5cbiAgICAgICAgaWYgKG9wdGlvbnMub3BhY2l0eUZhZGVzU3BlY3VsYXIgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICBjb2RlICs9ICd1bmlmb3JtIGZsb2F0IG1hdGVyaWFsX2FscGhhRmFkZTtcXG4nO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdGlvbnMudXNlU3BlY3VsYXIpIHtcbiAgICAgICAgICAgIHRoaXMuZGVmaW5lcy5wdXNoKFwiTElUX1NQRUNVTEFSXCIpO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5yZWZsZWN0aW9ucykge1xuICAgICAgICAgICAgICAgIHRoaXMuZGVmaW5lcy5wdXNoKFwiTElUX1JFRkxFQ1RJT05TXCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAob3B0aW9ucy51c2VDbGVhckNvYXQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmRlZmluZXMucHVzaChcIkxJVF9DTEVBUkNPQVRcIik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zLmZyZXNuZWxNb2RlbCA+IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLmRlZmluZXMucHVzaChcIkxJVF9TUEVDVUxBUl9GUkVTTkVMXCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBlbmFibGUgY29uc2VydmUgZW5lcmd5IHBhdGggaW4gY2x1c3RlcmVkIGNodW5rXG4gICAgICAgICAgICBpZiAob3B0aW9ucy5jb25zZXJ2ZUVuZXJneSkge1xuICAgICAgICAgICAgICAgIHRoaXMuZGVmaW5lcy5wdXNoKFwiTElUX0NPTlNFUlZFX0VORVJHWVwiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG9wdGlvbnMudXNlU2hlZW4pIHtcbiAgICAgICAgICAgICAgICB0aGlzLmRlZmluZXMucHVzaChcIkxJVF9TSEVFTlwiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG9wdGlvbnMudXNlSXJpZGVzY2VuY2UpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmRlZmluZXMucHVzaChcIkxJVF9JUklERVNDRU5DRVwiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEZSQUdNRU5UIFNIQURFUiBJTlBVVFM6IFVOSUZPUk1TXG4gICAgICAgIGNvbnN0IHNoYWRvd1R5cGVVc2VkID0gW107XG4gICAgICAgIGxldCBudW1TaGFkb3dMaWdodHMgPSAwO1xuICAgICAgICBsZXQgc2hhZG93ZWREaXJlY3Rpb25hbExpZ2h0VXNlZCA9IGZhbHNlO1xuICAgICAgICBsZXQgdXNlVnNtID0gZmFsc2U7XG4gICAgICAgIGxldCB1c2VQZXJzcFpidWZmZXJTaGFkb3cgPSBmYWxzZTtcblxuICAgICAgICBsZXQgaGFzQXJlYUxpZ2h0cyA9IG9wdGlvbnMubGlnaHRzLnNvbWUoZnVuY3Rpb24gKGxpZ2h0KSB7XG4gICAgICAgICAgICByZXR1cm4gbGlnaHQuX3NoYXBlICYmIGxpZ2h0Ll9zaGFwZSAhPT0gTElHSFRTSEFQRV9QVU5DVFVBTDtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gaWYgY2x1c3RlcmVkIGxpZ2h0aW5nIGhhcyBhcmVhIGxpZ2h0cyBlbmFibGVkLCBpdCBhbHdheXMgcnVucyBpbiAnYXJlYSBsaWdodHMgbW9kZSdcbiAgICAgICAgLy8gVE9ETzogbWF5YmUgd2Ugc2hvdWxkIGFsd2F5cyB1c2UgaXQgYW5kIHJlbW92ZSB0aGUgb3RoZXIgd2F5P1xuICAgICAgICBpZiAob3B0aW9ucy5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQgJiYgb3B0aW9ucy5jbHVzdGVyZWRMaWdodGluZ0FyZWFMaWdodHNFbmFibGVkKSB7XG4gICAgICAgICAgICBoYXNBcmVhTGlnaHRzID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBhcmVhTHV0c1ByZWNpc2lvbiA9ICdoaWdocCc7XG4gICAgICAgIGlmIChkZXZpY2UuYXJlYUxpZ2h0THV0Rm9ybWF0ID09PSBQSVhFTEZPUk1BVF9SR0JBOCkge1xuICAgICAgICAgICAgLy8gdXNlIG9mZnNldCBhbmQgc2NhbGUgZm9yIHJnYjggZm9ybWF0IGx1dHNcbiAgICAgICAgICAgIGNvZGUgKz0gXCIjZGVmaW5lIEFSRUFfUjhfRzhfQjhfQThfTFVUU1xcblwiO1xuICAgICAgICAgICAgYXJlYUx1dHNQcmVjaXNpb24gPSAnbG93cCc7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaGFzQXJlYUxpZ2h0cyB8fCBvcHRpb25zLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCkge1xuICAgICAgICAgICAgY29kZSArPSBcIiNkZWZpbmUgQVJFQV9MSUdIVFNcXG5cIjtcbiAgICAgICAgICAgIGNvZGUgKz0gYHVuaWZvcm0gJHthcmVhTHV0c1ByZWNpc2lvbn0gc2FtcGxlcjJEIGFyZWFMaWdodHNMdXRUZXgxO1xcbmA7XG4gICAgICAgICAgICBjb2RlICs9IGB1bmlmb3JtICR7YXJlYUx1dHNQcmVjaXNpb259IHNhbXBsZXIyRCBhcmVhTGlnaHRzTHV0VGV4MjtcXG5gO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBvcHRpb25zLmxpZ2h0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGlnaHQgPSBvcHRpb25zLmxpZ2h0c1tpXTtcbiAgICAgICAgICAgIGNvbnN0IGxpZ2h0VHlwZSA9IGxpZ2h0Ll90eXBlO1xuXG4gICAgICAgICAgICAvLyBza2lwIHVuaWZvcm0gZ2VuZXJhdGlvbiBmb3IgbG9jYWwgbGlnaHRzIGlmIGNsdXN0ZXJlZCBsaWdodGluZyBpcyBlbmFibGVkXG4gICAgICAgICAgICBpZiAob3B0aW9ucy5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQgJiYgbGlnaHRUeXBlICE9PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgICAgIGNvbnN0IGxpZ2h0U2hhcGUgPSAoaGFzQXJlYUxpZ2h0cyAmJiBsaWdodC5fc2hhcGUpID8gbGlnaHQuX3NoYXBlIDogTElHSFRTSEFQRV9QVU5DVFVBTDtcblxuICAgICAgICAgICAgY29kZSArPSBcInVuaWZvcm0gdmVjMyBsaWdodFwiICsgaSArIFwiX2NvbG9yO1xcblwiO1xuICAgICAgICAgICAgaWYgKGxpZ2h0VHlwZSA9PT0gTElHSFRUWVBFX0RJUkVDVElPTkFMKSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBcInVuaWZvcm0gdmVjMyBsaWdodFwiICsgaSArIFwiX2RpcmVjdGlvbjtcXG5cIjtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBcInVuaWZvcm0gdmVjMyBsaWdodFwiICsgaSArIFwiX3Bvc2l0aW9uO1xcblwiO1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJ1bmlmb3JtIGZsb2F0IGxpZ2h0XCIgKyBpICsgXCJfcmFkaXVzO1xcblwiO1xuICAgICAgICAgICAgICAgIGlmIChsaWdodFR5cGUgPT09IExJR0hUVFlQRV9TUE9UKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJ1bmlmb3JtIHZlYzMgbGlnaHRcIiArIGkgKyBcIl9kaXJlY3Rpb247XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJ1bmlmb3JtIGZsb2F0IGxpZ2h0XCIgKyBpICsgXCJfaW5uZXJDb25lQW5nbGU7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJ1bmlmb3JtIGZsb2F0IGxpZ2h0XCIgKyBpICsgXCJfb3V0ZXJDb25lQW5nbGU7XFxuXCI7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGxpZ2h0U2hhcGUgIT09IExJR0hUU0hBUEVfUFVOQ1RVQUwpIHtcbiAgICAgICAgICAgICAgICBpZiAobGlnaHRUeXBlID09PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwpIHtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcInVuaWZvcm0gdmVjMyBsaWdodFwiICsgaSArIFwiX3Bvc2l0aW9uO1xcblwiO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb2RlICs9IFwidW5pZm9ybSB2ZWMzIGxpZ2h0XCIgKyBpICsgXCJfaGFsZldpZHRoO1xcblwiO1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJ1bmlmb3JtIHZlYzMgbGlnaHRcIiArIGkgKyBcIl9oYWxmSGVpZ2h0O1xcblwiO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGxpZ2h0LmNhc3RTaGFkb3dzICYmICFvcHRpb25zLm5vU2hhZG93KSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBcInVuaWZvcm0gbWF0NCBsaWdodFwiICsgaSArIFwiX3NoYWRvd01hdHJpeDtcXG5cIjtcbiAgICAgICAgICAgICAgICBjb2RlICs9IFwidW5pZm9ybSBmbG9hdCBsaWdodFwiICsgaSArIFwiX3NoYWRvd0ludGVuc2l0eTtcXG5cIjtcblxuICAgICAgICAgICAgICAgIC8vIGRpcmVjdGlvbmFsIChjYXNjYWRlZCkgc2hhZG93c1xuICAgICAgICAgICAgICAgIGlmIChsaWdodFR5cGUgPT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCkge1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwidW5pZm9ybSBtYXQ0IGxpZ2h0XCIgKyBpICsgXCJfc2hhZG93TWF0cml4UGFsZXR0ZVs0XTtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcInVuaWZvcm0gZmxvYXQgbGlnaHRcIiArIGkgKyBcIl9zaGFkb3dDYXNjYWRlRGlzdGFuY2VzWzRdO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwidW5pZm9ybSBmbG9hdCBsaWdodFwiICsgaSArIFwiX3NoYWRvd0Nhc2NhZGVDb3VudDtcXG5cIjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAobGlnaHRUeXBlICE9PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwpIHtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcInVuaWZvcm0gdmVjNCBsaWdodFwiICsgaSArIFwiX3NoYWRvd1BhcmFtcztcXG5cIjsgLy8gV2lkdGgsIGhlaWdodCwgYmlhcywgcmFkaXVzXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgc2hhZG93ZWREaXJlY3Rpb25hbExpZ2h0VXNlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJ1bmlmb3JtIHZlYzMgbGlnaHRcIiArIGkgKyBcIl9zaGFkb3dQYXJhbXM7XFxuXCI7IC8vIFdpZHRoLCBoZWlnaHQsIGJpYXNcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKGxpZ2h0VHlwZSA9PT0gTElHSFRUWVBFX09NTkkpIHtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcInVuaWZvcm0gc2FtcGxlckN1YmUgbGlnaHRcIiArIGkgKyBcIl9zaGFkb3dNYXA7XFxuXCI7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGxpZ2h0Ll9pc1BjZiAmJiBkZXZpY2Uud2ViZ2wyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwidW5pZm9ybSBzYW1wbGVyMkRTaGFkb3cgbGlnaHRcIiArIGkgKyBcIl9zaGFkb3dNYXA7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwidW5pZm9ybSBzYW1wbGVyMkQgbGlnaHRcIiArIGkgKyBcIl9zaGFkb3dNYXA7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgbnVtU2hhZG93TGlnaHRzKys7XG4gICAgICAgICAgICAgICAgc2hhZG93VHlwZVVzZWRbbGlnaHQuX3NoYWRvd1R5cGVdID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBpZiAobGlnaHQuX2lzVnNtKSB1c2VWc20gPSB0cnVlO1xuICAgICAgICAgICAgICAgIGlmIChsaWdodC5faXNQY2YgJiYgKGRldmljZS53ZWJnbDIgfHwgZGV2aWNlLmV4dFN0YW5kYXJkRGVyaXZhdGl2ZXMpICYmIGxpZ2h0VHlwZSA9PT0gTElHSFRUWVBFX1NQT1QpIHVzZVBlcnNwWmJ1ZmZlclNoYWRvdyA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAobGlnaHQuX2Nvb2tpZSkge1xuICAgICAgICAgICAgICAgIGlmIChsaWdodC5fY29va2llLl9jdWJlbWFwKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChsaWdodFR5cGUgPT09IExJR0hUVFlQRV9PTU5JKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwidW5pZm9ybSBzYW1wbGVyQ3ViZSBsaWdodFwiICsgaSArIFwiX2Nvb2tpZTtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJ1bmlmb3JtIGZsb2F0IGxpZ2h0XCIgKyBpICsgXCJfY29va2llSW50ZW5zaXR5O1xcblwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFsaWdodC5jYXN0U2hhZG93cyB8fCBvcHRpb25zLm5vU2hhZG93KSBjb2RlICs9IFwidW5pZm9ybSBtYXQ0IGxpZ2h0XCIgKyBpICsgXCJfc2hhZG93TWF0cml4O1xcblwiO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGxpZ2h0VHlwZSA9PT0gTElHSFRUWVBFX1NQT1QpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJ1bmlmb3JtIHNhbXBsZXIyRCBsaWdodFwiICsgaSArIFwiX2Nvb2tpZTtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJ1bmlmb3JtIGZsb2F0IGxpZ2h0XCIgKyBpICsgXCJfY29va2llSW50ZW5zaXR5O1xcblwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFsaWdodC5jYXN0U2hhZG93cyB8fCBvcHRpb25zLm5vU2hhZG93KSBjb2RlICs9IFwidW5pZm9ybSBtYXQ0IGxpZ2h0XCIgKyBpICsgXCJfc2hhZG93TWF0cml4O1xcblwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxpZ2h0Ll9jb29raWVUcmFuc2Zvcm0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwidW5pZm9ybSB2ZWM0IGxpZ2h0XCIgKyBpICsgXCJfY29va2llTWF0cml4O1xcblwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJ1bmlmb3JtIHZlYzIgbGlnaHRcIiArIGkgKyBcIl9jb29raWVPZmZzZXQ7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjb2RlICs9IFwiXFxuXCI7IC8vIEVuZCBvZiB1bmlmb3JtIGRlY2xhcmF0aW9uc1xuXG4gICAgICAgIC8vIFRCTlxuICAgICAgICBjb25zdCBoYXNUQk4gPSB0aGlzLm5lZWRzTm9ybWFsICYmIChvcHRpb25zLm5vcm1hbE1hcEVuYWJsZWQgfHwgb3B0aW9ucy5jbGVhckNvYXROb3JtYWxNYXBFbmFibGVkIHx8IChvcHRpb25zLmVuYWJsZUdHWFNwZWN1bGFyICYmICFvcHRpb25zLmhlaWdodE1hcEVuYWJsZWQpKTtcblxuICAgICAgICBpZiAoaGFzVEJOKSB7XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5oYXNUYW5nZW50cykge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gb3B0aW9ucy5mYXN0VGJuID8gY2h1bmtzLlRCTmZhc3RQUyA6IGNodW5rcy5UQk5QUztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKGRldmljZS5leHRTdGFuZGFyZERlcml2YXRpdmVzICYmIChvcHRpb25zLm5vcm1hbE1hcEVuYWJsZWQgfHwgb3B0aW9ucy5jbGVhckNvYXROb3JtYWxNYXBFbmFibGVkKSkge1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IGNodW5rcy5UQk5kZXJpdmF0aXZlUFMucmVwbGFjZSgvXFwkVVYvZywgdGhpcy5saWdodGluZ1V2KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IGNodW5rcy5UQk5PYmplY3RTcGFjZVBTO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEZJWE1FOiBvbmx5IGFkZCB0aGVzZSB3aGVuIG5lZWRlZFxuICAgICAgICBjb2RlICs9IGNodW5rcy5zcGhlcmljYWxQUztcbiAgICAgICAgY29kZSArPSBjaHVua3MuZGVjb2RlUFM7XG4gICAgICAgIGNvZGUgKz0gZ2FtbWFDb2RlKG9wdGlvbnMuZ2FtbWEsIGNodW5rcyk7XG4gICAgICAgIGNvZGUgKz0gdG9uZW1hcENvZGUob3B0aW9ucy50b25lTWFwLCBjaHVua3MpO1xuICAgICAgICBjb2RlICs9IGZvZ0NvZGUob3B0aW9ucy5mb2csIGNodW5rcyk7XG5cblxuICAgICAgICAvLyBmcm9udGVuZFxuICAgICAgICBjb2RlICs9IHRoaXMuZnJvbnRlbmRDb2RlO1xuXG4gICAgICAgIGlmIChvcHRpb25zLnVzZUN1YmVNYXBSb3RhdGlvbikge1xuICAgICAgICAgICAgY29kZSArPSBcIiNkZWZpbmUgQ1VCRU1BUF9ST1RBVElPTlxcblwiO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMubmVlZHNOb3JtYWwpIHtcbiAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLmN1YmVNYXBSb3RhdGVQUztcbiAgICAgICAgICAgIGNvZGUgKz0gb3B0aW9ucy5jdWJlTWFwUHJvamVjdGlvbiA+IDAgPyBjaHVua3MuY3ViZU1hcFByb2plY3RCb3hQUyA6IGNodW5rcy5jdWJlTWFwUHJvamVjdE5vbmVQUztcbiAgICAgICAgICAgIGNvZGUgKz0gb3B0aW9ucy5za3lib3hJbnRlbnNpdHkgPyBjaHVua3MuZW52TXVsdGlwbHlQUyA6IGNodW5rcy5lbnZDb25zdFBTO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCh0aGlzLmxpZ2h0aW5nICYmIG9wdGlvbnMudXNlU3BlY3VsYXIpIHx8IHRoaXMucmVmbGVjdGlvbnMpIHtcbiAgICAgICAgICAgIGlmIChvcHRpb25zLnVzZU1ldGFsbmVzcykge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLm1ldGFsbmVzc01vZHVsYXRlUFM7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zLmZyZXNuZWxNb2RlbCA9PT0gRlJFU05FTF9TQ0hMSUNLKSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBjaHVua3MuZnJlc25lbFNjaGxpY2tQUztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG9wdGlvbnMudXNlSXJpZGVzY2VuY2UpIHtcbiAgICAgICAgICAgICAgICBjb2RlICs9IGNodW5rcy5pcmlkZXNjZW5jZURpZmZyYWN0aW9uUFM7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB1c2VBbyA9IG9wdGlvbnMuYW9NYXBFbmFibGVkIHx8IG9wdGlvbnMudXNlQW9WZXJ0ZXhDb2xvcnM7XG5cbiAgICAgICAgaWYgKHVzZUFvKSB7XG4gICAgICAgICAgICBjb2RlICs9IGNodW5rcy5hb0RpZmZ1c2VPY2NQUztcbiAgICAgICAgICAgIHN3aXRjaCAob3B0aW9ucy5vY2NsdWRlU3BlY3VsYXIpIHtcbiAgICAgICAgICAgICAgICBjYXNlIFNQRUNPQ0NfQU86XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gb3B0aW9ucy5vY2NsdWRlU3BlY3VsYXJGbG9hdCA/IGNodW5rcy5hb1NwZWNPY2NTaW1wbGVQUyA6IGNodW5rcy5hb1NwZWNPY2NDb25zdFNpbXBsZVBTO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIFNQRUNPQ0NfR0xPU1NERVBFTkRFTlQ6XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gb3B0aW9ucy5vY2NsdWRlU3BlY3VsYXJGbG9hdCA/IGNodW5rcy5hb1NwZWNPY2NQUyA6IGNodW5rcy5hb1NwZWNPY2NDb25zdFBTO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLnJlZmxlY3Rpb25Tb3VyY2UgPT09ICdlbnZBdGxhc0hRJykge1xuICAgICAgICAgICAgY29kZSArPSBvcHRpb25zLmZpeFNlYW1zID8gY2h1bmtzLmZpeEN1YmVtYXBTZWFtc1N0cmV0Y2hQUyA6IGNodW5rcy5maXhDdWJlbWFwU2VhbXNOb25lUFM7XG4gICAgICAgICAgICBjb2RlICs9IGNodW5rcy5lbnZBdGxhc1BTO1xuICAgICAgICAgICAgY29kZSArPSBjaHVua3MucmVmbGVjdGlvbkVudkhRUFMucmVwbGFjZSgvXFwkREVDT0RFL2csIENodW5rVXRpbHMuZGVjb2RlRnVuYyhvcHRpb25zLnJlZmxlY3Rpb25FbmNvZGluZykpO1xuICAgICAgICB9IGVsc2UgaWYgKG9wdGlvbnMucmVmbGVjdGlvblNvdXJjZSA9PT0gJ2VudkF0bGFzJykge1xuICAgICAgICAgICAgY29kZSArPSBjaHVua3MuZW52QXRsYXNQUztcbiAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLnJlZmxlY3Rpb25FbnZQUy5yZXBsYWNlKC9cXCRERUNPREUvZywgQ2h1bmtVdGlscy5kZWNvZGVGdW5jKG9wdGlvbnMucmVmbGVjdGlvbkVuY29kaW5nKSk7XG4gICAgICAgIH0gZWxzZSBpZiAob3B0aW9ucy5yZWZsZWN0aW9uU291cmNlID09PSAnY3ViZU1hcCcpIHtcbiAgICAgICAgICAgIGNvZGUgKz0gb3B0aW9ucy5maXhTZWFtcyA/IGNodW5rcy5maXhDdWJlbWFwU2VhbXNTdHJldGNoUFMgOiBjaHVua3MuZml4Q3ViZW1hcFNlYW1zTm9uZVBTO1xuICAgICAgICAgICAgY29kZSArPSBjaHVua3MucmVmbGVjdGlvbkN1YmVQUy5yZXBsYWNlKC9cXCRERUNPREUvZywgQ2h1bmtVdGlscy5kZWNvZGVGdW5jKG9wdGlvbnMucmVmbGVjdGlvbkVuY29kaW5nKSk7XG4gICAgICAgIH0gZWxzZSBpZiAob3B0aW9ucy5yZWZsZWN0aW9uU291cmNlID09PSAnc3BoZXJlTWFwJykge1xuICAgICAgICAgICAgY29uc3Qgc2NvZGUgPSBkZXZpY2UuZnJhZ21lbnRVbmlmb3Jtc0NvdW50ID4gMTYgPyBjaHVua3MucmVmbGVjdGlvblNwaGVyZVBTIDogY2h1bmtzLnJlZmxlY3Rpb25TcGhlcmVMb3dQUztcbiAgICAgICAgICAgIGNvZGUgKz0gc2NvZGUucmVwbGFjZSgvXFwkREVDT0RFL2csIENodW5rVXRpbHMuZGVjb2RlRnVuYyhvcHRpb25zLnJlZmxlY3Rpb25FbmNvZGluZykpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMucmVmbGVjdGlvbnMpIHtcbiAgICAgICAgICAgIGlmIChvcHRpb25zLnVzZUNsZWFyQ29hdCkge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLnJlZmxlY3Rpb25DQ1BTO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKG9wdGlvbnMudXNlU2hlZW4pIHtcbiAgICAgICAgICAgICAgICBjb2RlICs9IGNodW5rcy5yZWZsZWN0aW9uU2hlZW5QUztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLnVzZVJlZnJhY3Rpb24pIHtcbiAgICAgICAgICAgIGlmIChvcHRpb25zLnVzZUR5bmFtaWNSZWZyYWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBjaHVua3MucmVmcmFjdGlvbkR5bmFtaWNQUztcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5yZWZsZWN0aW9ucykge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLnJlZnJhY3Rpb25DdWJlUFM7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy51c2VTaGVlbikge1xuICAgICAgICAgICAgY29kZSArPSBjaHVua3MubGlnaHRTaGVlblBTO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gY2x1c3RlcmVkIGxpZ2h0aW5nXG4gICAgICAgIGlmIChvcHRpb25zLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCkge1xuXG4gICAgICAgICAgICAvLyBpbmNsdWRlIHRoaXMgYmVmb3JlIHNoYWRvdyAvIGNvb2tpZSBjb2RlXG4gICAgICAgICAgICBjb2RlICs9IGNodW5rcy5jbHVzdGVyZWRMaWdodFV0aWxzUFM7XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5jbHVzdGVyZWRMaWdodGluZ0Nvb2tpZXNFbmFibGVkKVxuICAgICAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLmNsdXN0ZXJlZExpZ2h0Q29va2llc1BTO1xuXG4gICAgICAgICAgICAvLyBpbmNsdWRlIHNoYWRvdyBjaHVua3MgY2x1c3RlcmVkIGxpZ2h0cyBzdXBwb3J0XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5jbHVzdGVyZWRMaWdodGluZ1NoYWRvd3NFbmFibGVkICYmICFvcHRpb25zLm5vU2hhZG93KSB7XG4gICAgICAgICAgICAgICAgc2hhZG93VHlwZVVzZWRbU0hBRE9XX1BDRjNdID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBzaGFkb3dUeXBlVXNlZFtTSEFET1dfUENGNV0gPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdXNlUGVyc3BaYnVmZmVyU2hhZG93ID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChudW1TaGFkb3dMaWdodHMgPiAwIHx8IG9wdGlvbnMuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkKSB7XG4gICAgICAgICAgICBpZiAoc2hhZG93ZWREaXJlY3Rpb25hbExpZ2h0VXNlZCkge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLnNoYWRvd0Nhc2NhZGVzUFM7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoc2hhZG93VHlwZVVzZWRbU0hBRE9XX1BDRjNdKSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBjaHVua3Muc2hhZG93U3RhbmRhcmRQUztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzaGFkb3dUeXBlVXNlZFtTSEFET1dfUENGNV0gJiYgZGV2aWNlLndlYmdsMikge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLnNoYWRvd1N0YW5kYXJkR0wyUFM7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodXNlVnNtKSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBjaHVua3Muc2hhZG93VlNNX2NvbW1vblBTO1xuICAgICAgICAgICAgICAgIGlmIChzaGFkb3dUeXBlVXNlZFtTSEFET1dfVlNNOF0pIHtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBjaHVua3Muc2hhZG93VlNNOFBTO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoc2hhZG93VHlwZVVzZWRbU0hBRE9XX1ZTTTE2XSkge1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IGRldmljZS5leHRUZXh0dXJlSGFsZkZsb2F0TGluZWFyID8gY2h1bmtzLnNoYWRvd0VWU01QUy5yZXBsYWNlKC9cXCQvZywgXCIxNlwiKSA6IGNodW5rcy5zaGFkb3dFVlNNblBTLnJlcGxhY2UoL1xcJC9nLCBcIjE2XCIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoc2hhZG93VHlwZVVzZWRbU0hBRE9XX1ZTTTMyXSkge1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IGRldmljZS5leHRUZXh0dXJlRmxvYXRMaW5lYXIgPyBjaHVua3Muc2hhZG93RVZTTVBTLnJlcGxhY2UoL1xcJC9nLCBcIjMyXCIpIDogY2h1bmtzLnNoYWRvd0VWU01uUFMucmVwbGFjZSgvXFwkL2csIFwiMzJcIik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIShkZXZpY2Uud2ViZ2wyIHx8IGRldmljZS5leHRTdGFuZGFyZERlcml2YXRpdmVzKSkge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLmJpYXNDb25zdFBTO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBvdGhlcndpc2UgYmlhcyBpcyBhcHBsaWVkIG9uIHJlbmRlclxuICAgICAgICAgICAgY29kZSArPSBjaHVua3Muc2hhZG93Q29vcmRQUyArIGNodW5rcy5zaGFkb3dDb21tb25QUztcbiAgICAgICAgICAgIGlmICh1c2VQZXJzcFpidWZmZXJTaGFkb3cpIGNvZGUgKz0gY2h1bmtzLnNoYWRvd0Nvb3JkUGVyc3BaYnVmZmVyUFM7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy5lbmFibGVHR1hTcGVjdWxhcikgY29kZSArPSBcInVuaWZvcm0gZmxvYXQgbWF0ZXJpYWxfYW5pc290cm9weTtcXG5cIjtcblxuICAgICAgICBpZiAodGhpcy5saWdodGluZykge1xuICAgICAgICAgICAgY29kZSArPSBjaHVua3MubGlnaHREaWZmdXNlTGFtYmVydFBTO1xuICAgICAgICAgICAgaWYgKGhhc0FyZWFMaWdodHMgfHwgb3B0aW9ucy5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpIGNvZGUgKz0gY2h1bmtzLmx0YztcbiAgICAgICAgfVxuXG4gICAgICAgIGNvZGUgKz0gJ1xcbic7XG5cbiAgICAgICAgbGV0IHVzZU9sZEFtYmllbnQgPSBmYWxzZTtcbiAgICAgICAgaWYgKG9wdGlvbnMudXNlU3BlY3VsYXIpIHtcblxuICAgICAgICAgICAgaWYgKHRoaXMubGlnaHRpbmcpIHtcbiAgICAgICAgICAgICAgICBjb2RlICs9IG9wdGlvbnMuc2hhZGluZ01vZGVsID09PSBTUEVDVUxBUl9QSE9ORyA/IGNodW5rcy5saWdodFNwZWN1bGFyUGhvbmdQUyA6IChvcHRpb25zLmVuYWJsZUdHWFNwZWN1bGFyID8gY2h1bmtzLmxpZ2h0U3BlY3VsYXJBbmlzb0dHWFBTIDogY2h1bmtzLmxpZ2h0U3BlY3VsYXJCbGlublBTKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFvcHRpb25zLmZyZXNuZWxNb2RlbCAmJiAhdGhpcy5yZWZsZWN0aW9ucyAmJiAhb3B0aW9ucy5kaWZmdXNlTWFwRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgdW5pZm9ybSB2ZWMzIG1hdGVyaWFsX2FtYmllbnQ7XFxuXCI7XG4gICAgICAgICAgICAgICAgY29kZSArPSBcIiNkZWZpbmUgTElUX09MRF9BTUJJRU5UXCI7XG4gICAgICAgICAgICAgICAgdXNlT2xkQW1iaWVudCA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjb2RlICs9IGNodW5rcy5jb21iaW5lUFM7XG5cbiAgICAgICAgLy8gbGlnaHRtYXAgc3VwcG9ydFxuICAgICAgICBpZiAob3B0aW9ucy5saWdodE1hcEVuYWJsZWQgfHwgb3B0aW9ucy51c2VMaWdodE1hcFZlcnRleENvbG9ycykge1xuICAgICAgICAgICAgY29kZSArPSAob3B0aW9ucy51c2VTcGVjdWxhciAmJiBvcHRpb25zLmRpckxpZ2h0TWFwRW5hYmxlZCkgPyBjaHVua3MubGlnaHRtYXBEaXJBZGRQUyA6IGNodW5rcy5saWdodG1hcEFkZFBTO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgYWRkQW1iaWVudCA9ICghb3B0aW9ucy5saWdodE1hcEVuYWJsZWQgJiYgIW9wdGlvbnMudXNlTGlnaHRNYXBWZXJ0ZXhDb2xvcnMpIHx8IG9wdGlvbnMubGlnaHRNYXBXaXRob3V0QW1iaWVudDtcblxuICAgICAgICBpZiAoYWRkQW1iaWVudCkge1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMuYW1iaWVudFNvdXJjZSA9PT0gJ2FtYmllbnRTSCcpIHtcbiAgICAgICAgICAgICAgICBjb2RlICs9IGNodW5rcy5hbWJpZW50U0hQUztcbiAgICAgICAgICAgIH0gZWxzZSBpZiAob3B0aW9ucy5hbWJpZW50U291cmNlID09PSAnZW52QXRsYXMnKSB7XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMucmVmbGVjdGlvblNvdXJjZSAhPT0gJ2VudkF0bGFzJyAmJiBvcHRpb25zLnJlZmxlY3Rpb25Tb3VyY2UgIT09ICdlbnZBdGxhc0hRJykge1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IGNodW5rcy5lbnZBdGxhc1BTO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb2RlICs9IGNodW5rcy5hbWJpZW50RW52UFMucmVwbGFjZSgvXFwkREVDT0RFL2csIENodW5rVXRpbHMuZGVjb2RlRnVuYyhvcHRpb25zLmFtYmllbnRFbmNvZGluZykpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb2RlICs9IGNodW5rcy5hbWJpZW50Q29uc3RhbnRQUztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLnVzZUFtYmllbnRUaW50ICYmICF1c2VPbGRBbWJpZW50KSB7XG4gICAgICAgICAgICBjb2RlICs9IFwidW5pZm9ybSB2ZWMzIG1hdGVyaWFsX2FtYmllbnQ7XFxuXCI7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy51c2VNc2RmKSB7XG4gICAgICAgICAgICBpZiAoIW9wdGlvbnMubXNkZlRleHRBdHRyaWJ1dGUpIHtcbiAgICAgICAgICAgICAgICBjb2RlICs9IFwiXFxuI2RlZmluZSBVTklGT1JNX1RFWFRfUEFSQU1FVEVSU1wiO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29kZSArPSBjaHVua3MubXNkZlBTO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMubmVlZHNOb3JtYWwpIHtcbiAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLnZpZXdEaXJQUztcbiAgICAgICAgICAgIGlmIChvcHRpb25zLnVzZVNwZWN1bGFyKSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSAob3B0aW9ucy5lbmFibGVHR1hTcGVjdWxhcikgPyBjaHVua3MucmVmbERpckFuaXNvUFMgOiBjaHVua3MucmVmbERpclBTO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGhhc1BvaW50TGlnaHRzID0gZmFsc2U7XG4gICAgICAgIGxldCB1c2VzTGluZWFyRmFsbG9mZiA9IGZhbHNlO1xuICAgICAgICBsZXQgdXNlc0ludlNxdWFyZWRGYWxsb2ZmID0gZmFsc2U7XG4gICAgICAgIGxldCB1c2VzU3BvdCA9IGZhbHNlO1xuICAgICAgICBsZXQgdXNlc0Nvb2tpZSA9IGZhbHNlO1xuICAgICAgICBsZXQgdXNlc0Nvb2tpZU5vdztcblxuICAgICAgICAvLyBjbHVzdGVyZWQgbGlnaHRpbmdcbiAgICAgICAgaWYgKG9wdGlvbnMuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkICYmIHRoaXMubGlnaHRpbmcpIHtcblxuICAgICAgICAgICAgdXNlc1Nwb3QgPSB0cnVlO1xuICAgICAgICAgICAgaGFzUG9pbnRMaWdodHMgPSB0cnVlO1xuICAgICAgICAgICAgdXNlc0xpbmVhckZhbGxvZmYgPSB0cnVlO1xuICAgICAgICAgICAgdXNlc0Nvb2tpZSA9IHRydWU7XG5cbiAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLmZsb2F0VW5wYWNraW5nUFM7XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zLmxpZ2h0TWFza0R5bmFtaWMpXG4gICAgICAgICAgICAgICAgY29kZSArPSBcIlxcbiNkZWZpbmUgQ0xVU1RFUl9NRVNIX0RZTkFNSUNfTElHSFRTXCI7XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zLmNsdXN0ZXJlZExpZ2h0aW5nQ29va2llc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgY29kZSArPSBcIlxcbiNkZWZpbmUgQ0xVU1RFUl9DT09LSUVTXCI7XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5jbHVzdGVyZWRMaWdodGluZ1NoYWRvd3NFbmFibGVkICYmICFvcHRpb25zLm5vU2hhZG93KSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBcIlxcbiNkZWZpbmUgQ0xVU1RFUl9TSEFET1dTXCI7XG4gICAgICAgICAgICAgICAgY29kZSArPSBcIlxcbiNkZWZpbmUgQ0xVU1RFUl9TSEFET1dfVFlQRV9cIiArIHNoYWRvd1R5cGVUb1N0cmluZ1tvcHRpb25zLmNsdXN0ZXJlZExpZ2h0aW5nU2hhZG93VHlwZV07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zLmNsdXN0ZXJlZExpZ2h0aW5nQXJlYUxpZ2h0c0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgY29kZSArPSBcIlxcbiNkZWZpbmUgQ0xVU1RFUl9BUkVBTElHSFRTXCI7XG5cbiAgICAgICAgICAgIGNvZGUgKz0gTGlnaHRzQnVmZmVyLnNoYWRlckRlZmluZXM7XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zLmNsdXN0ZXJlZExpZ2h0aW5nU2hhZG93c0VuYWJsZWQgJiYgIW9wdGlvbnMubm9TaGFkb3cpIHtcbiAgICAgICAgICAgICAgICBjb2RlICs9IGNodW5rcy5jbHVzdGVyZWRMaWdodFNoYWRvd3NQUztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29kZSArPSBjaHVua3MuY2x1c3RlcmVkTGlnaHRQUztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLnR3b1NpZGVkTGlnaHRpbmcpIGNvZGUgKz0gXCJ1bmlmb3JtIGZsb2F0IHR3b1NpZGVkTGlnaHRpbmdOZWdTY2FsZUZhY3RvcjtcXG5cIjtcblxuICAgICAgICAvLyBGUkFHTUVOVCBTSEFERVIgQk9EWVxuXG4gICAgICAgIGNvZGUgKz0gdGhpcy5fZnNHZXRTdGFydENvZGUoY29kZSwgZGV2aWNlLCBjaHVua3MsIG9wdGlvbnMpO1xuXG4gICAgICAgIGlmICh0aGlzLm5lZWRzTm9ybWFsKSB7XG4gICAgICAgICAgICBpZiAob3B0aW9ucy50d29TaWRlZExpZ2h0aW5nKSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBkVmVydGV4Tm9ybWFsVyA9IG5vcm1hbGl6ZShnbF9Gcm9udEZhY2luZyA/IHZOb3JtYWxXICogdHdvU2lkZWRMaWdodGluZ05lZ1NjYWxlRmFjdG9yIDogLXZOb3JtYWxXICogdHdvU2lkZWRMaWdodGluZ05lZ1NjYWxlRmFjdG9yKTtcXG5cIjtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBkVmVydGV4Tm9ybWFsVyA9IG5vcm1hbGl6ZSh2Tm9ybWFsVyk7XFxuXCI7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICgob3B0aW9ucy5oZWlnaHRNYXBFbmFibGVkIHx8IG9wdGlvbnMubm9ybWFsTWFwRW5hYmxlZCkgJiYgb3B0aW9ucy5oYXNUYW5nZW50cykge1xuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLnR3b1NpZGVkTGlnaHRpbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBkVGFuZ2VudFcgPSBnbF9Gcm9udEZhY2luZyA/IHZUYW5nZW50VyAqIHR3b1NpZGVkTGlnaHRpbmdOZWdTY2FsZUZhY3RvciA6IC12VGFuZ2VudFcgKiB0d29TaWRlZExpZ2h0aW5nTmVnU2NhbGVGYWN0b3I7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZEJpbm9ybWFsVyA9IGdsX0Zyb250RmFjaW5nID8gdkJpbm9ybWFsVyAqIHR3b1NpZGVkTGlnaHRpbmdOZWdTY2FsZUZhY3RvciA6IC12Qmlub3JtYWxXICogdHdvU2lkZWRMaWdodGluZ05lZ1NjYWxlRmFjdG9yO1xcblwiO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZFRhbmdlbnRXID0gdlRhbmdlbnRXO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGRCaW5vcm1hbFcgPSB2Qmlub3JtYWxXO1xcblwiO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29kZSArPSBcIiAgICBnZXRWaWV3RGlyKCk7XFxuXCI7XG4gICAgICAgICAgICBpZiAoaGFzVEJOKSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBnZXRUQk4oKTtcXG5cIjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGludm9rZSBmcm9udGVuZCBmdW5jdGlvbnNcbiAgICAgICAgY29kZSArPSB0aGlzLmZyb250ZW5kRnVuYztcblxuICAgICAgICAvLyB0cmFuc2Zvcm0gdGFuZ2VudCBzcGFjZSBub3JtYWxzIHRvIHdvcmxkIHNwYWNlXG4gICAgICAgIGlmICh0aGlzLm5lZWRzTm9ybWFsKSB7XG4gICAgICAgICAgICBpZiAob3B0aW9ucy51c2VTcGVjdWxhcikge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZ2V0UmVmbERpcigpO1xcblwiO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAob3B0aW9ucy51c2VDbGVhckNvYXQpIHtcbiAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGNjUmVmbERpclcgPSBub3JtYWxpemUoLXJlZmxlY3QoZFZpZXdEaXJXLCBjY05vcm1hbFcpKTtcXG5cIjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICgodGhpcy5saWdodGluZyAmJiBvcHRpb25zLnVzZVNwZWN1bGFyKSB8fCB0aGlzLnJlZmxlY3Rpb25zKSB7XG4gICAgICAgICAgICBpZiAob3B0aW9ucy51c2VNZXRhbG5lc3MpIHtcbiAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGdldE1ldGFsbmVzc01vZHVsYXRlKCk7XFxuXCI7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zLnVzZUlyaWRlc2NlbmNlKSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBnZXRJcmlkZXNjZW5jZShzYXR1cmF0ZShkb3QoZFZpZXdEaXJXLCBkTm9ybWFsVykpKTtcXG5cIjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChhZGRBbWJpZW50KSB7XG4gICAgICAgICAgICBjb2RlICs9IFwiICAgIGFkZEFtYmllbnQoKTtcXG5cIjtcblxuICAgICAgICAgICAgLy8gbW92ZSBhbWJpZW50IGNvbG9yIG91dCBvZiBkaWZmdXNlICh1c2VkIGJ5IExpZ2h0bWFwcGVyLCB0byBtdWx0aXBseSBhbWJpZW50IGNvbG9yIGJ5IGFjY3VtdWxhdGVkIEFPKVxuICAgICAgICAgICAgaWYgKG9wdGlvbnMuc2VwYXJhdGVBbWJpZW50KSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBgXG4gICAgICAgICAgICAgICAgICAgIHZlYzMgZEFtYmllbnRMaWdodCA9IGREaWZmdXNlTGlnaHQ7XG4gICAgICAgICAgICAgICAgICAgIGREaWZmdXNlTGlnaHQgPSB2ZWMzKDApO1xuICAgICAgICAgICAgICAgIGA7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy51c2VBbWJpZW50VGludCAmJiAhdXNlT2xkQW1iaWVudCkge1xuICAgICAgICAgICAgY29kZSArPSBcIiAgICBkRGlmZnVzZUxpZ2h0ICo9IG1hdGVyaWFsX2FtYmllbnQ7XFxuXCI7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodXNlQW8gJiYgIW9wdGlvbnMub2NjbHVkZURpcmVjdCkge1xuICAgICAgICAgICAgY29kZSArPSBcIiAgICBvY2NsdWRlRGlmZnVzZSgpO1xcblwiO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdGlvbnMubGlnaHRNYXBFbmFibGVkIHx8IG9wdGlvbnMudXNlTGlnaHRNYXBWZXJ0ZXhDb2xvcnMpIHtcbiAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgYWRkTGlnaHRNYXAoKTtcXG5cIjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmxpZ2h0aW5nIHx8IHRoaXMucmVmbGVjdGlvbnMpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLnJlZmxlY3Rpb25zKSB7XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMudXNlQ2xlYXJDb2F0KSB7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgYWRkUmVmbGVjdGlvbkNDKCk7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLmZyZXNuZWxNb2RlbCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgY2NGcmVzbmVsID0gZ2V0RnJlc25lbENDKGRvdChkVmlld0RpclcsIGNjTm9ybWFsVykpO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBjY1JlZmxlY3Rpb24ucmdiICo9IGNjRnJlc25lbDtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgfSAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGNjRnJlc25lbCA9IDAuMDtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy51c2VTcGVjdWxhcml0eUZhY3Rvcikge1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGNjUmVmbGVjdGlvbi5yZ2IgKj0gZFNwZWN1bGFyaXR5RmFjdG9yO1xcblwiO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLnVzZVNoZWVuKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgYWRkUmVmbGVjdGlvblNoZWVuKCk7XFxuXCI7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gRnJlc25lbCBoYXMgdG8gYmUgYXBwbGllZCB0byByZWZsZWN0aW9uc1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgYWRkUmVmbGVjdGlvbigpO1xcblwiO1xuXG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMuZnJlc25lbE1vZGVsID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGRSZWZsZWN0aW9uLnJnYiAqPSBnZXRGcmVzbmVsKGRvdChkVmlld0RpclcsIGROb3JtYWxXKSwgZFNwZWN1bGFyaXR5KTtcXG5cIjtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGRSZWZsZWN0aW9uLnJnYiAqPSBkU3BlY3VsYXJpdHk7XFxuXCI7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLnVzZVNwZWN1bGFyaXR5RmFjdG9yKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZFJlZmxlY3Rpb24ucmdiICo9IGRTcGVjdWxhcml0eUZhY3RvcjtcXG5cIjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChoYXNBcmVhTGlnaHRzKSB7XG4gICAgICAgICAgICAgICAgLy8gc3BlY3VsYXIgaGFzIHRvIGJlIGFjY3VtdWxhdGVkIGRpZmZlcmVudGx5IGlmIHdlIHdhbnQgYXJlYSBsaWdodHMgdG8gbG9vayBjb3JyZWN0XG4gICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBkU3BlY3VsYXJMaWdodCAqPSBkU3BlY3VsYXJpdHk7XFxuXCI7XG4gICAgICAgICAgICAgICAgLy8gY29kZSArPSBcIiAgICBmbG9hdCByb3VnaG5lc3MgPSBtYXgoKDEuMCAtIGRHbG9zc2luZXNzKSAqICgxLjAgLSBkR2xvc3NpbmVzcyksIDAuMDAxKTtcXG5cIjtcblxuICAgICAgICAgICAgICAgIC8vIGV2YWx1YXRlIG1hdGVyaWFsIGJhc2VkIGFyZWEgbGlnaHRzIGRhdGEsIHNoYXJlZCBieSBhbGwgYXJlYSBsaWdodHNcbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy51c2VTcGVjdWxhcikge1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGNhbGNMVENMaWdodFZhbHVlcygpO1xcblwiO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBvcHRpb25zLmxpZ2h0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0ID0gb3B0aW9ucy5saWdodHNbaV07XG4gICAgICAgICAgICAgICAgY29uc3QgbGlnaHRUeXBlID0gbGlnaHQuX3R5cGU7XG5cbiAgICAgICAgICAgICAgICAvLyBpZiBjbHVzdGVyZWQgbGlnaHRzIGFyZSB1c2VkLCBza2lwIG5vcm1hbCBsaWdodHMgb3RoZXIgdGhhbiBkaXJlY3Rpb25hbFxuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCAmJiBsaWdodFR5cGUgIT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCkge1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBUaGUgZm9sbG93aW5nIGNvZGUgaXMgbm90IGRlY291cGxlZCB0byBzZXBhcmF0ZSBzaGFkZXIgZmlsZXMsIGJlY2F1c2UgbW9zdCBvZiBpdCBjYW4gYmUgYWN0dWFsbHkgY2hhbmdlZCB0byBhY2hpZXZlIGRpZmZlcmVudCBiZWhhdmlvcnMgbGlrZTpcbiAgICAgICAgICAgICAgICAvLyAtIGRpZmZlcmVudCBmYWxsb2Zmc1xuICAgICAgICAgICAgICAgIC8vIC0gZGlmZmVyZW50IHNoYWRvdyBjb29yZHMgKG9tbmkgc2hhZG93cyB3aWxsIHVzZSBkcmFzdGljYWxseSBkaWZmZXJlbnQgZ2VuU2hhZG93Q29vcmQpXG4gICAgICAgICAgICAgICAgLy8gLSBkaWZmZXJlbnQgc2hhZG93IGZpbHRlciBtb2Rlc1xuICAgICAgICAgICAgICAgIC8vIC0gZGlmZmVyZW50IGxpZ2h0IHNvdXJjZSBzaGFwZXNcblxuICAgICAgICAgICAgICAgIC8vIGdldExpZ2h0RGlmZnVzZSBhbmQgZ2V0TGlnaHRTcGVjdWxhciBpcyBCUkRGIGl0c2VsZi5cblxuICAgICAgICAgICAgICAgIHVzZXNDb29raWVOb3cgPSBmYWxzZTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0U2hhcGUgPSAoaGFzQXJlYUxpZ2h0cyAmJiBsaWdodC5fc2hhcGUpID8gbGlnaHQuc2hhcGUgOiBMSUdIVFNIQVBFX1BVTkNUVUFMO1xuICAgICAgICAgICAgICAgIGNvbnN0IHNoYXBlU3RyaW5nID0gKGhhc0FyZWFMaWdodHMgJiYgbGlnaHQuX3NoYXBlKSA/IHRoaXMuX2dldExpZ2h0U291cmNlU2hhcGVTdHJpbmcobGlnaHRTaGFwZSkgOiAnJztcblxuICAgICAgICAgICAgICAgIGlmIChsaWdodFNoYXBlICE9PSBMSUdIVFNIQVBFX1BVTkNUVUFMKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgY2FsY1wiICsgc2hhcGVTdHJpbmcgKyBcIkxpZ2h0VmFsdWVzKGxpZ2h0XCIgKyBpICsgXCJfcG9zaXRpb24sIGxpZ2h0XCIgKyBpICsgXCJfaGFsZldpZHRoLCBsaWdodFwiICsgaSArIFwiX2hhbGZIZWlnaHQpO1xcblwiO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChsaWdodFR5cGUgPT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBkaXJlY3Rpb25hbFxuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGRMaWdodERpck5vcm1XID0gbGlnaHRcIiArIGkgKyBcIl9kaXJlY3Rpb247XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZEF0dGVuID0gMS4wO1xcblwiO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGxpZ2h0Ll9jb29raWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsaWdodFR5cGUgPT09IExJR0hUVFlQRV9TUE9UICYmICFsaWdodC5fY29va2llLl9jdWJlbWFwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdXNlc0Nvb2tpZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdXNlc0Nvb2tpZU5vdyA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGxpZ2h0VHlwZSA9PT0gTElHSFRUWVBFX09NTkkgJiYgbGlnaHQuX2Nvb2tpZS5fY3ViZW1hcCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVzZXNDb29raWUgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVzZXNDb29raWVOb3cgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBnZXRMaWdodERpclBvaW50KGxpZ2h0XCIgKyBpICsgXCJfcG9zaXRpb24pO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICBoYXNQb2ludExpZ2h0cyA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHVzZXNDb29raWVOb3cpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsaWdodFR5cGUgPT09IExJR0hUVFlQRV9TUE9UKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBkQXR0ZW4zID0gZ2V0Q29va2llMkRcIiArIChsaWdodC5fY29va2llRmFsbG9mZiA/IFwiXCIgOiBcIkNsaXBcIikgKyAobGlnaHQuX2Nvb2tpZVRyYW5zZm9ybSA/IFwiWGZvcm1cIiA6IFwiXCIpICsgXCIobGlnaHRcIiArIGkgKyBcIl9jb29raWUsIGxpZ2h0XCIgKyBpICsgXCJfc2hhZG93TWF0cml4LCBsaWdodFwiICsgaSArIFwiX2Nvb2tpZUludGVuc2l0eVwiICsgKGxpZ2h0Ll9jb29raWVUcmFuc2Zvcm0gPyBcIiwgbGlnaHRcIiArIGkgKyBcIl9jb29raWVNYXRyaXgsIGxpZ2h0XCIgKyBpICsgXCJfY29va2llT2Zmc2V0XCIgOiBcIlwiKSArIFwiKS5cIiArIGxpZ2h0Ll9jb29raWVDaGFubmVsICsgXCI7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZEF0dGVuMyA9IGdldENvb2tpZUN1YmUobGlnaHRcIiArIGkgKyBcIl9jb29raWUsIGxpZ2h0XCIgKyBpICsgXCJfc2hhZG93TWF0cml4LCBsaWdodFwiICsgaSArIFwiX2Nvb2tpZUludGVuc2l0eSkuXCIgKyBsaWdodC5fY29va2llQ2hhbm5lbCArIFwiO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGxpZ2h0U2hhcGUgPT09IExJR0hUU0hBUEVfUFVOQ1RVQUwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsaWdodC5fZmFsbG9mZk1vZGUgPT09IExJR0hURkFMTE9GRl9MSU5FQVIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGRBdHRlbiA9IGdldEZhbGxvZmZMaW5lYXIobGlnaHRcIiArIGkgKyBcIl9yYWRpdXMpO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVzZXNMaW5lYXJGYWxsb2ZmID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBkQXR0ZW4gPSBnZXRGYWxsb2ZmSW52U3F1YXJlZChsaWdodFwiICsgaSArIFwiX3JhZGl1cyk7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdXNlc0ludlNxdWFyZWRGYWxsb2ZmID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIG5vbiBwdW5jdHVhbCBsaWdodHMgb25seSBnZXRzIHRoZSByYW5nZSB3aW5kb3cgaGVyZVxuICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBkQXR0ZW4gPSBnZXRGYWxsb2ZmV2luZG93KGxpZ2h0XCIgKyBpICsgXCJfcmFkaXVzKTtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgICAgIHVzZXNJbnZTcXVhcmVkRmFsbG9mZiA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGlmIChkQXR0ZW4gPiAwLjAwMDAxKSB7XFxuXCI7IC8vIEJSQU5DSCBTVEFSVFxuXG4gICAgICAgICAgICAgICAgICAgIGlmIChsaWdodFR5cGUgPT09IExJR0hUVFlQRV9TUE9UKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoISh1c2VzQ29va2llTm93ICYmICFsaWdodC5fY29va2llRmFsbG9mZikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGRBdHRlbiAqPSBnZXRTcG90RWZmZWN0KGxpZ2h0XCIgKyBpICsgXCJfZGlyZWN0aW9uLCBsaWdodFwiICsgaSArIFwiX2lubmVyQ29uZUFuZ2xlLCBsaWdodFwiICsgaSArIFwiX291dGVyQ29uZUFuZ2xlKTtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB1c2VzU3BvdCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBkaWZmdXNlIGxpZ2h0aW5nIC0gTFRDIGxpZ2h0cyBkbyBub3QgbWl4IGRpZmZ1c2UgbGlnaHRpbmcgaW50byBhdHRlbnVhdGlvbiB0aGF0IGFmZmVjdHMgc3BlY3VsYXJcbiAgICAgICAgICAgICAgICBpZiAobGlnaHRTaGFwZSAhPT0gTElHSFRTSEFQRV9QVU5DVFVBTCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAobGlnaHRUeXBlID09PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIE5COiBBIGJldHRlciBhcHJveGltYXRpb24gcGVyaGFwcyB1c2luZyB3cmFwIGxpZ2h0aW5nIGNvdWxkIGJlIGltcGxlbWVudGVkIGhlcmVcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZEF0dGVuRCA9IGdldExpZ2h0RGlmZnVzZSgpO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gMTYuMCBpcyBhIGNvbnN0YW50IHRoYXQgaXMgaW4gZ2V0RmFsbG9mZkludlNxdWFyZWQoKVxuICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBkQXR0ZW5EID0gZ2V0XCIgKyBzaGFwZVN0cmluZyArIFwiTGlnaHREaWZmdXNlKCkgKiAxNi4wO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBkQXR0ZW4gKj0gZ2V0TGlnaHREaWZmdXNlKCk7XFxuXCI7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGxpZ2h0LmNhc3RTaGFkb3dzICYmICFvcHRpb25zLm5vU2hhZG93KSB7XG4gICAgICAgICAgICAgICAgICAgIGxldCBzaGFkb3dSZWFkTW9kZSA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIGxldCBldnNtRXhwO1xuICAgICAgICAgICAgICAgICAgICBpZiAobGlnaHQuX3NoYWRvd1R5cGUgPT09IFNIQURPV19WU004KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzaGFkb3dSZWFkTW9kZSA9IFwiVlNNOFwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgZXZzbUV4cCA9IFwiMC4wXCI7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobGlnaHQuX3NoYWRvd1R5cGUgPT09IFNIQURPV19WU00xNikge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2hhZG93UmVhZE1vZGUgPSBcIlZTTTE2XCI7XG4gICAgICAgICAgICAgICAgICAgICAgICBldnNtRXhwID0gXCI1LjU0XCI7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobGlnaHQuX3NoYWRvd1R5cGUgPT09IFNIQURPV19WU00zMikge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2hhZG93UmVhZE1vZGUgPSBcIlZTTTMyXCI7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZGV2aWNlLnRleHR1cmVGbG9hdEhpZ2hQcmVjaXNpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBldnNtRXhwID0gXCIxNS4wXCI7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV2c21FeHAgPSBcIjUuNTRcIjtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChsaWdodC5fc2hhZG93VHlwZSA9PT0gU0hBRE9XX1BDRjUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNoYWRvd1JlYWRNb2RlID0gXCJQQ0Y1eDVcIjtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNoYWRvd1JlYWRNb2RlID0gXCJQQ0YzeDNcIjtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmIChzaGFkb3dSZWFkTW9kZSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxpZ2h0VHlwZSA9PT0gTElHSFRUWVBFX09NTkkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzaGFkb3dDb29yZEFyZ3MgPSBcIihsaWdodFwiICsgaSArIFwiX3NoYWRvd01hcCwgbGlnaHRcIiArIGkgKyBcIl9zaGFkb3dQYXJhbXMpO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsaWdodC5fbm9ybWFsT2Zmc2V0Qmlhcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIG5vcm1hbE9mZnNldFBvaW50U2hhZG93KGxpZ2h0XCIgKyBpICsgXCJfc2hhZG93UGFyYW1zKTtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSBgICAgIGZsb2F0IHNoYWRvdyR7aX0gPSBnZXRTaGFkb3dQb2ludCR7c2hhZG93UmVhZE1vZGV9JHtzaGFkb3dDb29yZEFyZ3N9YDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2RlICs9IGAgICAgZEF0dGVuICo9IG1peCgxLjAsIHNoYWRvdyR7aX0sIGxpZ2h0JHtpfV9zaGFkb3dJbnRlbnNpdHkpO1xcbmA7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHNoYWRvd01hdEFyZyA9IGBsaWdodCR7aX1fc2hhZG93TWF0cml4YDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzaGFkb3dQYXJhbUFyZyA9IGBsaWdodCR7aX1fc2hhZG93UGFyYW1zYDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2RlICs9IHRoaXMuX25vblBvaW50U2hhZG93TWFwUHJvamVjdGlvbihkZXZpY2UsIG9wdGlvbnMubGlnaHRzW2ldLCBzaGFkb3dNYXRBcmcsIHNoYWRvd1BhcmFtQXJnLCBpKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsaWdodFR5cGUgPT09IExJR0hUVFlQRV9TUE9UKSBzaGFkb3dSZWFkTW9kZSA9IFwiU3BvdFwiICsgc2hhZG93UmVhZE1vZGU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSBgICAgIGZsb2F0IHNoYWRvdyR7aX0gPSBnZXRTaGFkb3cke3NoYWRvd1JlYWRNb2RlfShsaWdodCR7aX1fc2hhZG93TWFwLCBsaWdodCR7aX1fc2hhZG93UGFyYW1zJHsobGlnaHQuX2lzVnNtID8gXCIsIFwiICsgZXZzbUV4cCA6IFwiXCIpfSk7XFxuYDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2RlICs9IGAgICAgZEF0dGVuICo9IG1peCgxLjAsIHNoYWRvdyR7aX0sIGxpZ2h0JHtpfV9zaGFkb3dJbnRlbnNpdHkpO1xcbmA7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAobGlnaHRTaGFwZSAhPT0gTElHSFRTSEFQRV9QVU5DVFVBTCkge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIGFyZWEgbGlnaHQgLSB0aGV5IGRvIG5vdCBtaXggZGlmZnVzZSBsaWdodGluZyBpbnRvIHNwZWN1bGFyIGF0dGVudWF0aW9uXG4gICAgICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLmNvbnNlcnZlRW5lcmd5ICYmIG9wdGlvbnMudXNlU3BlY3VsYXIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZERpZmZ1c2VMaWdodCArPSBtaXgoKGRBdHRlbkQgKiBkQXR0ZW4pICogbGlnaHRcIiArIGkgKyBcIl9jb2xvclwiICsgKHVzZXNDb29raWVOb3cgPyBcIiAqIGRBdHRlbjNcIiA6IFwiXCIpICsgXCIsIHZlYzMoMCksIGRMVENTcGVjRnJlcyk7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGREaWZmdXNlTGlnaHQgKz0gKGRBdHRlbkQgKiBkQXR0ZW4pICogbGlnaHRcIiArIGkgKyBcIl9jb2xvclwiICsgKHVzZXNDb29raWVOb3cgPyBcIiAqIGRBdHRlbjNcIiA6IFwiXCIpICsgXCI7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIHB1bmN0dWFsIGxpZ2h0XG4gICAgICAgICAgICAgICAgICAgIGlmIChoYXNBcmVhTGlnaHRzICYmIG9wdGlvbnMuY29uc2VydmVFbmVyZ3kgJiYgb3B0aW9ucy51c2VTcGVjdWxhcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBkRGlmZnVzZUxpZ2h0ICs9IG1peChkQXR0ZW4gKiBsaWdodFwiICsgaSArIFwiX2NvbG9yXCIgKyAodXNlc0Nvb2tpZU5vdyA/IFwiICogZEF0dGVuM1wiIDogXCJcIikgKyBcIiwgdmVjMygwKSwgZFNwZWN1bGFyaXR5KTtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZERpZmZ1c2VMaWdodCArPSBkQXR0ZW4gKiBsaWdodFwiICsgaSArIFwiX2NvbG9yXCIgKyAodXNlc0Nvb2tpZU5vdyA/IFwiICogZEF0dGVuM1wiIDogXCJcIikgKyBcIjtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLnVzZVNwZWN1bGFyKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZEhhbGZEaXJXID0gbm9ybWFsaXplKC1kTGlnaHREaXJOb3JtVyArIGRWaWV3RGlyVyk7XFxuXCI7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gc3BlY3VsYXIgLyBjbGVhciBjb2F0XG4gICAgICAgICAgICAgICAgaWYgKGxpZ2h0U2hhcGUgIT09IExJR0hUU0hBUEVfUFVOQ1RVQUwpIHtcblxuICAgICAgICAgICAgICAgICAgICAvLyBhcmVhIGxpZ2h0XG4gICAgICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLnVzZUNsZWFyQ29hdCkgY29kZSArPSBcIiAgICBjY1NwZWN1bGFyTGlnaHQgKz0gY2NMVENTcGVjRnJlcyAqIGdldFwiICsgc2hhcGVTdHJpbmcgKyBcIkxpZ2h0U3BlY3VsYXJDQygpICogZEF0dGVuICogbGlnaHRcIiArIGkgKyBcIl9jb2xvclwiICsgKHVzZXNDb29raWVOb3cgPyBcIiAqIGRBdHRlbjNcIiA6IFwiXCIpICsgXCI7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLnVzZVNwZWN1bGFyKSBjb2RlICs9IFwiICAgIGRTcGVjdWxhckxpZ2h0ICs9IGRMVENTcGVjRnJlcyAqIGdldFwiICsgc2hhcGVTdHJpbmcgKyBcIkxpZ2h0U3BlY3VsYXIoKSAqIGRBdHRlbiAqIGxpZ2h0XCIgKyBpICsgXCJfY29sb3JcIiArICh1c2VzQ29va2llTm93ID8gXCIgKiBkQXR0ZW4zXCIgOiBcIlwiKSArIFwiO1xcblwiO1xuXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGNhbGNGcmVzbmVsID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIGlmIChsaWdodFR5cGUgPT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCAmJiBvcHRpb25zLmZyZXNuZWxNb2RlbCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGNGcmVzbmVsID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIGlmIExUQyBsaWdodHMgYXJlIHByZXNlbnQsIHNwZWN1bGFyIG11c3QgYmUgYWNjdW11bGF0ZWQgd2l0aCBzcGVjdWxhcml0eSAoc3BlY3VsYXJpdHkgaXMgcHJlIG11bHRpcGxpZWQgYnkgcHVuY3R1YWwgbGlnaHQgZnJlc25lbClcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMudXNlQ2xlYXJDb2F0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGNjU3BlY3VsYXJMaWdodCArPSBnZXRMaWdodFNwZWN1bGFyQ0MoZEhhbGZEaXJXKSAqIGRBdHRlbiAqIGxpZ2h0XCIgKyBpICsgXCJfY29sb3JcIjtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gdXNlc0Nvb2tpZU5vdyA/IFwiICogZEF0dGVuM1wiIDogXCJcIjtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gY2FsY0ZyZXNuZWwgPyBcIiAqIGdldEZyZXNuZWxDQyhkb3QoZFZpZXdEaXJXLCBkSGFsZkRpclcpKVwiIDogXCJcIjtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gIFwiO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLnVzZVNoZWVuKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIHNTcGVjdWxhckxpZ2h0ICs9IGdldExpZ2h0U3BlY3VsYXJTaGVlbihkSGFsZkRpclcpICogZEF0dGVuICogbGlnaHRcIiArIGkgKyBcIl9jb2xvclwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSB1c2VzQ29va2llTm93ID8gXCIgKiBkQXR0ZW4zXCIgOiBcIlwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSAgXCI7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMudXNlU3BlY3VsYXIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZFNwZWN1bGFyTGlnaHQgKz0gZ2V0TGlnaHRTcGVjdWxhcihkSGFsZkRpclcpICogZEF0dGVuICogbGlnaHRcIiArIGkgKyBcIl9jb2xvclwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSB1c2VzQ29va2llTm93ID8gXCIgKiBkQXR0ZW4zXCIgOiBcIlwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSBjYWxjRnJlc25lbCA/IFwiICogZ2V0RnJlc25lbChkb3QoZFZpZXdEaXJXLCBkSGFsZkRpclcpLCBkU3BlY3VsYXJpdHkpXCIgOiBcIiogZFNwZWN1bGFyaXR5XCI7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGxpZ2h0VHlwZSAhPT0gTElHSFRUWVBFX0RJUkVDVElPTkFMKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgfVxcblwiOyAvLyBCUkFOQ0ggRU5EXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29kZSArPSBcIlxcblwiO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBjbHVzdGVyZWQgbGlnaHRpbmdcbiAgICAgICAgICAgIGlmIChvcHRpb25zLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCAmJiB0aGlzLmxpZ2h0aW5nKSB7XG4gICAgICAgICAgICAgICAgdXNlc0xpbmVhckZhbGxvZmYgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHVzZXNJbnZTcXVhcmVkRmFsbG9mZiA9IHRydWU7XG4gICAgICAgICAgICAgICAgaGFzUG9pbnRMaWdodHMgPSB0cnVlO1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgYWRkQ2x1c3RlcmVkTGlnaHRzKCk7XFxuXCI7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChoYXNBcmVhTGlnaHRzKSB7XG4gICAgICAgICAgICAgICAgLy8gc3BlY3VsYXIgaGFzIHRvIGJlIGFjY3VtdWxhdGVkIGRpZmZlcmVudGx5IGlmIHdlIHdhbnQgYXJlYSBsaWdodHMgdG8gbG9vayBjb3JyZWN0XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMudXNlQ2xlYXJDb2F0KSB7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgY2NTcGVjdWxhcml0eSA9IDEuMDtcXG5cIjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMudXNlU3BlY3VsYXIpIHtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBkU3BlY3VsYXJpdHkgPSB2ZWMzKDEpO1xcblwiO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG9wdGlvbnMudXNlUmVmcmFjdGlvbikge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgYWRkUmVmcmFjdGlvbigpO1xcblwiO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGNvZGUgKz0gXCJcXG5cIjtcblxuICAgICAgICBpZiAodXNlQW8pIHtcbiAgICAgICAgICAgIGlmIChvcHRpb25zLm9jY2x1ZGVEaXJlY3QpIHtcbiAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIG9jY2x1ZGVEaWZmdXNlKCk7XFxuXCI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5vY2NsdWRlU3BlY3VsYXIgPT09IFNQRUNPQ0NfQU8gfHwgb3B0aW9ucy5vY2NsdWRlU3BlY3VsYXIgPT09IFNQRUNPQ0NfR0xPU1NERVBFTkRFTlQpIHtcbiAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIG9jY2x1ZGVTcGVjdWxhcigpO1xcblwiO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdGlvbnMudXNlU3BlY3VsYXJpdHlGYWN0b3IpIHtcbiAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZFNwZWN1bGFyTGlnaHQgKj0gZFNwZWN1bGFyaXR5RmFjdG9yO1xcblwiO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdGlvbnMub3BhY2l0eUZhZGVzU3BlY3VsYXIgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5ibGVuZFR5cGUgPT09IEJMRU5EX05PUk1BTCB8fCBvcHRpb25zLmJsZW5kVHlwZSA9PT0gQkxFTkRfUFJFTVVMVElQTElFRCkge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJmbG9hdCBzcGVjTHVtID0gZG90KChkU3BlY3VsYXJMaWdodCArIGRSZWZsZWN0aW9uLnJnYiAqIGRSZWZsZWN0aW9uLmEpLCB2ZWMzKCAwLjIxMjYsIDAuNzE1MiwgMC4wNzIyICkpO1xcblwiO1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIjaWZkZWYgTElUX0NMRUFSQ09BVFxcbiBzcGVjTHVtICs9IGRvdChjY1NwZWN1bGFyTGlnaHQgKiBjY1NwZWN1bGFyaXR5ICsgY2NSZWZsZWN0aW9uLnJnYiAqIGNjU3BlY3VsYXJpdHksIHZlYzMoIDAuMjEyNiwgMC43MTUyLCAwLjA3MjIgKSk7XFxuI2VuZGlmXFxuXCI7XG4gICAgICAgICAgICAgICAgY29kZSArPSBcImRBbHBoYSA9IGNsYW1wKGRBbHBoYSArIGdhbW1hQ29ycmVjdElucHV0KHNwZWNMdW0pLCAwLjAsIDEuMCk7XFxuXCI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb2RlICs9IFwiZEFscGhhICo9IG1hdGVyaWFsX2FscGhhRmFkZTtcXG5cIjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvZGUgKz0gY2h1bmtzLmVuZFBTO1xuICAgICAgICBpZiAob3B0aW9ucy5ibGVuZFR5cGUgPT09IEJMRU5EX05PUk1BTCB8fCBvcHRpb25zLmJsZW5kVHlwZSA9PT0gQkxFTkRfQURESVRJVkVBTFBIQSB8fCBvcHRpb25zLmFscGhhVG9Db3ZlcmFnZSkge1xuICAgICAgICAgICAgY29kZSArPSBjaHVua3Mub3V0cHV0QWxwaGFQUztcbiAgICAgICAgfSBlbHNlIGlmIChvcHRpb25zLmJsZW5kVHlwZSA9PT0gQkxFTkRfUFJFTVVMVElQTElFRCkge1xuICAgICAgICAgICAgY29kZSArPSBjaHVua3Mub3V0cHV0QWxwaGFQcmVtdWxQUztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLm91dHB1dEFscGhhT3BhcXVlUFM7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy51c2VNc2RmKSB7XG4gICAgICAgICAgICBjb2RlICs9IFwiICAgIGdsX0ZyYWdDb2xvciA9IGFwcGx5TXNkZihnbF9GcmFnQ29sb3IpO1xcblwiO1xuICAgICAgICB9XG5cbiAgICAgICAgY29kZSArPSBcIlxcblwiO1xuICAgICAgICBjb2RlICs9IGVuZCgpO1xuXG4gICAgICAgIGlmIChoYXNQb2ludExpZ2h0cykge1xuICAgICAgICAgICAgY29kZSA9IGNodW5rcy5saWdodERpclBvaW50UFMgKyBjb2RlO1xuICAgICAgICB9XG4gICAgICAgIGlmICh1c2VzTGluZWFyRmFsbG9mZikge1xuICAgICAgICAgICAgY29kZSA9IGNodW5rcy5mYWxsb2ZmTGluZWFyUFMgKyBjb2RlO1xuICAgICAgICB9XG4gICAgICAgIGlmICh1c2VzSW52U3F1YXJlZEZhbGxvZmYpIHtcbiAgICAgICAgICAgIGNvZGUgPSBjaHVua3MuZmFsbG9mZkludlNxdWFyZWRQUyArIGNvZGU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHVzZXNTcG90KSB7XG4gICAgICAgICAgICBjb2RlID0gY2h1bmtzLnNwb3RQUyArIGNvZGU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHVzZXNDb29raWUgJiYgIW9wdGlvbnMuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkKSB7XG4gICAgICAgICAgICAvLyBub24tY2x1c3RlcmVkIGxpZ2h0cyBjb29raWUgY29kZVxuICAgICAgICAgICAgY29kZSA9IGNodW5rcy5jb29raWVQUyArIGNvZGU7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IHN0cnVjdENvZGUgPSBcIlwiO1xuICAgICAgICBpZiAoY29kZS5pbmNsdWRlcyhcImRSZWZsZWN0aW9uXCIpKSBzdHJ1Y3RDb2RlICs9IFwidmVjNCBkUmVmbGVjdGlvbjtcXG5cIjtcbiAgICAgICAgaWYgKGNvZGUuaW5jbHVkZXMoXCJkVEJOXCIpKSBzdHJ1Y3RDb2RlICs9IFwibWF0MyBkVEJOO1xcblwiO1xuICAgICAgICBpZiAoY29kZS5pbmNsdWRlcyhcImRWZXJ0ZXhOb3JtYWxXXCIpKSBzdHJ1Y3RDb2RlICs9IFwidmVjMyBkVmVydGV4Tm9ybWFsVztcXG5cIjtcbiAgICAgICAgaWYgKGNvZGUuaW5jbHVkZXMoXCJkVGFuZ2VudFdcIikpIHN0cnVjdENvZGUgKz0gXCJ2ZWMzIGRUYW5nZW50VztcXG5cIjtcbiAgICAgICAgaWYgKGNvZGUuaW5jbHVkZXMoXCJkQmlub3JtYWxXXCIpKSBzdHJ1Y3RDb2RlICs9IFwidmVjMyBkQmlub3JtYWxXO1xcblwiO1xuICAgICAgICBpZiAoY29kZS5pbmNsdWRlcyhcImRWaWV3RGlyV1wiKSkgc3RydWN0Q29kZSArPSBcInZlYzMgZFZpZXdEaXJXO1xcblwiO1xuICAgICAgICBpZiAoY29kZS5pbmNsdWRlcyhcImRSZWZsRGlyV1wiKSkgc3RydWN0Q29kZSArPSBcInZlYzMgZFJlZmxEaXJXO1xcblwiO1xuICAgICAgICBpZiAoY29kZS5pbmNsdWRlcyhcImRIYWxmRGlyV1wiKSkgc3RydWN0Q29kZSArPSBcInZlYzMgZEhhbGZEaXJXO1xcblwiO1xuICAgICAgICBpZiAoY29kZS5pbmNsdWRlcyhcImREaWZmdXNlTGlnaHRcIikpIHN0cnVjdENvZGUgKz0gXCJ2ZWMzIGREaWZmdXNlTGlnaHQ7XFxuXCI7XG4gICAgICAgIGlmIChjb2RlLmluY2x1ZGVzKFwiZFNwZWN1bGFyTGlnaHRcIikpIHN0cnVjdENvZGUgKz0gXCJ2ZWMzIGRTcGVjdWxhckxpZ2h0O1xcblwiO1xuICAgICAgICBpZiAoY29kZS5pbmNsdWRlcyhcImRMaWdodERpck5vcm1XXCIpKSBzdHJ1Y3RDb2RlICs9IFwidmVjMyBkTGlnaHREaXJOb3JtVztcXG5cIjtcbiAgICAgICAgaWYgKGNvZGUuaW5jbHVkZXMoXCJkTGlnaHREaXJXXCIpKSBzdHJ1Y3RDb2RlICs9IFwidmVjMyBkTGlnaHREaXJXO1xcblwiO1xuICAgICAgICBpZiAoY29kZS5pbmNsdWRlcyhcImRMaWdodFBvc1dcIikpIHN0cnVjdENvZGUgKz0gXCJ2ZWMzIGRMaWdodFBvc1c7XFxuXCI7XG4gICAgICAgIGlmIChjb2RlLmluY2x1ZGVzKFwiZFNoYWRvd0Nvb3JkXCIpKSBzdHJ1Y3RDb2RlICs9IFwidmVjMyBkU2hhZG93Q29vcmQ7XFxuXCI7XG4gICAgICAgIGlmIChjb2RlLmluY2x1ZGVzKFwiZEF0dGVuXCIpKSBzdHJ1Y3RDb2RlICs9IFwiZmxvYXQgZEF0dGVuO1xcblwiO1xuICAgICAgICBpZiAoY29kZS5pbmNsdWRlcyhcImRBdHRlbkRcIikpIHN0cnVjdENvZGUgKz0gXCJmbG9hdCBkQXR0ZW5EO1xcblwiOyAvLyBzZXBhcmF0ZSBkaWZmdXNlIGF0dGVudWF0aW9uIGZvciBub24tcHVuY3R1YWwgbGlnaHQgc291cmNlc1xuICAgICAgICBpZiAoY29kZS5pbmNsdWRlcyhcImRBdHRlbjNcIikpIHN0cnVjdENvZGUgKz0gXCJ2ZWMzIGRBdHRlbjM7XFxuXCI7XG4gICAgICAgIGlmIChjb2RlLmluY2x1ZGVzKFwiZE1zZGZcIikpIHN0cnVjdENvZGUgKz0gXCJ2ZWM0IGRNc2RmO1xcblwiO1xuICAgICAgICBpZiAoY29kZS5pbmNsdWRlcyhcImNjRnJlc25lbFwiKSkgc3RydWN0Q29kZSArPSBcImZsb2F0IGNjRnJlc25lbDtcXG5cIjtcbiAgICAgICAgaWYgKGNvZGUuaW5jbHVkZXMoXCJjY1JlZmxlY3Rpb25cIikpIHN0cnVjdENvZGUgKz0gXCJ2ZWMzIGNjUmVmbGVjdGlvbjtcXG5cIjtcbiAgICAgICAgaWYgKGNvZGUuaW5jbHVkZXMoXCJjY1JlZmxEaXJXXCIpKSBzdHJ1Y3RDb2RlICs9IFwidmVjMyBjY1JlZmxEaXJXO1xcblwiO1xuICAgICAgICBpZiAoY29kZS5pbmNsdWRlcyhcImNjU3BlY3VsYXJMaWdodFwiKSkgc3RydWN0Q29kZSArPSBcInZlYzMgY2NTcGVjdWxhckxpZ2h0O1xcblwiO1xuICAgICAgICBpZiAoY29kZS5pbmNsdWRlcyhcImNjU3BlY3VsYXJpdHlOb0ZyZXNcIikpIHN0cnVjdENvZGUgKz0gXCJmbG9hdCBjY1NwZWN1bGFyaXR5Tm9GcmVzO1xcblwiO1xuICAgICAgICBpZiAoY29kZS5pbmNsdWRlcyhcInNTcGVjdWxhckxpZ2h0XCIpKSBzdHJ1Y3RDb2RlICs9IFwidmVjMyBzU3BlY3VsYXJMaWdodDtcXG5cIjtcbiAgICAgICAgaWYgKGNvZGUuaW5jbHVkZXMoXCJzUmVmbGVjdGlvblwiKSkgc3RydWN0Q29kZSArPSBcInZlYzMgc1JlZmxlY3Rpb247XFxuXCI7XG5cbiAgICAgICAgY29uc3QgcmVzdWx0ID0gdGhpcy5fZnNHZXRCZWdpbkNvZGUoKSArXG4gICAgICAgICAgICB0aGlzLnZhcnlpbmdzICtcbiAgICAgICAgICAgIHRoaXMuX2ZzR2V0QmFzZUNvZGUoKSArXG4gICAgICAgICAgICAob3B0aW9ucy5kZXRhaWxNb2RlcyA/IGNodW5rcy5kZXRhaWxNb2Rlc1BTIDogXCJcIikgK1xuICAgICAgICAgICAgc3RydWN0Q29kZSArXG4gICAgICAgICAgICB0aGlzLmZyb250ZW5kRGVjbCArXG4gICAgICAgICAgICBjb2RlO1xuXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgZ2VuZXJhdGVGcmFnbWVudFNoYWRlcihmcm9udGVuZERlY2wsIGZyb250ZW5kQ29kZSwgZnJvbnRlbmRGdW5jLCBsaWdodGluZ1V2KSB7XG4gICAgICAgIGNvbnN0IG9wdGlvbnMgPSB0aGlzLm9wdGlvbnM7XG5cbiAgICAgICAgdGhpcy5mcm9udGVuZERlY2wgPSBmcm9udGVuZERlY2w7XG4gICAgICAgIHRoaXMuZnJvbnRlbmRDb2RlID0gZnJvbnRlbmRDb2RlO1xuICAgICAgICB0aGlzLmZyb250ZW5kRnVuYyA9IGZyb250ZW5kRnVuYztcbiAgICAgICAgdGhpcy5saWdodGluZ1V2ID0gbGlnaHRpbmdVdjtcblxuICAgICAgICBpZiAob3B0aW9ucy5wYXNzID09PSBTSEFERVJfUElDSykge1xuICAgICAgICAgICAgdGhpcy5mc2hhZGVyID0gdGhpcy5fZnNHZXRQaWNrUGFzc0NvZGUoKTtcbiAgICAgICAgfSBlbHNlIGlmIChvcHRpb25zLnBhc3MgPT09IFNIQURFUl9ERVBUSCkge1xuICAgICAgICAgICAgdGhpcy5mc2hhZGVyID0gdGhpcy5fZnNHZXREZXB0aFBhc3NDb2RlKCk7XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5zaGFkb3dQYXNzKSB7XG4gICAgICAgICAgICB0aGlzLmZzaGFkZXIgPSB0aGlzLl9mc0dldFNoYWRvd1Bhc3NDb2RlKCk7XG4gICAgICAgIH0gZWxzZSBpZiAob3B0aW9ucy5jdXN0b21GcmFnbWVudFNoYWRlcikge1xuICAgICAgICAgICAgdGhpcy5mc2hhZGVyID0gdGhpcy5fZnNHZXRCZWdpbkNvZGUoKSArIG9wdGlvbnMuY3VzdG9tRnJhZ21lbnRTaGFkZXI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmZzaGFkZXIgPSB0aGlzLl9mc0dldExpdFBhc3NDb2RlKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXREZWZpbml0aW9uKCkge1xuXG4gICAgICAgIGNvbnN0IGRlZmluaXRpb24gPSBTaGFkZXJVdGlscy5jcmVhdGVEZWZpbml0aW9uKHRoaXMuZGV2aWNlLCB7XG4gICAgICAgICAgICBuYW1lOiAnTGl0U2hhZGVyJyxcbiAgICAgICAgICAgIGF0dHJpYnV0ZXM6IHRoaXMuYXR0cmlidXRlcyxcbiAgICAgICAgICAgIHZlcnRleENvZGU6IHRoaXMudnNoYWRlcixcbiAgICAgICAgICAgIGZyYWdtZW50Q29kZTogdGhpcy5mc2hhZGVyXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmIChTaGFkZXJQYXNzLmlzRm9yd2FyZCh0aGlzLm9wdGlvbnMucGFzcykpIHtcbiAgICAgICAgICAgIGRlZmluaXRpb24udGFnID0gU0hBREVSVEFHX01BVEVSSUFMO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGRlZmluaXRpb247XG4gICAgfVxufVxuXG5leHBvcnQge1xuICAgIExpdFNoYWRlclxufTtcbiJdLCJuYW1lcyI6WyJidWlsdGluQXR0cmlidXRlcyIsInZlcnRleF9ub3JtYWwiLCJTRU1BTlRJQ19OT1JNQUwiLCJ2ZXJ0ZXhfdGFuZ2VudCIsIlNFTUFOVElDX1RBTkdFTlQiLCJ2ZXJ0ZXhfdGV4Q29vcmQwIiwiU0VNQU5USUNfVEVYQ09PUkQwIiwidmVydGV4X3RleENvb3JkMSIsIlNFTUFOVElDX1RFWENPT1JEMSIsInZlcnRleF9jb2xvciIsIlNFTUFOVElDX0NPTE9SIiwidmVydGV4X2JvbmVXZWlnaHRzIiwiU0VNQU5USUNfQkxFTkRXRUlHSFQiLCJ2ZXJ0ZXhfYm9uZUluZGljZXMiLCJTRU1BTlRJQ19CTEVORElORElDRVMiLCJidWlsdGluVmFyeWluZ3MiLCJ2VmVydGV4Q29sb3IiLCJ2UG9zaXRpb25XIiwidk5vcm1hbFYiLCJ2Tm9ybWFsVyIsInZUYW5nZW50VyIsInZCaW5vcm1hbFciLCJ2T2JqZWN0U3BhY2VVcFciLCJ2VXYwIiwidlV2MSIsIkxpdFNoYWRlciIsImNvbnN0cnVjdG9yIiwiZGV2aWNlIiwib3B0aW9ucyIsImF0dHJpYnV0ZXMiLCJ2ZXJ0ZXhfcG9zaXRpb24iLCJTRU1BTlRJQ19QT1NJVElPTiIsImNodW5rcyIsInVzZXJDaHVua3MiLCJ2YWxpZGF0ZVVzZXJDaHVua3MiLCJjaHVua05hbWUiLCJzaGFkZXJDaHVua3MiLCJoYXNPd25Qcm9wZXJ0eSIsImNodW5rIiwiYSIsImluZGV4T2YiLCJsaWdodGluZyIsImxpZ2h0cyIsImxlbmd0aCIsImRpckxpZ2h0TWFwRW5hYmxlZCIsImNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCIsInJlZmxlY3Rpb25zIiwicmVmbGVjdGlvblNvdXJjZSIsInNoYWRvd1Bhc3MiLCJTaGFkZXJQYXNzIiwiaXNTaGFkb3ciLCJwYXNzIiwibmVlZHNOb3JtYWwiLCJ1c2VTcGVjdWxhciIsImFtYmllbnRTSCIsImhlaWdodE1hcEVuYWJsZWQiLCJlbmFibGVHR1hTcGVjdWxhciIsImNsZWFyQ29hdE5vcm1hbE1hcEVuYWJsZWQiLCJuZWVkc1NjZW5lQ29sb3IiLCJ1c2VEeW5hbWljUmVmcmFjdGlvbiIsIm5lZWRzU2NyZWVuU2l6ZSIsIm5lZWRzVHJhbnNmb3JtcyIsInZhcnlpbmdzIiwidnNoYWRlciIsImZyb250ZW5kRGVjbCIsImZyb250ZW5kQ29kZSIsImZyb250ZW5kRnVuYyIsImxpZ2h0aW5nVXYiLCJkZWZpbmVzIiwiZnNoYWRlciIsIl92c0FkZEJhc2VDb2RlIiwiY29kZSIsImJhc2VWUyIsIm5pbmVTbGljZWRNb2RlIiwiU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VEIiwiU1BSSVRFX1JFTkRFUk1PREVfVElMRUQiLCJiYXNlTmluZVNsaWNlZFZTIiwiX3ZzQWRkVHJhbnNmb3JtQ29kZSIsInRyYW5zZm9ybVZTIiwiX3NldE1hcFRyYW5zZm9ybSIsImNvZGVzIiwibmFtZSIsImlkIiwidXYiLCJjaGVja0lkIiwidmFyTmFtZSIsIl9mc0dldEJhc2VDb2RlIiwicmVzdWx0IiwiYmFzZVBTIiwiYmFzZU5pbmVTbGljZWRQUyIsImJhc2VOaW5lU2xpY2VkVGlsZWRQUyIsIl9mc0dldFN0YXJ0Q29kZSIsInN0YXJ0UFMiLCJzdGFydE5pbmVTbGljZWRQUyIsInN0YXJ0TmluZVNsaWNlZFRpbGVkUFMiLCJfZGlyZWN0aW9uYWxTaGFkb3dNYXBQcm9qZWN0aW9uIiwibGlnaHQiLCJzaGFkb3dDb29yZEFyZ3MiLCJzaGFkb3dQYXJhbUFyZyIsImxpZ2h0SW5kZXgiLCJjb29yZHNGdW5jdGlvbk5hbWUiLCJudW1DYXNjYWRlcyIsIl9ub25Qb2ludFNoYWRvd01hcFByb2plY3Rpb24iLCJzaGFkb3dNYXRBcmciLCJfbm9ybWFsT2Zmc2V0QmlhcyIsIl9pc1ZzbSIsIl90eXBlIiwiTElHSFRUWVBFX1NQT1QiLCJfaXNQY2YiLCJ3ZWJnbDIiLCJleHRTdGFuZGFyZERlcml2YXRpdmVzIiwiX2dldExpZ2h0U291cmNlU2hhcGVTdHJpbmciLCJzaGFwZSIsIkxJR0hUU0hBUEVfUkVDVCIsIkxJR0hUU0hBUEVfRElTSyIsIkxJR0hUU0hBUEVfU1BIRVJFIiwiZ2VuZXJhdGVWZXJ0ZXhTaGFkZXIiLCJ1c2VVdiIsInVzZVVubW9kaWZpZWRVdiIsIm1hcFRyYW5zZm9ybXMiLCJjb2RlQm9keSIsIlNIQURFUl9ERVBUSCIsInVzZUluc3RhbmNpbmciLCJpbnN0YW5jZV9saW5lMSIsIlNFTUFOVElDX0FUVFIxMiIsImluc3RhbmNlX2xpbmUyIiwiU0VNQU5USUNfQVRUUjEzIiwiaW5zdGFuY2VfbGluZTMiLCJTRU1BTlRJQ19BVFRSMTQiLCJpbnN0YW5jZV9saW5lNCIsIlNFTUFOVElDX0FUVFIxNSIsImluc3RhbmNpbmdWUyIsImZyYWdtZW50VW5pZm9ybXNDb3VudCIsInZpZXdOb3JtYWxWUyIsImhhc1RhbmdlbnRzIiwibm9ybWFsTWFwRW5hYmxlZCIsInRhbmdlbnRCaW5vcm1hbFZTIiwibWF4VXZTZXRzIiwiaSIsImZvckVhY2giLCJtYXBUcmFuc2Zvcm0iLCJ2ZXJ0ZXhDb2xvcnMiLCJ1c2VNc2RmIiwibXNkZlRleHRBdHRyaWJ1dGUiLCJ2ZXJ0ZXhfb3V0bGluZVBhcmFtZXRlcnMiLCJTRU1BTlRJQ19BVFRSOCIsInZlcnRleF9zaGFkb3dQYXJhbWV0ZXJzIiwiU0VNQU5USUNfQVRUUjkiLCJtc2RmVlMiLCJ1c2VNb3JwaFBvc2l0aW9uIiwidXNlTW9ycGhOb3JtYWwiLCJ1c2VNb3JwaFRleHR1cmVCYXNlZCIsIm1vcnBoX3ZlcnRleF9pZCIsIm1vcnBoX3BvczAiLCJtb3JwaF9wb3MxIiwibW9ycGhfcG9zMiIsIlNFTUFOVElDX0FUVFIxMCIsIm1vcnBoX3BvczMiLCJTRU1BTlRJQ19BVFRSMTEiLCJtb3JwaF9ucm0wIiwibW9ycGhfbnJtMSIsIm1vcnBoX25ybTIiLCJtb3JwaF9ucm0zIiwibW9ycGhfcG9zNCIsIm1vcnBoX3BvczUiLCJtb3JwaF9wb3M2IiwibW9ycGhfcG9zNyIsIm1vcnBoX25ybTQiLCJtb3JwaF9ucm01IiwibW9ycGhfbnJtNiIsIm1vcnBoX25ybTciLCJza2luIiwic2tpbkNvZGUiLCJzY3JlZW5TcGFjZSIsInBpeGVsU25hcCIsIm5vcm1hbFZTIiwic3RhcnRWUyIsImVuZFZTIiwiT2JqZWN0Iiwia2V5cyIsInYiLCJzaGFkZXJQYXNzRGVmaW5lIiwiZ2V0UGFzc1NoYWRlckRlZmluZSIsIl9mc0dldEJlZ2luQ29kZSIsIl9mc0dldFBpY2tQYXNzQ29kZSIsImJlZ2luIiwiZW5kIiwiX2ZzR2V0RGVwdGhQYXNzQ29kZSIsInBhY2tEZXB0aFBTIiwiX2ZzR2V0U2hhZG93UGFzc0NvZGUiLCJsaWdodFR5cGUiLCJ0b0xpZ2h0VHlwZSIsInNoYWRvd1R5cGUiLCJ0b1NoYWRvd1R5cGUiLCJTSEFET1dfVlNNMzIiLCJ0ZXh0dXJlRmxvYXRIaWdoUHJlY2lzaW9uIiwiU0hBRE9XX1ZTTTE2IiwiTElHSFRUWVBFX0RJUkVDVElPTkFMIiwiU0hBRE9XX1BDRjMiLCJMSUdIVFRZUEVfT01OSSIsIlNIQURPV19WU004IiwiaXNWc20iLCJhcHBseVNsb3BlU2NhbGVCaWFzIiwiU0hBRE9XX1BDRjUiLCJzdG9yZUVWU01QUyIsIl9mc0dldExpdFBhc3NDb2RlIiwib3BhY2l0eUZhZGVzU3BlY3VsYXIiLCJwdXNoIiwidXNlQ2xlYXJDb2F0IiwiZnJlc25lbE1vZGVsIiwiY29uc2VydmVFbmVyZ3kiLCJ1c2VTaGVlbiIsInVzZUlyaWRlc2NlbmNlIiwic2hhZG93VHlwZVVzZWQiLCJudW1TaGFkb3dMaWdodHMiLCJzaGFkb3dlZERpcmVjdGlvbmFsTGlnaHRVc2VkIiwidXNlVnNtIiwidXNlUGVyc3BaYnVmZmVyU2hhZG93IiwiaGFzQXJlYUxpZ2h0cyIsInNvbWUiLCJfc2hhcGUiLCJMSUdIVFNIQVBFX1BVTkNUVUFMIiwiY2x1c3RlcmVkTGlnaHRpbmdBcmVhTGlnaHRzRW5hYmxlZCIsImFyZWFMdXRzUHJlY2lzaW9uIiwiYXJlYUxpZ2h0THV0Rm9ybWF0IiwiUElYRUxGT1JNQVRfUkdCQTgiLCJsaWdodFNoYXBlIiwiY2FzdFNoYWRvd3MiLCJub1NoYWRvdyIsIl9zaGFkb3dUeXBlIiwiX2Nvb2tpZSIsIl9jdWJlbWFwIiwiX2Nvb2tpZVRyYW5zZm9ybSIsImhhc1RCTiIsImZhc3RUYm4iLCJUQk5mYXN0UFMiLCJUQk5QUyIsIlRCTmRlcml2YXRpdmVQUyIsInJlcGxhY2UiLCJUQk5PYmplY3RTcGFjZVBTIiwic3BoZXJpY2FsUFMiLCJkZWNvZGVQUyIsImdhbW1hQ29kZSIsImdhbW1hIiwidG9uZW1hcENvZGUiLCJ0b25lTWFwIiwiZm9nQ29kZSIsImZvZyIsInVzZUN1YmVNYXBSb3RhdGlvbiIsImN1YmVNYXBSb3RhdGVQUyIsImN1YmVNYXBQcm9qZWN0aW9uIiwiY3ViZU1hcFByb2plY3RCb3hQUyIsImN1YmVNYXBQcm9qZWN0Tm9uZVBTIiwic2t5Ym94SW50ZW5zaXR5IiwiZW52TXVsdGlwbHlQUyIsImVudkNvbnN0UFMiLCJ1c2VNZXRhbG5lc3MiLCJtZXRhbG5lc3NNb2R1bGF0ZVBTIiwiRlJFU05FTF9TQ0hMSUNLIiwiZnJlc25lbFNjaGxpY2tQUyIsImlyaWRlc2NlbmNlRGlmZnJhY3Rpb25QUyIsInVzZUFvIiwiYW9NYXBFbmFibGVkIiwidXNlQW9WZXJ0ZXhDb2xvcnMiLCJhb0RpZmZ1c2VPY2NQUyIsIm9jY2x1ZGVTcGVjdWxhciIsIlNQRUNPQ0NfQU8iLCJvY2NsdWRlU3BlY3VsYXJGbG9hdCIsImFvU3BlY09jY1NpbXBsZVBTIiwiYW9TcGVjT2NjQ29uc3RTaW1wbGVQUyIsIlNQRUNPQ0NfR0xPU1NERVBFTkRFTlQiLCJhb1NwZWNPY2NQUyIsImFvU3BlY09jY0NvbnN0UFMiLCJmaXhTZWFtcyIsImZpeEN1YmVtYXBTZWFtc1N0cmV0Y2hQUyIsImZpeEN1YmVtYXBTZWFtc05vbmVQUyIsImVudkF0bGFzUFMiLCJyZWZsZWN0aW9uRW52SFFQUyIsIkNodW5rVXRpbHMiLCJkZWNvZGVGdW5jIiwicmVmbGVjdGlvbkVuY29kaW5nIiwicmVmbGVjdGlvbkVudlBTIiwicmVmbGVjdGlvbkN1YmVQUyIsInNjb2RlIiwicmVmbGVjdGlvblNwaGVyZVBTIiwicmVmbGVjdGlvblNwaGVyZUxvd1BTIiwicmVmbGVjdGlvbkNDUFMiLCJyZWZsZWN0aW9uU2hlZW5QUyIsInVzZVJlZnJhY3Rpb24iLCJyZWZyYWN0aW9uRHluYW1pY1BTIiwicmVmcmFjdGlvbkN1YmVQUyIsImxpZ2h0U2hlZW5QUyIsImNsdXN0ZXJlZExpZ2h0VXRpbHNQUyIsImNsdXN0ZXJlZExpZ2h0aW5nQ29va2llc0VuYWJsZWQiLCJjbHVzdGVyZWRMaWdodENvb2tpZXNQUyIsImNsdXN0ZXJlZExpZ2h0aW5nU2hhZG93c0VuYWJsZWQiLCJzaGFkb3dDYXNjYWRlc1BTIiwic2hhZG93U3RhbmRhcmRQUyIsInNoYWRvd1N0YW5kYXJkR0wyUFMiLCJzaGFkb3dWU01fY29tbW9uUFMiLCJzaGFkb3dWU004UFMiLCJleHRUZXh0dXJlSGFsZkZsb2F0TGluZWFyIiwic2hhZG93RVZTTVBTIiwic2hhZG93RVZTTW5QUyIsImV4dFRleHR1cmVGbG9hdExpbmVhciIsImJpYXNDb25zdFBTIiwic2hhZG93Q29vcmRQUyIsInNoYWRvd0NvbW1vblBTIiwic2hhZG93Q29vcmRQZXJzcFpidWZmZXJQUyIsImxpZ2h0RGlmZnVzZUxhbWJlcnRQUyIsImx0YyIsInVzZU9sZEFtYmllbnQiLCJzaGFkaW5nTW9kZWwiLCJTUEVDVUxBUl9QSE9ORyIsImxpZ2h0U3BlY3VsYXJQaG9uZ1BTIiwibGlnaHRTcGVjdWxhckFuaXNvR0dYUFMiLCJsaWdodFNwZWN1bGFyQmxpbm5QUyIsImRpZmZ1c2VNYXBFbmFibGVkIiwiY29tYmluZVBTIiwibGlnaHRNYXBFbmFibGVkIiwidXNlTGlnaHRNYXBWZXJ0ZXhDb2xvcnMiLCJsaWdodG1hcERpckFkZFBTIiwibGlnaHRtYXBBZGRQUyIsImFkZEFtYmllbnQiLCJsaWdodE1hcFdpdGhvdXRBbWJpZW50IiwiYW1iaWVudFNvdXJjZSIsImFtYmllbnRTSFBTIiwiYW1iaWVudEVudlBTIiwiYW1iaWVudEVuY29kaW5nIiwiYW1iaWVudENvbnN0YW50UFMiLCJ1c2VBbWJpZW50VGludCIsIm1zZGZQUyIsInZpZXdEaXJQUyIsInJlZmxEaXJBbmlzb1BTIiwicmVmbERpclBTIiwiaGFzUG9pbnRMaWdodHMiLCJ1c2VzTGluZWFyRmFsbG9mZiIsInVzZXNJbnZTcXVhcmVkRmFsbG9mZiIsInVzZXNTcG90IiwidXNlc0Nvb2tpZSIsInVzZXNDb29raWVOb3ciLCJmbG9hdFVucGFja2luZ1BTIiwibGlnaHRNYXNrRHluYW1pYyIsInNoYWRvd1R5cGVUb1N0cmluZyIsImNsdXN0ZXJlZExpZ2h0aW5nU2hhZG93VHlwZSIsIkxpZ2h0c0J1ZmZlciIsInNoYWRlckRlZmluZXMiLCJjbHVzdGVyZWRMaWdodFNoYWRvd3NQUyIsImNsdXN0ZXJlZExpZ2h0UFMiLCJ0d29TaWRlZExpZ2h0aW5nIiwic2VwYXJhdGVBbWJpZW50Iiwib2NjbHVkZURpcmVjdCIsInVzZVNwZWN1bGFyaXR5RmFjdG9yIiwic2hhcGVTdHJpbmciLCJfY29va2llRmFsbG9mZiIsIl9jb29raWVDaGFubmVsIiwiX2ZhbGxvZmZNb2RlIiwiTElHSFRGQUxMT0ZGX0xJTkVBUiIsInNoYWRvd1JlYWRNb2RlIiwiZXZzbUV4cCIsImNhbGNGcmVzbmVsIiwiYmxlbmRUeXBlIiwiQkxFTkRfTk9STUFMIiwiQkxFTkRfUFJFTVVMVElQTElFRCIsImVuZFBTIiwiQkxFTkRfQURESVRJVkVBTFBIQSIsImFscGhhVG9Db3ZlcmFnZSIsIm91dHB1dEFscGhhUFMiLCJvdXRwdXRBbHBoYVByZW11bFBTIiwib3V0cHV0QWxwaGFPcGFxdWVQUyIsImxpZ2h0RGlyUG9pbnRQUyIsImZhbGxvZmZMaW5lYXJQUyIsImZhbGxvZmZJbnZTcXVhcmVkUFMiLCJzcG90UFMiLCJjb29raWVQUyIsInN0cnVjdENvZGUiLCJpbmNsdWRlcyIsImRldGFpbE1vZGVzIiwiZGV0YWlsTW9kZXNQUyIsImdlbmVyYXRlRnJhZ21lbnRTaGFkZXIiLCJTSEFERVJfUElDSyIsImN1c3RvbUZyYWdtZW50U2hhZGVyIiwiZ2V0RGVmaW5pdGlvbiIsImRlZmluaXRpb24iLCJTaGFkZXJVdGlscyIsImNyZWF0ZURlZmluaXRpb24iLCJ2ZXJ0ZXhDb2RlIiwiZnJhZ21lbnRDb2RlIiwiaXNGb3J3YXJkIiwidGFnIiwiU0hBREVSVEFHX01BVEVSSUFMIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7QUE2QkEsTUFBTUEsaUJBQWlCLEdBQUc7QUFDdEJDLEVBQUFBLGFBQWEsRUFBRUMsZUFBZTtBQUM5QkMsRUFBQUEsY0FBYyxFQUFFQyxnQkFBZ0I7QUFDaENDLEVBQUFBLGdCQUFnQixFQUFFQyxrQkFBa0I7QUFDcENDLEVBQUFBLGdCQUFnQixFQUFFQyxrQkFBa0I7QUFDcENDLEVBQUFBLFlBQVksRUFBRUMsY0FBYztBQUM1QkMsRUFBQUEsa0JBQWtCLEVBQUVDLG9CQUFvQjtBQUN4Q0MsRUFBQUEsa0JBQWtCLEVBQUVDLHFCQUFBQTtBQUN4QixDQUFDLENBQUE7QUFFRCxNQUFNQyxlQUFlLEdBQUc7QUFDcEJDLEVBQUFBLFlBQVksRUFBRSxNQUFNO0FBQ3BCQyxFQUFBQSxVQUFVLEVBQUUsTUFBTTtBQUNsQkMsRUFBQUEsUUFBUSxFQUFFLE1BQU07QUFDaEJDLEVBQUFBLFFBQVEsRUFBRSxNQUFNO0FBQ2hCQyxFQUFBQSxTQUFTLEVBQUUsTUFBTTtBQUNqQkMsRUFBQUEsVUFBVSxFQUFFLE1BQU07QUFDbEJDLEVBQUFBLGVBQWUsRUFBRSxNQUFNO0FBQ3ZCQyxFQUFBQSxJQUFJLEVBQUUsTUFBTTtBQUNaQyxFQUFBQSxJQUFJLEVBQUUsTUFBQTtBQUNWLENBQUMsQ0FBQTtBQUVELE1BQU1DLFNBQVMsQ0FBQztBQUNaQyxFQUFBQSxXQUFXLENBQUNDLE1BQU0sRUFBRUMsT0FBTyxFQUFFO0lBQ3pCLElBQUksQ0FBQ0QsTUFBTSxHQUFHQSxNQUFNLENBQUE7SUFDcEIsSUFBSSxDQUFDQyxPQUFPLEdBQUdBLE9BQU8sQ0FBQTs7SUFHdEIsSUFBSSxDQUFDQyxVQUFVLEdBQUc7QUFDZEMsTUFBQUEs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
