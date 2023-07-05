import { SEMANTIC_POSITION, SEMANTIC_ATTR12, SEMANTIC_ATTR13, SEMANTIC_ATTR14, SEMANTIC_ATTR15, SEMANTIC_NORMAL, SEMANTIC_TANGENT, SEMANTIC_COLOR, SEMANTIC_ATTR8, SEMANTIC_ATTR9, SEMANTIC_ATTR10, SEMANTIC_ATTR11, SEMANTIC_BLENDWEIGHT, SEMANTIC_BLENDINDICES, PIXELFORMAT_RGBA8, SHADERTAG_MATERIAL, SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD1 } from '../../../platform/graphics/constants.js';
import { shaderChunks } from '../chunks/chunks.js';
import { ChunkUtils } from '../chunk-utils.js';
import { SPRITE_RENDERMODE_SLICED, SPRITE_RENDERMODE_TILED, LIGHTSHAPE_SPHERE, LIGHTSHAPE_DISK, LIGHTSHAPE_RECT, SHADER_DEPTH, SHADOW_VSM32, SHADOW_PCF1, SHADOW_PCF3, SHADOW_PCSS, LIGHTTYPE_OMNI, SHADOW_VSM8, LIGHTSHAPE_PUNCTUAL, LIGHTTYPE_DIRECTIONAL, LIGHTTYPE_SPOT, FRESNEL_SCHLICK, SPECOCC_GLOSSDEPENDENT, SPECOCC_AO, SHADOW_PCF5, SHADOW_VSM16, SPECULAR_PHONG, shadowTypeToString, LIGHTFALLOFF_LINEAR, BLEND_NORMAL, BLEND_PREMULTIPLIED, BLEND_ADDITIVEALPHA, SHADER_PICK } from '../../constants.js';
import { LightsBuffer } from '../../lighting/lights-buffer.js';
import { ShaderPass } from '../../shader-pass.js';
import { skinCode, begin, end, gammaCode, tonemapCode, fogCode } from './common.js';
import '../../../core/debug.js';
import { ShaderUtils } from '../../../platform/graphics/shader-utils.js';
import { ChunkBuilder } from '../chunk-builder.js';

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
		this.shaderPassInfo = ShaderPass.get(this.device).getByIndex(options.pass);
		this.shadowPass = this.shaderPassInfo.isShadow;
		this.lighting = options.lights.length > 0 || options.dirLightMapEnabled || options.clusteredLightingEnabled;
		this.reflections = !!options.reflectionSource;
		this.needsNormal = this.lighting || this.reflections || options.useSpecular || options.ambientSH || options.heightMapEnabled || options.enableGGXSpecular || options.clusteredLightingEnabled && !this.shadowPass || options.clearCoatNormalMapEnabled;
		this.needsNormal = this.needsNormal && !this.shadowPass;
		this.needsSceneColor = options.useDynamicRefraction;
		this.needsScreenSize = options.useDynamicRefraction;
		this.needsTransforms = options.useDynamicRefraction;
		this.varyings = "";
		this.varyingDefines = "";
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
				codeBody += "   vObjectSpaceUpW = normalize(dNormalMatrix * vec3(0, 1, 0));\n";
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
				const morphIdType = device.isWebGPU ? 'uint' : 'float';
				code += `attribute ${morphIdType} morph_vertex_id;\n`;
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
				this.varyingDefines += `#define VARYING_${v.toUpperCase()}\n`;
			}
		});
		const shaderPassDefines = this.shaderPassInfo.shaderDefines;
		this.vshader = shaderPassDefines + this.varyings + code;
	}
	_fsGetBeginCode() {
		let code = this.shaderPassInfo.shaderDefines;
		for (let i = 0; i < this.defines.length; i++) {
			code += `#define ${this.defines[i]}\n`;
		}
		return code;
	}
	_fsGetPickPassCode() {
		let code = this._fsGetBeginCode();
		code += "uniform vec4 uColor;\n";
		code += this.varyings;
		code += this.varyingDefines;
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
		code += this.varyingDefines;
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
		const lightType = this.shaderPassInfo.lightType;
		const shadowType = this.shaderPassInfo.shadowType;
		let code = this._fsGetBeginCode();
		if (device.extStandardDerivatives && !device.webgl2 && !device.isWebGPU) {
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
		code += this.varyingDefines;
		code += this.frontendDecl;
		code += this.frontendCode;
		const usePackedDepth = !device.supportsDepthShadow && (shadowType === SHADOW_PCF1 || shadowType === SHADOW_PCF3 || shadowType === SHADOW_PCSS) || lightType === LIGHTTYPE_OMNI && shadowType !== SHADOW_PCSS && !options.clusteredLightingEnabled;
		if (usePackedDepth) {
			code += chunks.packDepthPS;
		} else if (shadowType === SHADOW_VSM8) {
			code += "vec2 encodeFloatRG( float v ) {\n";
			code += "    vec2 enc = vec2(1.0, 255.0) * v;\n";
			code += "    enc = fract(enc);\n";
			code += "    enc -= enc.yy * vec2(1.0/255.0, 1.0/255.0);\n";
			code += "    return enc;\n";
			code += "}\n\n";
		}
		if (shadowType === SHADOW_PCSS) {
			code += shaderChunks.linearizeDepthPS;
		}
		code += begin();
		code += this.frontendFunc;
		const isVsm = shadowType === SHADOW_VSM8 || shadowType === SHADOW_VSM16 || shadowType === SHADOW_VSM32;
		const applySlopeScaleBias = !device.webgl2 && device.extStandardDerivatives && !device.isWebGPU;
		const customDepth = isVsm && lightType !== LIGHTTYPE_DIRECTIONAL || lightType === LIGHTTYPE_OMNI;
		if (customDepth) {
			code += "    float depth = min(distance(view_position, vPositionW) / light_radius, 0.99999);\n";
		} else if (shadowType === SHADOW_PCSS) {
			code += "    float depth = linearizeDepth(gl_FragCoord.z, camera_params);\n";
			if (usePackedDepth) {
				code += "    depth *= 1.0 / (camera_params.y - camera_params.z);\n";
			}
		} else {
			code += "    float depth = gl_FragCoord.z;\n";
		}
		if (applySlopeScaleBias) {
			code += "    float minValue = 2.3374370500153186e-10; //(1.0 / 255.0) / (256.0 * 256.0 * 256.0);\n";
			code += "    depth += polygonOffset.x * max(abs(dFdx(depth)), abs(dFdy(depth))) + minValue * polygonOffset.y;\n";
		}
		if (usePackedDepth) {
			code += "    gl_FragColor = packFloat(depth);\n";
		} else if (!isVsm) {
			code += "    gl_FragColor = vec4(1.0);\n";
			if (shadowType === SHADOW_PCSS || lightType === LIGHTTYPE_OMNI && !options.clusteredLightingEnabled) {
				code += "   gl_FragColor.r = depth;\n";
			} else if (options.clusteredLightingEnabled && lightType === LIGHTTYPE_OMNI && device.supportsDepthShadow) {
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
		const decl = new ChunkBuilder();
		const func = new ChunkBuilder();
		const backend = new ChunkBuilder();
		const code = new ChunkBuilder();
		if (options.opacityFadesSpecular === false) {
			decl.append('uniform float material_alphaFade;');
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
		let usePcss = false;
		let hasAreaLights = options.lights.some(function (light) {
			return light._shape && light._shape !== LIGHTSHAPE_PUNCTUAL;
		});
		if (options.clusteredLightingEnabled && options.clusteredLightingAreaLightsEnabled) {
			hasAreaLights = true;
		}
		let areaLutsPrecision = 'highp';
		if (device.areaLightLutFormat === PIXELFORMAT_RGBA8) {
			decl.append("#define AREA_R8_G8_B8_A8_LUTS");
			areaLutsPrecision = 'lowp';
		}
		if (hasAreaLights || options.clusteredLightingEnabled) {
			decl.append("#define AREA_LIGHTS");
			decl.append(`uniform ${areaLutsPrecision} sampler2D areaLightsLutTex1;`);
			decl.append(`uniform ${areaLutsPrecision} sampler2D areaLightsLutTex2;`);
		}
		for (let i = 0; i < options.lights.length; i++) {
			const light = options.lights[i];
			const lightType = light._type;
			if (options.clusteredLightingEnabled && lightType !== LIGHTTYPE_DIRECTIONAL) continue;
			const lightShape = hasAreaLights && light._shape ? light._shape : LIGHTSHAPE_PUNCTUAL;
			decl.append("uniform vec3 light" + i + "_color;");
			if (light._shadowType === SHADOW_PCSS && light.castShadows && !options.noShadow) {
				decl.append(`uniform float light${i}_shadowSearchArea;`);
				decl.append(`uniform vec4 light${i}_cameraParams;`);
			}
			if (lightType === LIGHTTYPE_DIRECTIONAL) {
				decl.append("uniform vec3 light" + i + "_direction;");
			} else {
				decl.append("uniform vec3 light" + i + "_position;");
				decl.append("uniform float light" + i + "_radius;");
				if (lightType === LIGHTTYPE_SPOT) {
					decl.append("uniform vec3 light" + i + "_direction;");
					decl.append("uniform float light" + i + "_innerConeAngle;");
					decl.append("uniform float light" + i + "_outerConeAngle;");
				}
			}
			if (lightShape !== LIGHTSHAPE_PUNCTUAL) {
				if (lightType === LIGHTTYPE_DIRECTIONAL) {
					decl.append("uniform vec3 light" + i + "_position;");
				}
				decl.append("uniform vec3 light" + i + "_halfWidth;");
				decl.append("uniform vec3 light" + i + "_halfHeight;");
			}
			if (light.castShadows && !options.noShadow) {
				decl.append("uniform mat4 light" + i + "_shadowMatrix;");
				decl.append("uniform float light" + i + "_shadowIntensity;");
				if (lightType === LIGHTTYPE_DIRECTIONAL) {
					decl.append("uniform mat4 light" + i + "_shadowMatrixPalette[4];");
					decl.append("uniform float light" + i + "_shadowCascadeDistances[4];");
					decl.append("uniform float light" + i + "_shadowCascadeCount;");
				}
				decl.append("uniform vec4 light" + i + "_shadowParams;");
				if (lightType === LIGHTTYPE_DIRECTIONAL) {
					shadowedDirectionalLightUsed = true;
				}
				if (lightType === LIGHTTYPE_OMNI) {
					decl.append("uniform samplerCube light" + i + "_shadowMap;");
				} else {
					if (light._isPcf && device.supportsDepthShadow) {
						decl.append("uniform sampler2DShadow light" + i + "_shadowMap;");
					} else {
						decl.append("uniform sampler2D light" + i + "_shadowMap;");
					}
				}
				numShadowLights++;
				shadowTypeUsed[light._shadowType] = true;
				if (light._isVsm) useVsm = true;
				if (light._shadowType === SHADOW_PCSS) usePcss = true;
			}
			if (light._cookie) {
				if (light._cookie._cubemap) {
					if (lightType === LIGHTTYPE_OMNI) {
						decl.append("uniform samplerCube light" + i + "_cookie;");
						decl.append("uniform float light" + i + "_cookieIntensity;");
						if (!light.castShadows || options.noShadow) {
							decl.append("uniform mat4 light" + i + "_shadowMatrix;");
						}
					}
				} else {
					if (lightType === LIGHTTYPE_SPOT) {
						decl.append("uniform sampler2D light" + i + "_cookie;");
						decl.append("uniform float light" + i + "_cookieIntensity;");
						if (!light.castShadows || options.noShadow) {
							decl.append("uniform mat4 light" + i + "_shadowMatrix;");
						}
						if (light._cookieTransform) {
							decl.append("uniform vec4 light" + i + "_cookieMatrix;");
							decl.append("uniform vec2 light" + i + "_cookieOffset;");
						}
					}
				}
			}
		}
		const hasTBN = this.needsNormal && (options.normalMapEnabled || options.clearCoatNormalMapEnabled || options.enableGGXSpecular && !options.heightMapEnabled);
		if (hasTBN) {
			if (options.hasTangents) {
				func.append(options.fastTbn ? chunks.TBNfastPS : chunks.TBNPS);
			} else {
				if (device.extStandardDerivatives && (options.normalMapEnabled || options.clearCoatNormalMapEnabled)) {
					func.append(chunks.TBNderivativePS.replace(/\$UV/g, this.lightingUv));
				} else {
					func.append(chunks.TBNObjectSpacePS);
				}
			}
		}
		func.append(chunks.sphericalPS);
		func.append(chunks.decodePS);
		func.append(gammaCode(options.gamma, chunks));
		func.append(tonemapCode(options.toneMap, chunks));
		func.append(fogCode(options.fog, chunks));
		func.append(this.frontendCode);
		if (options.useCubeMapRotation) {
			decl.append("#define CUBEMAP_ROTATION");
		}
		if (this.needsNormal) {
			func.append(chunks.cubeMapRotatePS);
			func.append(options.cubeMapProjection > 0 ? chunks.cubeMapProjectBoxPS : chunks.cubeMapProjectNonePS);
			func.append(options.skyboxIntensity ? chunks.envMultiplyPS : chunks.envConstPS);
		}
		if (this.lighting && options.useSpecular || this.reflections) {
			if (options.useMetalness) {
				func.append(chunks.metalnessModulatePS);
			}
			if (options.fresnelModel === FRESNEL_SCHLICK) {
				func.append(chunks.fresnelSchlickPS);
			}
			if (options.useIridescence) {
				func.append(chunks.iridescenceDiffractionPS);
			}
		}
		const useAo = options.aoMapEnabled || options.useAoVertexColors;
		if (useAo) {
			func.append(chunks.aoDiffuseOccPS);
			switch (options.occludeSpecular) {
				case SPECOCC_AO:
					func.append(options.occludeSpecularFloat ? chunks.aoSpecOccSimplePS : chunks.aoSpecOccConstSimplePS);
					break;
				case SPECOCC_GLOSSDEPENDENT:
					func.append(options.occludeSpecularFloat ? chunks.aoSpecOccPS : chunks.aoSpecOccConstPS);
					break;
			}
		}
		if (options.reflectionSource === 'envAtlasHQ') {
			func.append(options.fixSeams ? chunks.fixCubemapSeamsStretchPS : chunks.fixCubemapSeamsNonePS);
			func.append(chunks.envAtlasPS);
			func.append(chunks.reflectionEnvHQPS.replace(/\$DECODE_CUBEMAP/g, ChunkUtils.decodeFunc(options.reflectionCubemapEncoding)).replace(/\$DECODE/g, ChunkUtils.decodeFunc(options.reflectionEncoding)));
		} else if (options.reflectionSource === 'envAtlas') {
			func.append(chunks.envAtlasPS);
			func.append(chunks.reflectionEnvPS.replace(/\$DECODE/g, ChunkUtils.decodeFunc(options.reflectionEncoding)));
		} else if (options.reflectionSource === 'cubeMap') {
			func.append(options.fixSeams ? chunks.fixCubemapSeamsStretchPS : chunks.fixCubemapSeamsNonePS);
			func.append(chunks.reflectionCubePS.replace(/\$DECODE/g, ChunkUtils.decodeFunc(options.reflectionEncoding)));
		} else if (options.reflectionSource === 'sphereMap') {
			const scode = device.fragmentUniformsCount > 16 ? chunks.reflectionSpherePS : chunks.reflectionSphereLowPS;
			func.append(scode.replace(/\$DECODE/g, ChunkUtils.decodeFunc(options.reflectionEncoding)));
		}
		if (this.reflections) {
			if (options.useClearCoat) {
				func.append(chunks.reflectionCCPS);
			}
			if (options.useSheen) {
				func.append(chunks.reflectionSheenPS);
			}
		}
		if (options.useRefraction) {
			if (options.useDynamicRefraction) {
				func.append(chunks.refractionDynamicPS);
			} else if (this.reflections) {
				func.append(chunks.refractionCubePS);
			}
		}
		if (options.useSheen) {
			func.append(chunks.lightSheenPS);
		}
		if (options.clusteredLightingEnabled) {
			func.append(chunks.clusteredLightUtilsPS);
			if (options.clusteredLightingCookiesEnabled) func.append(chunks.clusteredLightCookiesPS);
			if (options.clusteredLightingShadowsEnabled && !options.noShadow) {
				shadowTypeUsed[SHADOW_PCF3] = true;
				shadowTypeUsed[SHADOW_PCF5] = true;
				shadowTypeUsed[SHADOW_PCSS] = true;
			}
		}
		if (numShadowLights > 0 || options.clusteredLightingEnabled) {
			if (shadowedDirectionalLightUsed) {
				func.append(chunks.shadowCascadesPS);
			}
			if (shadowTypeUsed[SHADOW_PCF1] || shadowTypeUsed[SHADOW_PCF3]) {
				func.append(chunks.shadowStandardPS);
			}
			if (shadowTypeUsed[SHADOW_PCF5] && (device.webgl2 || device.isWebGPU)) {
				func.append(chunks.shadowStandardGL2PS);
			}
			if (useVsm) {
				func.append(chunks.shadowVSM_commonPS);
				if (shadowTypeUsed[SHADOW_VSM8]) {
					func.append(chunks.shadowVSM8PS);
				}
				if (shadowTypeUsed[SHADOW_VSM16]) {
					func.append(device.extTextureHalfFloatLinear ? chunks.shadowEVSMPS.replace(/\$/g, "16") : chunks.shadowEVSMnPS.replace(/\$/g, "16"));
				}
				if (shadowTypeUsed[SHADOW_VSM32]) {
					func.append(device.extTextureFloatLinear ? chunks.shadowEVSMPS.replace(/\$/g, "32") : chunks.shadowEVSMnPS.replace(/\$/g, "32"));
				}
			}
			if (usePcss) {
				func.append(chunks.linearizeDepthPS);
				func.append(chunks.shadowPCSSPS);
			}
			if (!(device.webgl2 || device.extStandardDerivatives || device.isWebGPU)) {
				func.append(chunks.biasConstPS);
			}
		}
		if (options.enableGGXSpecular) func.append("uniform float material_anisotropy;");
		if (this.lighting) {
			func.append(chunks.lightDiffuseLambertPS);
			if (hasAreaLights || options.clusteredLightingAreaLightsEnabled) {
				func.append(chunks.ltcPS);
			}
		}
		let useOldAmbient = false;
		if (options.useSpecular) {
			if (this.lighting) {
				func.append(options.shadingModel === SPECULAR_PHONG ? chunks.lightSpecularPhongPS : options.enableGGXSpecular ? chunks.lightSpecularAnisoGGXPS : chunks.lightSpecularBlinnPS);
			}
			if (!options.fresnelModel && !this.reflections && !options.diffuseMapEnabled) {
				decl.append("uniform vec3 material_ambient;");
				decl.append("#define LIT_OLD_AMBIENT");
				useOldAmbient = true;
			}
		}
		func.append(chunks.combinePS);
		if (options.lightMapEnabled || options.useLightMapVertexColors) {
			func.append(options.useSpecular && options.dirLightMapEnabled ? chunks.lightmapDirAddPS : chunks.lightmapAddPS);
		}
		const addAmbient = !options.lightMapEnabled && !options.useLightMapVertexColors || options.lightMapWithoutAmbient;
		if (addAmbient) {
			if (options.ambientSource === 'ambientSH') {
				func.append(chunks.ambientSHPS);
			} else if (options.ambientSource === 'envAtlas') {
				if (options.reflectionSource !== 'envAtlas' && options.reflectionSource !== 'envAtlasHQ') {
					func.append(chunks.envAtlasPS);
				}
				func.append(chunks.ambientEnvPS.replace(/\$DECODE/g, ChunkUtils.decodeFunc(options.ambientEncoding)));
			} else {
				func.append(chunks.ambientConstantPS);
			}
		}
		if (options.useAmbientTint && !useOldAmbient) {
			decl.append("uniform vec3 material_ambient;");
		}
		if (options.useMsdf) {
			if (!options.msdfTextAttribute) {
				decl.append("#define UNIFORM_TEXT_PARAMETERS");
			}
			func.append(chunks.msdfPS);
		}
		if (this.needsNormal) {
			func.append(chunks.viewDirPS);
			if (options.useSpecular) {
				func.append(options.enableGGXSpecular ? chunks.reflDirAnisoPS : chunks.reflDirPS);
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
			func.append(chunks.floatUnpackingPS);
			if (options.lightMaskDynamic) decl.append("#define CLUSTER_MESH_DYNAMIC_LIGHTS");
			if (options.clusteredLightingCookiesEnabled) decl.append("#define CLUSTER_COOKIES");
			if (options.clusteredLightingShadowsEnabled && !options.noShadow) {
				decl.append("#define CLUSTER_SHADOWS");
				decl.append("#define CLUSTER_SHADOW_TYPE_" + shadowTypeToString[options.clusteredLightingShadowType]);
			}
			if (options.clusteredLightingAreaLightsEnabled) decl.append("#define CLUSTER_AREALIGHTS");
			decl.append(LightsBuffer.shaderDefines);
			if (options.clusteredLightingShadowsEnabled && !options.noShadow) {
				func.append(chunks.clusteredLightShadowsPS);
			}
			func.append(chunks.clusteredLightPS);
		}
		if (options.twoSidedLighting) {
			decl.append("uniform float twoSidedLightingNegScaleFactor;");
		}
		code.append(this._fsGetStartCode(code, device, chunks, options));
		if (this.needsNormal) {
			if (options.twoSidedLighting) {
				code.append("    dVertexNormalW = normalize(gl_FrontFacing ? vNormalW * twoSidedLightingNegScaleFactor : -vNormalW * twoSidedLightingNegScaleFactor);");
			} else {
				code.append("    dVertexNormalW = normalize(vNormalW);");
			}
			if ((options.heightMapEnabled || options.normalMapEnabled) && options.hasTangents) {
				if (options.twoSidedLighting) {
					code.append("    dTangentW = gl_FrontFacing ? vTangentW * twoSidedLightingNegScaleFactor : -vTangentW * twoSidedLightingNegScaleFactor;");
					code.append("    dBinormalW = gl_FrontFacing ? vBinormalW * twoSidedLightingNegScaleFactor : -vBinormalW * twoSidedLightingNegScaleFactor;");
				} else {
					code.append("    dTangentW = vTangentW;");
					code.append("    dBinormalW = vBinormalW;");
				}
			}
			code.append("    getViewDir();");
			if (hasTBN) {
				code.append("    getTBN(dTangentW, dBinormalW, dVertexNormalW);");
			}
		}
		code.append(this.frontendFunc);
		if (this.needsNormal) {
			if (options.useSpecular) {
				backend.append("    getReflDir(litShaderArgs.worldNormal, dViewDirW, litShaderArgs.gloss, dTBN);");
			}
			if (options.useClearCoat) {
				backend.append("    ccReflDirW = normalize(-reflect(dViewDirW, litShaderArgs.clearcoat.worldNormal));");
			}
		}
		if (this.lighting && options.useSpecular || this.reflections) {
			if (options.useMetalness) {
				backend.append("    getMetalnessModulate(litShaderArgs);");
			}
			if (options.useIridescence) {
				backend.append("    vec3 iridescenceFresnel = getIridescence(saturate(dot(dViewDirW, litShaderArgs.worldNormal)), litShaderArgs.specularity, litShaderArgs.iridescence);");
			}
		}
		if (addAmbient) {
			backend.append("    addAmbient(litShaderArgs.worldNormal);");
			if (options.conserveEnergy && options.useSpecular) {
				backend.append(`   dDiffuseLight = dDiffuseLight * (1.0 - litShaderArgs.specularity);`);
			}
			if (options.separateAmbient) {
				backend.append(`
										vec3 dAmbientLight = dDiffuseLight;
										dDiffuseLight = vec3(0);
								`);
			}
		}
		if (options.useAmbientTint && !useOldAmbient) {
			backend.append("    dDiffuseLight *= material_ambient;");
		}
		if (useAo && !options.occludeDirect) {
			backend.append("    occludeDiffuse(litShaderArgs.ao);");
		}
		if (options.lightMapEnabled || options.useLightMapVertexColors) {
			backend.append(`    addLightMap(
								litShaderArgs.lightmap, 
								litShaderArgs.lightmapDir, 
								litShaderArgs.worldNormal, 
								dViewDirW, 
								dReflDirW, 
								litShaderArgs.gloss, 
								litShaderArgs.specularity, 
								dVertexNormalW,
								dTBN
						#if defined(LIT_IRIDESCENCE)
								, iridescenceFresnel,
								litShaderArgs.iridescence
						#endif
								);`);
		}
		if (this.lighting || this.reflections) {
			if (this.reflections) {
				if (options.useClearCoat) {
					backend.append("    addReflectionCC(ccReflDirW, litShaderArgs.clearcoat.gloss);");
					if (options.fresnelModel > 0) {
						backend.append("    ccFresnel = getFresnelCC(dot(dViewDirW, litShaderArgs.clearcoat.worldNormal));");
						backend.append("    ccReflection.rgb *= ccFresnel;");
					} else {
						backend.append("    ccFresnel = 0.0;");
					}
				}
				if (options.useSpecularityFactor) {
					backend.append("    ccReflection.rgb *= litShaderArgs.specularityFactor;");
				}
				if (options.useSheen) {
					backend.append("    addReflectionSheen(litShaderArgs.worldNormal, dViewDirW, litShaderArgs.sheen.gloss);");
				}
				backend.append("    addReflection(dReflDirW, litShaderArgs.gloss);");
				if (options.fresnelModel > 0) {
					backend.append(`    dReflection.rgb *= 
												getFresnel(
														dot(dViewDirW, litShaderArgs.worldNormal), 
														litShaderArgs.gloss, 
														litShaderArgs.specularity
												#if defined(LIT_IRIDESCENCE)
														, iridescenceFresnel,
														litShaderArgs.iridescence
												#endif
														);`);
				} else {
					backend.append("    dReflection.rgb *= litShaderArgs.specularity;");
				}
				if (options.useSpecularityFactor) {
					backend.append("    dReflection.rgb *= litShaderArgs.specularityFactor;");
				}
			}
			if (hasAreaLights) {
				backend.append("    dSpecularLight *= litShaderArgs.specularity;");
				if (options.useSpecular) {
					backend.append("    calcLTCLightValues(litShaderArgs.gloss, litShaderArgs.worldNormal, dViewDirW, litShaderArgs.specularity, litShaderArgs.clearcoat.gloss, litShaderArgs.clearcoat.worldNormal, litShaderArgs.clearcoat.specularity);");
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
					backend.append("    calc" + shapeString + "LightValues(light" + i + "_position, light" + i + "_halfWidth, light" + i + "_halfHeight);");
				}
				if (lightType === LIGHTTYPE_DIRECTIONAL) {
					backend.append("    dLightDirNormW = light" + i + "_direction;");
					backend.append("    dAtten = 1.0;");
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
					backend.append("    getLightDirPoint(light" + i + "_position);");
					hasPointLights = true;
					if (usesCookieNow) {
						if (lightType === LIGHTTYPE_SPOT) {
							backend.append("    dAtten3 = getCookie2D" + (light._cookieFalloff ? "" : "Clip") + (light._cookieTransform ? "Xform" : "") + "(light" + i + "_cookie, light" + i + "_shadowMatrix, light" + i + "_cookieIntensity" + (light._cookieTransform ? ", light" + i + "_cookieMatrix, light" + i + "_cookieOffset" : "") + ")." + light._cookieChannel + ";");
						} else {
							backend.append("    dAtten3 = getCookieCube(light" + i + "_cookie, light" + i + "_shadowMatrix, light" + i + "_cookieIntensity)." + light._cookieChannel + ";");
						}
					}
					if (lightShape === LIGHTSHAPE_PUNCTUAL) {
						if (light._falloffMode === LIGHTFALLOFF_LINEAR) {
							backend.append("    dAtten = getFalloffLinear(light" + i + "_radius, dLightDirW);");
							usesLinearFalloff = true;
						} else {
							backend.append("    dAtten = getFalloffInvSquared(light" + i + "_radius, dLightDirW);");
							usesInvSquaredFalloff = true;
						}
					} else {
						backend.append("    dAtten = getFalloffWindow(light" + i + "_radius, dLightDirW);");
						usesInvSquaredFalloff = true;
					}
					backend.append("    if (dAtten > 0.00001) {");
					if (lightType === LIGHTTYPE_SPOT) {
						if (!(usesCookieNow && !light._cookieFalloff)) {
							backend.append("    dAtten *= getSpotEffect(light" + i + "_direction, light" + i + "_innerConeAngle, light" + i + "_outerConeAngle, dLightDirNormW);");
							usesSpot = true;
						}
					}
				}
				if (lightShape !== LIGHTSHAPE_PUNCTUAL) {
					if (lightType === LIGHTTYPE_DIRECTIONAL) {
						backend.append("    dAttenD = getLightDiffuse(litShaderArgs.worldNormal, dViewDirW, dLightDirW, dLightDirNormW);");
					} else {
						backend.append("    dAttenD = get" + shapeString + "LightDiffuse(litShaderArgs.worldNormal, dViewDirW, dLightDirW, dLightDirNormW) * 16.0;");
					}
				} else {
					backend.append("    dAtten *= getLightDiffuse(litShaderArgs.worldNormal, dViewDirW, dLightDirW, dLightDirNormW);");
				}
				if (light.castShadows && !options.noShadow) {
					const pcssShadows = light._shadowType === SHADOW_PCSS;
					const vsmShadows = light._shadowType === SHADOW_VSM8 || light._shadowType === SHADOW_VSM16 || light._shadowType === SHADOW_VSM32;
					const pcfShadows = light._shadowType === SHADOW_PCF1 || light._shadowType === SHADOW_PCF3 || light._shadowType === SHADOW_PCF5;
					let shadowReadMode = null;
					let evsmExp;
					switch (light._shadowType) {
						case SHADOW_VSM8:
							shadowReadMode = "VSM8";
							evsmExp = "0.0";
							break;
						case SHADOW_VSM16:
							shadowReadMode = "VSM16";
							evsmExp = "5.54";
							break;
						case SHADOW_VSM32:
							shadowReadMode = "VSM32";
							if (device.textureFloatHighPrecision) {
								evsmExp = "15.0";
							} else {
								evsmExp = "5.54";
							}
							break;
						case SHADOW_PCF1:
							shadowReadMode = "PCF1x1";
							break;
						case SHADOW_PCF5:
							shadowReadMode = "PCF5x5";
							break;
						case SHADOW_PCSS:
							shadowReadMode = "PCSS";
							break;
						case SHADOW_PCF3:
						default:
							shadowReadMode = "PCF3x3";
							break;
					}
					if (shadowReadMode !== null) {
						if (light._normalOffsetBias && !light._isVsm) {
							func.append("#define SHADOW_SAMPLE_NORMAL_OFFSET");
						}
						if (lightType === LIGHTTYPE_DIRECTIONAL) {
							func.append("#define SHADOW_SAMPLE_ORTHO");
						}
						if ((pcfShadows || pcssShadows) && device.webgl2 || device.extStandardDerivatives || device.isWebGPU) {
							func.append("#define SHADOW_SAMPLE_SOURCE_ZBUFFER");
						}
						if (lightType === LIGHTTYPE_OMNI) {
							func.append("#define SHADOW_SAMPLE_POINT");
						}
						const coordCode = chunks.shadowSampleCoordPS;
						func.append(coordCode.replace("$LIGHT", i));
						func.append("#undef SHADOW_SAMPLE_NORMAL_OFFSET");
						func.append("#undef SHADOW_SAMPLE_ORTHO");
						func.append("#undef SHADOW_SAMPLE_SOURCE_ZBUFFER");
						func.append("#undef SHADOW_SAMPLE_POINT");
						let shadowMatrix = `light${i}_shadowMatrix`;
						if (lightType === LIGHTTYPE_DIRECTIONAL && light.numCascades > 1) {
							backend.append(`    getShadowCascadeMatrix(light${i}_shadowMatrixPalette, light${i}_shadowCascadeDistances, light${i}_shadowCascadeCount);`);
							shadowMatrix = `cascadeShadowMat`;
						}
						backend.append(`    dShadowCoord = getShadowSampleCoord${i}(${shadowMatrix}, light${i}_shadowParams, vPositionW, dLightPosW, dLightDirW, dLightDirNormW, dVertexNormalW);`);
						if (lightType === LIGHTTYPE_DIRECTIONAL) {
							backend.append(`    fadeShadow(light${i}_shadowCascadeDistances);`);
						}
						var shadowCoordArgs = `SHADOWMAP_PASS(light${i}_shadowMap), dShadowCoord, light${i}_shadowParams`;
						if (vsmShadows) {
							shadowCoordArgs = `${shadowCoordArgs}, ${evsmExp}, dLightDirW`;
						} else if (pcssShadows) {
							let penumbraSizeArg = `vec2(light${i}_shadowSearchArea)`;
							if (lightShape !== LIGHTSHAPE_PUNCTUAL) {
								penumbraSizeArg = `vec2(length(light${i}_halfWidth), length(light${i}_halfHeight)) * light${i}_shadowSearchArea`;
							}
							shadowCoordArgs = `${shadowCoordArgs}, light${i}_cameraParams, ${penumbraSizeArg}, dLightDirW`;
						}
						if (lightType === LIGHTTYPE_OMNI) {
							shadowReadMode = `Point${shadowReadMode}`;
							if (!pcssShadows) {
								shadowCoordArgs = `${shadowCoordArgs}, dLightDirW`;
							}
						} else if (lightType === LIGHTTYPE_SPOT) {
							shadowReadMode = `Spot${shadowReadMode}`;
						}
						backend.append(`    float shadow${i} = getShadow${shadowReadMode}(${shadowCoordArgs});`);
						backend.append(`    dAtten *= mix(1.0, shadow${i}, light${i}_shadowIntensity);`);
					}
				}
				if (lightShape !== LIGHTSHAPE_PUNCTUAL) {
					if (options.conserveEnergy && options.useSpecular) {
						backend.append("    dDiffuseLight += ((dAttenD * dAtten) * light" + i + "_color" + (usesCookieNow ? " * dAtten3" : "") + ") * (1.0 - dLTCSpecFres);");
					} else {
						backend.append("    dDiffuseLight += (dAttenD * dAtten) * light" + i + "_color" + (usesCookieNow ? " * dAtten3" : "") + ";");
					}
				} else {
					if (hasAreaLights && options.conserveEnergy && options.useSpecular) {
						backend.append("    dDiffuseLight += (dAtten * light" + i + "_color" + (usesCookieNow ? " * dAtten3" : "") + ") * (1.0 - litShaderArgs.specularity);");
					} else {
						backend.append("    dDiffuseLight += dAtten * light" + i + "_color" + (usesCookieNow ? " * dAtten3" : "") + ";");
					}
				}
				if (options.useSpecular) {
					backend.append("    dHalfDirW = normalize(-dLightDirNormW + dViewDirW);");
				}
				if (light.affectSpecularity) {
					if (lightShape !== LIGHTSHAPE_PUNCTUAL) {
						if (options.useClearCoat) {
							backend.append(`    ccSpecularLight += ccLTCSpecFres * get${shapeString}LightSpecular(litShaderArgs.clearcoat.worldNormal, dViewDirW) * dAtten * light${i}_color` + (usesCookieNow ? " * dAtten3" : "") + ";");
						}
						if (options.useSpecular) {
							backend.append(`    dSpecularLight += dLTCSpecFres * get${shapeString}LightSpecular(litShaderArgs.worldNormal, dViewDirW) * dAtten * light${i}_color` + (usesCookieNow ? " * dAtten3" : "") + ";");
						}
					} else {
						var calcFresnel = false;
						if (lightType === LIGHTTYPE_DIRECTIONAL && options.fresnelModel > 0) {
							calcFresnel = true;
						}
						if (options.useClearCoat) {
							backend.append(`    ccSpecularLight += getLightSpecular(dHalfDirW, ccReflDirW, litShaderArgs.clearcoat.worldNormal, dViewDirW, dLightDirNormW, litShaderArgs.clearcoat.gloss, dTBN) * dAtten * light${i}_color` + (usesCookieNow ? " * dAtten3" : "") + (calcFresnel ? " * getFresnelCC(dot(dViewDirW, dHalfDirW));" : ";"));
						}
						if (options.useSheen) {
							backend.append(`    sSpecularLight += getLightSpecularSheen(dHalfDirW, litShaderArgs.worldNormal, dViewDirW, dLightDirNormW, litShaderArgs.sheen.gloss) * dAtten * light${i}_color` + (usesCookieNow ? " * dAtten3;" : ";"));
						}
						if (options.useSpecular) {
							backend.append(`    dSpecularLight += getLightSpecular(dHalfDirW, dReflDirW, litShaderArgs.worldNormal, dViewDirW, dLightDirNormW, litShaderArgs.gloss, dTBN) * dAtten * light${i}_color` + (usesCookieNow ? " * dAtten3" : "") + (calcFresnel ? ` 
																		* getFresnel(
																				dot(dViewDirW, dHalfDirW), 
																				litShaderArgs.gloss, 
																				litShaderArgs.specularity
																		#if defined(LIT_IRIDESCENCE)
																				, iridescenceFresnel, 
																				litShaderArgs.iridescence
																		#endif
																		);` : `* litShaderArgs.specularity;`));
						}
					}
				}
				if (lightType !== LIGHTTYPE_DIRECTIONAL) {
					backend.append("    }");
				}
			}
			if (options.clusteredLightingEnabled && this.lighting) {
				usesLinearFalloff = true;
				usesInvSquaredFalloff = true;
				hasPointLights = true;
				backend.append(`    addClusteredLights(
																				litShaderArgs.worldNormal, 
																				dViewDirW, 
																				dReflDirW,
																#if defined(LIT_CLEARCOAT)
																				ccReflDirW,
																#endif
																				litShaderArgs.gloss, 
																				litShaderArgs.specularity, 
																				dVertexNormalW, 
																				dTBN, 
																#if defined(LIT_IRIDESCENCE)
																				iridescenceFresnel,
																#endif
																				litShaderArgs.clearcoat, 
																				litShaderArgs.sheen, 
																				litShaderArgs.iridescence
																		);`);
			}
			if (hasAreaLights) {
				if (options.useClearCoat) {
					backend.append("    litShaderArgs.clearcoat.specularity = 1.0;");
				}
				if (options.useSpecular) {
					backend.append("    litShaderArgs.specularity = vec3(1);");
				}
			}
			if (options.useRefraction) {
				backend.append(`    addRefraction(
												litShaderArgs.worldNormal, 
												dViewDirW, 
												litShaderArgs.thickness, 
												litShaderArgs.gloss, 
												litShaderArgs.specularity, 
												litShaderArgs.albedo, 
												litShaderArgs.transmission
										#if defined(LIT_IRIDESCENCE)
												, iridescenceFresnel, 
												litShaderArgs.iridescence
										#endif
										);`);
			}
		}
		if (useAo) {
			if (options.occludeDirect) {
				backend.append("    occludeDiffuse(litShaderArgs.ao);");
			}
			if (options.occludeSpecular === SPECOCC_AO || options.occludeSpecular === SPECOCC_GLOSSDEPENDENT) {
				backend.append("    occludeSpecular(litShaderArgs.gloss, litShaderArgs.ao, litShaderArgs.worldNormal, dViewDirW);");
			}
		}
		if (options.useSpecularityFactor) {
			backend.append("    dSpecularLight *= litShaderArgs.specularityFactor;");
		}
		if (options.opacityFadesSpecular === false) {
			if (options.blendType === BLEND_NORMAL || options.blendType === BLEND_PREMULTIPLIED) {
				backend.append("float specLum = dot((dSpecularLight + dReflection.rgb * dReflection.a), vec3( 0.2126, 0.7152, 0.0722 ));");
				backend.append("#ifdef LIT_CLEARCOAT\n specLum += dot(ccSpecularLight * litShaderArgs.clearcoat.specularity + ccReflection.rgb * litShaderArgs.clearcoat.specularity, vec3( 0.2126, 0.7152, 0.0722 ));\n#endif");
				backend.append("litShaderArgs.opacity = clamp(litShaderArgs.opacity + gammaCorrectInput(specLum), 0.0, 1.0);");
			}
			backend.append("litShaderArgs.opacity *= material_alphaFade;");
		}
		backend.append(chunks.endPS);
		if (options.blendType === BLEND_NORMAL || options.blendType === BLEND_ADDITIVEALPHA || options.alphaToCoverage) {
			backend.append(chunks.outputAlphaPS);
		} else if (options.blendType === BLEND_PREMULTIPLIED) {
			backend.append(chunks.outputAlphaPremulPS);
		} else {
			backend.append(chunks.outputAlphaOpaquePS);
		}
		if (options.useMsdf) {
			backend.append("    gl_FragColor = applyMsdf(gl_FragColor);");
		}
		backend.append(chunks.outputPS);
		backend.append(chunks.debugOutputPS);
		if (hasPointLights) {
			func.prepend(chunks.lightDirPointPS);
		}
		if (usesLinearFalloff) {
			func.prepend(chunks.falloffLinearPS);
		}
		if (usesInvSquaredFalloff) {
			func.prepend(chunks.falloffInvSquaredPS);
		}
		if (usesSpot) {
			func.prepend(chunks.spotPS);
		}
		if (usesCookie && !options.clusteredLightingEnabled) {
			func.prepend(chunks.cookiePS);
		}
		let structCode = "";
		const backendCode = `void evaluateBackend(LitShaderArguments litShaderArgs) {\n${backend.code}\n}`;
		func.append(backendCode);
		code.append(chunks.debugProcessFrontendPS);
		code.append("    evaluateBackend(litShaderArgs);");
		code.append(end());
		const mergedCode = decl.code + func.code + code.code;
		if (mergedCode.includes("dTBN")) structCode += "mat3 dTBN;\n";
		if (mergedCode.includes("dVertexNormalW")) structCode += "vec3 dVertexNormalW;\n";
		if (mergedCode.includes("dTangentW")) structCode += "vec3 dTangentW;\n";
		if (mergedCode.includes("dBinormalW")) structCode += "vec3 dBinormalW;\n";
		if (mergedCode.includes("dViewDirW")) structCode += "vec3 dViewDirW;\n";
		if (mergedCode.includes("dReflDirW")) structCode += "vec3 dReflDirW;\n";
		if (mergedCode.includes("dHalfDirW")) structCode += "vec3 dHalfDirW;\n";
		if (mergedCode.includes("ccReflDirW")) structCode += "vec3 ccReflDirW;\n";
		if (mergedCode.includes("dLightDirNormW")) structCode += "vec3 dLightDirNormW;\n";
		if (mergedCode.includes("dLightDirW")) structCode += "vec3 dLightDirW;\n";
		if (mergedCode.includes("dLightPosW")) structCode += "vec3 dLightPosW;\n";
		if (mergedCode.includes("dShadowCoord")) structCode += "vec3 dShadowCoord;\n";
		if (mergedCode.includes("dReflection")) structCode += "vec4 dReflection;\n";
		if (mergedCode.includes("dDiffuseLight")) structCode += "vec3 dDiffuseLight;\n";
		if (mergedCode.includes("dSpecularLight")) structCode += "vec3 dSpecularLight;\n";
		if (mergedCode.includes("dAtten")) structCode += "float dAtten;\n";
		if (mergedCode.includes("dAttenD")) structCode += "float dAttenD;\n";
		if (mergedCode.includes("dAtten3")) structCode += "vec3 dAtten3;\n";
		if (mergedCode.includes("dMsdf")) structCode += "vec4 dMsdf;\n";
		if (mergedCode.includes("ccFresnel")) structCode += "float ccFresnel;\n";
		if (mergedCode.includes("ccReflection")) structCode += "vec3 ccReflection;\n";
		if (mergedCode.includes("ccSpecularLight")) structCode += "vec3 ccSpecularLight;\n";
		if (mergedCode.includes("ccSpecularityNoFres")) structCode += "float ccSpecularityNoFres;\n";
		if (mergedCode.includes("sSpecularLight")) structCode += "vec3 sSpecularLight;\n";
		if (mergedCode.includes("sReflection")) structCode += "vec3 sReflection;\n";
		const result = this._fsGetBeginCode() + this.varyings + this.varyingDefines + this._fsGetBaseCode() + (options.detailModes ? chunks.detailModesPS : "") + structCode + this.frontendDecl + mergedCode;
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
		if (this.options.isForwardPass) {
			definition.tag = SHADERTAG_MATERIAL;
		}
		return definition;
	}
}

export { LitShader };
