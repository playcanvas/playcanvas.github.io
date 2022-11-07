/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { SEMANTIC_POSITION, SEMANTIC_ATTR12, SEMANTIC_ATTR13, SEMANTIC_ATTR14, SEMANTIC_ATTR15, SEMANTIC_NORMAL, SEMANTIC_TANGENT, SEMANTIC_COLOR, SEMANTIC_ATTR8, SEMANTIC_ATTR9, SEMANTIC_ATTR10, SEMANTIC_ATTR11, SEMANTIC_BLENDWEIGHT, SEMANTIC_BLENDINDICES, PIXELFORMAT_R8_G8_B8_A8, SHADERTAG_MATERIAL, SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD1 } from '../../../platform/graphics/constants.js';
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

          if (options.clearCoat) {
            code += "    ccSpecularLight += getLightSpecularCC(dHalfDirW) * dAtten * light" + i + "_color";
            code += usesCookieNow ? " * dAtten3" : "";
            code += calcFresnel ? " * getFresnelCC(dot(dViewDirW, dHalfDirW))" : "";
            code += ";\n";
          }
          if (options.sheen) {
            code += "    sSpecularLight += getLightSpecularSheen(dHalfDirW) * dAtten * light" + i + "_color";
            code += usesCookieNow ? " * dAtten3" : "";
            code += ";\n";
          }
          if (options.useSpecular) {
            code += "    dSpecularLight += getLightSpecular(dHalfDirW) * dAtten * light" + i + "_color";
            code += usesCookieNow ? " * dAtten3" : "";
            code += calcFresnel ? " * getFresnel(dot(dViewDirW, dHalfDirW), dSpecularity)" : "";
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGl0LXNoYWRlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvcHJvZ3JhbXMvbGl0LXNoYWRlci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge1xuICAgIFNFTUFOVElDX0FUVFI4LCBTRU1BTlRJQ19BVFRSOSwgU0VNQU5USUNfQVRUUjEwLCBTRU1BTlRJQ19BVFRSMTEsIFNFTUFOVElDX0FUVFIxMiwgU0VNQU5USUNfQVRUUjEzLCBTRU1BTlRJQ19BVFRSMTQsIFNFTUFOVElDX0FUVFIxNSxcbiAgICBTRU1BTlRJQ19CTEVORElORElDRVMsIFNFTUFOVElDX0JMRU5EV0VJR0hULCBTRU1BTlRJQ19DT0xPUiwgU0VNQU5USUNfTk9STUFMLCBTRU1BTlRJQ19QT1NJVElPTiwgU0VNQU5USUNfVEFOR0VOVCxcbiAgICBTRU1BTlRJQ19URVhDT09SRDAsIFNFTUFOVElDX1RFWENPT1JEMSxcbiAgICBTSEFERVJUQUdfTUFURVJJQUwsXG4gICAgUElYRUxGT1JNQVRfUjhfRzhfQjhfQThcbn0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IHNoYWRlckNodW5rcyB9IGZyb20gJy4uL2NodW5rcy9jaHVua3MuanMnO1xuaW1wb3J0IHsgQ2h1bmtVdGlscyB9IGZyb20gJy4uL2NodW5rLXV0aWxzLmpzJztcblxuaW1wb3J0IHtcbiAgICBCTEVORF9BRERJVElWRUFMUEhBLCBCTEVORF9OT1JNQUwsIEJMRU5EX1BSRU1VTFRJUExJRUQsXG4gICAgRlJFU05FTF9TQ0hMSUNLLFxuICAgIExJR0hURkFMTE9GRl9MSU5FQVIsXG4gICAgTElHSFRTSEFQRV9QVU5DVFVBTCwgTElHSFRTSEFQRV9SRUNULCBMSUdIVFNIQVBFX0RJU0ssIExJR0hUU0hBUEVfU1BIRVJFLFxuICAgIExJR0hUVFlQRV9ESVJFQ1RJT05BTCwgTElHSFRUWVBFX09NTkksIExJR0hUVFlQRV9TUE9ULFxuICAgIFNIQURFUl9ERVBUSCwgU0hBREVSX1BJQ0ssXG4gICAgU0hBRE9XX1BDRjMsIFNIQURPV19QQ0Y1LCBTSEFET1dfVlNNOCwgU0hBRE9XX1ZTTTE2LCBTSEFET1dfVlNNMzIsXG4gICAgU1BFQ09DQ19BTywgU1BFQ09DQ19HTE9TU0RFUEVOREVOVCxcbiAgICBTUEVDVUxBUl9QSE9ORyxcbiAgICBTUFJJVEVfUkVOREVSTU9ERV9TTElDRUQsIFNQUklURV9SRU5ERVJNT0RFX1RJTEVELCBzaGFkb3dUeXBlVG9TdHJpbmdcbn0gZnJvbSAnLi4vLi4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IExpZ2h0c0J1ZmZlciB9IGZyb20gJy4uLy4uL2xpZ2h0aW5nL2xpZ2h0cy1idWZmZXIuanMnO1xuaW1wb3J0IHsgU2hhZGVyUGFzcyB9IGZyb20gJy4uLy4uL3NoYWRlci1wYXNzLmpzJztcblxuaW1wb3J0IHsgYmVnaW4sIGVuZCwgZm9nQ29kZSwgZ2FtbWFDb2RlLCBza2luQ29kZSwgdG9uZW1hcENvZGUgfSBmcm9tICcuL2NvbW1vbi5qcyc7XG5pbXBvcnQgeyB2YWxpZGF0ZVVzZXJDaHVua3MgfSBmcm9tICcuLi9jaHVua3MvY2h1bmstdmFsaWRhdGlvbi5qcyc7XG5pbXBvcnQgeyBTaGFkZXJVdGlscyB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3NoYWRlci11dGlscy5qcyc7XG5cbmNvbnN0IGJ1aWx0aW5BdHRyaWJ1dGVzID0ge1xuICAgIHZlcnRleF9ub3JtYWw6IFNFTUFOVElDX05PUk1BTCxcbiAgICB2ZXJ0ZXhfdGFuZ2VudDogU0VNQU5USUNfVEFOR0VOVCxcbiAgICB2ZXJ0ZXhfdGV4Q29vcmQwOiBTRU1BTlRJQ19URVhDT09SRDAsXG4gICAgdmVydGV4X3RleENvb3JkMTogU0VNQU5USUNfVEVYQ09PUkQxLFxuICAgIHZlcnRleF9jb2xvcjogU0VNQU5USUNfQ09MT1IsXG4gICAgdmVydGV4X2JvbmVXZWlnaHRzOiBTRU1BTlRJQ19CTEVORFdFSUdIVCxcbiAgICB2ZXJ0ZXhfYm9uZUluZGljZXM6IFNFTUFOVElDX0JMRU5ESU5ESUNFU1xufTtcblxuY29uc3QgYnVpbHRpblZhcnlpbmdzID0ge1xuICAgIHZWZXJ0ZXhDb2xvcjogXCJ2ZWM0XCIsXG4gICAgdlBvc2l0aW9uVzogXCJ2ZWMzXCIsXG4gICAgdk5vcm1hbFY6IFwidmVjM1wiLFxuICAgIHZOb3JtYWxXOiBcInZlYzNcIixcbiAgICB2VGFuZ2VudFc6IFwidmVjM1wiLFxuICAgIHZCaW5vcm1hbFc6IFwidmVjM1wiLFxuICAgIHZPYmplY3RTcGFjZVVwVzogXCJ2ZWMzXCIsXG4gICAgdlV2MDogXCJ2ZWMyXCIsXG4gICAgdlV2MTogXCJ2ZWMyXCJcbn07XG5cbmNsYXNzIExpdFNoYWRlciB7XG4gICAgY29uc3RydWN0b3IoZGV2aWNlLCBvcHRpb25zKSB7XG4gICAgICAgIHRoaXMuZGV2aWNlID0gZGV2aWNlO1xuICAgICAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuXG4gICAgICAgIC8vIHJlc29sdmUgY3VzdG9tIGNodW5rIGF0dHJpYnV0ZXNcbiAgICAgICAgdGhpcy5hdHRyaWJ1dGVzID0ge1xuICAgICAgICAgICAgdmVydGV4X3Bvc2l0aW9uOiBTRU1BTlRJQ19QT1NJVElPTlxuICAgICAgICB9O1xuXG4gICAgICAgIGlmIChvcHRpb25zLmNodW5rcykge1xuICAgICAgICAgICAgdGhpcy5jaHVua3MgPSB7fTtcblxuICAgICAgICAgICAgY29uc3QgdXNlckNodW5rcyA9IG9wdGlvbnMuY2h1bmtzO1xuXG4gICAgICAgICAgICAvLyAjaWYgX0RFQlVHXG4gICAgICAgICAgICB2YWxpZGF0ZVVzZXJDaHVua3Mob3B0aW9ucy5jaHVua3MpO1xuICAgICAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgICAgIGZvciAoY29uc3QgY2h1bmtOYW1lIGluIHNoYWRlckNodW5rcykge1xuICAgICAgICAgICAgICAgIGlmICh1c2VyQ2h1bmtzLmhhc093blByb3BlcnR5KGNodW5rTmFtZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY2h1bmsgPSB1c2VyQ2h1bmtzW2NodW5rTmFtZV07XG4gICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgYSBpbiBidWlsdGluQXR0cmlidXRlcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGJ1aWx0aW5BdHRyaWJ1dGVzLmhhc093blByb3BlcnR5KGEpICYmIGNodW5rLmluZGV4T2YoYSkgPj0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlc1thXSA9IGJ1aWx0aW5BdHRyaWJ1dGVzW2FdO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY2h1bmtzW2NodW5rTmFtZV0gPSBjaHVuaztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmNodW5rc1tjaHVua05hbWVdID0gc2hhZGVyQ2h1bmtzW2NodW5rTmFtZV07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5jaHVua3MgPSBzaGFkZXJDaHVua3M7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmxpZ2h0aW5nID0gKG9wdGlvbnMubGlnaHRzLmxlbmd0aCA+IDApIHx8ICEhb3B0aW9ucy5kaXJMaWdodE1hcCB8fCAhIW9wdGlvbnMuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkO1xuICAgICAgICB0aGlzLnJlZmxlY3Rpb25zID0gISFvcHRpb25zLnJlZmxlY3Rpb25Tb3VyY2U7XG4gICAgICAgIGlmICghb3B0aW9ucy51c2VTcGVjdWxhcikgb3B0aW9ucy5zcGVjdWxhck1hcCA9IG9wdGlvbnMuZ2xvc3NNYXAgPSBudWxsO1xuICAgICAgICB0aGlzLnNoYWRvd1Bhc3MgPSBTaGFkZXJQYXNzLmlzU2hhZG93KG9wdGlvbnMucGFzcyk7XG4gICAgICAgIHRoaXMubmVlZHNOb3JtYWwgPSB0aGlzLmxpZ2h0aW5nIHx8IHRoaXMucmVmbGVjdGlvbnMgfHwgb3B0aW9ucy51c2VTcGVjdWxhciB8fCBvcHRpb25zLmFtYmllbnRTSCB8fCBvcHRpb25zLmhlaWdodE1hcCB8fCBvcHRpb25zLmVuYWJsZUdHWFNwZWN1bGFyIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKG9wdGlvbnMuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkICYmICF0aGlzLnNoYWRvd1Bhc3MpIHx8IG9wdGlvbnMuY2xlYXJDb2F0Tm9ybWFsTWFwO1xuICAgICAgICB0aGlzLm5lZWRzU2NlbmVDb2xvciA9IG9wdGlvbnMudXNlRHluYW1pY1JlZnJhY3Rpb247XG4gICAgICAgIHRoaXMubmVlZHNTY3JlZW5TaXplID0gb3B0aW9ucy51c2VEeW5hbWljUmVmcmFjdGlvbjtcbiAgICAgICAgdGhpcy5uZWVkc1RyYW5zZm9ybXMgPSBvcHRpb25zLnVzZUR5bmFtaWNSZWZyYWN0aW9uO1xuXG4gICAgICAgIC8vIGdlbmVyYXRlZCBieSB2c2hhZGVyXG4gICAgICAgIHRoaXMudmFyeWluZ3MgPSBcIlwiO1xuICAgICAgICB0aGlzLnZzaGFkZXIgPSBudWxsO1xuXG4gICAgICAgIC8vIHN1cHBsaWVkIGJ5IGNhbGxlclxuICAgICAgICB0aGlzLmZyb250ZW5kRGVjbCA9IG51bGw7XG4gICAgICAgIHRoaXMuZnJvbnRlbmRDb2RlID0gbnVsbDtcbiAgICAgICAgdGhpcy5mcm9udGVuZEZ1bmMgPSBudWxsO1xuICAgICAgICB0aGlzLmxpZ2h0aW5nVXYgPSBudWxsO1xuXG4gICAgICAgIC8vIGRlZmluZXMgc2V0IGJ5IHRoZSBzaGFkZXIgZ2VuZXJhdGlvblxuICAgICAgICB0aGlzLmRlZmluZXMgPSBbXTtcblxuICAgICAgICAvLyBnZW5lcmF0ZWQgYnkgZnNoYWRlclxuICAgICAgICB0aGlzLmZzaGFkZXIgPSBudWxsO1xuICAgIH1cblxuICAgIF92c0FkZEJhc2VDb2RlKGNvZGUsIGNodW5rcywgb3B0aW9ucykge1xuICAgICAgICBjb2RlICs9IGNodW5rcy5iYXNlVlM7XG4gICAgICAgIGlmIChvcHRpb25zLm5pbmVTbGljZWRNb2RlID09PSBTUFJJVEVfUkVOREVSTU9ERV9TTElDRUQgfHxcbiAgICAgICAgICAgIG9wdGlvbnMubmluZVNsaWNlZE1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1RJTEVEKSB7XG4gICAgICAgICAgICBjb2RlICs9IGNodW5rcy5iYXNlTmluZVNsaWNlZFZTO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjb2RlO1xuICAgIH1cblxuICAgIF92c0FkZFRyYW5zZm9ybUNvZGUoY29kZSwgZGV2aWNlLCBjaHVua3MsIG9wdGlvbnMpIHtcbiAgICAgICAgY29kZSArPSB0aGlzLmNodW5rcy50cmFuc2Zvcm1WUztcbiAgICAgICAgcmV0dXJuIGNvZGU7XG4gICAgfVxuXG4gICAgX3NldE1hcFRyYW5zZm9ybShjb2RlcywgbmFtZSwgaWQsIHV2KSB7XG4gICAgICAgIGNvbnN0IGNoZWNrSWQgPSBpZCArIHV2ICogMTAwO1xuICAgICAgICBpZiAoIWNvZGVzWzNdW2NoZWNrSWRdKSB7XG4gICAgICAgICAgICAvLyB1cGxvYWQgYSAzeDIgbWF0cml4IGFuZCBtYW51YWxseSBwZXJmb3JtIHRoZSBtdWx0aXBsaWNhdGlvblxuICAgICAgICAgICAgY29uc3QgdmFyTmFtZSA9IGB0ZXh0dXJlXyR7bmFtZX1NYXBUcmFuc2Zvcm1gO1xuICAgICAgICAgICAgY29kZXNbMF0gKz0gYHVuaWZvcm0gdmVjMyAke3Zhck5hbWV9MDtcXG5gO1xuICAgICAgICAgICAgY29kZXNbMF0gKz0gYHVuaWZvcm0gdmVjMyAke3Zhck5hbWV9MTtcXG5gO1xuICAgICAgICAgICAgY29kZXNbMV0gKz0gYHZhcnlpbmcgdmVjMiB2VVYke3V2fV8ke2lkfTtcXG5gO1xuICAgICAgICAgICAgY29kZXNbMl0gKz0gYCAgIHZVViR7dXZ9XyR7aWR9ID0gdmVjMihkb3QodmVjMyh1diR7dXZ9LCAxKSwgJHt2YXJOYW1lfTApLCBkb3QodmVjMyh1diR7dXZ9LCAxKSwgJHt2YXJOYW1lfTEpKTtcXG5gO1xuICAgICAgICAgICAgY29kZXNbM11bY2hlY2tJZF0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjb2RlcztcbiAgICB9XG5cbiAgICAvLyBBZGQgXCJCYXNlXCIgQ29kZSBzZWN0aW9uIHRvIGZyYWdtZW50IHNoYWRlci5cbiAgICBfZnNHZXRCYXNlQ29kZSgpIHtcbiAgICAgICAgY29uc3Qgb3B0aW9ucyA9IHRoaXMub3B0aW9ucztcbiAgICAgICAgY29uc3QgY2h1bmtzID0gdGhpcy5jaHVua3M7XG4gICAgICAgIGxldCByZXN1bHQgPSB0aGlzLmNodW5rcy5iYXNlUFM7XG4gICAgICAgIGlmIChvcHRpb25zLm5pbmVTbGljZWRNb2RlID09PSBTUFJJVEVfUkVOREVSTU9ERV9TTElDRUQpIHtcbiAgICAgICAgICAgIHJlc3VsdCArPSBjaHVua3MuYmFzZU5pbmVTbGljZWRQUztcbiAgICAgICAgfSBlbHNlIGlmIChvcHRpb25zLm5pbmVTbGljZWRNb2RlID09PSBTUFJJVEVfUkVOREVSTU9ERV9USUxFRCkge1xuICAgICAgICAgICAgcmVzdWx0ICs9IGNodW5rcy5iYXNlTmluZVNsaWNlZFRpbGVkUFM7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICAvLyBBZGQgXCJTdGFydFwiIENvZGUgc2VjdGlvbiB0byBmcmFnbWVudCBzaGFkZXIuXG4gICAgX2ZzR2V0U3RhcnRDb2RlKGNvZGUsIGRldmljZSwgY2h1bmtzLCBvcHRpb25zKSB7XG4gICAgICAgIGxldCByZXN1bHQgPSBjaHVua3Muc3RhcnRQUztcbiAgICAgICAgaWYgKG9wdGlvbnMubmluZVNsaWNlZE1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1NMSUNFRCkge1xuICAgICAgICAgICAgcmVzdWx0ICs9IGNodW5rcy5zdGFydE5pbmVTbGljZWRQUztcbiAgICAgICAgfSBlbHNlIGlmIChvcHRpb25zLm5pbmVTbGljZWRNb2RlID09PSBTUFJJVEVfUkVOREVSTU9ERV9USUxFRCkge1xuICAgICAgICAgICAgcmVzdWx0ICs9IGNodW5rcy5zdGFydE5pbmVTbGljZWRUaWxlZFBTO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgLy8gaGFuZGxlcyBkaXJlY3Rpb25hbCBtYXAgc2hhZG93IGNvb3JkaW5hdGUgZ2VuZXJhdGlvbiwgaW5jbHVkaW5nIGNhc2NhZGVkIHNoYWRvd3NcbiAgICBfZGlyZWN0aW9uYWxTaGFkb3dNYXBQcm9qZWN0aW9uKGxpZ2h0LCBzaGFkb3dDb29yZEFyZ3MsIHNoYWRvd1BhcmFtQXJnLCBsaWdodEluZGV4LCBjb29yZHNGdW5jdGlvbk5hbWUpIHtcblxuICAgICAgICAvLyBmb3Igc2hhZG93IGNhc2NhZGVzXG4gICAgICAgIGxldCBjb2RlID0gXCJcIjtcbiAgICAgICAgaWYgKGxpZ2h0Lm51bUNhc2NhZGVzID4gMSkge1xuICAgICAgICAgICAgLy8gY29tcHV0ZSB3aGljaCBjYXNjYWRlIG1hdHJpeCBuZWVkcyB0byBiZSB1c2VkXG4gICAgICAgICAgICBjb2RlICs9IGBnZXRTaGFkb3dDYXNjYWRlTWF0cml4KGxpZ2h0JHtsaWdodEluZGV4fV9zaGFkb3dNYXRyaXhQYWxldHRlLCBsaWdodCR7bGlnaHRJbmRleH1fc2hhZG93Q2FzY2FkZURpc3RhbmNlcywgbGlnaHQke2xpZ2h0SW5kZXh9X3NoYWRvd0Nhc2NhZGVDb3VudCk7XFxuYDtcbiAgICAgICAgICAgIHNoYWRvd0Nvb3JkQXJncyA9IGAoY2FzY2FkZVNoYWRvd01hdCwgJHtzaGFkb3dQYXJhbUFyZ30pO1xcbmA7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzaGFkb3cgY29vcmRpbmF0ZSBnZW5lcmF0aW9uXG4gICAgICAgIGNvZGUgKz0gY29vcmRzRnVuY3Rpb25OYW1lICsgc2hhZG93Q29vcmRBcmdzO1xuXG4gICAgICAgIC8vIHN0b3Agc2hhZG93IGF0IHRoZSBmYXIgZGlzdGFuY2VcbiAgICAgICAgY29kZSArPSBgZmFkZVNoYWRvdyhsaWdodCR7bGlnaHRJbmRleH1fc2hhZG93Q2FzY2FkZURpc3RhbmNlcyk7XFxuYDtcbiAgICAgICAgcmV0dXJuIGNvZGU7XG4gICAgfVxuXG4gICAgX25vblBvaW50U2hhZG93TWFwUHJvamVjdGlvbihkZXZpY2UsIGxpZ2h0LCBzaGFkb3dNYXRBcmcsIHNoYWRvd1BhcmFtQXJnLCBsaWdodEluZGV4KSB7XG4gICAgICAgIGNvbnN0IHNoYWRvd0Nvb3JkQXJncyA9IGAoJHtzaGFkb3dNYXRBcmd9LCAke3NoYWRvd1BhcmFtQXJnfSk7XFxuYDtcbiAgICAgICAgaWYgKCFsaWdodC5fbm9ybWFsT2Zmc2V0QmlhcyB8fCBsaWdodC5faXNWc20pIHtcbiAgICAgICAgICAgIGlmIChsaWdodC5fdHlwZSA9PT0gTElHSFRUWVBFX1NQT1QpIHtcbiAgICAgICAgICAgICAgICBpZiAobGlnaHQuX2lzUGNmICYmIChkZXZpY2Uud2ViZ2wyIHx8IGRldmljZS5leHRTdGFuZGFyZERlcml2YXRpdmVzKSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gXCIgICAgICAgZ2V0U2hhZG93Q29vcmRQZXJzcFpidWZmZXJcIiArIHNoYWRvd0Nvb3JkQXJncztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIFwiICAgICAgIGdldFNoYWRvd0Nvb3JkUGVyc3BcIiArIHNoYWRvd0Nvb3JkQXJncztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9kaXJlY3Rpb25hbFNoYWRvd01hcFByb2plY3Rpb24obGlnaHQsIHNoYWRvd0Nvb3JkQXJncywgc2hhZG93UGFyYW1BcmcsIGxpZ2h0SW5kZXgsIFwiZ2V0U2hhZG93Q29vcmRPcnRob1wiKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobGlnaHQuX3R5cGUgPT09IExJR0hUVFlQRV9TUE9UKSB7XG4gICAgICAgICAgICBpZiAobGlnaHQuX2lzUGNmICYmIChkZXZpY2Uud2ViZ2wyIHx8IGRldmljZS5leHRTdGFuZGFyZERlcml2YXRpdmVzKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBcIiAgICAgICBnZXRTaGFkb3dDb29yZFBlcnNwWmJ1ZmZlck5vcm1hbE9mZnNldFwiICsgc2hhZG93Q29vcmRBcmdzO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIFwiICAgICAgIGdldFNoYWRvd0Nvb3JkUGVyc3BOb3JtYWxPZmZzZXRcIiArIHNoYWRvd0Nvb3JkQXJncztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fZGlyZWN0aW9uYWxTaGFkb3dNYXBQcm9qZWN0aW9uKGxpZ2h0LCBzaGFkb3dDb29yZEFyZ3MsIHNoYWRvd1BhcmFtQXJnLCBsaWdodEluZGV4LCBcImdldFNoYWRvd0Nvb3JkT3J0aG9Ob3JtYWxPZmZzZXRcIik7XG4gICAgfVxuXG4gICAgX2dldExpZ2h0U291cmNlU2hhcGVTdHJpbmcoc2hhcGUpIHtcbiAgICAgICAgc3dpdGNoIChzaGFwZSkge1xuICAgICAgICAgICAgY2FzZSBMSUdIVFNIQVBFX1JFQ1Q6XG4gICAgICAgICAgICAgICAgcmV0dXJuICdSZWN0JztcbiAgICAgICAgICAgIGNhc2UgTElHSFRTSEFQRV9ESVNLOlxuICAgICAgICAgICAgICAgIHJldHVybiAnRGlzayc7XG4gICAgICAgICAgICBjYXNlIExJR0hUU0hBUEVfU1BIRVJFOlxuICAgICAgICAgICAgICAgIHJldHVybiAnU3BoZXJlJztcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgcmV0dXJuICcnO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2VuZXJhdGVWZXJ0ZXhTaGFkZXIodXNlVXYsIHVzZVVubW9kaWZpZWRVdiwgbWFwVHJhbnNmb3Jtcykge1xuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmRldmljZTtcbiAgICAgICAgY29uc3Qgb3B0aW9ucyA9IHRoaXMub3B0aW9ucztcbiAgICAgICAgY29uc3QgY2h1bmtzID0gdGhpcy5jaHVua3M7XG5cbiAgICAgICAgbGV0IGNvZGUgPSAnJztcbiAgICAgICAgbGV0IGNvZGVCb2R5ID0gJyc7XG5cbiAgICAgICAgLy8gY29kZSArPSBjaHVua3MuYmFzZVZTO1xuICAgICAgICBjb2RlID0gdGhpcy5fdnNBZGRCYXNlQ29kZShjb2RlLCBjaHVua3MsIG9wdGlvbnMpO1xuXG4gICAgICAgIGNvZGVCb2R5ICs9IFwiICAgdlBvc2l0aW9uVyAgICA9IGdldFdvcmxkUG9zaXRpb24oKTtcXG5cIjtcblxuICAgICAgICBpZiAodGhpcy5vcHRpb25zLnBhc3MgPT09IFNIQURFUl9ERVBUSCkge1xuICAgICAgICAgICAgY29kZSArPSAndmFyeWluZyBmbG9hdCB2RGVwdGg7XFxuJztcbiAgICAgICAgICAgIGNvZGUgKz0gJyNpZm5kZWYgVklFV01BVFJJWFxcbic7XG4gICAgICAgICAgICBjb2RlICs9ICcjZGVmaW5lIFZJRVdNQVRSSVhcXG4nO1xuICAgICAgICAgICAgY29kZSArPSAndW5pZm9ybSBtYXQ0IG1hdHJpeF92aWV3O1xcbic7XG4gICAgICAgICAgICBjb2RlICs9ICcjZW5kaWZcXG4nO1xuICAgICAgICAgICAgY29kZSArPSAnI2lmbmRlZiBDQU1FUkFQTEFORVNcXG4nO1xuICAgICAgICAgICAgY29kZSArPSAnI2RlZmluZSBDQU1FUkFQTEFORVNcXG4nO1xuICAgICAgICAgICAgY29kZSArPSAndW5pZm9ybSB2ZWM0IGNhbWVyYV9wYXJhbXM7XFxuXFxuJztcbiAgICAgICAgICAgIGNvZGUgKz0gJyNlbmRpZlxcbic7XG4gICAgICAgICAgICBjb2RlQm9keSArPSBcIiAgICB2RGVwdGggPSAtKG1hdHJpeF92aWV3ICogdmVjNCh2UG9zaXRpb25XLDEuMCkpLnogKiBjYW1lcmFfcGFyYW1zLng7XFxuXCI7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5vcHRpb25zLnVzZUluc3RhbmNpbmcpIHtcbiAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlcy5pbnN0YW5jZV9saW5lMSA9IFNFTUFOVElDX0FUVFIxMjtcbiAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlcy5pbnN0YW5jZV9saW5lMiA9IFNFTUFOVElDX0FUVFIxMztcbiAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlcy5pbnN0YW5jZV9saW5lMyA9IFNFTUFOVElDX0FUVFIxNDtcbiAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlcy5pbnN0YW5jZV9saW5lNCA9IFNFTUFOVElDX0FUVFIxNTtcbiAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLmluc3RhbmNpbmdWUztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLm5lZWRzTm9ybWFsKSB7XG4gICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXMudmVydGV4X25vcm1hbCA9IFNFTUFOVElDX05PUk1BTDtcbiAgICAgICAgICAgIGNvZGVCb2R5ICs9IFwiICAgdk5vcm1hbFcgPSBnZXROb3JtYWwoKTtcXG5cIjtcblxuICAgICAgICAgICAgaWYgKG9wdGlvbnMucmVmbGVjdGlvblNvdXJjZSA9PT0gJ3NwaGVyZU1hcCcgJiYgZGV2aWNlLmZyYWdtZW50VW5pZm9ybXNDb3VudCA8PSAxNikge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLnZpZXdOb3JtYWxWUztcbiAgICAgICAgICAgICAgICBjb2RlQm9keSArPSBcIiAgIHZOb3JtYWxWICAgID0gZ2V0Vmlld05vcm1hbCgpO1xcblwiO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAob3B0aW9ucy5oYXNUYW5nZW50cyAmJiAob3B0aW9ucy5oZWlnaHRNYXAgfHwgb3B0aW9ucy5ub3JtYWxNYXAgfHwgb3B0aW9ucy5lbmFibGVHR1hTcGVjdWxhcikpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXMudmVydGV4X3RhbmdlbnQgPSBTRU1BTlRJQ19UQU5HRU5UO1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLnRhbmdlbnRCaW5vcm1hbFZTO1xuICAgICAgICAgICAgICAgIGNvZGVCb2R5ICs9IFwiICAgdlRhbmdlbnRXICAgPSBnZXRUYW5nZW50KCk7XFxuXCI7XG4gICAgICAgICAgICAgICAgY29kZUJvZHkgKz0gXCIgICB2Qmlub3JtYWxXICA9IGdldEJpbm9ybWFsKCk7XFxuXCI7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKG9wdGlvbnMuZW5hYmxlR0dYU3BlY3VsYXIgfHwgIWRldmljZS5leHRTdGFuZGFyZERlcml2YXRpdmVzKSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBjaHVua3MudGFuZ2VudEJpbm9ybWFsVlM7XG4gICAgICAgICAgICAgICAgY29kZUJvZHkgKz0gXCIgICB2T2JqZWN0U3BhY2VVcFcgID0gZ2V0T2JqZWN0U3BhY2VVcCgpO1xcblwiO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgbWF4VXZTZXRzID0gMjtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1heFV2U2V0czsgaSsrKSB7XG4gICAgICAgICAgICBpZiAodXNlVXZbaV0pIHtcbiAgICAgICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXNbXCJ2ZXJ0ZXhfdGV4Q29vcmRcIiArIGldID0gXCJURVhDT09SRFwiICsgaTtcbiAgICAgICAgICAgICAgICBjb2RlICs9IGNodW5rc1tcInV2XCIgKyBpICsgXCJWU1wiXTtcbiAgICAgICAgICAgICAgICBjb2RlQm9keSArPSBcIiAgIHZlYzIgdXZcIiArIGkgKyBcIiA9IGdldFV2XCIgKyBpICsgXCIoKTtcXG5cIjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh1c2VVbm1vZGlmaWVkVXZbaV0pIHtcbiAgICAgICAgICAgICAgICBjb2RlQm9keSArPSBcIiAgIHZVdlwiICsgaSArIFwiID0gdXZcIiArIGkgKyBcIjtcXG5cIjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGNvZGVzID0gW2NvZGUsIHRoaXMudmFyeWluZ3MsIGNvZGVCb2R5LCBbXV07XG5cbiAgICAgICAgbWFwVHJhbnNmb3Jtcy5mb3JFYWNoKChtYXBUcmFuc2Zvcm0pID0+IHtcbiAgICAgICAgICAgIHRoaXMuX3NldE1hcFRyYW5zZm9ybShjb2RlcywgbWFwVHJhbnNmb3JtLm5hbWUsIG1hcFRyYW5zZm9ybS5pZCwgbWFwVHJhbnNmb3JtLnV2KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29kZSA9IGNvZGVzWzBdO1xuICAgICAgICB0aGlzLnZhcnlpbmdzID0gY29kZXNbMV07XG4gICAgICAgIGNvZGVCb2R5ID0gY29kZXNbMl07XG5cbiAgICAgICAgaWYgKG9wdGlvbnMudmVydGV4Q29sb3JzKSB7XG4gICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXMudmVydGV4X2NvbG9yID0gU0VNQU5USUNfQ09MT1I7XG4gICAgICAgICAgICBjb2RlQm9keSArPSBcIiAgIHZWZXJ0ZXhDb2xvciA9IHZlcnRleF9jb2xvcjtcXG5cIjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLm1zZGYgJiYgb3B0aW9ucy5tc2RmVGV4dEF0dHJpYnV0ZSkge1xuICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGVzLnZlcnRleF9vdXRsaW5lUGFyYW1ldGVycyA9IFNFTUFOVElDX0FUVFI4O1xuICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGVzLnZlcnRleF9zaGFkb3dQYXJhbWV0ZXJzID0gU0VNQU5USUNfQVRUUjk7XG5cbiAgICAgICAgICAgIGNvZGVCb2R5ICs9IFwiICAgIHVucGFja01zZGZQYXJhbXMoKTtcXG5cIjtcblxuICAgICAgICAgICAgY29kZSArPSBjaHVua3MubXNkZlZTO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gbW9ycGhpbmdcbiAgICAgICAgaWYgKG9wdGlvbnMudXNlTW9ycGhQb3NpdGlvbiB8fCBvcHRpb25zLnVzZU1vcnBoTm9ybWFsKSB7XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zLnVzZU1vcnBoVGV4dHVyZUJhc2VkKSB7XG5cbiAgICAgICAgICAgICAgICBjb2RlICs9IFwiI2RlZmluZSBNT1JQSElOR19URVhUVVJFX0JBU0VEXFxuXCI7XG5cbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy51c2VNb3JwaFBvc2l0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIjZGVmaW5lIE1PUlBISU5HX1RFWFRVUkVfQkFTRURfUE9TSVRJT05cXG5cIjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy51c2VNb3JwaE5vcm1hbCkge1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiI2RlZmluZSBNT1JQSElOR19URVhUVVJFX0JBU0VEX05PUk1BTFxcblwiO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIHZlcnRleCBpZHMgYXR0cmlidXRlc1xuICAgICAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlcy5tb3JwaF92ZXJ0ZXhfaWQgPSBTRU1BTlRJQ19BVFRSMTU7XG4gICAgICAgICAgICAgICAgY29kZSArPSBcImF0dHJpYnV0ZSBmbG9hdCBtb3JwaF92ZXJ0ZXhfaWQ7XFxuXCI7XG5cbiAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICAvLyBzZXQgdXAgOCBzbG90cyBmb3IgbW9ycGhpbmcuIHRoZXNlIGFyZSBzdXBwb3J0ZWQgY29tYmluYXRpb25zOiBQUFBQUFBQUCwgTk5OTk5OTk4sIFBQUFBOTk5OXG4gICAgICAgICAgICAgICAgY29kZSArPSBcIiNkZWZpbmUgTU9SUEhJTkdcXG5cIjtcblxuICAgICAgICAgICAgICAgIC8vIGZpcnN0IDQgc2xvdHMgYXJlIGVpdGhlciBwb3NpdGlvbiBvciBub3JtYWxcbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy51c2VNb3JwaFBvc2l0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlcy5tb3JwaF9wb3MwID0gU0VNQU5USUNfQVRUUjg7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlcy5tb3JwaF9wb3MxID0gU0VNQU5USUNfQVRUUjk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlcy5tb3JwaF9wb3MyID0gU0VNQU5USUNfQVRUUjEwO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXMubW9ycGhfcG9zMyA9IFNFTUFOVElDX0FUVFIxMTtcblxuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiI2RlZmluZSBNT1JQSElOR19QT1MwM1xcblwiO1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiYXR0cmlidXRlIHZlYzMgbW9ycGhfcG9zMDtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcImF0dHJpYnV0ZSB2ZWMzIG1vcnBoX3BvczE7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJhdHRyaWJ1dGUgdmVjMyBtb3JwaF9wb3MyO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiYXR0cmlidXRlIHZlYzMgbW9ycGhfcG9zMztcXG5cIjtcblxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAob3B0aW9ucy51c2VNb3JwaE5vcm1hbCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXMubW9ycGhfbnJtMCA9IFNFTUFOVElDX0FUVFI4O1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXMubW9ycGhfbnJtMSA9IFNFTUFOVElDX0FUVFI5O1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXMubW9ycGhfbnJtMiA9IFNFTUFOVElDX0FUVFIxMDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGVzLm1vcnBoX25ybTMgPSBTRU1BTlRJQ19BVFRSMTE7XG5cbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiNkZWZpbmUgTU9SUEhJTkdfTlJNMDNcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcImF0dHJpYnV0ZSB2ZWMzIG1vcnBoX25ybTA7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJhdHRyaWJ1dGUgdmVjMyBtb3JwaF9ucm0xO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiYXR0cmlidXRlIHZlYzMgbW9ycGhfbnJtMjtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcImF0dHJpYnV0ZSB2ZWMzIG1vcnBoX25ybTM7XFxuXCI7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gbmV4dCA0IHNsb3RzIGFyZSBlaXRoZXIgcG9zaXRpb24gb3Igbm9ybWFsXG4gICAgICAgICAgICAgICAgaWYgKCFvcHRpb25zLnVzZU1vcnBoTm9ybWFsKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlcy5tb3JwaF9wb3M0ID0gU0VNQU5USUNfQVRUUjEyO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXMubW9ycGhfcG9zNSA9IFNFTUFOVElDX0FUVFIxMztcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGVzLm1vcnBoX3BvczYgPSBTRU1BTlRJQ19BVFRSMTQ7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlcy5tb3JwaF9wb3M3ID0gU0VNQU5USUNfQVRUUjE1O1xuXG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIjZGVmaW5lIE1PUlBISU5HX1BPUzQ3XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJhdHRyaWJ1dGUgdmVjMyBtb3JwaF9wb3M0O1xcblwiO1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiYXR0cmlidXRlIHZlYzMgbW9ycGhfcG9zNTtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcImF0dHJpYnV0ZSB2ZWMzIG1vcnBoX3BvczY7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJhdHRyaWJ1dGUgdmVjMyBtb3JwaF9wb3M3O1xcblwiO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlcy5tb3JwaF9ucm00ID0gU0VNQU5USUNfQVRUUjEyO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXMubW9ycGhfbnJtNSA9IFNFTUFOVElDX0FUVFIxMztcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGVzLm1vcnBoX25ybTYgPSBTRU1BTlRJQ19BVFRSMTQ7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlcy5tb3JwaF9ucm03ID0gU0VNQU5USUNfQVRUUjE1O1xuXG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIjZGVmaW5lIE1PUlBISU5HX05STTQ3XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJhdHRyaWJ1dGUgdmVjMyBtb3JwaF9ucm00O1xcblwiO1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiYXR0cmlidXRlIHZlYzMgbW9ycGhfbnJtNTtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcImF0dHJpYnV0ZSB2ZWMzIG1vcnBoX25ybTY7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJhdHRyaWJ1dGUgdmVjMyBtb3JwaF9ucm03O1xcblwiO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLnNraW4pIHtcbiAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlcy52ZXJ0ZXhfYm9uZVdlaWdodHMgPSBTRU1BTlRJQ19CTEVORFdFSUdIVDtcbiAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlcy52ZXJ0ZXhfYm9uZUluZGljZXMgPSBTRU1BTlRJQ19CTEVORElORElDRVM7XG4gICAgICAgICAgICBjb2RlICs9IHNraW5Db2RlKGRldmljZSwgY2h1bmtzKTtcbiAgICAgICAgICAgIGNvZGUgKz0gXCIjZGVmaW5lIFNLSU5cXG5cIjtcbiAgICAgICAgfSBlbHNlIGlmIChvcHRpb25zLnVzZUluc3RhbmNpbmcpIHtcbiAgICAgICAgICAgIGNvZGUgKz0gXCIjZGVmaW5lIElOU1RBTkNJTkdcXG5cIjtcbiAgICAgICAgfVxuICAgICAgICBpZiAob3B0aW9ucy5zY3JlZW5TcGFjZSkge1xuICAgICAgICAgICAgY29kZSArPSBcIiNkZWZpbmUgU0NSRUVOU1BBQ0VcXG5cIjtcbiAgICAgICAgfVxuICAgICAgICBpZiAob3B0aW9ucy5waXhlbFNuYXApIHtcbiAgICAgICAgICAgIGNvZGUgKz0gXCIjZGVmaW5lIFBJWEVMU05BUFxcblwiO1xuICAgICAgICB9XG5cbiAgICAgICAgY29kZSA9IHRoaXMuX3ZzQWRkVHJhbnNmb3JtQ29kZShjb2RlLCBkZXZpY2UsIGNodW5rcywgb3B0aW9ucyk7XG5cbiAgICAgICAgaWYgKHRoaXMubmVlZHNOb3JtYWwpIHtcbiAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLm5vcm1hbFZTO1xuICAgICAgICB9XG5cbiAgICAgICAgY29kZSArPSBcIlxcblwiO1xuICAgICAgICBjb2RlICs9IGNodW5rcy5zdGFydFZTO1xuICAgICAgICBjb2RlICs9IGNvZGVCb2R5O1xuICAgICAgICBjb2RlICs9IGNodW5rcy5lbmRWUztcbiAgICAgICAgY29kZSArPSBcIn1cIjtcblxuICAgICAgICAvLyBidWlsZCB2YXJ5aW5nc1xuICAgICAgICBPYmplY3Qua2V5cyhidWlsdGluVmFyeWluZ3MpLmZvckVhY2goKHYpID0+IHtcbiAgICAgICAgICAgIGlmIChjb2RlLmluZGV4T2YodikgPj0gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMudmFyeWluZ3MgKz0gYHZhcnlpbmcgJHtidWlsdGluVmFyeWluZ3Nbdl19ICR7dn07XFxuYDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3Qgc2hhZGVyUGFzc0RlZmluZSA9IFNoYWRlclBhc3MuZ2V0UGFzc1NoYWRlckRlZmluZSh0aGlzLm9wdGlvbnMucGFzcyk7XG4gICAgICAgIHRoaXMudnNoYWRlciA9IHNoYWRlclBhc3NEZWZpbmUgKyB0aGlzLnZhcnlpbmdzICsgY29kZTtcbiAgICB9XG5cbiAgICBfZnNHZXRCZWdpbkNvZGUoKSB7XG5cbiAgICAgICAgbGV0IGNvZGUgPSBTaGFkZXJQYXNzLmdldFBhc3NTaGFkZXJEZWZpbmUodGhpcy5vcHRpb25zLnBhc3MpO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5kZWZpbmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb2RlICs9IGAjZGVmaW5lICR7dGhpcy5kZWZpbmVzW2ldfVxcbmA7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gY29kZTtcbiAgICB9XG5cbiAgICBfZnNHZXRQaWNrUGFzc0NvZGUoKSB7XG4gICAgICAgIGxldCBjb2RlID0gdGhpcy5fZnNHZXRCZWdpbkNvZGUoKTtcbiAgICAgICAgY29kZSArPSBcInVuaWZvcm0gdmVjNCB1Q29sb3I7XFxuXCI7XG4gICAgICAgIGNvZGUgKz0gdGhpcy52YXJ5aW5ncztcbiAgICAgICAgY29kZSArPSB0aGlzLmZyb250ZW5kRGVjbDtcbiAgICAgICAgY29kZSArPSB0aGlzLmZyb250ZW5kQ29kZTtcbiAgICAgICAgY29kZSArPSBiZWdpbigpO1xuICAgICAgICBjb2RlICs9IHRoaXMuZnJvbnRlbmRGdW5jO1xuICAgICAgICBjb2RlICs9IFwiICAgIGdsX0ZyYWdDb2xvciA9IHVDb2xvcjtcXG5cIjtcbiAgICAgICAgY29kZSArPSBlbmQoKTtcbiAgICAgICAgcmV0dXJuIGNvZGU7XG4gICAgfVxuXG4gICAgX2ZzR2V0RGVwdGhQYXNzQ29kZSgpIHtcbiAgICAgICAgY29uc3QgY2h1bmtzID0gdGhpcy5jaHVua3M7XG5cbiAgICAgICAgbGV0IGNvZGUgPSB0aGlzLl9mc0dldEJlZ2luQ29kZSgpO1xuXG4gICAgICAgIGNvZGUgKz0gJ3ZhcnlpbmcgZmxvYXQgdkRlcHRoO1xcbic7XG4gICAgICAgIGNvZGUgKz0gdGhpcy52YXJ5aW5ncztcbiAgICAgICAgY29kZSArPSBjaHVua3MucGFja0RlcHRoUFM7XG4gICAgICAgIGNvZGUgKz0gdGhpcy5mcm9udGVuZERlY2w7XG4gICAgICAgIGNvZGUgKz0gdGhpcy5mcm9udGVuZENvZGU7XG4gICAgICAgIGNvZGUgKz0gYmVnaW4oKTtcbiAgICAgICAgY29kZSArPSB0aGlzLmZyb250ZW5kRnVuYztcbiAgICAgICAgY29kZSArPSBcIiAgICBnbF9GcmFnQ29sb3IgPSBwYWNrRmxvYXQodkRlcHRoKTtcXG5cIjtcbiAgICAgICAgY29kZSArPSBlbmQoKTtcblxuICAgICAgICByZXR1cm4gY29kZTtcbiAgICB9XG5cbiAgICBfZnNHZXRTaGFkb3dQYXNzQ29kZSgpIHtcbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG4gICAgICAgIGNvbnN0IG9wdGlvbnMgPSB0aGlzLm9wdGlvbnM7XG4gICAgICAgIGNvbnN0IGNodW5rcyA9IHRoaXMuY2h1bmtzO1xuICAgICAgICBjb25zdCB2YXJ5aW5ncyA9IHRoaXMudmFyeWluZ3M7XG5cbiAgICAgICAgY29uc3QgbGlnaHRUeXBlID0gU2hhZGVyUGFzcy50b0xpZ2h0VHlwZShvcHRpb25zLnBhc3MpO1xuICAgICAgICBjb25zdCBzaGFkb3dUeXBlID0gU2hhZGVyUGFzcy50b1NoYWRvd1R5cGUob3B0aW9ucy5wYXNzKTtcblxuICAgICAgICBsZXQgY29kZSA9IHRoaXMuX2ZzR2V0QmVnaW5Db2RlKCk7XG5cbiAgICAgICAgaWYgKGRldmljZS5leHRTdGFuZGFyZERlcml2YXRpdmVzICYmICFkZXZpY2Uud2ViZ2wyKSB7XG4gICAgICAgICAgICBjb2RlICs9ICd1bmlmb3JtIHZlYzIgcG9seWdvbk9mZnNldDtcXG4nO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHNoYWRvd1R5cGUgPT09IFNIQURPV19WU00zMikge1xuICAgICAgICAgICAgaWYgKGRldmljZS50ZXh0dXJlRmxvYXRIaWdoUHJlY2lzaW9uKSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSAnI2RlZmluZSBWU01fRVhQT05FTlQgMTUuMFxcblxcbic7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gJyNkZWZpbmUgVlNNX0VYUE9ORU5UIDUuNTRcXG5cXG4nO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKHNoYWRvd1R5cGUgPT09IFNIQURPV19WU00xNikge1xuICAgICAgICAgICAgY29kZSArPSAnI2RlZmluZSBWU01fRVhQT05FTlQgNS41NFxcblxcbic7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobGlnaHRUeXBlICE9PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwpIHtcbiAgICAgICAgICAgIGNvZGUgKz0gJ3VuaWZvcm0gdmVjMyB2aWV3X3Bvc2l0aW9uO1xcbic7XG4gICAgICAgICAgICBjb2RlICs9ICd1bmlmb3JtIGZsb2F0IGxpZ2h0X3JhZGl1cztcXG4nO1xuICAgICAgICB9XG5cbiAgICAgICAgY29kZSArPSB2YXJ5aW5ncztcbiAgICAgICAgY29kZSArPSB0aGlzLmZyb250ZW5kRGVjbDtcbiAgICAgICAgY29kZSArPSB0aGlzLmZyb250ZW5kQ29kZTtcblxuICAgICAgICBpZiAoc2hhZG93VHlwZSA9PT0gU0hBRE9XX1BDRjMgJiYgKCFkZXZpY2Uud2ViZ2wyIHx8IGxpZ2h0VHlwZSA9PT0gTElHSFRUWVBFX09NTkkpKSB7XG4gICAgICAgICAgICBjb2RlICs9IGNodW5rcy5wYWNrRGVwdGhQUztcbiAgICAgICAgfSBlbHNlIGlmIChzaGFkb3dUeXBlID09PSBTSEFET1dfVlNNOCkge1xuICAgICAgICAgICAgY29kZSArPSBcInZlYzIgZW5jb2RlRmxvYXRSRyggZmxvYXQgdiApIHtcXG5cIjtcbiAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgdmVjMiBlbmMgPSB2ZWMyKDEuMCwgMjU1LjApICogdjtcXG5cIjtcbiAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZW5jID0gZnJhY3QoZW5jKTtcXG5cIjtcbiAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZW5jIC09IGVuYy55eSAqIHZlYzIoMS4wLzI1NS4wLCAxLjAvMjU1LjApO1xcblwiO1xuICAgICAgICAgICAgY29kZSArPSBcIiAgICByZXR1cm4gZW5jO1xcblwiO1xuICAgICAgICAgICAgY29kZSArPSBcIn1cXG5cXG5cIjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvZGUgKz0gYmVnaW4oKTtcblxuICAgICAgICBjb2RlICs9IHRoaXMuZnJvbnRlbmRGdW5jO1xuXG4gICAgICAgIGNvbnN0IGlzVnNtID0gc2hhZG93VHlwZSA9PT0gU0hBRE9XX1ZTTTggfHwgc2hhZG93VHlwZSA9PT0gU0hBRE9XX1ZTTTE2IHx8IHNoYWRvd1R5cGUgPT09IFNIQURPV19WU00zMjtcbiAgICAgICAgY29uc3QgYXBwbHlTbG9wZVNjYWxlQmlhcyA9ICFkZXZpY2Uud2ViZ2wyICYmIGRldmljZS5leHRTdGFuZGFyZERlcml2YXRpdmVzO1xuXG4gICAgICAgIGlmIChsaWdodFR5cGUgPT09IExJR0hUVFlQRV9PTU5JIHx8IChpc1ZzbSAmJiBsaWdodFR5cGUgIT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCkpIHtcbiAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZmxvYXQgZGVwdGggPSBtaW4oZGlzdGFuY2Uodmlld19wb3NpdGlvbiwgdlBvc2l0aW9uVykgLyBsaWdodF9yYWRpdXMsIDAuOTk5OTkpO1xcblwiO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29kZSArPSBcIiAgICBmbG9hdCBkZXB0aCA9IGdsX0ZyYWdDb29yZC56O1xcblwiO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGFwcGx5U2xvcGVTY2FsZUJpYXMpIHtcbiAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZmxvYXQgbWluVmFsdWUgPSAyLjMzNzQzNzA1MDAxNTMxODZlLTEwOyAvLygxLjAgLyAyNTUuMCkgLyAoMjU2LjAgKiAyNTYuMCAqIDI1Ni4wKTtcXG5cIjtcbiAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZGVwdGggKz0gcG9seWdvbk9mZnNldC54ICogbWF4KGFicyhkRmR4KGRlcHRoKSksIGFicyhkRmR5KGRlcHRoKSkpICsgbWluVmFsdWUgKiBwb2x5Z29uT2Zmc2V0Lnk7XFxuXCI7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc2hhZG93VHlwZSA9PT0gU0hBRE9XX1BDRjMgJiYgKCFkZXZpY2Uud2ViZ2wyIHx8IChsaWdodFR5cGUgPT09IExJR0hUVFlQRV9PTU5JICYmICFvcHRpb25zLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCkpKSB7XG4gICAgICAgICAgICBjb2RlICs9IFwiICAgIGdsX0ZyYWdDb2xvciA9IHBhY2tGbG9hdChkZXB0aCk7XFxuXCI7XG4gICAgICAgIH0gZWxzZSBpZiAoc2hhZG93VHlwZSA9PT0gU0hBRE9XX1BDRjMgfHwgc2hhZG93VHlwZSA9PT0gU0hBRE9XX1BDRjUpIHtcbiAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZ2xfRnJhZ0NvbG9yID0gdmVjNCgxLjApO1xcblwiOyAvLyBqdXN0IHRoZSBzaW1wbGVzdCBjb2RlLCBjb2xvciBpcyBub3Qgd3JpdHRlbiBhbnl3YXlcblxuICAgICAgICAgICAgLy8gY2x1c3RlcmVkIG9tbmkgbGlnaHQgaXMgdXNpbmcgc2hhZG93IHNhbXBsZXIgYW5kIG5lZWRzIHRvIHdyaXRlIGN1c3RvbSBkZXB0aFxuICAgICAgICAgICAgaWYgKG9wdGlvbnMuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkICYmIGxpZ2h0VHlwZSA9PT0gTElHSFRUWVBFX09NTkkgJiYgZGV2aWNlLndlYmdsMikge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZ2xfRnJhZ0RlcHRoID0gZGVwdGg7XFxuXCI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoc2hhZG93VHlwZSA9PT0gU0hBRE9XX1ZTTTgpIHtcbiAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZ2xfRnJhZ0NvbG9yID0gdmVjNChlbmNvZGVGbG9hdFJHKGRlcHRoKSwgZW5jb2RlRmxvYXRSRyhkZXB0aCpkZXB0aCkpO1xcblwiO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29kZSArPSBjaHVua3Muc3RvcmVFVlNNUFM7XG4gICAgICAgIH1cblxuICAgICAgICBjb2RlICs9IGVuZCgpO1xuXG4gICAgICAgIHJldHVybiBjb2RlO1xuICAgIH1cblxuICAgIC8vIHRoZSBiaWcgb25lXG4gICAgX2ZzR2V0TGl0UGFzc0NvZGUoKSB7XG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuICAgICAgICBjb25zdCBvcHRpb25zID0gdGhpcy5vcHRpb25zO1xuICAgICAgICBjb25zdCBjaHVua3MgPSB0aGlzLmNodW5rcztcblxuICAgICAgICBsZXQgY29kZSA9IFwiXCI7XG5cbiAgICAgICAgaWYgKG9wdGlvbnMub3BhY2l0eUZhZGVzU3BlY3VsYXIgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICBjb2RlICs9ICd1bmlmb3JtIGZsb2F0IG1hdGVyaWFsX2FscGhhRmFkZTtcXG4nO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdGlvbnMudXNlU3BlY3VsYXIpIHtcbiAgICAgICAgICAgIHRoaXMuZGVmaW5lcy5wdXNoKFwiTElUX1NQRUNVTEFSXCIpO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5yZWZsZWN0aW9ucykge1xuICAgICAgICAgICAgICAgIHRoaXMuZGVmaW5lcy5wdXNoKFwiTElUX1JFRkxFQ1RJT05TXCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAob3B0aW9ucy5jbGVhckNvYXQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmRlZmluZXMucHVzaChcIkxJVF9DTEVBUkNPQVRcIik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zLmZyZXNuZWxNb2RlbCA+IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLmRlZmluZXMucHVzaChcIkxJVF9TUEVDVUxBUl9GUkVTTkVMXCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBlbmFibGUgY29uc2VydmUgZW5lcmd5IHBhdGggaW4gY2x1c3RlcmVkIGNodW5rXG4gICAgICAgICAgICBpZiAob3B0aW9ucy5jb25zZXJ2ZUVuZXJneSkge1xuICAgICAgICAgICAgICAgIHRoaXMuZGVmaW5lcy5wdXNoKFwiTElUX0NPTlNFUlZFX0VORVJHWVwiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG9wdGlvbnMuc2hlZW4pIHtcbiAgICAgICAgICAgICAgICB0aGlzLmRlZmluZXMucHVzaChcIkxJVF9TSEVFTlwiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG9wdGlvbnMuaXJpZGVzY2VuY2UpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmRlZmluZXMucHVzaChcIkxJVF9JUklERVNDRU5DRVwiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEZSQUdNRU5UIFNIQURFUiBJTlBVVFM6IFVOSUZPUk1TXG4gICAgICAgIGNvbnN0IHNoYWRvd1R5cGVVc2VkID0gW107XG4gICAgICAgIGxldCBudW1TaGFkb3dMaWdodHMgPSAwO1xuICAgICAgICBsZXQgc2hhZG93ZWREaXJlY3Rpb25hbExpZ2h0VXNlZCA9IGZhbHNlO1xuICAgICAgICBsZXQgdXNlVnNtID0gZmFsc2U7XG4gICAgICAgIGxldCB1c2VQZXJzcFpidWZmZXJTaGFkb3cgPSBmYWxzZTtcblxuICAgICAgICBsZXQgaGFzQXJlYUxpZ2h0cyA9IG9wdGlvbnMubGlnaHRzLnNvbWUoZnVuY3Rpb24gKGxpZ2h0KSB7XG4gICAgICAgICAgICByZXR1cm4gbGlnaHQuX3NoYXBlICYmIGxpZ2h0Ll9zaGFwZSAhPT0gTElHSFRTSEFQRV9QVU5DVFVBTDtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gaWYgY2x1c3RlcmVkIGxpZ2h0aW5nIGhhcyBhcmVhIGxpZ2h0cyBlbmFibGVkLCBpdCBhbHdheXMgcnVucyBpbiAnYXJlYSBsaWdodHMgbW9kZSdcbiAgICAgICAgLy8gVE9ETzogbWF5YmUgd2Ugc2hvdWxkIGFsd2F5cyB1c2UgaXQgYW5kIHJlbW92ZSB0aGUgb3RoZXIgd2F5P1xuICAgICAgICBpZiAob3B0aW9ucy5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQgJiYgb3B0aW9ucy5jbHVzdGVyZWRMaWdodGluZ0FyZWFMaWdodHNFbmFibGVkKSB7XG4gICAgICAgICAgICBoYXNBcmVhTGlnaHRzID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBhcmVhTHV0c1ByZWNpc2lvbiA9ICdoaWdocCc7XG4gICAgICAgIGlmIChkZXZpY2UuYXJlYUxpZ2h0THV0Rm9ybWF0ID09PSBQSVhFTEZPUk1BVF9SOF9HOF9COF9BOCkge1xuICAgICAgICAgICAgLy8gdXNlIG9mZnNldCBhbmQgc2NhbGUgZm9yIHJnYjggZm9ybWF0IGx1dHNcbiAgICAgICAgICAgIGNvZGUgKz0gXCIjZGVmaW5lIEFSRUFfUjhfRzhfQjhfQThfTFVUU1xcblwiO1xuICAgICAgICAgICAgYXJlYUx1dHNQcmVjaXNpb24gPSAnbG93cCc7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaGFzQXJlYUxpZ2h0cyB8fCBvcHRpb25zLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCkge1xuICAgICAgICAgICAgY29kZSArPSBcIiNkZWZpbmUgQVJFQV9MSUdIVFNcXG5cIjtcbiAgICAgICAgICAgIGNvZGUgKz0gYHVuaWZvcm0gJHthcmVhTHV0c1ByZWNpc2lvbn0gc2FtcGxlcjJEIGFyZWFMaWdodHNMdXRUZXgxO1xcbmA7XG4gICAgICAgICAgICBjb2RlICs9IGB1bmlmb3JtICR7YXJlYUx1dHNQcmVjaXNpb259IHNhbXBsZXIyRCBhcmVhTGlnaHRzTHV0VGV4MjtcXG5gO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBvcHRpb25zLmxpZ2h0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGlnaHQgPSBvcHRpb25zLmxpZ2h0c1tpXTtcbiAgICAgICAgICAgIGNvbnN0IGxpZ2h0VHlwZSA9IGxpZ2h0Ll90eXBlO1xuXG4gICAgICAgICAgICAvLyBza2lwIHVuaWZvcm0gZ2VuZXJhdGlvbiBmb3IgbG9jYWwgbGlnaHRzIGlmIGNsdXN0ZXJlZCBsaWdodGluZyBpcyBlbmFibGVkXG4gICAgICAgICAgICBpZiAob3B0aW9ucy5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQgJiYgbGlnaHRUeXBlICE9PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgICAgIGNvbnN0IGxpZ2h0U2hhcGUgPSAoaGFzQXJlYUxpZ2h0cyAmJiBsaWdodC5fc2hhcGUpID8gbGlnaHQuX3NoYXBlIDogTElHSFRTSEFQRV9QVU5DVFVBTDtcblxuICAgICAgICAgICAgY29kZSArPSBcInVuaWZvcm0gdmVjMyBsaWdodFwiICsgaSArIFwiX2NvbG9yO1xcblwiO1xuICAgICAgICAgICAgaWYgKGxpZ2h0VHlwZSA9PT0gTElHSFRUWVBFX0RJUkVDVElPTkFMKSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBcInVuaWZvcm0gdmVjMyBsaWdodFwiICsgaSArIFwiX2RpcmVjdGlvbjtcXG5cIjtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBcInVuaWZvcm0gdmVjMyBsaWdodFwiICsgaSArIFwiX3Bvc2l0aW9uO1xcblwiO1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJ1bmlmb3JtIGZsb2F0IGxpZ2h0XCIgKyBpICsgXCJfcmFkaXVzO1xcblwiO1xuICAgICAgICAgICAgICAgIGlmIChsaWdodFR5cGUgPT09IExJR0hUVFlQRV9TUE9UKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJ1bmlmb3JtIHZlYzMgbGlnaHRcIiArIGkgKyBcIl9kaXJlY3Rpb247XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJ1bmlmb3JtIGZsb2F0IGxpZ2h0XCIgKyBpICsgXCJfaW5uZXJDb25lQW5nbGU7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJ1bmlmb3JtIGZsb2F0IGxpZ2h0XCIgKyBpICsgXCJfb3V0ZXJDb25lQW5nbGU7XFxuXCI7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGxpZ2h0U2hhcGUgIT09IExJR0hUU0hBUEVfUFVOQ1RVQUwpIHtcbiAgICAgICAgICAgICAgICBpZiAobGlnaHRUeXBlID09PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwpIHtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcInVuaWZvcm0gdmVjMyBsaWdodFwiICsgaSArIFwiX3Bvc2l0aW9uO1xcblwiO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb2RlICs9IFwidW5pZm9ybSB2ZWMzIGxpZ2h0XCIgKyBpICsgXCJfaGFsZldpZHRoO1xcblwiO1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJ1bmlmb3JtIHZlYzMgbGlnaHRcIiArIGkgKyBcIl9oYWxmSGVpZ2h0O1xcblwiO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGxpZ2h0LmNhc3RTaGFkb3dzICYmICFvcHRpb25zLm5vU2hhZG93KSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBcInVuaWZvcm0gbWF0NCBsaWdodFwiICsgaSArIFwiX3NoYWRvd01hdHJpeDtcXG5cIjtcbiAgICAgICAgICAgICAgICBjb2RlICs9IFwidW5pZm9ybSBmbG9hdCBsaWdodFwiICsgaSArIFwiX3NoYWRvd0ludGVuc2l0eTtcXG5cIjtcblxuICAgICAgICAgICAgICAgIC8vIGRpcmVjdGlvbmFsIChjYXNjYWRlZCkgc2hhZG93c1xuICAgICAgICAgICAgICAgIGlmIChsaWdodFR5cGUgPT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCkge1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwidW5pZm9ybSBtYXQ0IGxpZ2h0XCIgKyBpICsgXCJfc2hhZG93TWF0cml4UGFsZXR0ZVs0XTtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcInVuaWZvcm0gZmxvYXQgbGlnaHRcIiArIGkgKyBcIl9zaGFkb3dDYXNjYWRlRGlzdGFuY2VzWzRdO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwidW5pZm9ybSBmbG9hdCBsaWdodFwiICsgaSArIFwiX3NoYWRvd0Nhc2NhZGVDb3VudDtcXG5cIjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAobGlnaHRUeXBlICE9PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwpIHtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcInVuaWZvcm0gdmVjNCBsaWdodFwiICsgaSArIFwiX3NoYWRvd1BhcmFtcztcXG5cIjsgLy8gV2lkdGgsIGhlaWdodCwgYmlhcywgcmFkaXVzXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgc2hhZG93ZWREaXJlY3Rpb25hbExpZ2h0VXNlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJ1bmlmb3JtIHZlYzMgbGlnaHRcIiArIGkgKyBcIl9zaGFkb3dQYXJhbXM7XFxuXCI7IC8vIFdpZHRoLCBoZWlnaHQsIGJpYXNcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKGxpZ2h0VHlwZSA9PT0gTElHSFRUWVBFX09NTkkpIHtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcInVuaWZvcm0gc2FtcGxlckN1YmUgbGlnaHRcIiArIGkgKyBcIl9zaGFkb3dNYXA7XFxuXCI7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGxpZ2h0Ll9pc1BjZiAmJiBkZXZpY2Uud2ViZ2wyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwidW5pZm9ybSBzYW1wbGVyMkRTaGFkb3cgbGlnaHRcIiArIGkgKyBcIl9zaGFkb3dNYXA7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwidW5pZm9ybSBzYW1wbGVyMkQgbGlnaHRcIiArIGkgKyBcIl9zaGFkb3dNYXA7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgbnVtU2hhZG93TGlnaHRzKys7XG4gICAgICAgICAgICAgICAgc2hhZG93VHlwZVVzZWRbbGlnaHQuX3NoYWRvd1R5cGVdID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBpZiAobGlnaHQuX2lzVnNtKSB1c2VWc20gPSB0cnVlO1xuICAgICAgICAgICAgICAgIGlmIChsaWdodC5faXNQY2YgJiYgKGRldmljZS53ZWJnbDIgfHwgZGV2aWNlLmV4dFN0YW5kYXJkRGVyaXZhdGl2ZXMpICYmIGxpZ2h0VHlwZSA9PT0gTElHSFRUWVBFX1NQT1QpIHVzZVBlcnNwWmJ1ZmZlclNoYWRvdyA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAobGlnaHQuX2Nvb2tpZSkge1xuICAgICAgICAgICAgICAgIGlmIChsaWdodC5fY29va2llLl9jdWJlbWFwKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChsaWdodFR5cGUgPT09IExJR0hUVFlQRV9PTU5JKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwidW5pZm9ybSBzYW1wbGVyQ3ViZSBsaWdodFwiICsgaSArIFwiX2Nvb2tpZTtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJ1bmlmb3JtIGZsb2F0IGxpZ2h0XCIgKyBpICsgXCJfY29va2llSW50ZW5zaXR5O1xcblwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFsaWdodC5jYXN0U2hhZG93cyB8fCBvcHRpb25zLm5vU2hhZG93KSBjb2RlICs9IFwidW5pZm9ybSBtYXQ0IGxpZ2h0XCIgKyBpICsgXCJfc2hhZG93TWF0cml4O1xcblwiO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGxpZ2h0VHlwZSA9PT0gTElHSFRUWVBFX1NQT1QpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJ1bmlmb3JtIHNhbXBsZXIyRCBsaWdodFwiICsgaSArIFwiX2Nvb2tpZTtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJ1bmlmb3JtIGZsb2F0IGxpZ2h0XCIgKyBpICsgXCJfY29va2llSW50ZW5zaXR5O1xcblwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFsaWdodC5jYXN0U2hhZG93cyB8fCBvcHRpb25zLm5vU2hhZG93KSBjb2RlICs9IFwidW5pZm9ybSBtYXQ0IGxpZ2h0XCIgKyBpICsgXCJfc2hhZG93TWF0cml4O1xcblwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxpZ2h0Ll9jb29raWVUcmFuc2Zvcm0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwidW5pZm9ybSB2ZWM0IGxpZ2h0XCIgKyBpICsgXCJfY29va2llTWF0cml4O1xcblwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJ1bmlmb3JtIHZlYzIgbGlnaHRcIiArIGkgKyBcIl9jb29raWVPZmZzZXQ7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjb2RlICs9IFwiXFxuXCI7IC8vIEVuZCBvZiB1bmlmb3JtIGRlY2xhcmF0aW9uc1xuXG4gICAgICAgIC8vIFRCTlxuICAgICAgICBjb25zdCBoYXNUQk4gPSB0aGlzLm5lZWRzTm9ybWFsICYmIChvcHRpb25zLm5vcm1hbE1hcCB8fCBvcHRpb25zLmNsZWFyQ29hdE5vcm1hbE1hcCB8fCAob3B0aW9ucy5lbmFibGVHR1hTcGVjdWxhciAmJiAhb3B0aW9ucy5oZWlnaHRNYXApKTtcblxuICAgICAgICBpZiAoaGFzVEJOKSB7XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5oYXNUYW5nZW50cykge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gb3B0aW9ucy5mYXN0VGJuID8gY2h1bmtzLlRCTmZhc3RQUyA6IGNodW5rcy5UQk5QUztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKGRldmljZS5leHRTdGFuZGFyZERlcml2YXRpdmVzICYmIChvcHRpb25zLm5vcm1hbE1hcCB8fCBvcHRpb25zLmNsZWFyQ29hdE5vcm1hbE1hcCkpIHtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBjaHVua3MuVEJOZGVyaXZhdGl2ZVBTLnJlcGxhY2UoL1xcJFVWL2csIHRoaXMubGlnaHRpbmdVdik7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBjaHVua3MuVEJOT2JqZWN0U3BhY2VQUztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBGSVhNRTogb25seSBhZGQgdGhlc2Ugd2hlbiBuZWVkZWRcbiAgICAgICAgY29kZSArPSBjaHVua3Muc3BoZXJpY2FsUFM7XG4gICAgICAgIGNvZGUgKz0gY2h1bmtzLmRlY29kZVBTO1xuICAgICAgICBjb2RlICs9IGdhbW1hQ29kZShvcHRpb25zLmdhbW1hLCBjaHVua3MpO1xuICAgICAgICBjb2RlICs9IHRvbmVtYXBDb2RlKG9wdGlvbnMudG9uZU1hcCwgY2h1bmtzKTtcbiAgICAgICAgY29kZSArPSBmb2dDb2RlKG9wdGlvbnMuZm9nLCBjaHVua3MpO1xuXG5cbiAgICAgICAgLy8gZnJvbnRlbmRcbiAgICAgICAgY29kZSArPSB0aGlzLmZyb250ZW5kQ29kZTtcblxuICAgICAgICBpZiAob3B0aW9ucy51c2VDdWJlTWFwUm90YXRpb24pIHtcbiAgICAgICAgICAgIGNvZGUgKz0gXCIjZGVmaW5lIENVQkVNQVBfUk9UQVRJT05cXG5cIjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLm5lZWRzTm9ybWFsKSB7XG4gICAgICAgICAgICBjb2RlICs9IGNodW5rcy5jdWJlTWFwUm90YXRlUFM7XG4gICAgICAgICAgICBjb2RlICs9IG9wdGlvbnMuY3ViZU1hcFByb2plY3Rpb24gPiAwID8gY2h1bmtzLmN1YmVNYXBQcm9qZWN0Qm94UFMgOiBjaHVua3MuY3ViZU1hcFByb2plY3ROb25lUFM7XG4gICAgICAgICAgICBjb2RlICs9IG9wdGlvbnMuc2t5Ym94SW50ZW5zaXR5ID8gY2h1bmtzLmVudk11bHRpcGx5UFMgOiBjaHVua3MuZW52Q29uc3RQUztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICgodGhpcy5saWdodGluZyAmJiBvcHRpb25zLnVzZVNwZWN1bGFyKSB8fCB0aGlzLnJlZmxlY3Rpb25zKSB7XG4gICAgICAgICAgICBpZiAob3B0aW9ucy51c2VNZXRhbG5lc3MpIHtcbiAgICAgICAgICAgICAgICBjb2RlICs9IGNodW5rcy5tZXRhbG5lc3NNb2R1bGF0ZVBTO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAob3B0aW9ucy5mcmVzbmVsTW9kZWwgPT09IEZSRVNORUxfU0NITElDSykge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLmZyZXNuZWxTY2hsaWNrUFM7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zLmlyaWRlc2NlbmNlKSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBjaHVua3MuaXJpZGVzY2VuY2VEaWZmcmFjdGlvblBTO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgdXNlQW8gPSBvcHRpb25zLmFvTWFwIHx8IG9wdGlvbnMuYW9WZXJ0ZXhDb2xvcjtcblxuICAgICAgICBpZiAodXNlQW8pIHtcbiAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLmFvRGlmZnVzZU9jY1BTO1xuICAgICAgICAgICAgc3dpdGNoIChvcHRpb25zLm9jY2x1ZGVTcGVjdWxhcikge1xuICAgICAgICAgICAgICAgIGNhc2UgU1BFQ09DQ19BTzpcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBvcHRpb25zLm9jY2x1ZGVTcGVjdWxhckZsb2F0ID8gY2h1bmtzLmFvU3BlY09jY1NpbXBsZVBTIDogY2h1bmtzLmFvU3BlY09jY0NvbnN0U2ltcGxlUFM7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgU1BFQ09DQ19HTE9TU0RFUEVOREVOVDpcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBvcHRpb25zLm9jY2x1ZGVTcGVjdWxhckZsb2F0ID8gY2h1bmtzLmFvU3BlY09jY1BTIDogY2h1bmtzLmFvU3BlY09jY0NvbnN0UFM7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdGlvbnMucmVmbGVjdGlvblNvdXJjZSA9PT0gJ2VudkF0bGFzSFEnKSB7XG4gICAgICAgICAgICBjb2RlICs9IG9wdGlvbnMuZml4U2VhbXMgPyBjaHVua3MuZml4Q3ViZW1hcFNlYW1zU3RyZXRjaFBTIDogY2h1bmtzLmZpeEN1YmVtYXBTZWFtc05vbmVQUztcbiAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLmVudkF0bGFzUFM7XG4gICAgICAgICAgICBjb2RlICs9IGNodW5rcy5yZWZsZWN0aW9uRW52SFFQUy5yZXBsYWNlKC9cXCRERUNPREUvZywgQ2h1bmtVdGlscy5kZWNvZGVGdW5jKG9wdGlvbnMucmVmbGVjdGlvbkVuY29kaW5nKSk7XG4gICAgICAgIH0gZWxzZSBpZiAob3B0aW9ucy5yZWZsZWN0aW9uU291cmNlID09PSAnZW52QXRsYXMnKSB7XG4gICAgICAgICAgICBjb2RlICs9IGNodW5rcy5lbnZBdGxhc1BTO1xuICAgICAgICAgICAgY29kZSArPSBjaHVua3MucmVmbGVjdGlvbkVudlBTLnJlcGxhY2UoL1xcJERFQ09ERS9nLCBDaHVua1V0aWxzLmRlY29kZUZ1bmMob3B0aW9ucy5yZWZsZWN0aW9uRW5jb2RpbmcpKTtcbiAgICAgICAgfSBlbHNlIGlmIChvcHRpb25zLnJlZmxlY3Rpb25Tb3VyY2UgPT09ICdjdWJlTWFwJykge1xuICAgICAgICAgICAgY29kZSArPSBvcHRpb25zLmZpeFNlYW1zID8gY2h1bmtzLmZpeEN1YmVtYXBTZWFtc1N0cmV0Y2hQUyA6IGNodW5rcy5maXhDdWJlbWFwU2VhbXNOb25lUFM7XG4gICAgICAgICAgICBjb2RlICs9IGNodW5rcy5yZWZsZWN0aW9uQ3ViZVBTLnJlcGxhY2UoL1xcJERFQ09ERS9nLCBDaHVua1V0aWxzLmRlY29kZUZ1bmMob3B0aW9ucy5yZWZsZWN0aW9uRW5jb2RpbmcpKTtcbiAgICAgICAgfSBlbHNlIGlmIChvcHRpb25zLnJlZmxlY3Rpb25Tb3VyY2UgPT09ICdzcGhlcmVNYXAnKSB7XG4gICAgICAgICAgICBjb25zdCBzY29kZSA9IGRldmljZS5mcmFnbWVudFVuaWZvcm1zQ291bnQgPiAxNiA/IGNodW5rcy5yZWZsZWN0aW9uU3BoZXJlUFMgOiBjaHVua3MucmVmbGVjdGlvblNwaGVyZUxvd1BTO1xuICAgICAgICAgICAgY29kZSArPSBzY29kZS5yZXBsYWNlKC9cXCRERUNPREUvZywgQ2h1bmtVdGlscy5kZWNvZGVGdW5jKG9wdGlvbnMucmVmbGVjdGlvbkVuY29kaW5nKSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5yZWZsZWN0aW9ucykge1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMuY2xlYXJDb2F0KSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBjaHVua3MucmVmbGVjdGlvbkNDUFM7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5zaGVlbikge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLnJlZmxlY3Rpb25TaGVlblBTO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdGlvbnMucmVmcmFjdGlvbikge1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMudXNlRHluYW1pY1JlZnJhY3Rpb24pIHtcbiAgICAgICAgICAgICAgICBjb2RlICs9IGNodW5rcy5yZWZyYWN0aW9uRHluYW1pY1BTO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh0aGlzLnJlZmxlY3Rpb25zKSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBjaHVua3MucmVmcmFjdGlvbkN1YmVQUztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLnNoZWVuKSB7XG4gICAgICAgICAgICBjb2RlICs9IGNodW5rcy5saWdodFNoZWVuUFM7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjbHVzdGVyZWQgbGlnaHRpbmdcbiAgICAgICAgaWYgKG9wdGlvbnMuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkKSB7XG5cbiAgICAgICAgICAgIC8vIGluY2x1ZGUgdGhpcyBiZWZvcmUgc2hhZG93IC8gY29va2llIGNvZGVcbiAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLmNsdXN0ZXJlZExpZ2h0VXRpbHNQUztcbiAgICAgICAgICAgIGlmIChvcHRpb25zLmNsdXN0ZXJlZExpZ2h0aW5nQ29va2llc0VuYWJsZWQpXG4gICAgICAgICAgICAgICAgY29kZSArPSBjaHVua3MuY2x1c3RlcmVkTGlnaHRDb29raWVzUFM7XG5cbiAgICAgICAgICAgIC8vIGluY2x1ZGUgc2hhZG93IGNodW5rcyBjbHVzdGVyZWQgbGlnaHRzIHN1cHBvcnRcbiAgICAgICAgICAgIGlmIChvcHRpb25zLmNsdXN0ZXJlZExpZ2h0aW5nU2hhZG93c0VuYWJsZWQgJiYgIW9wdGlvbnMubm9TaGFkb3cpIHtcbiAgICAgICAgICAgICAgICBzaGFkb3dUeXBlVXNlZFtTSEFET1dfUENGM10gPSB0cnVlO1xuICAgICAgICAgICAgICAgIHNoYWRvd1R5cGVVc2VkW1NIQURPV19QQ0Y1XSA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB1c2VQZXJzcFpidWZmZXJTaGFkb3cgPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG51bVNoYWRvd0xpZ2h0cyA+IDAgfHwgb3B0aW9ucy5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpIHtcbiAgICAgICAgICAgIGlmIChzaGFkb3dlZERpcmVjdGlvbmFsTGlnaHRVc2VkKSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBjaHVua3Muc2hhZG93Q2FzY2FkZXNQUztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzaGFkb3dUeXBlVXNlZFtTSEFET1dfUENGM10pIHtcbiAgICAgICAgICAgICAgICBjb2RlICs9IGNodW5rcy5zaGFkb3dTdGFuZGFyZFBTO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHNoYWRvd1R5cGVVc2VkW1NIQURPV19QQ0Y1XSAmJiBkZXZpY2Uud2ViZ2wyKSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBjaHVua3Muc2hhZG93U3RhbmRhcmRHTDJQUztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh1c2VWc20pIHtcbiAgICAgICAgICAgICAgICBjb2RlICs9IGNodW5rcy5zaGFkb3dWU01fY29tbW9uUFM7XG4gICAgICAgICAgICAgICAgaWYgKHNoYWRvd1R5cGVVc2VkW1NIQURPV19WU004XSkge1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IGNodW5rcy5zaGFkb3dWU004UFM7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChzaGFkb3dUeXBlVXNlZFtTSEFET1dfVlNNMTZdKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gZGV2aWNlLmV4dFRleHR1cmVIYWxmRmxvYXRMaW5lYXIgPyBjaHVua3Muc2hhZG93RVZTTVBTLnJlcGxhY2UoL1xcJC9nLCBcIjE2XCIpIDogY2h1bmtzLnNoYWRvd0VWU01uUFMucmVwbGFjZSgvXFwkL2csIFwiMTZcIik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChzaGFkb3dUeXBlVXNlZFtTSEFET1dfVlNNMzJdKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gZGV2aWNlLmV4dFRleHR1cmVGbG9hdExpbmVhciA/IGNodW5rcy5zaGFkb3dFVlNNUFMucmVwbGFjZSgvXFwkL2csIFwiMzJcIikgOiBjaHVua3Muc2hhZG93RVZTTW5QUy5yZXBsYWNlKC9cXCQvZywgXCIzMlwiKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghKGRldmljZS53ZWJnbDIgfHwgZGV2aWNlLmV4dFN0YW5kYXJkRGVyaXZhdGl2ZXMpKSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBjaHVua3MuYmlhc0NvbnN0UFM7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIG90aGVyd2lzZSBiaWFzIGlzIGFwcGxpZWQgb24gcmVuZGVyXG4gICAgICAgICAgICBjb2RlICs9IGNodW5rcy5zaGFkb3dDb29yZFBTICsgY2h1bmtzLnNoYWRvd0NvbW1vblBTO1xuICAgICAgICAgICAgaWYgKHVzZVBlcnNwWmJ1ZmZlclNoYWRvdykgY29kZSArPSBjaHVua3Muc2hhZG93Q29vcmRQZXJzcFpidWZmZXJQUztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLmVuYWJsZUdHWFNwZWN1bGFyKSBjb2RlICs9IFwidW5pZm9ybSBmbG9hdCBtYXRlcmlhbF9hbmlzb3Ryb3B5O1xcblwiO1xuXG4gICAgICAgIGlmICh0aGlzLmxpZ2h0aW5nKSB7XG4gICAgICAgICAgICBjb2RlICs9IGNodW5rcy5saWdodERpZmZ1c2VMYW1iZXJ0UFM7XG4gICAgICAgICAgICBpZiAoaGFzQXJlYUxpZ2h0cyB8fCBvcHRpb25zLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCkgY29kZSArPSBjaHVua3MubHRjO1xuICAgICAgICB9XG5cbiAgICAgICAgY29kZSArPSAnXFxuJztcblxuICAgICAgICBsZXQgdXNlT2xkQW1iaWVudCA9IGZhbHNlO1xuICAgICAgICBpZiAob3B0aW9ucy51c2VTcGVjdWxhcikge1xuXG4gICAgICAgICAgICBpZiAodGhpcy5saWdodGluZykge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gb3B0aW9ucy5zaGFkaW5nTW9kZWwgPT09IFNQRUNVTEFSX1BIT05HID8gY2h1bmtzLmxpZ2h0U3BlY3VsYXJQaG9uZ1BTIDogKG9wdGlvbnMuZW5hYmxlR0dYU3BlY3VsYXIgPyBjaHVua3MubGlnaHRTcGVjdWxhckFuaXNvR0dYUFMgOiBjaHVua3MubGlnaHRTcGVjdWxhckJsaW5uUFMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIW9wdGlvbnMuZnJlc25lbE1vZGVsICYmICF0aGlzLnJlZmxlY3Rpb25zICYmICFvcHRpb25zLmRpZmZ1c2VNYXApIHtcbiAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIHVuaWZvcm0gdmVjMyBtYXRlcmlhbF9hbWJpZW50O1xcblwiO1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIjZGVmaW5lIExJVF9PTERfQU1CSUVOVFwiO1xuICAgICAgICAgICAgICAgIHVzZU9sZEFtYmllbnQgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29kZSArPSBjaHVua3MuY29tYmluZVBTO1xuXG4gICAgICAgIC8vIGxpZ2h0bWFwIHN1cHBvcnRcbiAgICAgICAgaWYgKG9wdGlvbnMubGlnaHRNYXAgfHwgb3B0aW9ucy5saWdodFZlcnRleENvbG9yKSB7XG4gICAgICAgICAgICBjb2RlICs9IChvcHRpb25zLnVzZVNwZWN1bGFyICYmIG9wdGlvbnMuZGlyTGlnaHRNYXApID8gY2h1bmtzLmxpZ2h0bWFwRGlyQWRkUFMgOiBjaHVua3MubGlnaHRtYXBBZGRQUztcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGFkZEFtYmllbnQgPSAoIW9wdGlvbnMubGlnaHRNYXAgJiYgIW9wdGlvbnMubGlnaHRWZXJ0ZXhDb2xvcikgfHwgb3B0aW9ucy5saWdodE1hcFdpdGhvdXRBbWJpZW50O1xuXG4gICAgICAgIGlmIChhZGRBbWJpZW50KSB7XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5hbWJpZW50U291cmNlID09PSAnYW1iaWVudFNIJykge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLmFtYmllbnRTSFBTO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChvcHRpb25zLmFtYmllbnRTb3VyY2UgPT09ICdlbnZBdGxhcycpIHtcbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5yZWZsZWN0aW9uU291cmNlICE9PSAnZW52QXRsYXMnICYmIG9wdGlvbnMucmVmbGVjdGlvblNvdXJjZSAhPT0gJ2VudkF0bGFzSFEnKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLmVudkF0bGFzUFM7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLmFtYmllbnRFbnZQUy5yZXBsYWNlKC9cXCRERUNPREUvZywgQ2h1bmtVdGlscy5kZWNvZGVGdW5jKG9wdGlvbnMuYW1iaWVudEVuY29kaW5nKSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLmFtYmllbnRDb25zdGFudFBTO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdGlvbnMuYW1iaWVudFRpbnQgJiYgIXVzZU9sZEFtYmllbnQpIHtcbiAgICAgICAgICAgIGNvZGUgKz0gXCJ1bmlmb3JtIHZlYzMgbWF0ZXJpYWxfYW1iaWVudDtcXG5cIjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLm1zZGYpIHtcbiAgICAgICAgICAgIGlmICghb3B0aW9ucy5tc2RmVGV4dEF0dHJpYnV0ZSkge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gXCJcXG4jZGVmaW5lIFVOSUZPUk1fVEVYVF9QQVJBTUVURVJTXCI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb2RlICs9IGNodW5rcy5tc2RmUFM7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5uZWVkc05vcm1hbCkge1xuICAgICAgICAgICAgY29kZSArPSBjaHVua3Mudmlld0RpclBTO1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMudXNlU3BlY3VsYXIpIHtcbiAgICAgICAgICAgICAgICBjb2RlICs9IChvcHRpb25zLmVuYWJsZUdHWFNwZWN1bGFyKSA/IGNodW5rcy5yZWZsRGlyQW5pc29QUyA6IGNodW5rcy5yZWZsRGlyUFM7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgaGFzUG9pbnRMaWdodHMgPSBmYWxzZTtcbiAgICAgICAgbGV0IHVzZXNMaW5lYXJGYWxsb2ZmID0gZmFsc2U7XG4gICAgICAgIGxldCB1c2VzSW52U3F1YXJlZEZhbGxvZmYgPSBmYWxzZTtcbiAgICAgICAgbGV0IHVzZXNTcG90ID0gZmFsc2U7XG4gICAgICAgIGxldCB1c2VzQ29va2llID0gZmFsc2U7XG4gICAgICAgIGxldCB1c2VzQ29va2llTm93O1xuXG4gICAgICAgIC8vIGNsdXN0ZXJlZCBsaWdodGluZ1xuICAgICAgICBpZiAob3B0aW9ucy5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQgJiYgdGhpcy5saWdodGluZykge1xuXG4gICAgICAgICAgICB1c2VzU3BvdCA9IHRydWU7XG4gICAgICAgICAgICBoYXNQb2ludExpZ2h0cyA9IHRydWU7XG4gICAgICAgICAgICB1c2VzTGluZWFyRmFsbG9mZiA9IHRydWU7XG4gICAgICAgICAgICB1c2VzQ29va2llID0gdHJ1ZTtcblxuICAgICAgICAgICAgY29kZSArPSBjaHVua3MuZmxvYXRVbnBhY2tpbmdQUztcblxuICAgICAgICAgICAgaWYgKG9wdGlvbnMubGlnaHRNYXNrRHluYW1pYylcbiAgICAgICAgICAgICAgICBjb2RlICs9IFwiXFxuI2RlZmluZSBDTFVTVEVSX01FU0hfRFlOQU1JQ19MSUdIVFNcIjtcblxuICAgICAgICAgICAgaWYgKG9wdGlvbnMuY2x1c3RlcmVkTGlnaHRpbmdDb29raWVzRW5hYmxlZClcbiAgICAgICAgICAgICAgICBjb2RlICs9IFwiXFxuI2RlZmluZSBDTFVTVEVSX0NPT0tJRVNcIjtcbiAgICAgICAgICAgIGlmIChvcHRpb25zLmNsdXN0ZXJlZExpZ2h0aW5nU2hhZG93c0VuYWJsZWQgJiYgIW9wdGlvbnMubm9TaGFkb3cpIHtcbiAgICAgICAgICAgICAgICBjb2RlICs9IFwiXFxuI2RlZmluZSBDTFVTVEVSX1NIQURPV1NcIjtcbiAgICAgICAgICAgICAgICBjb2RlICs9IFwiXFxuI2RlZmluZSBDTFVTVEVSX1NIQURPV19UWVBFX1wiICsgc2hhZG93VHlwZVRvU3RyaW5nW29wdGlvbnMuY2x1c3RlcmVkTGlnaHRpbmdTaGFkb3dUeXBlXTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG9wdGlvbnMuY2x1c3RlcmVkTGlnaHRpbmdBcmVhTGlnaHRzRW5hYmxlZClcbiAgICAgICAgICAgICAgICBjb2RlICs9IFwiXFxuI2RlZmluZSBDTFVTVEVSX0FSRUFMSUdIVFNcIjtcblxuICAgICAgICAgICAgY29kZSArPSBMaWdodHNCdWZmZXIuc2hhZGVyRGVmaW5lcztcblxuICAgICAgICAgICAgaWYgKG9wdGlvbnMuY2x1c3RlcmVkTGlnaHRpbmdTaGFkb3dzRW5hYmxlZCAmJiAhb3B0aW9ucy5ub1NoYWRvdykge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gY2h1bmtzLmNsdXN0ZXJlZExpZ2h0U2hhZG93c1BTO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb2RlICs9IGNodW5rcy5jbHVzdGVyZWRMaWdodFBTO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdGlvbnMudHdvU2lkZWRMaWdodGluZykgY29kZSArPSBcInVuaWZvcm0gZmxvYXQgdHdvU2lkZWRMaWdodGluZ05lZ1NjYWxlRmFjdG9yO1xcblwiO1xuXG4gICAgICAgIC8vIEZSQUdNRU5UIFNIQURFUiBCT0RZXG5cbiAgICAgICAgY29kZSArPSB0aGlzLl9mc0dldFN0YXJ0Q29kZShjb2RlLCBkZXZpY2UsIGNodW5rcywgb3B0aW9ucyk7XG5cbiAgICAgICAgaWYgKHRoaXMubmVlZHNOb3JtYWwpIHtcbiAgICAgICAgICAgIGlmIChvcHRpb25zLnR3b1NpZGVkTGlnaHRpbmcpIHtcbiAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGRWZXJ0ZXhOb3JtYWxXID0gbm9ybWFsaXplKGdsX0Zyb250RmFjaW5nID8gdk5vcm1hbFcgKiB0d29TaWRlZExpZ2h0aW5nTmVnU2NhbGVGYWN0b3IgOiAtdk5vcm1hbFcgKiB0d29TaWRlZExpZ2h0aW5nTmVnU2NhbGVGYWN0b3IpO1xcblwiO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGRWZXJ0ZXhOb3JtYWxXID0gbm9ybWFsaXplKHZOb3JtYWxXKTtcXG5cIjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKChvcHRpb25zLmhlaWdodE1hcCB8fCBvcHRpb25zLm5vcm1hbE1hcCkgJiYgb3B0aW9ucy5oYXNUYW5nZW50cykge1xuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLnR3b1NpZGVkTGlnaHRpbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBkVGFuZ2VudFcgPSBnbF9Gcm9udEZhY2luZyA/IHZUYW5nZW50VyAqIHR3b1NpZGVkTGlnaHRpbmdOZWdTY2FsZUZhY3RvciA6IC12VGFuZ2VudFcgKiB0d29TaWRlZExpZ2h0aW5nTmVnU2NhbGVGYWN0b3I7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZEJpbm9ybWFsVyA9IGdsX0Zyb250RmFjaW5nID8gdkJpbm9ybWFsVyAqIHR3b1NpZGVkTGlnaHRpbmdOZWdTY2FsZUZhY3RvciA6IC12Qmlub3JtYWxXICogdHdvU2lkZWRMaWdodGluZ05lZ1NjYWxlRmFjdG9yO1xcblwiO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZFRhbmdlbnRXID0gdlRhbmdlbnRXO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGRCaW5vcm1hbFcgPSB2Qmlub3JtYWxXO1xcblwiO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29kZSArPSBcIiAgICBnZXRWaWV3RGlyKCk7XFxuXCI7XG4gICAgICAgICAgICBpZiAoaGFzVEJOKSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBnZXRUQk4oKTtcXG5cIjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGludm9rZSBmcm9udGVuZCBmdW5jdGlvbnNcbiAgICAgICAgY29kZSArPSB0aGlzLmZyb250ZW5kRnVuYztcblxuICAgICAgICAvLyB0cmFuc2Zvcm0gdGFuZ2VudCBzcGFjZSBub3JtYWxzIHRvIHdvcmxkIHNwYWNlXG4gICAgICAgIGlmICh0aGlzLm5lZWRzTm9ybWFsKSB7XG4gICAgICAgICAgICBpZiAob3B0aW9ucy51c2VTcGVjdWxhcikge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZ2V0UmVmbERpcigpO1xcblwiO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAob3B0aW9ucy5jbGVhckNvYXQpIHtcbiAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGNjUmVmbERpclcgPSBub3JtYWxpemUoLXJlZmxlY3QoZFZpZXdEaXJXLCBjY05vcm1hbFcpKTtcXG5cIjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICgodGhpcy5saWdodGluZyAmJiBvcHRpb25zLnVzZVNwZWN1bGFyKSB8fCB0aGlzLnJlZmxlY3Rpb25zKSB7XG4gICAgICAgICAgICBpZiAob3B0aW9ucy51c2VNZXRhbG5lc3MpIHtcbiAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGdldE1ldGFsbmVzc01vZHVsYXRlKCk7XFxuXCI7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zLmlyaWRlc2NlbmNlKSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBnZXRJcmlkZXNjZW5jZShzYXR1cmF0ZShkb3QoZFZpZXdEaXJXLCBkTm9ybWFsVykpKTtcXG5cIjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChhZGRBbWJpZW50KSB7XG4gICAgICAgICAgICBjb2RlICs9IFwiICAgIGFkZEFtYmllbnQoKTtcXG5cIjtcblxuICAgICAgICAgICAgLy8gbW92ZSBhbWJpZW50IGNvbG9yIG91dCBvZiBkaWZmdXNlICh1c2VkIGJ5IExpZ2h0bWFwcGVyLCB0byBtdWx0aXBseSBhbWJpZW50IGNvbG9yIGJ5IGFjY3VtdWxhdGVkIEFPKVxuICAgICAgICAgICAgaWYgKG9wdGlvbnMuc2VwYXJhdGVBbWJpZW50KSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBgXG4gICAgICAgICAgICAgICAgICAgIHZlYzMgZEFtYmllbnRMaWdodCA9IGREaWZmdXNlTGlnaHQ7XG4gICAgICAgICAgICAgICAgICAgIGREaWZmdXNlTGlnaHQgPSB2ZWMzKDApO1xuICAgICAgICAgICAgICAgIGA7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy5hbWJpZW50VGludCAmJiAhdXNlT2xkQW1iaWVudCkge1xuICAgICAgICAgICAgY29kZSArPSBcIiAgICBkRGlmZnVzZUxpZ2h0ICo9IG1hdGVyaWFsX2FtYmllbnQ7XFxuXCI7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodXNlQW8gJiYgIW9wdGlvbnMub2NjbHVkZURpcmVjdCkge1xuICAgICAgICAgICAgY29kZSArPSBcIiAgICBvY2NsdWRlRGlmZnVzZSgpO1xcblwiO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdGlvbnMubGlnaHRNYXAgfHwgb3B0aW9ucy5saWdodFZlcnRleENvbG9yKSB7XG4gICAgICAgICAgICBjb2RlICs9IFwiICAgIGFkZExpZ2h0TWFwKCk7XFxuXCI7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5saWdodGluZyB8fCB0aGlzLnJlZmxlY3Rpb25zKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5yZWZsZWN0aW9ucykge1xuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLmNsZWFyQ29hdCkge1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGFkZFJlZmxlY3Rpb25DQygpO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5mcmVzbmVsTW9kZWwgPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGNjRnJlc25lbCA9IGdldEZyZXNuZWxDQyhkb3QoZFZpZXdEaXJXLCBjY05vcm1hbFcpKTtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgY2NSZWZsZWN0aW9uLnJnYiAqPSBjY0ZyZXNuZWw7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIH0gIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBjY0ZyZXNuZWwgPSAwLjA7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMudXNlU3BlY3VsYXJpdHlGYWN0b3IpIHtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBjY1JlZmxlY3Rpb24ucmdiICo9IGRTcGVjdWxhcml0eUZhY3RvcjtcXG5cIjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5zaGVlbikge1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGFkZFJlZmxlY3Rpb25TaGVlbigpO1xcblwiO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIEZyZXNuZWwgaGFzIHRvIGJlIGFwcGxpZWQgdG8gcmVmbGVjdGlvbnNcbiAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGFkZFJlZmxlY3Rpb24oKTtcXG5cIjtcblxuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLmZyZXNuZWxNb2RlbCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBkUmVmbGVjdGlvbi5yZ2IgKj0gZ2V0RnJlc25lbChkb3QoZFZpZXdEaXJXLCBkTm9ybWFsVyksIGRTcGVjdWxhcml0eSk7XFxuXCI7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBkUmVmbGVjdGlvbi5yZ2IgKj0gZFNwZWN1bGFyaXR5O1xcblwiO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy51c2VTcGVjdWxhcml0eUZhY3Rvcikge1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGRSZWZsZWN0aW9uLnJnYiAqPSBkU3BlY3VsYXJpdHlGYWN0b3I7XFxuXCI7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoaGFzQXJlYUxpZ2h0cykge1xuICAgICAgICAgICAgICAgIC8vIHNwZWN1bGFyIGhhcyB0byBiZSBhY2N1bXVsYXRlZCBkaWZmZXJlbnRseSBpZiB3ZSB3YW50IGFyZWEgbGlnaHRzIHRvIGxvb2sgY29ycmVjdFxuICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZFNwZWN1bGFyTGlnaHQgKj0gZFNwZWN1bGFyaXR5O1xcblwiO1xuICAgICAgICAgICAgICAgIC8vIGNvZGUgKz0gXCIgICAgZmxvYXQgcm91Z2huZXNzID0gbWF4KCgxLjAgLSBkR2xvc3NpbmVzcykgKiAoMS4wIC0gZEdsb3NzaW5lc3MpLCAwLjAwMSk7XFxuXCI7XG5cbiAgICAgICAgICAgICAgICAvLyBldmFsdWF0ZSBtYXRlcmlhbCBiYXNlZCBhcmVhIGxpZ2h0cyBkYXRhLCBzaGFyZWQgYnkgYWxsIGFyZWEgbGlnaHRzXG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMudXNlU3BlY3VsYXIpIHtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBjYWxjTFRDTGlnaHRWYWx1ZXMoKTtcXG5cIjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgb3B0aW9ucy5saWdodHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBsaWdodCA9IG9wdGlvbnMubGlnaHRzW2ldO1xuICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0VHlwZSA9IGxpZ2h0Ll90eXBlO1xuXG4gICAgICAgICAgICAgICAgLy8gaWYgY2x1c3RlcmVkIGxpZ2h0cyBhcmUgdXNlZCwgc2tpcCBub3JtYWwgbGlnaHRzIG90aGVyIHRoYW4gZGlyZWN0aW9uYWxcbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQgJiYgbGlnaHRUeXBlICE9PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwpIHtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gVGhlIGZvbGxvd2luZyBjb2RlIGlzIG5vdCBkZWNvdXBsZWQgdG8gc2VwYXJhdGUgc2hhZGVyIGZpbGVzLCBiZWNhdXNlIG1vc3Qgb2YgaXQgY2FuIGJlIGFjdHVhbGx5IGNoYW5nZWQgdG8gYWNoaWV2ZSBkaWZmZXJlbnQgYmVoYXZpb3JzIGxpa2U6XG4gICAgICAgICAgICAgICAgLy8gLSBkaWZmZXJlbnQgZmFsbG9mZnNcbiAgICAgICAgICAgICAgICAvLyAtIGRpZmZlcmVudCBzaGFkb3cgY29vcmRzIChvbW5pIHNoYWRvd3Mgd2lsbCB1c2UgZHJhc3RpY2FsbHkgZGlmZmVyZW50IGdlblNoYWRvd0Nvb3JkKVxuICAgICAgICAgICAgICAgIC8vIC0gZGlmZmVyZW50IHNoYWRvdyBmaWx0ZXIgbW9kZXNcbiAgICAgICAgICAgICAgICAvLyAtIGRpZmZlcmVudCBsaWdodCBzb3VyY2Ugc2hhcGVzXG5cbiAgICAgICAgICAgICAgICAvLyBnZXRMaWdodERpZmZ1c2UgYW5kIGdldExpZ2h0U3BlY3VsYXIgaXMgQlJERiBpdHNlbGYuXG5cbiAgICAgICAgICAgICAgICB1c2VzQ29va2llTm93ID0gZmFsc2U7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBsaWdodFNoYXBlID0gKGhhc0FyZWFMaWdodHMgJiYgbGlnaHQuX3NoYXBlKSA/IGxpZ2h0LnNoYXBlIDogTElHSFRTSEFQRV9QVU5DVFVBTDtcbiAgICAgICAgICAgICAgICBjb25zdCBzaGFwZVN0cmluZyA9IChoYXNBcmVhTGlnaHRzICYmIGxpZ2h0Ll9zaGFwZSkgPyB0aGlzLl9nZXRMaWdodFNvdXJjZVNoYXBlU3RyaW5nKGxpZ2h0U2hhcGUpIDogJyc7XG5cbiAgICAgICAgICAgICAgICBpZiAobGlnaHRTaGFwZSAhPT0gTElHSFRTSEFQRV9QVU5DVFVBTCkge1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGNhbGNcIiArIHNoYXBlU3RyaW5nICsgXCJMaWdodFZhbHVlcyhsaWdodFwiICsgaSArIFwiX3Bvc2l0aW9uLCBsaWdodFwiICsgaSArIFwiX2hhbGZXaWR0aCwgbGlnaHRcIiArIGkgKyBcIl9oYWxmSGVpZ2h0KTtcXG5cIjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAobGlnaHRUeXBlID09PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gZGlyZWN0aW9uYWxcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBkTGlnaHREaXJOb3JtVyA9IGxpZ2h0XCIgKyBpICsgXCJfZGlyZWN0aW9uO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGRBdHRlbiA9IDEuMDtcXG5cIjtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChsaWdodC5fY29va2llKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobGlnaHRUeXBlID09PSBMSUdIVFRZUEVfU1BPVCAmJiAhbGlnaHQuX2Nvb2tpZS5fY3ViZW1hcCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVzZXNDb29raWUgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVzZXNDb29raWVOb3cgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChsaWdodFR5cGUgPT09IExJR0hUVFlQRV9PTU5JICYmIGxpZ2h0Ll9jb29raWUuX2N1YmVtYXApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB1c2VzQ29va2llID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB1c2VzQ29va2llTm93ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZ2V0TGlnaHREaXJQb2ludChsaWdodFwiICsgaSArIFwiX3Bvc2l0aW9uKTtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgaGFzUG9pbnRMaWdodHMgPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICh1c2VzQ29va2llTm93KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobGlnaHRUeXBlID09PSBMSUdIVFRZUEVfU1BPVCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZEF0dGVuMyA9IGdldENvb2tpZTJEXCIgKyAobGlnaHQuX2Nvb2tpZUZhbGxvZmYgPyBcIlwiIDogXCJDbGlwXCIpICsgKGxpZ2h0Ll9jb29raWVUcmFuc2Zvcm0gPyBcIlhmb3JtXCIgOiBcIlwiKSArIFwiKGxpZ2h0XCIgKyBpICsgXCJfY29va2llLCBsaWdodFwiICsgaSArIFwiX3NoYWRvd01hdHJpeCwgbGlnaHRcIiArIGkgKyBcIl9jb29raWVJbnRlbnNpdHlcIiArIChsaWdodC5fY29va2llVHJhbnNmb3JtID8gXCIsIGxpZ2h0XCIgKyBpICsgXCJfY29va2llTWF0cml4LCBsaWdodFwiICsgaSArIFwiX2Nvb2tpZU9mZnNldFwiIDogXCJcIikgKyBcIikuXCIgKyBsaWdodC5fY29va2llQ2hhbm5lbCArIFwiO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGRBdHRlbjMgPSBnZXRDb29raWVDdWJlKGxpZ2h0XCIgKyBpICsgXCJfY29va2llLCBsaWdodFwiICsgaSArIFwiX3NoYWRvd01hdHJpeCwgbGlnaHRcIiArIGkgKyBcIl9jb29raWVJbnRlbnNpdHkpLlwiICsgbGlnaHQuX2Nvb2tpZUNoYW5uZWwgKyBcIjtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmIChsaWdodFNoYXBlID09PSBMSUdIVFNIQVBFX1BVTkNUVUFMKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobGlnaHQuX2ZhbGxvZmZNb2RlID09PSBMSUdIVEZBTExPRkZfTElORUFSKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBkQXR0ZW4gPSBnZXRGYWxsb2ZmTGluZWFyKGxpZ2h0XCIgKyBpICsgXCJfcmFkaXVzKTtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB1c2VzTGluZWFyRmFsbG9mZiA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZEF0dGVuID0gZ2V0RmFsbG9mZkludlNxdWFyZWQobGlnaHRcIiArIGkgKyBcIl9yYWRpdXMpO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVzZXNJbnZTcXVhcmVkRmFsbG9mZiA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBub24gcHVuY3R1YWwgbGlnaHRzIG9ubHkgZ2V0cyB0aGUgcmFuZ2Ugd2luZG93IGhlcmVcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZEF0dGVuID0gZ2V0RmFsbG9mZldpbmRvdyhsaWdodFwiICsgaSArIFwiX3JhZGl1cyk7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgICAgICB1c2VzSW52U3F1YXJlZEZhbGxvZmYgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBpZiAoZEF0dGVuID4gMC4wMDAwMSkge1xcblwiOyAvLyBCUkFOQ0ggU1RBUlRcblxuICAgICAgICAgICAgICAgICAgICBpZiAobGlnaHRUeXBlID09PSBMSUdIVFRZUEVfU1BPVCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCEodXNlc0Nvb2tpZU5vdyAmJiAhbGlnaHQuX2Nvb2tpZUZhbGxvZmYpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBkQXR0ZW4gKj0gZ2V0U3BvdEVmZmVjdChsaWdodFwiICsgaSArIFwiX2RpcmVjdGlvbiwgbGlnaHRcIiArIGkgKyBcIl9pbm5lckNvbmVBbmdsZSwgbGlnaHRcIiArIGkgKyBcIl9vdXRlckNvbmVBbmdsZSk7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdXNlc1Nwb3QgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gZGlmZnVzZSBsaWdodGluZyAtIExUQyBsaWdodHMgZG8gbm90IG1peCBkaWZmdXNlIGxpZ2h0aW5nIGludG8gYXR0ZW51YXRpb24gdGhhdCBhZmZlY3RzIHNwZWN1bGFyXG4gICAgICAgICAgICAgICAgaWYgKGxpZ2h0U2hhcGUgIT09IExJR0hUU0hBUEVfUFVOQ1RVQUwpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGxpZ2h0VHlwZSA9PT0gTElHSFRUWVBFX0RJUkVDVElPTkFMKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBOQjogQSBiZXR0ZXIgYXByb3hpbWF0aW9uIHBlcmhhcHMgdXNpbmcgd3JhcCBsaWdodGluZyBjb3VsZCBiZSBpbXBsZW1lbnRlZCBoZXJlXG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGRBdHRlbkQgPSBnZXRMaWdodERpZmZ1c2UoKTtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIDE2LjAgaXMgYSBjb25zdGFudCB0aGF0IGlzIGluIGdldEZhbGxvZmZJbnZTcXVhcmVkKClcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZEF0dGVuRCA9IGdldFwiICsgc2hhcGVTdHJpbmcgKyBcIkxpZ2h0RGlmZnVzZSgpICogMTYuMDtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZEF0dGVuICo9IGdldExpZ2h0RGlmZnVzZSgpO1xcblwiO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChsaWdodC5jYXN0U2hhZG93cyAmJiAhb3B0aW9ucy5ub1NoYWRvdykge1xuICAgICAgICAgICAgICAgICAgICBsZXQgc2hhZG93UmVhZE1vZGUgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICBsZXQgZXZzbUV4cDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGxpZ2h0Ll9zaGFkb3dUeXBlID09PSBTSEFET1dfVlNNOCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2hhZG93UmVhZE1vZGUgPSBcIlZTTThcIjtcbiAgICAgICAgICAgICAgICAgICAgICAgIGV2c21FeHAgPSBcIjAuMFwiO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGxpZ2h0Ll9zaGFkb3dUeXBlID09PSBTSEFET1dfVlNNMTYpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNoYWRvd1JlYWRNb2RlID0gXCJWU00xNlwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgZXZzbUV4cCA9IFwiNS41NFwiO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGxpZ2h0Ll9zaGFkb3dUeXBlID09PSBTSEFET1dfVlNNMzIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNoYWRvd1JlYWRNb2RlID0gXCJWU00zMlwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGRldmljZS50ZXh0dXJlRmxvYXRIaWdoUHJlY2lzaW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZXZzbUV4cCA9IFwiMTUuMFwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBldnNtRXhwID0gXCI1LjU0XCI7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobGlnaHQuX3NoYWRvd1R5cGUgPT09IFNIQURPV19QQ0Y1KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzaGFkb3dSZWFkTW9kZSA9IFwiUENGNXg1XCI7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzaGFkb3dSZWFkTW9kZSA9IFwiUENGM3gzXCI7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAoc2hhZG93UmVhZE1vZGUgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsaWdodFR5cGUgPT09IExJR0hUVFlQRV9PTU5JKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2hhZG93Q29vcmRBcmdzID0gXCIobGlnaHRcIiArIGkgKyBcIl9zaGFkb3dNYXAsIGxpZ2h0XCIgKyBpICsgXCJfc2hhZG93UGFyYW1zKTtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobGlnaHQuX25vcm1hbE9mZnNldEJpYXMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBub3JtYWxPZmZzZXRQb2ludFNoYWRvdyhsaWdodFwiICsgaSArIFwiX3NoYWRvd1BhcmFtcyk7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gYCAgICBmbG9hdCBzaGFkb3cke2l9ID0gZ2V0U2hhZG93UG9pbnQke3NoYWRvd1JlYWRNb2RlfSR7c2hhZG93Q29vcmRBcmdzfWA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSBgICAgIGRBdHRlbiAqPSBtaXgoMS4wLCBzaGFkb3cke2l9LCBsaWdodCR7aX1fc2hhZG93SW50ZW5zaXR5KTtcXG5gO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzaGFkb3dNYXRBcmcgPSBgbGlnaHQke2l9X3NoYWRvd01hdHJpeGA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2hhZG93UGFyYW1BcmcgPSBgbGlnaHQke2l9X3NoYWRvd1BhcmFtc2A7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSB0aGlzLl9ub25Qb2ludFNoYWRvd01hcFByb2plY3Rpb24oZGV2aWNlLCBvcHRpb25zLmxpZ2h0c1tpXSwgc2hhZG93TWF0QXJnLCBzaGFkb3dQYXJhbUFyZywgaSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobGlnaHRUeXBlID09PSBMSUdIVFRZUEVfU1BPVCkgc2hhZG93UmVhZE1vZGUgPSBcIlNwb3RcIiArIHNoYWRvd1JlYWRNb2RlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gYCAgICBmbG9hdCBzaGFkb3cke2l9ID0gZ2V0U2hhZG93JHtzaGFkb3dSZWFkTW9kZX0obGlnaHQke2l9X3NoYWRvd01hcCwgbGlnaHQke2l9X3NoYWRvd1BhcmFtcyR7KGxpZ2h0Ll9pc1ZzbSA/IFwiLCBcIiArIGV2c21FeHAgOiBcIlwiKX0pO1xcbmA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSBgICAgIGRBdHRlbiAqPSBtaXgoMS4wLCBzaGFkb3cke2l9LCBsaWdodCR7aX1fc2hhZG93SW50ZW5zaXR5KTtcXG5gO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGxpZ2h0U2hhcGUgIT09IExJR0hUU0hBUEVfUFVOQ1RVQUwpIHtcblxuICAgICAgICAgICAgICAgICAgICAvLyBhcmVhIGxpZ2h0IC0gdGhleSBkbyBub3QgbWl4IGRpZmZ1c2UgbGlnaHRpbmcgaW50byBzcGVjdWxhciBhdHRlbnVhdGlvblxuICAgICAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5jb25zZXJ2ZUVuZXJneSAmJiBvcHRpb25zLnVzZVNwZWN1bGFyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGREaWZmdXNlTGlnaHQgKz0gbWl4KChkQXR0ZW5EICogZEF0dGVuKSAqIGxpZ2h0XCIgKyBpICsgXCJfY29sb3JcIiArICh1c2VzQ29va2llTm93ID8gXCIgKiBkQXR0ZW4zXCIgOiBcIlwiKSArIFwiLCB2ZWMzKDApLCBkTFRDU3BlY0ZyZXMpO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBkRGlmZnVzZUxpZ2h0ICs9IChkQXR0ZW5EICogZEF0dGVuKSAqIGxpZ2h0XCIgKyBpICsgXCJfY29sb3JcIiArICh1c2VzQ29va2llTm93ID8gXCIgKiBkQXR0ZW4zXCIgOiBcIlwiKSArIFwiO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgICAgICAgICAvLyBwdW5jdHVhbCBsaWdodFxuICAgICAgICAgICAgICAgICAgICBpZiAoaGFzQXJlYUxpZ2h0cyAmJiBvcHRpb25zLmNvbnNlcnZlRW5lcmd5ICYmIG9wdGlvbnMudXNlU3BlY3VsYXIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZERpZmZ1c2VMaWdodCArPSBtaXgoZEF0dGVuICogbGlnaHRcIiArIGkgKyBcIl9jb2xvclwiICsgKHVzZXNDb29raWVOb3cgPyBcIiAqIGRBdHRlbjNcIiA6IFwiXCIpICsgXCIsIHZlYzMoMCksIGRTcGVjdWxhcml0eSk7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGREaWZmdXNlTGlnaHQgKz0gZEF0dGVuICogbGlnaHRcIiArIGkgKyBcIl9jb2xvclwiICsgKHVzZXNDb29raWVOb3cgPyBcIiAqIGRBdHRlbjNcIiA6IFwiXCIpICsgXCI7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy51c2VTcGVjdWxhcikge1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGRIYWxmRGlyVyA9IG5vcm1hbGl6ZSgtZExpZ2h0RGlyTm9ybVcgKyBkVmlld0RpclcpO1xcblwiO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIHNwZWN1bGFyIC8gY2xlYXIgY29hdFxuICAgICAgICAgICAgICAgIGlmIChsaWdodFNoYXBlICE9PSBMSUdIVFNIQVBFX1BVTkNUVUFMKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gYXJlYSBsaWdodFxuICAgICAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5jbGVhckNvYXQpIGNvZGUgKz0gXCIgICAgY2NTcGVjdWxhckxpZ2h0ICs9IGNjTFRDU3BlY0ZyZXMgKiBnZXRcIiArIHNoYXBlU3RyaW5nICsgXCJMaWdodFNwZWN1bGFyQ0MoKSAqIGRBdHRlbiAqIGxpZ2h0XCIgKyBpICsgXCJfY29sb3JcIiArICh1c2VzQ29va2llTm93ID8gXCIgKiBkQXR0ZW4zXCIgOiBcIlwiKSArIFwiO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy51c2VTcGVjdWxhcikgY29kZSArPSBcIiAgICBkU3BlY3VsYXJMaWdodCArPSBkTFRDU3BlY0ZyZXMgKiBnZXRcIiArIHNoYXBlU3RyaW5nICsgXCJMaWdodFNwZWN1bGFyKCkgKiBkQXR0ZW4gKiBsaWdodFwiICsgaSArIFwiX2NvbG9yXCIgKyAodXNlc0Nvb2tpZU5vdyA/IFwiICogZEF0dGVuM1wiIDogXCJcIikgKyBcIjtcXG5cIjtcblxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBjYWxjRnJlc25lbCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICBpZiAobGlnaHRUeXBlID09PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwgJiYgb3B0aW9ucy5mcmVzbmVsTW9kZWwgPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxjRnJlc25lbCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBpZiBMVEMgbGlnaHRzIGFyZSBwcmVzZW50LCBzcGVjdWxhciBtdXN0IGJlIGFjY3VtdWxhdGVkIHdpdGggc3BlY3VsYXJpdHkgKHNwZWN1bGFyaXR5IGlzIHByZSBtdWx0aXBsaWVkIGJ5IHB1bmN0dWFsIGxpZ2h0IGZyZXNuZWwpXG4gICAgICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLmNsZWFyQ29hdCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBjY1NwZWN1bGFyTGlnaHQgKz0gZ2V0TGlnaHRTcGVjdWxhckNDKGRIYWxmRGlyVykgKiBkQXR0ZW4gKiBsaWdodFwiICsgaSArIFwiX2NvbG9yXCI7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlICs9IHVzZXNDb29raWVOb3cgPyBcIiAqIGRBdHRlbjNcIiA6IFwiXCI7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlICs9IGNhbGNGcmVzbmVsID8gXCIgKiBnZXRGcmVzbmVsQ0MoZG90KGRWaWV3RGlyVywgZEhhbGZEaXJXKSlcIiA6IFwiXCI7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlICs9ICBcIjtcXG5cIjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5zaGVlbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBzU3BlY3VsYXJMaWdodCArPSBnZXRMaWdodFNwZWN1bGFyU2hlZW4oZEhhbGZEaXJXKSAqIGRBdHRlbiAqIGxpZ2h0XCIgKyBpICsgXCJfY29sb3JcIjtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gdXNlc0Nvb2tpZU5vdyA/IFwiICogZEF0dGVuM1wiIDogXCJcIjtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gIFwiO1xcblwiO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLnVzZVNwZWN1bGFyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGRTcGVjdWxhckxpZ2h0ICs9IGdldExpZ2h0U3BlY3VsYXIoZEhhbGZEaXJXKSAqIGRBdHRlbiAqIGxpZ2h0XCIgKyBpICsgXCJfY29sb3JcIjtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gdXNlc0Nvb2tpZU5vdyA/IFwiICogZEF0dGVuM1wiIDogXCJcIjtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gY2FsY0ZyZXNuZWwgPyBcIiAqIGdldEZyZXNuZWwoZG90KGRWaWV3RGlyVywgZEhhbGZEaXJXKSwgZFNwZWN1bGFyaXR5KVwiIDogXCJcIjtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgKz0gXCI7XFxuXCI7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAobGlnaHRUeXBlICE9PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwpIHtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICB9XFxuXCI7IC8vIEJSQU5DSCBFTkRcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb2RlICs9IFwiXFxuXCI7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGNsdXN0ZXJlZCBsaWdodGluZ1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkICYmIHRoaXMubGlnaHRpbmcpIHtcbiAgICAgICAgICAgICAgICB1c2VzTGluZWFyRmFsbG9mZiA9IHRydWU7XG4gICAgICAgICAgICAgICAgdXNlc0ludlNxdWFyZWRGYWxsb2ZmID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBoYXNQb2ludExpZ2h0cyA9IHRydWU7XG4gICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBhZGRDbHVzdGVyZWRMaWdodHMoKTtcXG5cIjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGhhc0FyZWFMaWdodHMpIHtcbiAgICAgICAgICAgICAgICAvLyBzcGVjdWxhciBoYXMgdG8gYmUgYWNjdW11bGF0ZWQgZGlmZmVyZW50bHkgaWYgd2Ugd2FudCBhcmVhIGxpZ2h0cyB0byBsb29rIGNvcnJlY3RcbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5jbGVhckNvYXQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBjY1NwZWN1bGFyaXR5ID0gMS4wO1xcblwiO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy51c2VTcGVjdWxhcikge1xuICAgICAgICAgICAgICAgICAgICBjb2RlICs9IFwiICAgIGRTcGVjdWxhcml0eSA9IHZlYzMoMSk7XFxuXCI7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAob3B0aW9ucy5yZWZyYWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBcIiAgICBhZGRSZWZyYWN0aW9uKCk7XFxuXCI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgY29kZSArPSBcIlxcblwiO1xuXG4gICAgICAgIGlmICh1c2VBbykge1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMub2NjbHVkZURpcmVjdCkge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgb2NjbHVkZURpZmZ1c2UoKTtcXG5cIjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChvcHRpb25zLm9jY2x1ZGVTcGVjdWxhciA9PT0gU1BFQ09DQ19BTyB8fCBvcHRpb25zLm9jY2x1ZGVTcGVjdWxhciA9PT0gU1BFQ09DQ19HTE9TU0RFUEVOREVOVCkge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgb2NjbHVkZVNwZWN1bGFyKCk7XFxuXCI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy51c2VTcGVjdWxhcml0eUZhY3Rvcikge1xuICAgICAgICAgICAgY29kZSArPSBcIiAgICBkU3BlY3VsYXJMaWdodCAqPSBkU3BlY3VsYXJpdHlGYWN0b3I7XFxuXCI7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy5vcGFjaXR5RmFkZXNTcGVjdWxhciA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgIGlmIChvcHRpb25zLmJsZW5kVHlwZSA9PT0gQkxFTkRfTk9STUFMIHx8IG9wdGlvbnMuYmxlbmRUeXBlID09PSBCTEVORF9QUkVNVUxUSVBMSUVEKSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBcImZsb2F0IHNwZWNMdW0gPSBkb3QoKGRTcGVjdWxhckxpZ2h0ICsgZFJlZmxlY3Rpb24ucmdiICogZFJlZmxlY3Rpb24uYSksIHZlYzMoIDAuMjEyNiwgMC43MTUyLCAwLjA3MjIgKSk7XFxuXCI7XG4gICAgICAgICAgICAgICAgY29kZSArPSBcIiNpZmRlZiBMSVRfQ0xFQVJDT0FUXFxuIHNwZWNMdW0gKz0gZG90KGNjU3BlY3VsYXJMaWdodCAqIGNjU3BlY3VsYXJpdHkgKyBjY1JlZmxlY3Rpb24ucmdiICogY2NTcGVjdWxhcml0eSwgdmVjMyggMC4yMTI2LCAwLjcxNTIsIDAuMDcyMiApKTtcXG4jZW5kaWZcXG5cIjtcbiAgICAgICAgICAgICAgICBjb2RlICs9IFwiZEFscGhhID0gY2xhbXAoZEFscGhhICsgZ2FtbWFDb3JyZWN0SW5wdXQoc3BlY0x1bSksIDAuMCwgMS4wKTtcXG5cIjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvZGUgKz0gXCJkQWxwaGEgKj0gbWF0ZXJpYWxfYWxwaGFGYWRlO1xcblwiO1xuICAgICAgICB9XG5cbiAgICAgICAgY29kZSArPSBjaHVua3MuZW5kUFM7XG4gICAgICAgIGlmIChvcHRpb25zLmJsZW5kVHlwZSA9PT0gQkxFTkRfTk9STUFMIHx8IG9wdGlvbnMuYmxlbmRUeXBlID09PSBCTEVORF9BRERJVElWRUFMUEhBIHx8IG9wdGlvbnMuYWxwaGFUb0NvdmVyYWdlKSB7XG4gICAgICAgICAgICBjb2RlICs9IGNodW5rcy5vdXRwdXRBbHBoYVBTO1xuICAgICAgICB9IGVsc2UgaWYgKG9wdGlvbnMuYmxlbmRUeXBlID09PSBCTEVORF9QUkVNVUxUSVBMSUVEKSB7XG4gICAgICAgICAgICBjb2RlICs9IGNodW5rcy5vdXRwdXRBbHBoYVByZW11bFBTO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29kZSArPSBjaHVua3Mub3V0cHV0QWxwaGFPcGFxdWVQUztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLm1zZGYpIHtcbiAgICAgICAgICAgIGNvZGUgKz0gXCIgICAgZ2xfRnJhZ0NvbG9yID0gYXBwbHlNc2RmKGdsX0ZyYWdDb2xvcik7XFxuXCI7XG4gICAgICAgIH1cblxuICAgICAgICBjb2RlICs9IFwiXFxuXCI7XG4gICAgICAgIGNvZGUgKz0gZW5kKCk7XG5cbiAgICAgICAgaWYgKGhhc1BvaW50TGlnaHRzKSB7XG4gICAgICAgICAgICBjb2RlID0gY2h1bmtzLmxpZ2h0RGlyUG9pbnRQUyArIGNvZGU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHVzZXNMaW5lYXJGYWxsb2ZmKSB7XG4gICAgICAgICAgICBjb2RlID0gY2h1bmtzLmZhbGxvZmZMaW5lYXJQUyArIGNvZGU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHVzZXNJbnZTcXVhcmVkRmFsbG9mZikge1xuICAgICAgICAgICAgY29kZSA9IGNodW5rcy5mYWxsb2ZmSW52U3F1YXJlZFBTICsgY29kZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodXNlc1Nwb3QpIHtcbiAgICAgICAgICAgIGNvZGUgPSBjaHVua3Muc3BvdFBTICsgY29kZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodXNlc0Nvb2tpZSAmJiAhb3B0aW9ucy5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpIHtcbiAgICAgICAgICAgIC8vIG5vbi1jbHVzdGVyZWQgbGlnaHRzIGNvb2tpZSBjb2RlXG4gICAgICAgICAgICBjb2RlID0gY2h1bmtzLmNvb2tpZVBTICsgY29kZTtcbiAgICAgICAgfVxuICAgICAgICBsZXQgc3RydWN0Q29kZSA9IFwiXCI7XG4gICAgICAgIGlmIChjb2RlLmluY2x1ZGVzKFwiZFJlZmxlY3Rpb25cIikpIHN0cnVjdENvZGUgKz0gXCJ2ZWM0IGRSZWZsZWN0aW9uO1xcblwiO1xuICAgICAgICBpZiAoY29kZS5pbmNsdWRlcyhcImRUQk5cIikpIHN0cnVjdENvZGUgKz0gXCJtYXQzIGRUQk47XFxuXCI7XG4gICAgICAgIGlmIChjb2RlLmluY2x1ZGVzKFwiZFZlcnRleE5vcm1hbFdcIikpIHN0cnVjdENvZGUgKz0gXCJ2ZWMzIGRWZXJ0ZXhOb3JtYWxXO1xcblwiO1xuICAgICAgICBpZiAoY29kZS5pbmNsdWRlcyhcImRUYW5nZW50V1wiKSkgc3RydWN0Q29kZSArPSBcInZlYzMgZFRhbmdlbnRXO1xcblwiO1xuICAgICAgICBpZiAoY29kZS5pbmNsdWRlcyhcImRCaW5vcm1hbFdcIikpIHN0cnVjdENvZGUgKz0gXCJ2ZWMzIGRCaW5vcm1hbFc7XFxuXCI7XG4gICAgICAgIGlmIChjb2RlLmluY2x1ZGVzKFwiZFZpZXdEaXJXXCIpKSBzdHJ1Y3RDb2RlICs9IFwidmVjMyBkVmlld0Rpclc7XFxuXCI7XG4gICAgICAgIGlmIChjb2RlLmluY2x1ZGVzKFwiZFJlZmxEaXJXXCIpKSBzdHJ1Y3RDb2RlICs9IFwidmVjMyBkUmVmbERpclc7XFxuXCI7XG4gICAgICAgIGlmIChjb2RlLmluY2x1ZGVzKFwiZEhhbGZEaXJXXCIpKSBzdHJ1Y3RDb2RlICs9IFwidmVjMyBkSGFsZkRpclc7XFxuXCI7XG4gICAgICAgIGlmIChjb2RlLmluY2x1ZGVzKFwiZERpZmZ1c2VMaWdodFwiKSkgc3RydWN0Q29kZSArPSBcInZlYzMgZERpZmZ1c2VMaWdodDtcXG5cIjtcbiAgICAgICAgaWYgKGNvZGUuaW5jbHVkZXMoXCJkU3BlY3VsYXJMaWdodFwiKSkgc3RydWN0Q29kZSArPSBcInZlYzMgZFNwZWN1bGFyTGlnaHQ7XFxuXCI7XG4gICAgICAgIGlmIChjb2RlLmluY2x1ZGVzKFwiZExpZ2h0RGlyTm9ybVdcIikpIHN0cnVjdENvZGUgKz0gXCJ2ZWMzIGRMaWdodERpck5vcm1XO1xcblwiO1xuICAgICAgICBpZiAoY29kZS5pbmNsdWRlcyhcImRMaWdodERpcldcIikpIHN0cnVjdENvZGUgKz0gXCJ2ZWMzIGRMaWdodERpclc7XFxuXCI7XG4gICAgICAgIGlmIChjb2RlLmluY2x1ZGVzKFwiZExpZ2h0UG9zV1wiKSkgc3RydWN0Q29kZSArPSBcInZlYzMgZExpZ2h0UG9zVztcXG5cIjtcbiAgICAgICAgaWYgKGNvZGUuaW5jbHVkZXMoXCJkU2hhZG93Q29vcmRcIikpIHN0cnVjdENvZGUgKz0gXCJ2ZWMzIGRTaGFkb3dDb29yZDtcXG5cIjtcbiAgICAgICAgaWYgKGNvZGUuaW5jbHVkZXMoXCJkQXR0ZW5cIikpIHN0cnVjdENvZGUgKz0gXCJmbG9hdCBkQXR0ZW47XFxuXCI7XG4gICAgICAgIGlmIChjb2RlLmluY2x1ZGVzKFwiZEF0dGVuRFwiKSkgc3RydWN0Q29kZSArPSBcImZsb2F0IGRBdHRlbkQ7XFxuXCI7IC8vIHNlcGFyYXRlIGRpZmZ1c2UgYXR0ZW51YXRpb24gZm9yIG5vbi1wdW5jdHVhbCBsaWdodCBzb3VyY2VzXG4gICAgICAgIGlmIChjb2RlLmluY2x1ZGVzKFwiZEF0dGVuM1wiKSkgc3RydWN0Q29kZSArPSBcInZlYzMgZEF0dGVuMztcXG5cIjtcbiAgICAgICAgaWYgKGNvZGUuaW5jbHVkZXMoXCJkTXNkZlwiKSkgc3RydWN0Q29kZSArPSBcInZlYzQgZE1zZGY7XFxuXCI7XG4gICAgICAgIGlmIChjb2RlLmluY2x1ZGVzKFwiY2NGcmVzbmVsXCIpKSBzdHJ1Y3RDb2RlICs9IFwiZmxvYXQgY2NGcmVzbmVsO1xcblwiO1xuICAgICAgICBpZiAoY29kZS5pbmNsdWRlcyhcImNjUmVmbGVjdGlvblwiKSkgc3RydWN0Q29kZSArPSBcInZlYzMgY2NSZWZsZWN0aW9uO1xcblwiO1xuICAgICAgICBpZiAoY29kZS5pbmNsdWRlcyhcImNjUmVmbERpcldcIikpIHN0cnVjdENvZGUgKz0gXCJ2ZWMzIGNjUmVmbERpclc7XFxuXCI7XG4gICAgICAgIGlmIChjb2RlLmluY2x1ZGVzKFwiY2NTcGVjdWxhckxpZ2h0XCIpKSBzdHJ1Y3RDb2RlICs9IFwidmVjMyBjY1NwZWN1bGFyTGlnaHQ7XFxuXCI7XG4gICAgICAgIGlmIChjb2RlLmluY2x1ZGVzKFwiY2NTcGVjdWxhcml0eU5vRnJlc1wiKSkgc3RydWN0Q29kZSArPSBcImZsb2F0IGNjU3BlY3VsYXJpdHlOb0ZyZXM7XFxuXCI7XG4gICAgICAgIGlmIChjb2RlLmluY2x1ZGVzKFwic1NwZWN1bGFyTGlnaHRcIikpIHN0cnVjdENvZGUgKz0gXCJ2ZWMzIHNTcGVjdWxhckxpZ2h0O1xcblwiO1xuICAgICAgICBpZiAoY29kZS5pbmNsdWRlcyhcInNSZWZsZWN0aW9uXCIpKSBzdHJ1Y3RDb2RlICs9IFwidmVjMyBzUmVmbGVjdGlvbjtcXG5cIjtcblxuICAgICAgICBjb25zdCByZXN1bHQgPSB0aGlzLl9mc0dldEJlZ2luQ29kZSgpICtcbiAgICAgICAgICAgIHRoaXMudmFyeWluZ3MgK1xuICAgICAgICAgICAgdGhpcy5fZnNHZXRCYXNlQ29kZSgpICtcbiAgICAgICAgICAgIChvcHRpb25zLmRldGFpbE1vZGVzID8gY2h1bmtzLmRldGFpbE1vZGVzUFMgOiBcIlwiKSArXG4gICAgICAgICAgICBzdHJ1Y3RDb2RlICtcbiAgICAgICAgICAgIHRoaXMuZnJvbnRlbmREZWNsICtcbiAgICAgICAgICAgIGNvZGU7XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICBnZW5lcmF0ZUZyYWdtZW50U2hhZGVyKGZyb250ZW5kRGVjbCwgZnJvbnRlbmRDb2RlLCBmcm9udGVuZEZ1bmMsIGxpZ2h0aW5nVXYpIHtcbiAgICAgICAgY29uc3Qgb3B0aW9ucyA9IHRoaXMub3B0aW9ucztcblxuICAgICAgICB0aGlzLmZyb250ZW5kRGVjbCA9IGZyb250ZW5kRGVjbDtcbiAgICAgICAgdGhpcy5mcm9udGVuZENvZGUgPSBmcm9udGVuZENvZGU7XG4gICAgICAgIHRoaXMuZnJvbnRlbmRGdW5jID0gZnJvbnRlbmRGdW5jO1xuICAgICAgICB0aGlzLmxpZ2h0aW5nVXYgPSBsaWdodGluZ1V2O1xuXG4gICAgICAgIGlmIChvcHRpb25zLnBhc3MgPT09IFNIQURFUl9QSUNLKSB7XG4gICAgICAgICAgICB0aGlzLmZzaGFkZXIgPSB0aGlzLl9mc0dldFBpY2tQYXNzQ29kZSgpO1xuICAgICAgICB9IGVsc2UgaWYgKG9wdGlvbnMucGFzcyA9PT0gU0hBREVSX0RFUFRIKSB7XG4gICAgICAgICAgICB0aGlzLmZzaGFkZXIgPSB0aGlzLl9mc0dldERlcHRoUGFzc0NvZGUoKTtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLnNoYWRvd1Bhc3MpIHtcbiAgICAgICAgICAgIHRoaXMuZnNoYWRlciA9IHRoaXMuX2ZzR2V0U2hhZG93UGFzc0NvZGUoKTtcbiAgICAgICAgfSBlbHNlIGlmIChvcHRpb25zLmN1c3RvbUZyYWdtZW50U2hhZGVyKSB7XG4gICAgICAgICAgICB0aGlzLmZzaGFkZXIgPSB0aGlzLl9mc0dldEJlZ2luQ29kZSgpICsgb3B0aW9ucy5jdXN0b21GcmFnbWVudFNoYWRlcjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuZnNoYWRlciA9IHRoaXMuX2ZzR2V0TGl0UGFzc0NvZGUoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldERlZmluaXRpb24oKSB7XG5cbiAgICAgICAgY29uc3QgZGVmaW5pdGlvbiA9IFNoYWRlclV0aWxzLmNyZWF0ZURlZmluaXRpb24odGhpcy5kZXZpY2UsIHtcbiAgICAgICAgICAgIG5hbWU6ICdMaXRTaGFkZXInLFxuICAgICAgICAgICAgYXR0cmlidXRlczogdGhpcy5hdHRyaWJ1dGVzLFxuICAgICAgICAgICAgdmVydGV4Q29kZTogdGhpcy52c2hhZGVyLFxuICAgICAgICAgICAgZnJhZ21lbnRDb2RlOiB0aGlzLmZzaGFkZXJcbiAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKFNoYWRlclBhc3MuaXNGb3J3YXJkKHRoaXMub3B0aW9ucy5wYXNzKSkge1xuICAgICAgICAgICAgZGVmaW5pdGlvbi50YWcgPSBTSEFERVJUQUdfTUFURVJJQUw7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZGVmaW5pdGlvbjtcbiAgICB9XG59XG5cbmV4cG9ydCB7XG4gICAgTGl0U2hhZGVyXG59O1xuIl0sIm5hbWVzIjpbImJ1aWx0aW5BdHRyaWJ1dGVzIiwidmVydGV4X25vcm1hbCIsIlNFTUFOVElDX05PUk1BTCIsInZlcnRleF90YW5nZW50IiwiU0VNQU5USUNfVEFOR0VOVCIsInZlcnRleF90ZXhDb29yZDAiLCJTRU1BTlRJQ19URVhDT09SRDAiLCJ2ZXJ0ZXhfdGV4Q29vcmQxIiwiU0VNQU5USUNfVEVYQ09PUkQxIiwidmVydGV4X2NvbG9yIiwiU0VNQU5USUNfQ09MT1IiLCJ2ZXJ0ZXhfYm9uZVdlaWdodHMiLCJTRU1BTlRJQ19CTEVORFdFSUdIVCIsInZlcnRleF9ib25lSW5kaWNlcyIsIlNFTUFOVElDX0JMRU5ESU5ESUNFUyIsImJ1aWx0aW5WYXJ5aW5ncyIsInZWZXJ0ZXhDb2xvciIsInZQb3NpdGlvblciLCJ2Tm9ybWFsViIsInZOb3JtYWxXIiwidlRhbmdlbnRXIiwidkJpbm9ybWFsVyIsInZPYmplY3RTcGFjZVVwVyIsInZVdjAiLCJ2VXYxIiwiTGl0U2hhZGVyIiwiY29uc3RydWN0b3IiLCJkZXZpY2UiLCJvcHRpb25zIiwiYXR0cmlidXRlcyIsInZlcnRleF9wb3NpdGlvbiIsIlNFTUFOVElDX1BPU0lUSU9OIiwiY2h1bmtzIiwidXNlckNodW5rcyIsInZhbGlkYXRlVXNlckNodW5rcyIsImNodW5rTmFtZSIsInNoYWRlckNodW5rcyIsImhhc093blByb3BlcnR5IiwiY2h1bmsiLCJhIiwiaW5kZXhPZiIsImxpZ2h0aW5nIiwibGlnaHRzIiwibGVuZ3RoIiwiZGlyTGlnaHRNYXAiLCJjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQiLCJyZWZsZWN0aW9ucyIsInJlZmxlY3Rpb25Tb3VyY2UiLCJ1c2VTcGVjdWxhciIsInNwZWN1bGFyTWFwIiwiZ2xvc3NNYXAiLCJzaGFkb3dQYXNzIiwiU2hhZGVyUGFzcyIsImlzU2hhZG93IiwicGFzcyIsIm5lZWRzTm9ybWFsIiwiYW1iaWVudFNIIiwiaGVpZ2h0TWFwIiwiZW5hYmxlR0dYU3BlY3VsYXIiLCJjbGVhckNvYXROb3JtYWxNYXAiLCJuZWVkc1NjZW5lQ29sb3IiLCJ1c2VEeW5hbWljUmVmcmFjdGlvbiIsIm5lZWRzU2NyZWVuU2l6ZSIsIm5lZWRzVHJhbnNmb3JtcyIsInZhcnlpbmdzIiwidnNoYWRlciIsImZyb250ZW5kRGVjbCIsImZyb250ZW5kQ29kZSIsImZyb250ZW5kRnVuYyIsImxpZ2h0aW5nVXYiLCJkZWZpbmVzIiwiZnNoYWRlciIsIl92c0FkZEJhc2VDb2RlIiwiY29kZSIsImJhc2VWUyIsIm5pbmVTbGljZWRNb2RlIiwiU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VEIiwiU1BSSVRFX1JFTkRFUk1PREVfVElMRUQiLCJiYXNlTmluZVNsaWNlZFZTIiwiX3ZzQWRkVHJhbnNmb3JtQ29kZSIsInRyYW5zZm9ybVZTIiwiX3NldE1hcFRyYW5zZm9ybSIsImNvZGVzIiwibmFtZSIsImlkIiwidXYiLCJjaGVja0lkIiwidmFyTmFtZSIsIl9mc0dldEJhc2VDb2RlIiwicmVzdWx0IiwiYmFzZVBTIiwiYmFzZU5pbmVTbGljZWRQUyIsImJhc2VOaW5lU2xpY2VkVGlsZWRQUyIsIl9mc0dldFN0YXJ0Q29kZSIsInN0YXJ0UFMiLCJzdGFydE5pbmVTbGljZWRQUyIsInN0YXJ0TmluZVNsaWNlZFRpbGVkUFMiLCJfZGlyZWN0aW9uYWxTaGFkb3dNYXBQcm9qZWN0aW9uIiwibGlnaHQiLCJzaGFkb3dDb29yZEFyZ3MiLCJzaGFkb3dQYXJhbUFyZyIsImxpZ2h0SW5kZXgiLCJjb29yZHNGdW5jdGlvbk5hbWUiLCJudW1DYXNjYWRlcyIsIl9ub25Qb2ludFNoYWRvd01hcFByb2plY3Rpb24iLCJzaGFkb3dNYXRBcmciLCJfbm9ybWFsT2Zmc2V0QmlhcyIsIl9pc1ZzbSIsIl90eXBlIiwiTElHSFRUWVBFX1NQT1QiLCJfaXNQY2YiLCJ3ZWJnbDIiLCJleHRTdGFuZGFyZERlcml2YXRpdmVzIiwiX2dldExpZ2h0U291cmNlU2hhcGVTdHJpbmciLCJzaGFwZSIsIkxJR0hUU0hBUEVfUkVDVCIsIkxJR0hUU0hBUEVfRElTSyIsIkxJR0hUU0hBUEVfU1BIRVJFIiwiZ2VuZXJhdGVWZXJ0ZXhTaGFkZXIiLCJ1c2VVdiIsInVzZVVubW9kaWZpZWRVdiIsIm1hcFRyYW5zZm9ybXMiLCJjb2RlQm9keSIsIlNIQURFUl9ERVBUSCIsInVzZUluc3RhbmNpbmciLCJpbnN0YW5jZV9saW5lMSIsIlNFTUFOVElDX0FUVFIxMiIsImluc3RhbmNlX2xpbmUyIiwiU0VNQU5USUNfQVRUUjEzIiwiaW5zdGFuY2VfbGluZTMiLCJTRU1BTlRJQ19BVFRSMTQiLCJpbnN0YW5jZV9saW5lNCIsIlNFTUFOVElDX0FUVFIxNSIsImluc3RhbmNpbmdWUyIsImZyYWdtZW50VW5pZm9ybXNDb3VudCIsInZpZXdOb3JtYWxWUyIsImhhc1RhbmdlbnRzIiwibm9ybWFsTWFwIiwidGFuZ2VudEJpbm9ybWFsVlMiLCJtYXhVdlNldHMiLCJpIiwiZm9yRWFjaCIsIm1hcFRyYW5zZm9ybSIsInZlcnRleENvbG9ycyIsIm1zZGYiLCJtc2RmVGV4dEF0dHJpYnV0ZSIsInZlcnRleF9vdXRsaW5lUGFyYW1ldGVycyIsIlNFTUFOVElDX0FUVFI4IiwidmVydGV4X3NoYWRvd1BhcmFtZXRlcnMiLCJTRU1BTlRJQ19BVFRSOSIsIm1zZGZWUyIsInVzZU1vcnBoUG9zaXRpb24iLCJ1c2VNb3JwaE5vcm1hbCIsInVzZU1vcnBoVGV4dHVyZUJhc2VkIiwibW9ycGhfdmVydGV4X2lkIiwibW9ycGhfcG9zMCIsIm1vcnBoX3BvczEiLCJtb3JwaF9wb3MyIiwiU0VNQU5USUNfQVRUUjEwIiwibW9ycGhfcG9zMyIsIlNFTUFOVElDX0FUVFIxMSIsIm1vcnBoX25ybTAiLCJtb3JwaF9ucm0xIiwibW9ycGhfbnJtMiIsIm1vcnBoX25ybTMiLCJtb3JwaF9wb3M0IiwibW9ycGhfcG9zNSIsIm1vcnBoX3BvczYiLCJtb3JwaF9wb3M3IiwibW9ycGhfbnJtNCIsIm1vcnBoX25ybTUiLCJtb3JwaF9ucm02IiwibW9ycGhfbnJtNyIsInNraW4iLCJza2luQ29kZSIsInNjcmVlblNwYWNlIiwicGl4ZWxTbmFwIiwibm9ybWFsVlMiLCJzdGFydFZTIiwiZW5kVlMiLCJPYmplY3QiLCJrZXlzIiwidiIsInNoYWRlclBhc3NEZWZpbmUiLCJnZXRQYXNzU2hhZGVyRGVmaW5lIiwiX2ZzR2V0QmVnaW5Db2RlIiwiX2ZzR2V0UGlja1Bhc3NDb2RlIiwiYmVnaW4iLCJlbmQiLCJfZnNHZXREZXB0aFBhc3NDb2RlIiwicGFja0RlcHRoUFMiLCJfZnNHZXRTaGFkb3dQYXNzQ29kZSIsImxpZ2h0VHlwZSIsInRvTGlnaHRUeXBlIiwic2hhZG93VHlwZSIsInRvU2hhZG93VHlwZSIsIlNIQURPV19WU00zMiIsInRleHR1cmVGbG9hdEhpZ2hQcmVjaXNpb24iLCJTSEFET1dfVlNNMTYiLCJMSUdIVFRZUEVfRElSRUNUSU9OQUwiLCJTSEFET1dfUENGMyIsIkxJR0hUVFlQRV9PTU5JIiwiU0hBRE9XX1ZTTTgiLCJpc1ZzbSIsImFwcGx5U2xvcGVTY2FsZUJpYXMiLCJTSEFET1dfUENGNSIsInN0b3JlRVZTTVBTIiwiX2ZzR2V0TGl0UGFzc0NvZGUiLCJvcGFjaXR5RmFkZXNTcGVjdWxhciIsInB1c2giLCJjbGVhckNvYXQiLCJmcmVzbmVsTW9kZWwiLCJjb25zZXJ2ZUVuZXJneSIsInNoZWVuIiwiaXJpZGVzY2VuY2UiLCJzaGFkb3dUeXBlVXNlZCIsIm51bVNoYWRvd0xpZ2h0cyIsInNoYWRvd2VkRGlyZWN0aW9uYWxMaWdodFVzZWQiLCJ1c2VWc20iLCJ1c2VQZXJzcFpidWZmZXJTaGFkb3ciLCJoYXNBcmVhTGlnaHRzIiwic29tZSIsIl9zaGFwZSIsIkxJR0hUU0hBUEVfUFVOQ1RVQUwiLCJjbHVzdGVyZWRMaWdodGluZ0FyZWFMaWdodHNFbmFibGVkIiwiYXJlYUx1dHNQcmVjaXNpb24iLCJhcmVhTGlnaHRMdXRGb3JtYXQiLCJQSVhFTEZPUk1BVF9SOF9HOF9COF9BOCIsImxpZ2h0U2hhcGUiLCJjYXN0U2hhZG93cyIsIm5vU2hhZG93IiwiX3NoYWRvd1R5cGUiLCJfY29va2llIiwiX2N1YmVtYXAiLCJfY29va2llVHJhbnNmb3JtIiwiaGFzVEJOIiwiZmFzdFRibiIsIlRCTmZhc3RQUyIsIlRCTlBTIiwiVEJOZGVyaXZhdGl2ZVBTIiwicmVwbGFjZSIsIlRCTk9iamVjdFNwYWNlUFMiLCJzcGhlcmljYWxQUyIsImRlY29kZVBTIiwiZ2FtbWFDb2RlIiwiZ2FtbWEiLCJ0b25lbWFwQ29kZSIsInRvbmVNYXAiLCJmb2dDb2RlIiwiZm9nIiwidXNlQ3ViZU1hcFJvdGF0aW9uIiwiY3ViZU1hcFJvdGF0ZVBTIiwiY3ViZU1hcFByb2plY3Rpb24iLCJjdWJlTWFwUHJvamVjdEJveFBTIiwiY3ViZU1hcFByb2plY3ROb25lUFMiLCJza3lib3hJbnRlbnNpdHkiLCJlbnZNdWx0aXBseVBTIiwiZW52Q29uc3RQUyIsInVzZU1ldGFsbmVzcyIsIm1ldGFsbmVzc01vZHVsYXRlUFMiLCJGUkVTTkVMX1NDSExJQ0siLCJmcmVzbmVsU2NobGlja1BTIiwiaXJpZGVzY2VuY2VEaWZmcmFjdGlvblBTIiwidXNlQW8iLCJhb01hcCIsImFvVmVydGV4Q29sb3IiLCJhb0RpZmZ1c2VPY2NQUyIsIm9jY2x1ZGVTcGVjdWxhciIsIlNQRUNPQ0NfQU8iLCJvY2NsdWRlU3BlY3VsYXJGbG9hdCIsImFvU3BlY09jY1NpbXBsZVBTIiwiYW9TcGVjT2NjQ29uc3RTaW1wbGVQUyIsIlNQRUNPQ0NfR0xPU1NERVBFTkRFTlQiLCJhb1NwZWNPY2NQUyIsImFvU3BlY09jY0NvbnN0UFMiLCJmaXhTZWFtcyIsImZpeEN1YmVtYXBTZWFtc1N0cmV0Y2hQUyIsImZpeEN1YmVtYXBTZWFtc05vbmVQUyIsImVudkF0bGFzUFMiLCJyZWZsZWN0aW9uRW52SFFQUyIsIkNodW5rVXRpbHMiLCJkZWNvZGVGdW5jIiwicmVmbGVjdGlvbkVuY29kaW5nIiwicmVmbGVjdGlvbkVudlBTIiwicmVmbGVjdGlvbkN1YmVQUyIsInNjb2RlIiwicmVmbGVjdGlvblNwaGVyZVBTIiwicmVmbGVjdGlvblNwaGVyZUxvd1BTIiwicmVmbGVjdGlvbkNDUFMiLCJyZWZsZWN0aW9uU2hlZW5QUyIsInJlZnJhY3Rpb24iLCJyZWZyYWN0aW9uRHluYW1pY1BTIiwicmVmcmFjdGlvbkN1YmVQUyIsImxpZ2h0U2hlZW5QUyIsImNsdXN0ZXJlZExpZ2h0VXRpbHNQUyIsImNsdXN0ZXJlZExpZ2h0aW5nQ29va2llc0VuYWJsZWQiLCJjbHVzdGVyZWRMaWdodENvb2tpZXNQUyIsImNsdXN0ZXJlZExpZ2h0aW5nU2hhZG93c0VuYWJsZWQiLCJzaGFkb3dDYXNjYWRlc1BTIiwic2hhZG93U3RhbmRhcmRQUyIsInNoYWRvd1N0YW5kYXJkR0wyUFMiLCJzaGFkb3dWU01fY29tbW9uUFMiLCJzaGFkb3dWU004UFMiLCJleHRUZXh0dXJlSGFsZkZsb2F0TGluZWFyIiwic2hhZG93RVZTTVBTIiwic2hhZG93RVZTTW5QUyIsImV4dFRleHR1cmVGbG9hdExpbmVhciIsImJpYXNDb25zdFBTIiwic2hhZG93Q29vcmRQUyIsInNoYWRvd0NvbW1vblBTIiwic2hhZG93Q29vcmRQZXJzcFpidWZmZXJQUyIsImxpZ2h0RGlmZnVzZUxhbWJlcnRQUyIsImx0YyIsInVzZU9sZEFtYmllbnQiLCJzaGFkaW5nTW9kZWwiLCJTUEVDVUxBUl9QSE9ORyIsImxpZ2h0U3BlY3VsYXJQaG9uZ1BTIiwibGlnaHRTcGVjdWxhckFuaXNvR0dYUFMiLCJsaWdodFNwZWN1bGFyQmxpbm5QUyIsImRpZmZ1c2VNYXAiLCJjb21iaW5lUFMiLCJsaWdodE1hcCIsImxpZ2h0VmVydGV4Q29sb3IiLCJsaWdodG1hcERpckFkZFBTIiwibGlnaHRtYXBBZGRQUyIsImFkZEFtYmllbnQiLCJsaWdodE1hcFdpdGhvdXRBbWJpZW50IiwiYW1iaWVudFNvdXJjZSIsImFtYmllbnRTSFBTIiwiYW1iaWVudEVudlBTIiwiYW1iaWVudEVuY29kaW5nIiwiYW1iaWVudENvbnN0YW50UFMiLCJhbWJpZW50VGludCIsIm1zZGZQUyIsInZpZXdEaXJQUyIsInJlZmxEaXJBbmlzb1BTIiwicmVmbERpclBTIiwiaGFzUG9pbnRMaWdodHMiLCJ1c2VzTGluZWFyRmFsbG9mZiIsInVzZXNJbnZTcXVhcmVkRmFsbG9mZiIsInVzZXNTcG90IiwidXNlc0Nvb2tpZSIsInVzZXNDb29raWVOb3ciLCJmbG9hdFVucGFja2luZ1BTIiwibGlnaHRNYXNrRHluYW1pYyIsInNoYWRvd1R5cGVUb1N0cmluZyIsImNsdXN0ZXJlZExpZ2h0aW5nU2hhZG93VHlwZSIsIkxpZ2h0c0J1ZmZlciIsInNoYWRlckRlZmluZXMiLCJjbHVzdGVyZWRMaWdodFNoYWRvd3NQUyIsImNsdXN0ZXJlZExpZ2h0UFMiLCJ0d29TaWRlZExpZ2h0aW5nIiwic2VwYXJhdGVBbWJpZW50Iiwib2NjbHVkZURpcmVjdCIsInVzZVNwZWN1bGFyaXR5RmFjdG9yIiwic2hhcGVTdHJpbmciLCJfY29va2llRmFsbG9mZiIsIl9jb29raWVDaGFubmVsIiwiX2ZhbGxvZmZNb2RlIiwiTElHSFRGQUxMT0ZGX0xJTkVBUiIsInNoYWRvd1JlYWRNb2RlIiwiZXZzbUV4cCIsImNhbGNGcmVzbmVsIiwiYmxlbmRUeXBlIiwiQkxFTkRfTk9STUFMIiwiQkxFTkRfUFJFTVVMVElQTElFRCIsImVuZFBTIiwiQkxFTkRfQURESVRJVkVBTFBIQSIsImFscGhhVG9Db3ZlcmFnZSIsIm91dHB1dEFscGhhUFMiLCJvdXRwdXRBbHBoYVByZW11bFBTIiwib3V0cHV0QWxwaGFPcGFxdWVQUyIsImxpZ2h0RGlyUG9pbnRQUyIsImZhbGxvZmZMaW5lYXJQUyIsImZhbGxvZmZJbnZTcXVhcmVkUFMiLCJzcG90UFMiLCJjb29raWVQUyIsInN0cnVjdENvZGUiLCJpbmNsdWRlcyIsImRldGFpbE1vZGVzIiwiZGV0YWlsTW9kZXNQUyIsImdlbmVyYXRlRnJhZ21lbnRTaGFkZXIiLCJTSEFERVJfUElDSyIsImN1c3RvbUZyYWdtZW50U2hhZGVyIiwiZ2V0RGVmaW5pdGlvbiIsImRlZmluaXRpb24iLCJTaGFkZXJVdGlscyIsImNyZWF0ZURlZmluaXRpb24iLCJ2ZXJ0ZXhDb2RlIiwiZnJhZ21lbnRDb2RlIiwiaXNGb3J3YXJkIiwidGFnIiwiU0hBREVSVEFHX01BVEVSSUFMIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7QUE2QkEsTUFB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
