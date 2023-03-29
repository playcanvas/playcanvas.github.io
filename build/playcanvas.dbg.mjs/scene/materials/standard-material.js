/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../core/debug.js';
import { Color } from '../../core/math/color.js';
import { math } from '../../core/math/math.js';
import { Vec2 } from '../../core/math/vec2.js';
import { ShaderProcessorOptions } from '../../platform/graphics/shader-processor-options.js';
import { CUBEPROJ_BOX, SPECULAR_PHONG, SHADER_DEPTH, SHADER_PICK, SPECOCC_AO, SPECULAR_BLINN, FRESNEL_SCHLICK, CUBEPROJ_NONE, DETAILMODE_MUL } from '../constants.js';
import { ShaderPass } from '../shader-pass.js';
import { EnvLighting } from '../graphics/env-lighting.js';
import { getProgramLibrary } from '../shader-lib/get-program-library.js';
import { _matTex2D, standard } from '../shader-lib/programs/standard.js';
import { Material } from './material.js';
import { StandardMaterialOptionsBuilder } from './standard-material-options-builder.js';
import { standardMaterialTextureParameters, standardMaterialCubemapParameters } from './standard-material-parameters.js';

// properties that get created on a standard material
const _props = {};

// special uniform functions on a standard material
const _uniforms = {};

// temporary set of params
let _params = new Set();

/**
 * Callback used by {@link StandardMaterial#onUpdateShader}.
 *
 * @callback UpdateShaderCallback
 * @param {import('./standard-material-options.js').StandardMaterialOptions} options - An object with shader generator settings (based on current
 * material and scene properties), that you can change and then return. Properties of the object passed
 * into this function are documented in {@link StandardMaterial}. Also contains a member named litOptions
 * which holds some of the options only used by the lit shader backend {@link LitOptions}.
 * @returns {import('./standard-material-options.js').StandardMaterialOptions} Returned settings will be used by the shader.
 */

/**
 * A Standard material is the main, general purpose material that is most often used for rendering.
 * It can approximate a wide variety of surface types and can simulate dynamic reflected light.
 * Most maps can use 3 types of input values in any combination: constant (color or number), mesh
 * vertex colors and a texture. All enabled inputs are multiplied together.
 *
 * @property {Color} ambient The ambient color of the material. This color value is 3-component
 * (RGB), where each component is between 0 and 1.
 * @property {Color} diffuse The diffuse color of the material. This color value is 3-component
 * (RGB), where each component is between 0 and 1. Defines basic surface color (aka albedo).
 * @property {boolean} diffuseTint Multiply main (primary) diffuse map and/or diffuse vertex color
 * by the constant diffuse value.
 * @property {import('../../platform/graphics/texture.js').Texture|null} diffuseMap The main
 * (primary) diffuse map of the material (default is null).
 * @property {number} diffuseMapUv Main (primary) diffuse map UV channel.
 * @property {Vec2} diffuseMapTiling Controls the 2D tiling of the main (primary) diffuse map.
 * @property {Vec2} diffuseMapOffset Controls the 2D offset of the main (primary) diffuse map. Each
 * component is between 0 and 1.
 * @property {number} diffuseMapRotation Controls the 2D rotation (in degrees) of the main
 * (primary) diffuse map.
 * @property {string} diffuseMapChannel Color channels of the main (primary) diffuse map to use.
 * Can be "r", "g", "b", "a", "rgb" or any swizzled combination.
 * @property {boolean} diffuseVertexColor Use mesh vertex colors for diffuse. If diffuseMap or are
 * diffuseTint are set, they'll be multiplied by vertex colors.
 * @property {string} diffuseVertexColorChannel Vertex color channels to use for diffuse. Can be
 * "r", "g", "b", "a", "rgb" or any swizzled combination.
 * @property {import('../../platform/graphics/texture.js').Texture|null} diffuseDetailMap The
 * detail (secondary) diffuse map of the material (default is null). Will only be used if main
 * (primary) diffuse map is non-null.
 * @property {number} diffuseDetailMapUv Detail (secondary) diffuse map UV channel.
 * @property {Vec2} diffuseDetailMapTiling Controls the 2D tiling of the detail (secondary) diffuse
 * map.
 * @property {Vec2} diffuseDetailMapOffset Controls the 2D offset of the detail (secondary) diffuse
 * map. Each component is between 0 and 1.
 * @property {number} diffuseDetailMapRotation Controls the 2D rotation (in degrees) of the main
 * (secondary) diffuse map.
 * @property {string} diffuseDetailMapChannel Color channels of the detail (secondary) diffuse map
 * to use. Can be "r", "g", "b", "a", "rgb" or any swizzled combination.
 * @property {string} diffuseDetailMode Determines how the main (primary) and detail (secondary)
 * diffuse maps are blended together. Can be:
 *
 * - {@link DETAILMODE_MUL}: Multiply together the primary and secondary colors.
 * - {@link DETAILMODE_ADD}: Add together the primary and secondary colors.
 * - {@link DETAILMODE_SCREEN}: Softer version of {@link DETAILMODE_ADD}.
 * - {@link DETAILMODE_OVERLAY}: Multiplies or screens the colors, depending on the primary color.
 * - {@link DETAILMODE_MIN}: Select whichever of the primary and secondary colors is darker,
 * component-wise.
 * - {@link DETAILMODE_MAX}: Select whichever of the primary and secondary colors is lighter,
 * component-wise.
 *
 * Defaults to {@link DETAILMODE_MUL}.
 * @property {Color} specular The specular color of the material. This color value is 3-component
 * (RGB), where each component is between 0 and 1. Defines surface reflection/specular color.
 * Affects specular intensity and tint.
 * @property {boolean} specularTint Multiply specular map and/or specular vertex color by the
 * constant specular value.
 * @property {import('../../platform/graphics/texture.js').Texture|null} specularMap The specular
 * map of the material (default is null).
 * @property {number} specularMapUv Specular map UV channel.
 * @property {Vec2} specularMapTiling Controls the 2D tiling of the specular map.
 * @property {Vec2} specularMapOffset Controls the 2D offset of the specular map. Each component is
 * between 0 and 1.
 * @property {number} specularMapRotation Controls the 2D rotation (in degrees) of the specular map.
 * @property {string} specularMapChannel Color channels of the specular map to use. Can be "r", "g",
 * "b", "a", "rgb" or any swizzled combination.
 * @property {boolean} specularVertexColor Use mesh vertex colors for specular. If specularMap or
 * are specularTint are set, they'll be multiplied by vertex colors.
 * @property {string} specularVertexColorChannel Vertex color channels to use for specular. Can be
 * @property {boolean} specularityFactorTint Multiply specularity factor map and/or specular vertex color by the
 * constant specular value.
 * "r", "g", "b", "a", "rgb" or any swizzled combination.
 * @property {number} specularityFactor The factor of specular intensity, used to weight the fresnel and specularity. Default is 1.0.
 * @property {import('../../platform/graphics/texture.js').Texture|null} specularityFactorMap The
 * factor of specularity as a texture (default is null).
 * @property {number} specularityFactorMapUv Specularity factor map UV channel.
 * @property {Vec2} specularityFactorMapTiling Controls the 2D tiling of the specularity factor map.
 * @property {Vec2} specularityFactorMapOffset Controls the 2D offset of the specularity factor map. Each component is
 * between 0 and 1.
 * @property {number} specularityFactorMapRotation Controls the 2D rotation (in degrees) of the specularity factor map.
 * @property {string} specularityFactorMapChannel The channel used by the specularity factor texture to sample from (default is 'a').
 * @property {boolean} specularityFactorVertexColor Use mesh vertex colors for specularity factor. If specularityFactorMap or
 * are specularityFactorTint are set, they'll be multiplied by vertex colors.
 * @property {string} specularityFactorVertexColorChannel Vertex color channels to use for specularity factor. Can be
 * "r", "g", "b", "a", "rgb" or any swizzled combination.
 * @property {boolean} enableGGXSpecular Enables GGX specular. Also enables
 * {@link StandardMaterial#anisotropy}  parameter to set material anisotropy.
 * @property {number} anisotropy Defines amount of anisotropy. Requires
 * {@link StandardMaterial#enableGGXSpecular} is set to true.
 *
 * - When anisotropy == 0, specular is isotropic.
 * - When anisotropy < 0, anisotropy direction aligns with the tangent, and specular anisotropy
 * increases as the anisotropy value decreases to minimum of -1.
 * - When anisotropy > 0, anisotropy direction aligns with the bi-normal, and specular anisotropy
 * increases as anisotropy value increases to maximum of 1.
 *
 * @property {number} clearCoat Defines intensity of clearcoat layer from 0 to 1. Clearcoat layer
 * is disabled when clearCoat == 0. Default value is 0 (disabled).
 * @property {import('../../platform/graphics/texture.js').Texture|null} clearCoatMap Monochrome
 * clearcoat intensity map (default is null). If specified, will be multiplied by normalized
 * 'clearCoat' value and/or vertex colors.
 * @property {number} clearCoatMapUv Clearcoat intensity map UV channel.
 * @property {Vec2} clearCoatMapTiling Controls the 2D tiling of the clearcoat intensity map.
 * @property {Vec2} clearCoatMapOffset Controls the 2D offset of the clearcoat intensity map. Each
 * component is between 0 and 1.
 * @property {number} clearCoatMapRotation Controls the 2D rotation (in degrees) of the clearcoat
 * intensity map.
 * @property {string} clearCoatMapChannel Color channel of the clearcoat intensity map to use. Can
 * be "r", "g", "b" or "a".
 * @property {boolean} clearCoatVertexColor Use mesh vertex colors for clearcoat intensity. If
 * clearCoatMap is set, it'll be multiplied by vertex colors.
 * @property {string} clearCoatVertexColorChannel Vertex color channel to use for clearcoat
 * intensity. Can be "r", "g", "b" or "a".
 * @property {number} clearCoatGloss Defines the clearcoat glossiness of the clearcoat layer
 * from 0 (rough) to 1 (mirror).
 * @property {boolean} clearCoatGlossInvert Invert the clearcoat gloss component (default is false).
 * Enabling this flag results in material treating the clear coat gloss members as roughness.
 * @property {import('../../platform/graphics/texture.js').Texture|null} clearCoatGlossMap Monochrome
 * clearcoat glossiness map (default is null). If specified, will be multiplied by normalized
 * 'clearCoatGloss' value and/or vertex colors.
 * @property {number} clearCoatGlossMapUv Clearcoat gloss map UV channel.
 * @property {Vec2} clearCoatGlossMapTiling Controls the 2D tiling of the clearcoat gloss map.
 * @property {Vec2} clearCoatGlossMapOffset Controls the 2D offset of the clearcoat gloss map.
 * Each component is between 0 and 1.
 * @property {number} clearCoatGlossMapRotation Controls the 2D rotation (in degrees) of the clear
 * coat gloss map.
 * @property {string} clearCoatGlossMapChannel Color channel of the clearcoat gloss map to use.
 * Can be "r", "g", "b" or "a".
 * @property {boolean} clearCoatGlossVertexColor Use mesh vertex colors for clearcoat glossiness.
 * If clearCoatGlossMap is set, it'll be multiplied by vertex colors.
 * @property {string} clearCoatGlossVertexColorChannel Vertex color channel to use for clearcoat
 * glossiness. Can be "r", "g", "b" or "a".
 * @property {import('../../platform/graphics/texture.js').Texture|null} clearCoatNormalMap The
 * clearcoat normal map of the material (default is null). The texture must contains normalized,
 * tangent space normals.
 * @property {number} clearCoatNormalMapUv Clearcoat normal map UV channel.
 * @property {Vec2} clearCoatNormalMapTiling Controls the 2D tiling of the main clearcoat normal
 * map.
 * @property {Vec2} clearCoatNormalMapOffset Controls the 2D offset of the main clearcoat normal
 * map. Each component is between 0 and 1.
 * @property {number} clearCoatNormalMapRotation Controls the 2D rotation (in degrees) of the main
 * clearcoat map.
 * @property {number} clearCoatBumpiness The bumpiness of the clearcoat layer. This value scales
 * the assigned main clearcoat normal map. It should be normally between 0 (no bump mapping) and 1
 * (full bump mapping), but can be set to e.g. 2 to give even more pronounced bump effect.
 * @property {boolean} useIridescence Enable thin-film iridescence.
 * @property {import('../../platform/graphics/texture.js').Texture|null} iridescenceMap The
 * per-pixel iridescence intensity. Only used when useIridescence is enabled.
 * @property {number} iridescenceMapUv Iridescence map UV channel.
 * @property {Vec2} iridescenceMapTiling Controls the 2D tiling of the iridescence map.
 * @property {Vec2} iridescenceMapOffset Controls the 2D offset of the iridescence map. Each component is
 * between 0 and 1.
 * @property {number} iridescenceMapRotation Controls the 2D rotation (in degrees) of the iridescence
 * map.
 * @property {string} iridescenceMapChannel Color channels of the iridescence map to use. Can be "r",
 * "g", "b" or "a".
 * @property {import('../../platform/graphics/texture.js').Texture|null} iridescenceThicknessMap The
 * per-pixel iridescence thickness. Defines a gradient weight between iridescenceThicknessMin and
 * iridescenceThicknessMax. Only used when useIridescence is enabled.
 * @property {number} iridescenceThicknessMapUv Iridescence thickness map UV channel.
 * @property {Vec2} iridescenceThicknessMapTiling Controls the 2D tiling of the iridescence
 * thickness map.
 * @property {Vec2} iridescenceThicknessMapOffset Controls the 2D offset of the iridescence
 * thickness map. Each component is between 0 and 1.
 * @property {number} iridescenceThicknessMapRotation Controls the 2D rotation (in degrees)
 * of the iridescence map.
 * @property {string} iridescenceThicknessMapChannel Color channels of the iridescence thickness
 * map to use. Can be "r", "g", "b" or "a".
 * @property {number} iridescenceThicknessMin The minimum thickness for the iridescence layer.
 * Only used when an iridescence thickness map is used. The unit is in nm.
 * @property {number} iridescenceThicknessMax The maximum thickness for the iridescence layer.
 * Used as the 'base' thickness when no iridescence thickness map is defined. The unit is in nm.
 * @property {number} iridescenceRefractionIndex The index of refraction of the iridescent
 * thin-film. Affects the color phase shift as described here:
 * https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_iridescence
 * @property {boolean} useMetalness Use metalness properties instead of specular. When enabled,
 * diffuse colors also affect specular instead of the dedicated specular map. This can be used as
 * alternative to specular color to save space. With metalness == 0, the pixel is assumed to be
 * dielectric, and diffuse color is used as normal. With metalness == 1, the pixel is fully
 * metallic, and diffuse color is used as specular color instead.
 * @property {boolean} useMetalnessSpecularColor When metalness is enabled, use the
 * specular map to apply color tint to specular reflections.
 * at direct angles.
 * @property {number} metalness Defines how much the surface is metallic. From 0 (dielectric) to 1
 * (metal).
 * @property {import('../../platform/graphics/texture.js').Texture|null} metalnessMap Monochrome
 * metalness map (default is null).
 * @property {number} metalnessMapUv Metalness map UV channel.
 * @property {Vec2} metalnessMapTiling Controls the 2D tiling of the metalness map.
 * @property {Vec2} metalnessMapOffset Controls the 2D offset of the metalness map. Each component
 * is between 0 and 1.
 * @property {number} metalnessMapRotation Controls the 2D rotation (in degrees) of the metalness
 * map.
 * @property {string} metalnessMapChannel Color channel of the metalness map to use. Can be "r",
 * "g", "b" or "a".
 * @property {boolean} metalnessVertexColor Use mesh vertex colors for metalness. If metalnessMap
 * is set, it'll be multiplied by vertex colors.
 * @property {string} metalnessVertexColorChannel Vertex color channel to use for metalness. Can be
 * "r", "g", "b" or "a".
 * @property {number} gloss Defines the glossiness of the material from 0 (rough) to 1 (shiny).
 * @property {import('../../platform/graphics/texture.js').Texture|null} glossMap Gloss map
 * (default is null). If specified, will be multiplied by normalized gloss value and/or vertex
 * colors.
 * @property {boolean} glossInvert Invert the gloss component (default is false). Enabling this
 * flag results in material treating the gloss members as roughness.
 * @property {number} glossMapUv Gloss map UV channel.
 * @property {string} glossMapChannel Color channel of the gloss map to use. Can be "r", "g", "b"
 * or "a".
 * @property {Vec2} glossMapTiling Controls the 2D tiling of the gloss map.
 * @property {Vec2} glossMapOffset Controls the 2D offset of the gloss map. Each component is
 * between 0 and 1.
 * @property {number} glossMapRotation Controls the 2D rotation (in degrees) of the gloss map.
 * @property {boolean} glossVertexColor Use mesh vertex colors for glossiness. If glossMap is set,
 * it'll be multiplied by vertex colors.
 * @property {string} glossVertexColorChannel Vertex color channel to use for glossiness. Can be
 * "r", "g", "b" or "a".
 * @property {number} refraction Defines the visibility of refraction. Material can refract the
 * same cube map as used for reflections.
 * @property {import('../../platform/graphics/texture.js').Texture|null} refractionMap The map of
 * the refraction visibility.
 * @property {number} refractionMapUv Refraction map UV channel.
 * @property {Vec2} refractionMapTiling Controls the 2D tiling of the refraction map.
 * @property {Vec2} refractionMapOffset Controls the 2D offset of the refraction map. Each component
 * is between 0 and 1.
 * @property {number} refractionMapRotation Controls the 2D rotation (in degrees) of the emissive
 * map.
 * @property {string} refractionMapChannel Color channels of the refraction map to use. Can be "r",
 * "g", "b", "a", "rgb" or any swizzled combination.
 * @property {boolean} refractionVertexColor Use mesh vertex colors for refraction. If
 * refraction map is set, it will be be multiplied by vertex colors.
 * @property {boolean} refractionVertexColorChannel Vertex color channel to use for refraction.
 * Can be "r", "g", "b" or "a".
 * @property {number} refractionIndex Defines the index of refraction, i.e. The amount of
 * distortion. The value is calculated as (outerIor / surfaceIor), where inputs are measured
 * indices of refraction, the one around the object and the one of its own surface. In most
 * situations outer medium is air, so outerIor will be approximately 1. Then you only need to do
 * (1.0 / surfaceIor).
 * @property {boolean} useDynamicRefraction Enables higher quality refractions using the grab pass
 * instead of pre-computed cube maps for refractions.
 * @property {number} thickness The thickness of the medium, only used when useDynamicRefraction
 * is enabled. The unit is in base units, and scales with the size of the object.
 * @property {import('../../platform/graphics/texture.js').Texture|null} thicknessMap The
 * per-pixel thickness of the medium, only used when useDynamicRefraction is enabled.
 * @property {number} thicknessMapUv Thickness map UV channel.
 * @property {Vec2} thicknessMapTiling Controls the 2D tiling of the thickness map.
 * @property {Vec2} thicknessMapOffset Controls the 2D offset of the thickness map. Each component is
 * between 0 and 1.
 * @property {number} thicknessMapRotation Controls the 2D rotation (in degrees) of the thickness
 * map.
 * @property {string} thicknessMapChannel Color channels of the thickness map to use. Can be "r",
 * "g", "b" or "a".
 * @property {boolean} thicknessVertexColor Use mesh vertex colors for thickness. If
 * thickness map is set, it will be be multiplied by vertex colors.
 * @property {Color} attenuation The attenuation color for refractive materials, only used when
 * useDynamicRefraction is enabled.
 * @property {number} attenuationDistance The distance defining the absorption rate of light
 * within the medium. Only used when useDynamicRefraction is enabled.
 * @property {Color} emissive The emissive color of the material. This color value is 3-component
 * (RGB), where each component is between 0 and 1.
 * @property {boolean} emissiveTint Multiply emissive map and/or emissive vertex color by the
 * constant emissive value.
 * @property {import('../../platform/graphics/texture.js').Texture|null} emissiveMap The emissive
 * map of the material (default is null). Can be HDR.
 * @property {number} emissiveIntensity Emissive color multiplier.
 * @property {number} emissiveMapUv Emissive map UV channel.
 * @property {Vec2} emissiveMapTiling Controls the 2D tiling of the emissive map.
 * @property {Vec2} emissiveMapOffset Controls the 2D offset of the emissive map. Each component is
 * between 0 and 1.
 * @property {number} emissiveMapRotation Controls the 2D rotation (in degrees) of the emissive
 * map.
 * @property {string} emissiveMapChannel Color channels of the emissive map to use. Can be "r",
 * "g", "b", "a", "rgb" or any swizzled combination.
 * @property {boolean} emissiveVertexColor Use mesh vertex colors for emission. If emissiveMap or
 * emissiveTint are set, they'll be multiplied by vertex colors.
 * @property {string} emissiveVertexColorChannel Vertex color channels to use for emission. Can be
 * "r", "g", "b", "a", "rgb" or any swizzled combination.
 * @property {boolean} useSheen Toggle sheen specular effect on/off.
 * @property {Color} sheen The specular color of the sheen (fabric) microfiber structure.
 * This color value is 3-component (RGB), where each component is between 0 and 1.
 * @property {boolean} sheenTint Multiply sheen map and/or sheen vertex color by the constant
 * sheen value.
 * @property {import('../../platform/graphics/texture.js').Texture|null} sheenMap The sheen
 * microstructure color map of the material (default is null).
 * @property {number} sheenMapUv Sheen map UV channel.
 * @property {Vec2} sheenMapTiling Controls the 2D tiling of the sheen map.
 * @property {Vec2} sheenMapOffset Controls the 2D offset of the sheen map. Each component is
 * between 0 and 1.
 * @property {number} sheenMapRotation Controls the 2D rotation (in degrees) of the sheen
 * map.
 * @property {string} sheenMapChannel Color channels of the sheen map to use. Can be "r",
 * "g", "b", "a", "rgb" or any swizzled combination.
 * @property {boolean} sheenVertexColor Use mesh vertex colors for sheen. If sheen map or
 * sheen tint are set, they'll be multiplied by vertex colors.
 * @property {number} sheenGloss The glossiness of the sheen (fabric) microfiber structure.
 * This color value is a single value between 0 and 1.
 * @property {boolean} sheenGlossInvert Invert the sheen gloss component (default is false).
 * Enabling this flag results in material treating the sheen gloss members as roughness.
 * @property {boolean} sheenGlossTint Multiply sheen glossiness map and/or sheen glossiness vertex
 * value by the scalar sheen glossiness value.
 * @property {import('../../platform/graphics/texture.js').Texture|null} sheenGlossMap The sheen
 * glossiness microstructure color map of the material (default is null).
 * @property {number} sheenGlossMapUv Sheen map UV channel.
 * @property {Vec2} sheenGlossMapTiling Controls the 2D tiling of the sheen glossiness map.
 * @property {Vec2} sheenGlossMapOffset Controls the 2D offset of the sheen glossiness map.
 * Each component is between 0 and 1.
 * @property {number} sheenGlossMapRotation Controls the 2D rotation (in degrees) of the sheen
 * glossiness map.
 * @property {string} sheenGlossMapChannel Color channels of the sheen glossiness map to use.
 * Can be "r", "g", "b", "a", "rgb" or any swizzled combination.
 * @property {boolean} sheenGlossVertexColor Use mesh vertex colors for sheen glossiness.
 * If sheen glossiness map or sheen glossiness tint are set, they'll be multiplied by vertex colors.
 * @property {string} sheenGlossVertexColorChannel Vertex color channels to use for sheen glossiness.
 * Can be "r", "g", "b" or "a".
 * @property {number} opacity The opacity of the material. This value can be between 0 and 1, where
 * 0 is fully transparent and 1 is fully opaque. If you want the material to be semi-transparent
 * you also need to set the {@link Material#blendType} to {@link BLEND_NORMAL},
 * {@link BLEND_ADDITIVE} or any other mode. Also note that for most semi-transparent objects you
 * want {@link Material#depthWrite} to be false, otherwise they can fully occlude objects behind
 * them.
 * @property {import('../../platform/graphics/texture.js').Texture|null} opacityMap The opacity map
 * of the material (default is null).
 * @property {number} opacityMapUv Opacity map UV channel.
 * @property {string} opacityMapChannel Color channel of the opacity map to use. Can be "r", "g",
 * "b" or "a".
 * @property {Vec2} opacityMapTiling Controls the 2D tiling of the opacity map.
 * @property {Vec2} opacityMapOffset Controls the 2D offset of the opacity map. Each component is
 * between 0 and 1.
 * @property {number} opacityMapRotation Controls the 2D rotation (in degrees) of the opacity map.
 * @property {boolean} opacityVertexColor Use mesh vertex colors for opacity. If opacityMap is set,
 * it'll be multiplied by vertex colors.
 * @property {string} opacityVertexColorChannel Vertex color channels to use for opacity. Can be
 * "r", "g", "b" or "a".
 * @property {boolean} opacityFadesSpecular used to specify whether specular and reflections are
 * faded out using {@link StandardMaterial#opacity}. Default is true. When set to false use
 * {@link Material#alphaFade} to fade out materials.
 * @property {number} alphaFade used to fade out materials when
 * {@link StandardMaterial#opacityFadesSpecular} is set to false.
 * @property {import('../../platform/graphics/texture.js').Texture|null} normalMap The main
 * (primary) normal map of the material (default is null). The texture must contains normalized,
 * tangent space normals.
 * @property {number} normalMapUv Main (primary) normal map UV channel.
 * @property {Vec2} normalMapTiling Controls the 2D tiling of the main (primary) normal map.
 * @property {Vec2} normalMapOffset Controls the 2D offset of the main (primary) normal map. Each
 * component is between 0 and 1.
 * @property {number} normalMapRotation Controls the 2D rotation (in degrees) of the main (primary)
 * normal map.
 * @property {number} bumpiness The bumpiness of the material. This value scales the assigned main
 * (primary) normal map. It should be normally between 0 (no bump mapping) and 1 (full bump
 * mapping), but can be set to e.g. 2 to give even more pronounced bump effect.
 * @property {import('../../platform/graphics/texture.js').Texture|null} normalDetailMap The detail
 * (secondary) normal map of the material (default is null). Will only be used if main (primary)
 * normal map is non-null.
 * @property {number} normalDetailMapUv Detail (secondary) normal map UV channel.
 * @property {Vec2} normalDetailMapTiling Controls the 2D tiling of the detail (secondary) normal
 * map.
 * @property {Vec2} normalDetailMapOffset Controls the 2D offset of the detail (secondary) normal
 * map. Each component is between 0 and 1.
 * @property {number} normalDetailMapRotation Controls the 2D rotation (in degrees) of the detail
 * (secondary) normal map.
 * @property {number} normalDetailMapBumpiness The bumpiness of the material. This value scales the
 * assigned detail (secondary) normal map. It should be normally between 0 (no bump mapping) and 1
 * (full bump mapping), but can be set to e.g. 2 to give even more pronounced bump effect.
 * @property {import('../../platform/graphics/texture.js').Texture|null} heightMap The height map
 * of the material (default is null). Used for a view-dependent parallax effect. The texture must
 * represent the height of the surface where darker pixels are lower and lighter pixels are higher.
 * It is recommended to use it together with a normal map.
 * @property {number} heightMapUv Height map UV channel.
 * @property {string} heightMapChannel Color channel of the height map to use. Can be "r", "g", "b"
 * or "a".
 * @property {Vec2} heightMapTiling Controls the 2D tiling of the height map.
 * @property {Vec2} heightMapOffset Controls the 2D offset of the height map. Each component is
 * between 0 and 1.
 * @property {number} heightMapRotation Controls the 2D rotation (in degrees) of the height map.
 * @property {number} heightMapFactor Height map multiplier. Affects the strength of the parallax
 * effect.
 * @property {import('../../platform/graphics/texture.js').Texture|null} envAtlas The prefiltered
 * environment lighting atlas (default is null). This setting overrides cubeMap and sphereMap and
 * will replace the scene lighting environment.
 * @property {import('../../platform/graphics/texture.js').Texture|null} cubeMap The cubic
 * environment map of the material (default is null). This setting overrides sphereMap and will
 * replace the scene lighting environment.
 * @property {import('../../platform/graphics/texture.js').Texture|null} sphereMap The spherical
 * environment map of the material (default is null). This will replace the scene lighting
 * environment.
 * @property {number} cubeMapProjection The type of projection applied to the cubeMap property:
 * - {@link CUBEPROJ_NONE}: The cube map is treated as if it is infinitely far away.
 * - {@link CUBEPROJ_BOX}: Box-projection based on a world space axis-aligned bounding box.
 * Defaults to {@link CUBEPROJ_NONE}.
 * @property {import('../../core/shape/bounding-box.js').BoundingBox} cubeMapProjectionBox The
 * world space axis-aligned bounding box defining the box-projection used for the cubeMap property.
 * Only used when cubeMapProjection is set to {@link CUBEPROJ_BOX}.
 * @property {number} reflectivity Environment map intensity.
 * @property {import('../../platform/graphics/texture.js').Texture|null} lightMap A custom lightmap
 * of the material (default is null). Lightmaps are textures that contain pre-rendered lighting.
 * Can be HDR.
 * @property {number} lightMapUv Lightmap UV channel
 * @property {string} lightMapChannel Color channels of the lightmap to use. Can be "r", "g", "b",
 * "a", "rgb" or any swizzled combination.
 * @property {Vec2} lightMapTiling Controls the 2D tiling of the lightmap.
 * @property {Vec2} lightMapOffset Controls the 2D offset of the lightmap. Each component is
 * between 0 and 1.
 * @property {number} lightMapRotation Controls the 2D rotation (in degrees) of the lightmap.
 * @property {boolean} lightVertexColor Use baked vertex lighting. If lightMap is set, it'll be
 * multiplied by vertex colors.
 * @property {string} lightVertexColorChannel Vertex color channels to use for baked lighting. Can
 * be "r", "g", "b", "a", "rgb" or any swizzled combination.
 * @property {boolean} ambientTint Enables scene ambient multiplication by material ambient color.
 * @property {import('../../platform/graphics/texture.js').Texture|null} aoMap Baked ambient
 * occlusion (AO) map (default is null). Modulates ambient color.
 * @property {number} aoMapUv AO map UV channel
 * @property {string} aoMapChannel Color channel of the AO map to use. Can be "r", "g", "b" or "a".
 * @property {Vec2} aoMapTiling Controls the 2D tiling of the AO map.
 * @property {Vec2} aoMapOffset Controls the 2D offset of the AO map. Each component is between 0
 * and 1.
 * @property {number} aoMapRotation Controls the 2D rotation (in degrees) of the AO map.
 * @property {boolean} aoVertexColor Use mesh vertex colors for AO. If aoMap is set, it'll be
 * multiplied by vertex colors.
 * @property {string} aoVertexColorChannel Vertex color channels to use for AO. Can be "r", "g",
 * "b" or "a".
 * @property {number} occludeSpecular Uses ambient occlusion to darken specular/reflection. It's a
 * hack, because real specular occlusion is view-dependent. However, it can be better than nothing.
 *
 * - {@link SPECOCC_NONE}: No specular occlusion
 * - {@link SPECOCC_AO}: Use AO directly to occlude specular.
 * - {@link SPECOCC_GLOSSDEPENDENT}: Modify AO based on material glossiness/view angle to occlude
 * specular.
 *
 * @property {number} occludeSpecularIntensity Controls visibility of specular occlusion.
 * @property {boolean} occludeDirect Tells if AO should darken directional lighting. Defaults to
 * false.
 * @property {boolean} conserveEnergy Defines how diffuse and specular components are combined when
 * Fresnel is on. It is recommended that you leave this option enabled, although you may want to
 * disable it in case when all reflection comes only from a few light sources, and you don't use an
 * environment map, therefore having mostly black reflection.
 * @property {number} shadingModel Defines the shading model.
 * - {@link SPECULAR_PHONG}: Phong without energy conservation. You should only use it as a
 * backwards compatibility with older projects.
 * - {@link SPECULAR_BLINN}: Energy-conserving Blinn-Phong.
 * @property {number} fresnelModel Defines the formula used for Fresnel effect.
 * As a side-effect, enabling any Fresnel model changes the way diffuse and reflection components
 * are combined. When Fresnel is off, legacy non energy-conserving combining is used. When it is
 * on, combining behavior is defined by conserveEnergy parameter.
 *
 * - {@link FRESNEL_NONE}: No Fresnel.
 * - {@link FRESNEL_SCHLICK}: Schlick's approximation of Fresnel (recommended). Parameterized by
 * specular color.
 *
 * @property {boolean} useFog Apply fogging (as configured in scene settings)
 * @property {boolean} useLighting Apply lighting
 * @property {boolean} useSkybox Apply scene skybox as prefiltered environment map
 * @property {boolean} useGammaTonemap Apply gamma correction and tonemapping (as configured in
 * scene settings).
 * @property {boolean} pixelSnap Align vertices to pixel coordinates when rendering. Useful for
 * pixel perfect 2D graphics.
 * @property {boolean} twoSidedLighting Calculate proper normals (and therefore lighting) on
 * backfaces.
 * @property {UpdateShaderCallback} onUpdateShader A custom function that will be called after all
 * shader generator properties are collected and before shader code is generated. This function
 * will receive an object with shader generator settings (based on current material and scene
 * properties), that you can change and then return. Returned value will be used instead. This is
 * mostly useful when rendering the same set of objects, but with different shader variations based
 * on the same material. For example, you may wish to render a depth or normal pass using textures
 * assigned to the material, a reflection pass with simpler shaders and so on. These properties are
 * split into two sections, generic standard material options and lit options. Properties of the
 * standard material options are {@link StandardMaterialOptions} and the options for the lit options
 * are {@link LitOptions}.
 * @augments Material
 */
class StandardMaterial extends Material {
  /**
   * Create a new StandardMaterial instance.
   *
   * @example
   * // Create a new Standard material
   * var material = new pc.StandardMaterial();
   *
   * // Update the material's diffuse and specular properties
   * material.diffuse.set(1, 0, 0);
   * material.specular.set(1, 1, 1);
   *
   * // Notify the material that it has been modified
   * material.update();
   * @example
   * // Create a new Standard material
   * var material = new pc.StandardMaterial();
   *
   * // Assign a texture to the diffuse slot
   * material.diffuseMap = texture;
   *
   * // Use the alpha channel of the texture for alpha testing with a reference value of 0.5
   * material.opacityMap = texture;
   * material.alphaTest = 0.5;
   *
   * // Notify the material that it has been modified
   * material.update();
   */
  constructor() {
    super();
    this._dirtyShader = true;

    // storage for texture and cubemap asset references
    this._assetReferences = {};
    this._activeParams = new Set();
    this._activeLightingParams = new Set();
    this.shaderOptBuilder = new StandardMaterialOptionsBuilder();
    this.reset();
  }
  reset() {
    // set default values
    Object.keys(_props).forEach(name => {
      this[`_${name}`] = _props[name].value();
    });

    /**
     * @type {Object<string, string>}
     * @private
     */
    this._chunks = {};
    this._uniformCache = {};
  }
  set shader(shader) {
    Debug.warn('StandardMaterial#shader property is not implemented, and should not be used.');
  }
  get shader() {
    Debug.warn('StandardMaterial#shader property is not implemented, and should not be used.');
    return null;
  }

  /**
   * Object containing custom shader chunks that will replace default ones.
   *
   * @type {Object<string, string>}
   */
  set chunks(value) {
    this._dirtyShader = true;
    this._chunks = value;
  }
  get chunks() {
    this._dirtyShader = true;
    return this._chunks;
  }

  /**
   * Copy a `StandardMaterial`.
   *
   * @param {StandardMaterial} source - The material to copy from.
   * @returns {StandardMaterial} The destination material.
   */
  copy(source) {
    super.copy(source);

    // set properties
    Object.keys(_props).forEach(k => {
      this[k] = source[k];
    });

    // clone chunks
    for (const p in source._chunks) {
      if (source._chunks.hasOwnProperty(p)) this._chunks[p] = source._chunks[p];
    }
    return this;
  }
  _setParameter(name, value) {
    _params.add(name);
    this.setParameter(name, value);
  }
  _setParameters(parameters) {
    parameters.forEach(v => {
      this._setParameter(v.name, v.value);
    });
  }
  _processParameters(paramsName) {
    const prevParams = this[paramsName];
    prevParams.forEach(param => {
      if (!_params.has(param)) {
        delete this.parameters[param];
      }
    });
    this[paramsName] = _params;
    _params = prevParams;
    _params.clear();
  }
  _updateMap(p) {
    const mname = p + 'Map';
    const map = this[mname];
    if (map) {
      this._setParameter('texture_' + mname, map);
      const tname = mname + 'Transform';
      const uniform = this.getUniform(tname);
      if (uniform) {
        this._setParameters(uniform);
      }
    }
  }

  // allocate a uniform if it doesn't already exist in the uniform cache
  _allocUniform(name, allocFunc) {
    let uniform = this._uniformCache[name];
    if (!uniform) {
      uniform = allocFunc();
      this._uniformCache[name] = uniform;
    }
    return uniform;
  }
  getUniform(name, device, scene) {
    return _uniforms[name](this, device, scene);
  }
  updateUniforms(device, scene) {
    const getUniform = name => {
      return this.getUniform(name, device, scene);
    };
    this._setParameter('material_ambient', getUniform('ambient'));
    if (!this.diffuseMap || this.diffuseTint) {
      this._setParameter('material_diffuse', getUniform('diffuse'));
    }
    if (!this.useMetalness) {
      if (!this.specularMap || this.specularTint) {
        this._setParameter('material_specular', getUniform('specular'));
      }
    } else {
      if (!this.metalnessMap || this.metalness < 1) {
        this._setParameter('material_metalness', this.metalness);
      }
      if (!this.specularMap || this.specularTint) {
        this._setParameter('material_specular', getUniform('specular'));
      }
      if (!this.specularityFactorMap || this.specularityFactorTint) {
        this._setParameter('material_specularityFactor', this.specularityFactor);
      }
      if (!this.sheenMap || this.sheenTint) {
        this._setParameter('material_sheen', getUniform('sheen'));
      }
      if (!this.sheenGlossMap || this.sheenGlossTint) {
        this._setParameter('material_sheenGloss', this.sheenGloss);
      }
      if (this.refractionIndex !== 1.0 / 1.5) {
        const oneOverRefractionIndex = 1.0 / this.refractionIndex;
        const f0 = (oneOverRefractionIndex - 1) / (oneOverRefractionIndex + 1);
        this._setParameter('material_f0', f0 * f0);
      } else {
        this._setParameter('material_f0', 0.04);
      }
    }
    if (this.enableGGXSpecular) {
      this._setParameter('material_anisotropy', this.anisotropy);
    }
    if (this.clearCoat > 0) {
      this._setParameter('material_clearCoat', this.clearCoat);
      this._setParameter('material_clearCoatGloss', this.clearCoatGloss);
      this._setParameter('material_clearCoatBumpiness', this.clearCoatBumpiness);
    }
    this._setParameter('material_gloss', getUniform('gloss'));
    if (!this.emissiveMap || this.emissiveTint) {
      this._setParameter('material_emissive', getUniform('emissive'));
    }
    if (this.emissiveIntensity !== 1) {
      this._setParameter('material_emissiveIntensity', this.emissiveIntensity);
    }
    if (this.refraction > 0) {
      this._setParameter('material_refraction', this.refraction);
      this._setParameter('material_refractionIndex', this.refractionIndex);
    }
    if (this.useDynamicRefraction) {
      this._setParameter('material_thickness', this.thickness);
      this._setParameter('material_attenuation', getUniform('attenuation'));
      this._setParameter('material_invAttenuationDistance', this.attenuationDistance === 0 ? 0 : 1.0 / this.attenuationDistance);
    }
    if (this.useIridescence) {
      this._setParameter('material_iridescence', this.iridescence);
      this._setParameter('material_iridescenceRefractionIndex', this.iridescenceRefractionIndex);
      this._setParameter('material_iridescenceThicknessMin', this.iridescenceThicknessMin);
      this._setParameter('material_iridescenceThicknessMax', this.iridescenceThicknessMax);
    }
    this._setParameter('material_opacity', this.opacity);
    if (this.opacityFadesSpecular === false) {
      this._setParameter('material_alphaFade', this.alphaFade);
    }
    if (this.occludeSpecular) {
      this._setParameter('material_occludeSpecularIntensity', this.occludeSpecularIntensity);
    }
    if (this.cubeMapProjection === CUBEPROJ_BOX) {
      this._setParameter(getUniform('cubeMapProjectionBox'));
    }
    for (const p in _matTex2D) {
      this._updateMap(p);
    }
    if (this.ambientSH) {
      this._setParameter('ambientSH[0]', this.ambientSH);
    }
    if (this.normalMap) {
      this._setParameter('material_bumpiness', this.bumpiness);
    }
    if (this.normalMap && this.normalDetailMap) {
      this._setParameter('material_normalDetailMapBumpiness', this.normalDetailMapBumpiness);
    }
    if (this.heightMap) {
      this._setParameter('material_heightMapFactor', getUniform('heightMapFactor'));
    }
    const isPhong = this.shadingModel === SPECULAR_PHONG;

    // set overridden environment textures
    if (this.envAtlas && this.cubeMap && !isPhong) {
      this._setParameter('texture_envAtlas', this.envAtlas);
      this._setParameter('texture_cubeMap', this.cubeMap);
    } else if (this.envAtlas && !isPhong) {
      this._setParameter('texture_envAtlas', this.envAtlas);
    } else if (this.cubeMap) {
      this._setParameter('texture_cubeMap', this.cubeMap);
    } else if (this.sphereMap) {
      this._setParameter('texture_sphereMap', this.sphereMap);
    }
    this._setParameter('material_reflectivity', this.reflectivity);

    // remove unused params
    this._processParameters('_activeParams');
    if (this._dirtyShader) {
      this.clearVariants();
    }
  }
  updateEnvUniforms(device, scene) {
    const isPhong = this.shadingModel === SPECULAR_PHONG;
    const hasLocalEnvOverride = this.envAtlas && !isPhong || this.cubeMap || this.sphereMap;
    if (!hasLocalEnvOverride && this.useSkybox) {
      if (scene.envAtlas && scene.skybox && !isPhong) {
        this._setParameter('texture_envAtlas', scene.envAtlas);
        this._setParameter('texture_cubeMap', scene.skybox);
      } else if (scene.envAtlas && !isPhong) {
        this._setParameter('texture_envAtlas', scene.envAtlas);
      } else if (scene.skybox) {
        this._setParameter('texture_cubeMap', scene.skybox);
      }
    }
    this._processParameters('_activeLightingParams');
  }
  getShaderVariant(device, scene, objDefs, staticLightList, pass, sortedLights, viewUniformFormat, viewBindGroupFormat, vertexFormat) {
    // update prefiltered lighting data
    this.updateEnvUniforms(device, scene);

    // Minimal options for Depth and Shadow passes
    const minimalOptions = pass === SHADER_DEPTH || pass === SHADER_PICK || ShaderPass.isShadow(pass);
    let options = minimalOptions ? standard.optionsContextMin : standard.optionsContext;
    if (minimalOptions) this.shaderOptBuilder.updateMinRef(options, scene, this, objDefs, staticLightList, pass, sortedLights);else this.shaderOptBuilder.updateRef(options, scene, this, objDefs, staticLightList, pass, sortedLights);

    // execute user callback to modify the options
    if (this.onUpdateShader) {
      options = this.onUpdateShader(options);
    }
    const processingOptions = new ShaderProcessorOptions(viewUniformFormat, viewBindGroupFormat, vertexFormat);
    const library = getProgramLibrary(device);
    library.register('standard', standard);
    const shader = library.getProgram('standard', options, processingOptions);
    this._dirtyShader = false;
    return shader;
  }

  /**
   * Removes this material from the scene and possibly frees up memory from its shaders (if there
   * are no other materials using it).
   */
  destroy() {
    // unbind (texture) asset references
    for (const asset in this._assetReferences) {
      this._assetReferences[asset]._unbind();
    }
    this._assetReferences = null;
    super.destroy();
  }
}

// define a uniform get function
StandardMaterial.TEXTURE_PARAMETERS = standardMaterialTextureParameters;
StandardMaterial.CUBEMAP_PARAMETERS = standardMaterialCubemapParameters;
const defineUniform = (name, getUniformFunc) => {
  _uniforms[name] = getUniformFunc;
};
const definePropInternal = (name, constructorFunc, setterFunc, getterFunc) => {
  Object.defineProperty(StandardMaterial.prototype, name, {
    get: getterFunc || function () {
      return this[`_${name}`];
    },
    set: setterFunc
  });
  _props[name] = {
    value: constructorFunc
  };
};

// define a simple value property (float, string etc)
const defineValueProp = prop => {
  const internalName = `_${prop.name}`;
  const dirtyShaderFunc = prop.dirtyShaderFunc || (() => true);
  const setterFunc = function setterFunc(value) {
    const oldValue = this[internalName];
    if (oldValue !== value) {
      this._dirtyShader = this._dirtyShader || dirtyShaderFunc(oldValue, value);
      this[internalName] = value;
    }
  };
  definePropInternal(prop.name, () => prop.defaultValue, setterFunc, prop.getterFunc);
};

// define an aggregate property (color, vec3 etc)
const defineAggProp = prop => {
  const internalName = `_${prop.name}`;
  const dirtyShaderFunc = prop.dirtyShaderFunc || (() => true);
  const setterFunc = function setterFunc(value) {
    const oldValue = this[internalName];
    if (!oldValue.equals(value)) {
      this._dirtyShader = this._dirtyShader || dirtyShaderFunc(oldValue, value);
      this[internalName] = oldValue.copy(value);
    }
  };
  definePropInternal(prop.name, () => prop.defaultValue.clone(), setterFunc, prop.getterFunc);
};

// define either a value or aggregate property
const defineProp = prop => {
  return prop.defaultValue && prop.defaultValue.clone ? defineAggProp(prop) : defineValueProp(prop);
};
function _defineTex2D(name, channel = "rgb", vertexColor = true, uv = 0) {
  // store texture name
  _matTex2D[name] = channel.length || -1;
  defineProp({
    name: `${name}Map`,
    defaultValue: null,
    dirtyShaderFunc: (oldValue, newValue) => {
      return !!oldValue !== !!newValue || oldValue && (oldValue.type !== newValue.type || oldValue.fixCubemapSeams !== newValue.fixCubemapSeams || oldValue.format !== newValue.format);
    }
  });
  defineProp({
    name: `${name}MapTiling`,
    defaultValue: new Vec2(1, 1)
  });
  defineProp({
    name: `${name}MapOffset`,
    defaultValue: new Vec2(0, 0)
  });
  defineProp({
    name: `${name}MapRotation`,
    defaultValue: 0
  });
  defineProp({
    name: `${name}MapUv`,
    defaultValue: uv
  });
  if (channel) {
    defineProp({
      name: `${name}MapChannel`,
      defaultValue: channel
    });
    if (vertexColor) {
      defineProp({
        name: `${name}VertexColor`,
        defaultValue: false
      });
      defineProp({
        name: `${name}VertexColorChannel`,
        defaultValue: channel
      });
    }
  }

  // construct the transform uniform
  const mapTiling = `${name}MapTiling`;
  const mapOffset = `${name}MapOffset`;
  const mapRotation = `${name}MapRotation`;
  const mapTransform = `${name}MapTransform`;
  defineUniform(mapTransform, (material, device, scene) => {
    const tiling = material[mapTiling];
    const offset = material[mapOffset];
    const rotation = material[mapRotation];
    if (tiling.x === 1 && tiling.y === 1 && offset.x === 0 && offset.y === 0 && rotation === 0) {
      return null;
    }
    const uniform = material._allocUniform(mapTransform, () => {
      return [{
        name: `texture_${mapTransform}0`,
        value: new Float32Array(3)
      }, {
        name: `texture_${mapTransform}1`,
        value: new Float32Array(3)
      }];
    });
    const cr = Math.cos(rotation * math.DEG_TO_RAD);
    const sr = Math.sin(rotation * math.DEG_TO_RAD);
    const uniform0 = uniform[0].value;
    uniform0[0] = cr * tiling.x;
    uniform0[1] = -sr * tiling.y;
    uniform0[2] = offset.x;
    const uniform1 = uniform[1].value;
    uniform1[0] = sr * tiling.x;
    uniform1[1] = cr * tiling.y;
    uniform1[2] = 1.0 - tiling.y - offset.y;
    return uniform;
  });
}
function _defineColor(name, defaultValue) {
  defineProp({
    name: name,
    defaultValue: defaultValue,
    getterFunc: function () {
      // HACK: since we can't detect whether a user is going to set a color property
      // after calling this getter (i.e doing material.ambient.r = 0.5) we must assume
      // the worst and flag the shader as dirty.
      // This means currently animating a material color is horribly slow.
      this._dirtyShader = true;
      return this[`_${name}`];
    }
  });
  defineUniform(name, (material, device, scene) => {
    const uniform = material._allocUniform(name, () => new Float32Array(3));
    const color = material[name];
    const gamma = material.useGammaTonemap && scene.gammaCorrection;
    if (gamma) {
      uniform[0] = Math.pow(color.r, 2.2);
      uniform[1] = Math.pow(color.g, 2.2);
      uniform[2] = Math.pow(color.b, 2.2);
    } else {
      uniform[0] = color.r;
      uniform[1] = color.g;
      uniform[2] = color.b;
    }
    return uniform;
  });
}
function _defineFloat(name, defaultValue, getUniformFunc) {
  defineProp({
    name: name,
    defaultValue: defaultValue,
    dirtyShaderFunc: (oldValue, newValue) => {
      // This is not always optimal and will sometimes trigger redundant shader
      // recompilation. However, no number property on a standard material
      // triggers a shader recompile if the previous and current values both
      // have a fractional part.
      return (oldValue === 0 || oldValue === 1) !== (newValue === 0 || newValue === 1);
    }
  });
  defineUniform(name, getUniformFunc);
}
function _defineObject(name, getUniformFunc) {
  defineProp({
    name: name,
    defaultValue: null,
    dirtyShaderFunc: (oldValue, newValue) => {
      return !!oldValue === !!newValue;
    }
  });
  defineUniform(name, getUniformFunc);
}
function _defineFlag(name, defaultValue) {
  defineProp({
    name: name,
    defaultValue: defaultValue
  });
}
function _defineMaterialProps() {
  _defineColor('ambient', new Color(0.7, 0.7, 0.7));
  _defineColor('diffuse', new Color(1, 1, 1));
  _defineColor('specular', new Color(0, 0, 0));
  _defineColor('emissive', new Color(0, 0, 0));
  _defineColor('sheen', new Color(1, 1, 1));
  _defineColor('attenuation', new Color(1, 1, 1));
  _defineFloat('emissiveIntensity', 1);
  _defineFloat('specularityFactor', 1);
  _defineFloat('sheenGloss', 0.0);
  _defineFloat('gloss', 0.25, (material, device, scene) => {
    return material.shadingModel === SPECULAR_PHONG ?
    // legacy: expand back to specular power
    Math.pow(2, material.gloss * 11) : material.gloss;
  });
  _defineFloat('heightMapFactor', 1, (material, device, scene) => {
    return material.heightMapFactor * 0.025;
  });
  _defineFloat('opacity', 1);
  _defineFloat('alphaFade', 1);
  _defineFloat('alphaTest', 0); // NOTE: overwrites Material.alphaTest
  _defineFloat('bumpiness', 1);
  _defineFloat('normalDetailMapBumpiness', 1);
  _defineFloat('reflectivity', 1);
  _defineFloat('occludeSpecularIntensity', 1);
  _defineFloat('refraction', 0);
  _defineFloat('refractionIndex', 1.0 / 1.5); // approx. (air ior / glass ior)
  _defineFloat('thickness', 0);
  _defineFloat('attenuationDistance', 0);
  _defineFloat('metalness', 1);
  _defineFloat('anisotropy', 0);
  _defineFloat('clearCoat', 0);
  _defineFloat('clearCoatGloss', 1);
  _defineFloat('clearCoatBumpiness', 1);
  _defineFloat('aoUvSet', 0, null); // legacy

  _defineFloat('iridescence', 0);
  _defineFloat('iridescenceRefractionIndex', 1.0 / 1.5);
  _defineFloat('iridescenceThicknessMin', 0);
  _defineFloat('iridescenceThicknessMax', 0);
  _defineObject('ambientSH');
  _defineObject('cubeMapProjectionBox', (material, device, scene) => {
    const uniform = material._allocUniform('cubeMapProjectionBox', () => {
      return [{
        name: 'envBoxMin',
        value: new Float32Array(3)
      }, {
        name: 'envBoxMax',
        value: new Float32Array(3)
      }];
    });
    const bboxMin = material.cubeMapProjectionBox.getMin();
    const minUniform = uniform[0].value;
    minUniform[0] = bboxMin.x;
    minUniform[1] = bboxMin.y;
    minUniform[2] = bboxMin.z;
    const bboxMax = material.cubeMapProjectionBox.getMax();
    const maxUniform = uniform[1].value;
    maxUniform[0] = bboxMax.x;
    maxUniform[1] = bboxMax.y;
    maxUniform[2] = bboxMax.z;
    return uniform;
  });
  _defineFlag('ambientTint', false);
  _defineFlag('diffuseTint', false);
  _defineFlag('specularTint', false);
  _defineFlag('specularityFactorTint', false);
  _defineFlag('emissiveTint', false);
  _defineFlag('fastTbn', false);
  _defineFlag('useMetalness', false);
  _defineFlag('useMetalnessSpecularColor', false);
  _defineFlag('useSheen', false);
  _defineFlag('enableGGXSpecular', false);
  _defineFlag('occludeDirect', false);
  _defineFlag('normalizeNormalMap', true);
  _defineFlag('conserveEnergy', true);
  _defineFlag('opacityFadesSpecular', true);
  _defineFlag('occludeSpecular', SPECOCC_AO);
  _defineFlag('shadingModel', SPECULAR_BLINN);
  _defineFlag('fresnelModel', FRESNEL_SCHLICK); // NOTE: this has been made to match the default shading model (to fix a bug)
  _defineFlag('useDynamicRefraction', false);
  _defineFlag('cubeMapProjection', CUBEPROJ_NONE);
  _defineFlag('customFragmentShader', null);
  _defineFlag('forceFragmentPrecision', null);
  _defineFlag('useFog', true);
  _defineFlag('useLighting', true);
  _defineFlag('useGammaTonemap', true);
  _defineFlag('useSkybox', true);
  _defineFlag('forceUv1', false);
  _defineFlag('pixelSnap', false);
  _defineFlag('twoSidedLighting', false);
  _defineFlag('nineSlicedMode', undefined); // NOTE: this used to be SPRITE_RENDERMODE_SLICED but was undefined pre-Rollup
  _defineFlag('msdfTextAttribute', false);
  _defineFlag('useIridescence', false);
  _defineFlag('glossInvert', false);
  _defineFlag('sheenGlossInvert', false);
  _defineFlag('clearCoatGlossInvert', false);
  _defineTex2D('diffuse');
  _defineTex2D('specular');
  _defineTex2D('emissive');
  _defineTex2D('thickness', 'g');
  _defineTex2D('specularityFactor', 'g');
  _defineTex2D('normal', '');
  _defineTex2D('metalness', 'g');
  _defineTex2D('gloss', 'g');
  _defineTex2D('opacity', 'a');
  _defineTex2D('refraction', 'g');
  _defineTex2D('height', 'g', false);
  _defineTex2D('ao', 'g');
  _defineTex2D('light', 'rgb', true, 1);
  _defineTex2D('msdf', '');
  _defineTex2D('diffuseDetail', 'rgb', false);
  _defineTex2D('normalDetail', '');
  _defineTex2D('clearCoat', 'g');
  _defineTex2D('clearCoatGloss', 'g');
  _defineTex2D('clearCoatNormal', '');
  _defineTex2D('sheen', 'rgb');
  _defineTex2D('sheenGloss', 'g');
  _defineTex2D('iridescence', 'g');
  _defineTex2D('iridescenceThickness', 'g');
  _defineFlag('diffuseDetailMode', DETAILMODE_MUL);
  _defineObject('cubeMap');
  _defineObject('sphereMap');
  _defineObject('envAtlas');

  // prefiltered cubemap getter
  const getterFunc = function getterFunc() {
    return this._prefilteredCubemaps;
  };

  // prefiltered cubemap setter
  const setterFunc = function setterFunc(value) {
    const cubemaps = this._prefilteredCubemaps;
    value = value || [];
    let changed = false;
    let complete = true;
    for (let i = 0; i < 6; ++i) {
      const v = value[i] || null;
      if (cubemaps[i] !== v) {
        cubemaps[i] = v;
        changed = true;
      }
      complete = complete && !!cubemaps[i];
    }
    if (changed) {
      if (complete) {
        this.envAtlas = EnvLighting.generatePrefilteredAtlas(cubemaps, {
          target: this.envAtlas
        });
      } else {
        if (this.envAtlas) {
          this.envAtlas.destroy();
          this.envAtlas = null;
        }
      }
      this._dirtyShader = true;
    }
  };
  const empty = [null, null, null, null, null, null];
  definePropInternal('prefilteredCubemaps', () => empty.slice(), setterFunc, getterFunc);
}
_defineMaterialProps();

export { StandardMaterial };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhbmRhcmQtbWF0ZXJpYWwuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9zY2VuZS9tYXRlcmlhbHMvc3RhbmRhcmQtbWF0ZXJpYWwuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL2NvbG9yLmpzJztcbmltcG9ydCB7IG1hdGggfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvbWF0aC5qcyc7XG5pbXBvcnQgeyBWZWMyIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzIuanMnO1xuXG5pbXBvcnQgeyBTaGFkZXJQcm9jZXNzb3JPcHRpb25zIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3Mvc2hhZGVyLXByb2Nlc3Nvci1vcHRpb25zLmpzJztcblxuaW1wb3J0IHtcbiAgICBDVUJFUFJPSl9CT1gsIENVQkVQUk9KX05PTkUsXG4gICAgREVUQUlMTU9ERV9NVUwsXG4gICAgRlJFU05FTF9TQ0hMSUNLLFxuICAgIFNIQURFUl9ERVBUSCwgU0hBREVSX1BJQ0ssXG4gICAgU1BFQ09DQ19BTyxcbiAgICBTUEVDVUxBUl9CTElOTiwgU1BFQ1VMQVJfUEhPTkdcbn0gZnJvbSAnLi4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IFNoYWRlclBhc3MgfSBmcm9tICcuLi9zaGFkZXItcGFzcy5qcyc7XG5pbXBvcnQgeyBFbnZMaWdodGluZyB9IGZyb20gJy4uL2dyYXBoaWNzL2Vudi1saWdodGluZy5qcyc7XG5pbXBvcnQgeyBnZXRQcm9ncmFtTGlicmFyeSB9IGZyb20gJy4uL3NoYWRlci1saWIvZ2V0LXByb2dyYW0tbGlicmFyeS5qcyc7XG5pbXBvcnQgeyBfbWF0VGV4MkQsIHN0YW5kYXJkIH0gZnJvbSAnLi4vc2hhZGVyLWxpYi9wcm9ncmFtcy9zdGFuZGFyZC5qcyc7XG5pbXBvcnQgeyBNYXRlcmlhbCB9IGZyb20gJy4vbWF0ZXJpYWwuanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRNYXRlcmlhbE9wdGlvbnNCdWlsZGVyIH0gZnJvbSAnLi9zdGFuZGFyZC1tYXRlcmlhbC1vcHRpb25zLWJ1aWxkZXIuanMnO1xuaW1wb3J0IHsgc3RhbmRhcmRNYXRlcmlhbEN1YmVtYXBQYXJhbWV0ZXJzLCBzdGFuZGFyZE1hdGVyaWFsVGV4dHVyZVBhcmFtZXRlcnMgfSBmcm9tICcuL3N0YW5kYXJkLW1hdGVyaWFsLXBhcmFtZXRlcnMuanMnO1xuXG4vLyBwcm9wZXJ0aWVzIHRoYXQgZ2V0IGNyZWF0ZWQgb24gYSBzdGFuZGFyZCBtYXRlcmlhbFxuY29uc3QgX3Byb3BzID0ge307XG5cbi8vIHNwZWNpYWwgdW5pZm9ybSBmdW5jdGlvbnMgb24gYSBzdGFuZGFyZCBtYXRlcmlhbFxuY29uc3QgX3VuaWZvcm1zID0ge307XG5cbi8vIHRlbXBvcmFyeSBzZXQgb2YgcGFyYW1zXG5sZXQgX3BhcmFtcyA9IG5ldyBTZXQoKTtcblxuLyoqXG4gKiBDYWxsYmFjayB1c2VkIGJ5IHtAbGluayBTdGFuZGFyZE1hdGVyaWFsI29uVXBkYXRlU2hhZGVyfS5cbiAqXG4gKiBAY2FsbGJhY2sgVXBkYXRlU2hhZGVyQ2FsbGJhY2tcbiAqIEBwYXJhbSB7aW1wb3J0KCcuL3N0YW5kYXJkLW1hdGVyaWFsLW9wdGlvbnMuanMnKS5TdGFuZGFyZE1hdGVyaWFsT3B0aW9uc30gb3B0aW9ucyAtIEFuIG9iamVjdCB3aXRoIHNoYWRlciBnZW5lcmF0b3Igc2V0dGluZ3MgKGJhc2VkIG9uIGN1cnJlbnRcbiAqIG1hdGVyaWFsIGFuZCBzY2VuZSBwcm9wZXJ0aWVzKSwgdGhhdCB5b3UgY2FuIGNoYW5nZSBhbmQgdGhlbiByZXR1cm4uIFByb3BlcnRpZXMgb2YgdGhlIG9iamVjdCBwYXNzZWRcbiAqIGludG8gdGhpcyBmdW5jdGlvbiBhcmUgZG9jdW1lbnRlZCBpbiB7QGxpbmsgU3RhbmRhcmRNYXRlcmlhbH0uIEFsc28gY29udGFpbnMgYSBtZW1iZXIgbmFtZWQgbGl0T3B0aW9uc1xuICogd2hpY2ggaG9sZHMgc29tZSBvZiB0aGUgb3B0aW9ucyBvbmx5IHVzZWQgYnkgdGhlIGxpdCBzaGFkZXIgYmFja2VuZCB7QGxpbmsgTGl0T3B0aW9uc30uXG4gKiBAcmV0dXJucyB7aW1wb3J0KCcuL3N0YW5kYXJkLW1hdGVyaWFsLW9wdGlvbnMuanMnKS5TdGFuZGFyZE1hdGVyaWFsT3B0aW9uc30gUmV0dXJuZWQgc2V0dGluZ3Mgd2lsbCBiZSB1c2VkIGJ5IHRoZSBzaGFkZXIuXG4gKi9cblxuLyoqXG4gKiBBIFN0YW5kYXJkIG1hdGVyaWFsIGlzIHRoZSBtYWluLCBnZW5lcmFsIHB1cnBvc2UgbWF0ZXJpYWwgdGhhdCBpcyBtb3N0IG9mdGVuIHVzZWQgZm9yIHJlbmRlcmluZy5cbiAqIEl0IGNhbiBhcHByb3hpbWF0ZSBhIHdpZGUgdmFyaWV0eSBvZiBzdXJmYWNlIHR5cGVzIGFuZCBjYW4gc2ltdWxhdGUgZHluYW1pYyByZWZsZWN0ZWQgbGlnaHQuXG4gKiBNb3N0IG1hcHMgY2FuIHVzZSAzIHR5cGVzIG9mIGlucHV0IHZhbHVlcyBpbiBhbnkgY29tYmluYXRpb246IGNvbnN0YW50IChjb2xvciBvciBudW1iZXIpLCBtZXNoXG4gKiB2ZXJ0ZXggY29sb3JzIGFuZCBhIHRleHR1cmUuIEFsbCBlbmFibGVkIGlucHV0cyBhcmUgbXVsdGlwbGllZCB0b2dldGhlci5cbiAqXG4gKiBAcHJvcGVydHkge0NvbG9yfSBhbWJpZW50IFRoZSBhbWJpZW50IGNvbG9yIG9mIHRoZSBtYXRlcmlhbC4gVGhpcyBjb2xvciB2YWx1ZSBpcyAzLWNvbXBvbmVudFxuICogKFJHQiksIHdoZXJlIGVhY2ggY29tcG9uZW50IGlzIGJldHdlZW4gMCBhbmQgMS5cbiAqIEBwcm9wZXJ0eSB7Q29sb3J9IGRpZmZ1c2UgVGhlIGRpZmZ1c2UgY29sb3Igb2YgdGhlIG1hdGVyaWFsLiBUaGlzIGNvbG9yIHZhbHVlIGlzIDMtY29tcG9uZW50XG4gKiAoUkdCKSwgd2hlcmUgZWFjaCBjb21wb25lbnQgaXMgYmV0d2VlbiAwIGFuZCAxLiBEZWZpbmVzIGJhc2ljIHN1cmZhY2UgY29sb3IgKGFrYSBhbGJlZG8pLlxuICogQHByb3BlcnR5IHtib29sZWFufSBkaWZmdXNlVGludCBNdWx0aXBseSBtYWluIChwcmltYXJ5KSBkaWZmdXNlIG1hcCBhbmQvb3IgZGlmZnVzZSB2ZXJ0ZXggY29sb3JcbiAqIGJ5IHRoZSBjb25zdGFudCBkaWZmdXNlIHZhbHVlLlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnKS5UZXh0dXJlfG51bGx9IGRpZmZ1c2VNYXAgVGhlIG1haW5cbiAqIChwcmltYXJ5KSBkaWZmdXNlIG1hcCBvZiB0aGUgbWF0ZXJpYWwgKGRlZmF1bHQgaXMgbnVsbCkuXG4gKiBAcHJvcGVydHkge251bWJlcn0gZGlmZnVzZU1hcFV2IE1haW4gKHByaW1hcnkpIGRpZmZ1c2UgbWFwIFVWIGNoYW5uZWwuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IGRpZmZ1c2VNYXBUaWxpbmcgQ29udHJvbHMgdGhlIDJEIHRpbGluZyBvZiB0aGUgbWFpbiAocHJpbWFyeSkgZGlmZnVzZSBtYXAuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IGRpZmZ1c2VNYXBPZmZzZXQgQ29udHJvbHMgdGhlIDJEIG9mZnNldCBvZiB0aGUgbWFpbiAocHJpbWFyeSkgZGlmZnVzZSBtYXAuIEVhY2hcbiAqIGNvbXBvbmVudCBpcyBiZXR3ZWVuIDAgYW5kIDEuXG4gKiBAcHJvcGVydHkge251bWJlcn0gZGlmZnVzZU1hcFJvdGF0aW9uIENvbnRyb2xzIHRoZSAyRCByb3RhdGlvbiAoaW4gZGVncmVlcykgb2YgdGhlIG1haW5cbiAqIChwcmltYXJ5KSBkaWZmdXNlIG1hcC5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBkaWZmdXNlTWFwQ2hhbm5lbCBDb2xvciBjaGFubmVscyBvZiB0aGUgbWFpbiAocHJpbWFyeSkgZGlmZnVzZSBtYXAgdG8gdXNlLlxuICogQ2FuIGJlIFwiclwiLCBcImdcIiwgXCJiXCIsIFwiYVwiLCBcInJnYlwiIG9yIGFueSBzd2l6emxlZCBjb21iaW5hdGlvbi5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gZGlmZnVzZVZlcnRleENvbG9yIFVzZSBtZXNoIHZlcnRleCBjb2xvcnMgZm9yIGRpZmZ1c2UuIElmIGRpZmZ1c2VNYXAgb3IgYXJlXG4gKiBkaWZmdXNlVGludCBhcmUgc2V0LCB0aGV5J2xsIGJlIG11bHRpcGxpZWQgYnkgdmVydGV4IGNvbG9ycy5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBkaWZmdXNlVmVydGV4Q29sb3JDaGFubmVsIFZlcnRleCBjb2xvciBjaGFubmVscyB0byB1c2UgZm9yIGRpZmZ1c2UuIENhbiBiZVxuICogXCJyXCIsIFwiZ1wiLCBcImJcIiwgXCJhXCIsIFwicmdiXCIgb3IgYW55IHN3aXp6bGVkIGNvbWJpbmF0aW9uLlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnKS5UZXh0dXJlfG51bGx9IGRpZmZ1c2VEZXRhaWxNYXAgVGhlXG4gKiBkZXRhaWwgKHNlY29uZGFyeSkgZGlmZnVzZSBtYXAgb2YgdGhlIG1hdGVyaWFsIChkZWZhdWx0IGlzIG51bGwpLiBXaWxsIG9ubHkgYmUgdXNlZCBpZiBtYWluXG4gKiAocHJpbWFyeSkgZGlmZnVzZSBtYXAgaXMgbm9uLW51bGwuXG4gKiBAcHJvcGVydHkge251bWJlcn0gZGlmZnVzZURldGFpbE1hcFV2IERldGFpbCAoc2Vjb25kYXJ5KSBkaWZmdXNlIG1hcCBVViBjaGFubmVsLlxuICogQHByb3BlcnR5IHtWZWMyfSBkaWZmdXNlRGV0YWlsTWFwVGlsaW5nIENvbnRyb2xzIHRoZSAyRCB0aWxpbmcgb2YgdGhlIGRldGFpbCAoc2Vjb25kYXJ5KSBkaWZmdXNlXG4gKiBtYXAuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IGRpZmZ1c2VEZXRhaWxNYXBPZmZzZXQgQ29udHJvbHMgdGhlIDJEIG9mZnNldCBvZiB0aGUgZGV0YWlsIChzZWNvbmRhcnkpIGRpZmZ1c2VcbiAqIG1hcC4gRWFjaCBjb21wb25lbnQgaXMgYmV0d2VlbiAwIGFuZCAxLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGRpZmZ1c2VEZXRhaWxNYXBSb3RhdGlvbiBDb250cm9scyB0aGUgMkQgcm90YXRpb24gKGluIGRlZ3JlZXMpIG9mIHRoZSBtYWluXG4gKiAoc2Vjb25kYXJ5KSBkaWZmdXNlIG1hcC5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBkaWZmdXNlRGV0YWlsTWFwQ2hhbm5lbCBDb2xvciBjaGFubmVscyBvZiB0aGUgZGV0YWlsIChzZWNvbmRhcnkpIGRpZmZ1c2UgbWFwXG4gKiB0byB1c2UuIENhbiBiZSBcInJcIiwgXCJnXCIsIFwiYlwiLCBcImFcIiwgXCJyZ2JcIiBvciBhbnkgc3dpenpsZWQgY29tYmluYXRpb24uXG4gKiBAcHJvcGVydHkge3N0cmluZ30gZGlmZnVzZURldGFpbE1vZGUgRGV0ZXJtaW5lcyBob3cgdGhlIG1haW4gKHByaW1hcnkpIGFuZCBkZXRhaWwgKHNlY29uZGFyeSlcbiAqIGRpZmZ1c2UgbWFwcyBhcmUgYmxlbmRlZCB0b2dldGhlci4gQ2FuIGJlOlxuICpcbiAqIC0ge0BsaW5rIERFVEFJTE1PREVfTVVMfTogTXVsdGlwbHkgdG9nZXRoZXIgdGhlIHByaW1hcnkgYW5kIHNlY29uZGFyeSBjb2xvcnMuXG4gKiAtIHtAbGluayBERVRBSUxNT0RFX0FERH06IEFkZCB0b2dldGhlciB0aGUgcHJpbWFyeSBhbmQgc2Vjb25kYXJ5IGNvbG9ycy5cbiAqIC0ge0BsaW5rIERFVEFJTE1PREVfU0NSRUVOfTogU29mdGVyIHZlcnNpb24gb2Yge0BsaW5rIERFVEFJTE1PREVfQUREfS5cbiAqIC0ge0BsaW5rIERFVEFJTE1PREVfT1ZFUkxBWX06IE11bHRpcGxpZXMgb3Igc2NyZWVucyB0aGUgY29sb3JzLCBkZXBlbmRpbmcgb24gdGhlIHByaW1hcnkgY29sb3IuXG4gKiAtIHtAbGluayBERVRBSUxNT0RFX01JTn06IFNlbGVjdCB3aGljaGV2ZXIgb2YgdGhlIHByaW1hcnkgYW5kIHNlY29uZGFyeSBjb2xvcnMgaXMgZGFya2VyLFxuICogY29tcG9uZW50LXdpc2UuXG4gKiAtIHtAbGluayBERVRBSUxNT0RFX01BWH06IFNlbGVjdCB3aGljaGV2ZXIgb2YgdGhlIHByaW1hcnkgYW5kIHNlY29uZGFyeSBjb2xvcnMgaXMgbGlnaHRlcixcbiAqIGNvbXBvbmVudC13aXNlLlxuICpcbiAqIERlZmF1bHRzIHRvIHtAbGluayBERVRBSUxNT0RFX01VTH0uXG4gKiBAcHJvcGVydHkge0NvbG9yfSBzcGVjdWxhciBUaGUgc3BlY3VsYXIgY29sb3Igb2YgdGhlIG1hdGVyaWFsLiBUaGlzIGNvbG9yIHZhbHVlIGlzIDMtY29tcG9uZW50XG4gKiAoUkdCKSwgd2hlcmUgZWFjaCBjb21wb25lbnQgaXMgYmV0d2VlbiAwIGFuZCAxLiBEZWZpbmVzIHN1cmZhY2UgcmVmbGVjdGlvbi9zcGVjdWxhciBjb2xvci5cbiAqIEFmZmVjdHMgc3BlY3VsYXIgaW50ZW5zaXR5IGFuZCB0aW50LlxuICogQHByb3BlcnR5IHtib29sZWFufSBzcGVjdWxhclRpbnQgTXVsdGlwbHkgc3BlY3VsYXIgbWFwIGFuZC9vciBzcGVjdWxhciB2ZXJ0ZXggY29sb3IgYnkgdGhlXG4gKiBjb25zdGFudCBzcGVjdWxhciB2YWx1ZS5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJykuVGV4dHVyZXxudWxsfSBzcGVjdWxhck1hcCBUaGUgc3BlY3VsYXJcbiAqIG1hcCBvZiB0aGUgbWF0ZXJpYWwgKGRlZmF1bHQgaXMgbnVsbCkuXG4gKiBAcHJvcGVydHkge251bWJlcn0gc3BlY3VsYXJNYXBVdiBTcGVjdWxhciBtYXAgVVYgY2hhbm5lbC5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gc3BlY3VsYXJNYXBUaWxpbmcgQ29udHJvbHMgdGhlIDJEIHRpbGluZyBvZiB0aGUgc3BlY3VsYXIgbWFwLlxuICogQHByb3BlcnR5IHtWZWMyfSBzcGVjdWxhck1hcE9mZnNldCBDb250cm9scyB0aGUgMkQgb2Zmc2V0IG9mIHRoZSBzcGVjdWxhciBtYXAuIEVhY2ggY29tcG9uZW50IGlzXG4gKiBiZXR3ZWVuIDAgYW5kIDEuXG4gKiBAcHJvcGVydHkge251bWJlcn0gc3BlY3VsYXJNYXBSb3RhdGlvbiBDb250cm9scyB0aGUgMkQgcm90YXRpb24gKGluIGRlZ3JlZXMpIG9mIHRoZSBzcGVjdWxhciBtYXAuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gc3BlY3VsYXJNYXBDaGFubmVsIENvbG9yIGNoYW5uZWxzIG9mIHRoZSBzcGVjdWxhciBtYXAgdG8gdXNlLiBDYW4gYmUgXCJyXCIsIFwiZ1wiLFxuICogXCJiXCIsIFwiYVwiLCBcInJnYlwiIG9yIGFueSBzd2l6emxlZCBjb21iaW5hdGlvbi5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gc3BlY3VsYXJWZXJ0ZXhDb2xvciBVc2UgbWVzaCB2ZXJ0ZXggY29sb3JzIGZvciBzcGVjdWxhci4gSWYgc3BlY3VsYXJNYXAgb3JcbiAqIGFyZSBzcGVjdWxhclRpbnQgYXJlIHNldCwgdGhleSdsbCBiZSBtdWx0aXBsaWVkIGJ5IHZlcnRleCBjb2xvcnMuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gc3BlY3VsYXJWZXJ0ZXhDb2xvckNoYW5uZWwgVmVydGV4IGNvbG9yIGNoYW5uZWxzIHRvIHVzZSBmb3Igc3BlY3VsYXIuIENhbiBiZVxuICogQHByb3BlcnR5IHtib29sZWFufSBzcGVjdWxhcml0eUZhY3RvclRpbnQgTXVsdGlwbHkgc3BlY3VsYXJpdHkgZmFjdG9yIG1hcCBhbmQvb3Igc3BlY3VsYXIgdmVydGV4IGNvbG9yIGJ5IHRoZVxuICogY29uc3RhbnQgc3BlY3VsYXIgdmFsdWUuXG4gKiBcInJcIiwgXCJnXCIsIFwiYlwiLCBcImFcIiwgXCJyZ2JcIiBvciBhbnkgc3dpenpsZWQgY29tYmluYXRpb24uXG4gKiBAcHJvcGVydHkge251bWJlcn0gc3BlY3VsYXJpdHlGYWN0b3IgVGhlIGZhY3RvciBvZiBzcGVjdWxhciBpbnRlbnNpdHksIHVzZWQgdG8gd2VpZ2h0IHRoZSBmcmVzbmVsIGFuZCBzcGVjdWxhcml0eS4gRGVmYXVsdCBpcyAxLjAuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcycpLlRleHR1cmV8bnVsbH0gc3BlY3VsYXJpdHlGYWN0b3JNYXAgVGhlXG4gKiBmYWN0b3Igb2Ygc3BlY3VsYXJpdHkgYXMgYSB0ZXh0dXJlIChkZWZhdWx0IGlzIG51bGwpLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHNwZWN1bGFyaXR5RmFjdG9yTWFwVXYgU3BlY3VsYXJpdHkgZmFjdG9yIG1hcCBVViBjaGFubmVsLlxuICogQHByb3BlcnR5IHtWZWMyfSBzcGVjdWxhcml0eUZhY3Rvck1hcFRpbGluZyBDb250cm9scyB0aGUgMkQgdGlsaW5nIG9mIHRoZSBzcGVjdWxhcml0eSBmYWN0b3IgbWFwLlxuICogQHByb3BlcnR5IHtWZWMyfSBzcGVjdWxhcml0eUZhY3Rvck1hcE9mZnNldCBDb250cm9scyB0aGUgMkQgb2Zmc2V0IG9mIHRoZSBzcGVjdWxhcml0eSBmYWN0b3IgbWFwLiBFYWNoIGNvbXBvbmVudCBpc1xuICogYmV0d2VlbiAwIGFuZCAxLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHNwZWN1bGFyaXR5RmFjdG9yTWFwUm90YXRpb24gQ29udHJvbHMgdGhlIDJEIHJvdGF0aW9uIChpbiBkZWdyZWVzKSBvZiB0aGUgc3BlY3VsYXJpdHkgZmFjdG9yIG1hcC5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBzcGVjdWxhcml0eUZhY3Rvck1hcENoYW5uZWwgVGhlIGNoYW5uZWwgdXNlZCBieSB0aGUgc3BlY3VsYXJpdHkgZmFjdG9yIHRleHR1cmUgdG8gc2FtcGxlIGZyb20gKGRlZmF1bHQgaXMgJ2EnKS5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gc3BlY3VsYXJpdHlGYWN0b3JWZXJ0ZXhDb2xvciBVc2UgbWVzaCB2ZXJ0ZXggY29sb3JzIGZvciBzcGVjdWxhcml0eSBmYWN0b3IuIElmIHNwZWN1bGFyaXR5RmFjdG9yTWFwIG9yXG4gKiBhcmUgc3BlY3VsYXJpdHlGYWN0b3JUaW50IGFyZSBzZXQsIHRoZXknbGwgYmUgbXVsdGlwbGllZCBieSB2ZXJ0ZXggY29sb3JzLlxuICogQHByb3BlcnR5IHtzdHJpbmd9IHNwZWN1bGFyaXR5RmFjdG9yVmVydGV4Q29sb3JDaGFubmVsIFZlcnRleCBjb2xvciBjaGFubmVscyB0byB1c2UgZm9yIHNwZWN1bGFyaXR5IGZhY3Rvci4gQ2FuIGJlXG4gKiBcInJcIiwgXCJnXCIsIFwiYlwiLCBcImFcIiwgXCJyZ2JcIiBvciBhbnkgc3dpenpsZWQgY29tYmluYXRpb24uXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IGVuYWJsZUdHWFNwZWN1bGFyIEVuYWJsZXMgR0dYIHNwZWN1bGFyLiBBbHNvIGVuYWJsZXNcbiAqIHtAbGluayBTdGFuZGFyZE1hdGVyaWFsI2FuaXNvdHJvcHl9ICBwYXJhbWV0ZXIgdG8gc2V0IG1hdGVyaWFsIGFuaXNvdHJvcHkuXG4gKiBAcHJvcGVydHkge251bWJlcn0gYW5pc290cm9weSBEZWZpbmVzIGFtb3VudCBvZiBhbmlzb3Ryb3B5LiBSZXF1aXJlc1xuICoge0BsaW5rIFN0YW5kYXJkTWF0ZXJpYWwjZW5hYmxlR0dYU3BlY3VsYXJ9IGlzIHNldCB0byB0cnVlLlxuICpcbiAqIC0gV2hlbiBhbmlzb3Ryb3B5ID09IDAsIHNwZWN1bGFyIGlzIGlzb3Ryb3BpYy5cbiAqIC0gV2hlbiBhbmlzb3Ryb3B5IDwgMCwgYW5pc290cm9weSBkaXJlY3Rpb24gYWxpZ25zIHdpdGggdGhlIHRhbmdlbnQsIGFuZCBzcGVjdWxhciBhbmlzb3Ryb3B5XG4gKiBpbmNyZWFzZXMgYXMgdGhlIGFuaXNvdHJvcHkgdmFsdWUgZGVjcmVhc2VzIHRvIG1pbmltdW0gb2YgLTEuXG4gKiAtIFdoZW4gYW5pc290cm9weSA+IDAsIGFuaXNvdHJvcHkgZGlyZWN0aW9uIGFsaWducyB3aXRoIHRoZSBiaS1ub3JtYWwsIGFuZCBzcGVjdWxhciBhbmlzb3Ryb3B5XG4gKiBpbmNyZWFzZXMgYXMgYW5pc290cm9weSB2YWx1ZSBpbmNyZWFzZXMgdG8gbWF4aW11bSBvZiAxLlxuICpcbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBjbGVhckNvYXQgRGVmaW5lcyBpbnRlbnNpdHkgb2YgY2xlYXJjb2F0IGxheWVyIGZyb20gMCB0byAxLiBDbGVhcmNvYXQgbGF5ZXJcbiAqIGlzIGRpc2FibGVkIHdoZW4gY2xlYXJDb2F0ID09IDAuIERlZmF1bHQgdmFsdWUgaXMgMCAoZGlzYWJsZWQpLlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnKS5UZXh0dXJlfG51bGx9IGNsZWFyQ29hdE1hcCBNb25vY2hyb21lXG4gKiBjbGVhcmNvYXQgaW50ZW5zaXR5IG1hcCAoZGVmYXVsdCBpcyBudWxsKS4gSWYgc3BlY2lmaWVkLCB3aWxsIGJlIG11bHRpcGxpZWQgYnkgbm9ybWFsaXplZFxuICogJ2NsZWFyQ29hdCcgdmFsdWUgYW5kL29yIHZlcnRleCBjb2xvcnMuXG4gKiBAcHJvcGVydHkge251bWJlcn0gY2xlYXJDb2F0TWFwVXYgQ2xlYXJjb2F0IGludGVuc2l0eSBtYXAgVVYgY2hhbm5lbC5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gY2xlYXJDb2F0TWFwVGlsaW5nIENvbnRyb2xzIHRoZSAyRCB0aWxpbmcgb2YgdGhlIGNsZWFyY29hdCBpbnRlbnNpdHkgbWFwLlxuICogQHByb3BlcnR5IHtWZWMyfSBjbGVhckNvYXRNYXBPZmZzZXQgQ29udHJvbHMgdGhlIDJEIG9mZnNldCBvZiB0aGUgY2xlYXJjb2F0IGludGVuc2l0eSBtYXAuIEVhY2hcbiAqIGNvbXBvbmVudCBpcyBiZXR3ZWVuIDAgYW5kIDEuXG4gKiBAcHJvcGVydHkge251bWJlcn0gY2xlYXJDb2F0TWFwUm90YXRpb24gQ29udHJvbHMgdGhlIDJEIHJvdGF0aW9uIChpbiBkZWdyZWVzKSBvZiB0aGUgY2xlYXJjb2F0XG4gKiBpbnRlbnNpdHkgbWFwLlxuICogQHByb3BlcnR5IHtzdHJpbmd9IGNsZWFyQ29hdE1hcENoYW5uZWwgQ29sb3IgY2hhbm5lbCBvZiB0aGUgY2xlYXJjb2F0IGludGVuc2l0eSBtYXAgdG8gdXNlLiBDYW5cbiAqIGJlIFwiclwiLCBcImdcIiwgXCJiXCIgb3IgXCJhXCIuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IGNsZWFyQ29hdFZlcnRleENvbG9yIFVzZSBtZXNoIHZlcnRleCBjb2xvcnMgZm9yIGNsZWFyY29hdCBpbnRlbnNpdHkuIElmXG4gKiBjbGVhckNvYXRNYXAgaXMgc2V0LCBpdCdsbCBiZSBtdWx0aXBsaWVkIGJ5IHZlcnRleCBjb2xvcnMuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gY2xlYXJDb2F0VmVydGV4Q29sb3JDaGFubmVsIFZlcnRleCBjb2xvciBjaGFubmVsIHRvIHVzZSBmb3IgY2xlYXJjb2F0XG4gKiBpbnRlbnNpdHkuIENhbiBiZSBcInJcIiwgXCJnXCIsIFwiYlwiIG9yIFwiYVwiLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGNsZWFyQ29hdEdsb3NzIERlZmluZXMgdGhlIGNsZWFyY29hdCBnbG9zc2luZXNzIG9mIHRoZSBjbGVhcmNvYXQgbGF5ZXJcbiAqIGZyb20gMCAocm91Z2gpIHRvIDEgKG1pcnJvcikuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IGNsZWFyQ29hdEdsb3NzSW52ZXJ0IEludmVydCB0aGUgY2xlYXJjb2F0IGdsb3NzIGNvbXBvbmVudCAoZGVmYXVsdCBpcyBmYWxzZSkuXG4gKiBFbmFibGluZyB0aGlzIGZsYWcgcmVzdWx0cyBpbiBtYXRlcmlhbCB0cmVhdGluZyB0aGUgY2xlYXIgY29hdCBnbG9zcyBtZW1iZXJzIGFzIHJvdWdobmVzcy5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJykuVGV4dHVyZXxudWxsfSBjbGVhckNvYXRHbG9zc01hcCBNb25vY2hyb21lXG4gKiBjbGVhcmNvYXQgZ2xvc3NpbmVzcyBtYXAgKGRlZmF1bHQgaXMgbnVsbCkuIElmIHNwZWNpZmllZCwgd2lsbCBiZSBtdWx0aXBsaWVkIGJ5IG5vcm1hbGl6ZWRcbiAqICdjbGVhckNvYXRHbG9zcycgdmFsdWUgYW5kL29yIHZlcnRleCBjb2xvcnMuXG4gKiBAcHJvcGVydHkge251bWJlcn0gY2xlYXJDb2F0R2xvc3NNYXBVdiBDbGVhcmNvYXQgZ2xvc3MgbWFwIFVWIGNoYW5uZWwuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IGNsZWFyQ29hdEdsb3NzTWFwVGlsaW5nIENvbnRyb2xzIHRoZSAyRCB0aWxpbmcgb2YgdGhlIGNsZWFyY29hdCBnbG9zcyBtYXAuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IGNsZWFyQ29hdEdsb3NzTWFwT2Zmc2V0IENvbnRyb2xzIHRoZSAyRCBvZmZzZXQgb2YgdGhlIGNsZWFyY29hdCBnbG9zcyBtYXAuXG4gKiBFYWNoIGNvbXBvbmVudCBpcyBiZXR3ZWVuIDAgYW5kIDEuXG4gKiBAcHJvcGVydHkge251bWJlcn0gY2xlYXJDb2F0R2xvc3NNYXBSb3RhdGlvbiBDb250cm9scyB0aGUgMkQgcm90YXRpb24gKGluIGRlZ3JlZXMpIG9mIHRoZSBjbGVhclxuICogY29hdCBnbG9zcyBtYXAuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gY2xlYXJDb2F0R2xvc3NNYXBDaGFubmVsIENvbG9yIGNoYW5uZWwgb2YgdGhlIGNsZWFyY29hdCBnbG9zcyBtYXAgdG8gdXNlLlxuICogQ2FuIGJlIFwiclwiLCBcImdcIiwgXCJiXCIgb3IgXCJhXCIuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IGNsZWFyQ29hdEdsb3NzVmVydGV4Q29sb3IgVXNlIG1lc2ggdmVydGV4IGNvbG9ycyBmb3IgY2xlYXJjb2F0IGdsb3NzaW5lc3MuXG4gKiBJZiBjbGVhckNvYXRHbG9zc01hcCBpcyBzZXQsIGl0J2xsIGJlIG11bHRpcGxpZWQgYnkgdmVydGV4IGNvbG9ycy5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBjbGVhckNvYXRHbG9zc1ZlcnRleENvbG9yQ2hhbm5lbCBWZXJ0ZXggY29sb3IgY2hhbm5lbCB0byB1c2UgZm9yIGNsZWFyY29hdFxuICogZ2xvc3NpbmVzcy4gQ2FuIGJlIFwiclwiLCBcImdcIiwgXCJiXCIgb3IgXCJhXCIuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcycpLlRleHR1cmV8bnVsbH0gY2xlYXJDb2F0Tm9ybWFsTWFwIFRoZVxuICogY2xlYXJjb2F0IG5vcm1hbCBtYXAgb2YgdGhlIG1hdGVyaWFsIChkZWZhdWx0IGlzIG51bGwpLiBUaGUgdGV4dHVyZSBtdXN0IGNvbnRhaW5zIG5vcm1hbGl6ZWQsXG4gKiB0YW5nZW50IHNwYWNlIG5vcm1hbHMuXG4gKiBAcHJvcGVydHkge251bWJlcn0gY2xlYXJDb2F0Tm9ybWFsTWFwVXYgQ2xlYXJjb2F0IG5vcm1hbCBtYXAgVVYgY2hhbm5lbC5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gY2xlYXJDb2F0Tm9ybWFsTWFwVGlsaW5nIENvbnRyb2xzIHRoZSAyRCB0aWxpbmcgb2YgdGhlIG1haW4gY2xlYXJjb2F0IG5vcm1hbFxuICogbWFwLlxuICogQHByb3BlcnR5IHtWZWMyfSBjbGVhckNvYXROb3JtYWxNYXBPZmZzZXQgQ29udHJvbHMgdGhlIDJEIG9mZnNldCBvZiB0aGUgbWFpbiBjbGVhcmNvYXQgbm9ybWFsXG4gKiBtYXAuIEVhY2ggY29tcG9uZW50IGlzIGJldHdlZW4gMCBhbmQgMS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBjbGVhckNvYXROb3JtYWxNYXBSb3RhdGlvbiBDb250cm9scyB0aGUgMkQgcm90YXRpb24gKGluIGRlZ3JlZXMpIG9mIHRoZSBtYWluXG4gKiBjbGVhcmNvYXQgbWFwLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGNsZWFyQ29hdEJ1bXBpbmVzcyBUaGUgYnVtcGluZXNzIG9mIHRoZSBjbGVhcmNvYXQgbGF5ZXIuIFRoaXMgdmFsdWUgc2NhbGVzXG4gKiB0aGUgYXNzaWduZWQgbWFpbiBjbGVhcmNvYXQgbm9ybWFsIG1hcC4gSXQgc2hvdWxkIGJlIG5vcm1hbGx5IGJldHdlZW4gMCAobm8gYnVtcCBtYXBwaW5nKSBhbmQgMVxuICogKGZ1bGwgYnVtcCBtYXBwaW5nKSwgYnV0IGNhbiBiZSBzZXQgdG8gZS5nLiAyIHRvIGdpdmUgZXZlbiBtb3JlIHByb25vdW5jZWQgYnVtcCBlZmZlY3QuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IHVzZUlyaWRlc2NlbmNlIEVuYWJsZSB0aGluLWZpbG0gaXJpZGVzY2VuY2UuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcycpLlRleHR1cmV8bnVsbH0gaXJpZGVzY2VuY2VNYXAgVGhlXG4gKiBwZXItcGl4ZWwgaXJpZGVzY2VuY2UgaW50ZW5zaXR5LiBPbmx5IHVzZWQgd2hlbiB1c2VJcmlkZXNjZW5jZSBpcyBlbmFibGVkLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGlyaWRlc2NlbmNlTWFwVXYgSXJpZGVzY2VuY2UgbWFwIFVWIGNoYW5uZWwuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IGlyaWRlc2NlbmNlTWFwVGlsaW5nIENvbnRyb2xzIHRoZSAyRCB0aWxpbmcgb2YgdGhlIGlyaWRlc2NlbmNlIG1hcC5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gaXJpZGVzY2VuY2VNYXBPZmZzZXQgQ29udHJvbHMgdGhlIDJEIG9mZnNldCBvZiB0aGUgaXJpZGVzY2VuY2UgbWFwLiBFYWNoIGNvbXBvbmVudCBpc1xuICogYmV0d2VlbiAwIGFuZCAxLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGlyaWRlc2NlbmNlTWFwUm90YXRpb24gQ29udHJvbHMgdGhlIDJEIHJvdGF0aW9uIChpbiBkZWdyZWVzKSBvZiB0aGUgaXJpZGVzY2VuY2VcbiAqIG1hcC5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBpcmlkZXNjZW5jZU1hcENoYW5uZWwgQ29sb3IgY2hhbm5lbHMgb2YgdGhlIGlyaWRlc2NlbmNlIG1hcCB0byB1c2UuIENhbiBiZSBcInJcIixcbiAqIFwiZ1wiLCBcImJcIiBvciBcImFcIi5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJykuVGV4dHVyZXxudWxsfSBpcmlkZXNjZW5jZVRoaWNrbmVzc01hcCBUaGVcbiAqIHBlci1waXhlbCBpcmlkZXNjZW5jZSB0aGlja25lc3MuIERlZmluZXMgYSBncmFkaWVudCB3ZWlnaHQgYmV0d2VlbiBpcmlkZXNjZW5jZVRoaWNrbmVzc01pbiBhbmRcbiAqIGlyaWRlc2NlbmNlVGhpY2tuZXNzTWF4LiBPbmx5IHVzZWQgd2hlbiB1c2VJcmlkZXNjZW5jZSBpcyBlbmFibGVkLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGlyaWRlc2NlbmNlVGhpY2tuZXNzTWFwVXYgSXJpZGVzY2VuY2UgdGhpY2tuZXNzIG1hcCBVViBjaGFubmVsLlxuICogQHByb3BlcnR5IHtWZWMyfSBpcmlkZXNjZW5jZVRoaWNrbmVzc01hcFRpbGluZyBDb250cm9scyB0aGUgMkQgdGlsaW5nIG9mIHRoZSBpcmlkZXNjZW5jZVxuICogdGhpY2tuZXNzIG1hcC5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gaXJpZGVzY2VuY2VUaGlja25lc3NNYXBPZmZzZXQgQ29udHJvbHMgdGhlIDJEIG9mZnNldCBvZiB0aGUgaXJpZGVzY2VuY2VcbiAqIHRoaWNrbmVzcyBtYXAuIEVhY2ggY29tcG9uZW50IGlzIGJldHdlZW4gMCBhbmQgMS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBpcmlkZXNjZW5jZVRoaWNrbmVzc01hcFJvdGF0aW9uIENvbnRyb2xzIHRoZSAyRCByb3RhdGlvbiAoaW4gZGVncmVlcylcbiAqIG9mIHRoZSBpcmlkZXNjZW5jZSBtYXAuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gaXJpZGVzY2VuY2VUaGlja25lc3NNYXBDaGFubmVsIENvbG9yIGNoYW5uZWxzIG9mIHRoZSBpcmlkZXNjZW5jZSB0aGlja25lc3NcbiAqIG1hcCB0byB1c2UuIENhbiBiZSBcInJcIiwgXCJnXCIsIFwiYlwiIG9yIFwiYVwiLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGlyaWRlc2NlbmNlVGhpY2tuZXNzTWluIFRoZSBtaW5pbXVtIHRoaWNrbmVzcyBmb3IgdGhlIGlyaWRlc2NlbmNlIGxheWVyLlxuICogT25seSB1c2VkIHdoZW4gYW4gaXJpZGVzY2VuY2UgdGhpY2tuZXNzIG1hcCBpcyB1c2VkLiBUaGUgdW5pdCBpcyBpbiBubS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBpcmlkZXNjZW5jZVRoaWNrbmVzc01heCBUaGUgbWF4aW11bSB0aGlja25lc3MgZm9yIHRoZSBpcmlkZXNjZW5jZSBsYXllci5cbiAqIFVzZWQgYXMgdGhlICdiYXNlJyB0aGlja25lc3Mgd2hlbiBubyBpcmlkZXNjZW5jZSB0aGlja25lc3MgbWFwIGlzIGRlZmluZWQuIFRoZSB1bml0IGlzIGluIG5tLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGlyaWRlc2NlbmNlUmVmcmFjdGlvbkluZGV4IFRoZSBpbmRleCBvZiByZWZyYWN0aW9uIG9mIHRoZSBpcmlkZXNjZW50XG4gKiB0aGluLWZpbG0uIEFmZmVjdHMgdGhlIGNvbG9yIHBoYXNlIHNoaWZ0IGFzIGRlc2NyaWJlZCBoZXJlOlxuICogaHR0cHM6Ly9naXRodWIuY29tL0tocm9ub3NHcm91cC9nbFRGL3RyZWUvbWFpbi9leHRlbnNpb25zLzIuMC9LaHJvbm9zL0tIUl9tYXRlcmlhbHNfaXJpZGVzY2VuY2VcbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gdXNlTWV0YWxuZXNzIFVzZSBtZXRhbG5lc3MgcHJvcGVydGllcyBpbnN0ZWFkIG9mIHNwZWN1bGFyLiBXaGVuIGVuYWJsZWQsXG4gKiBkaWZmdXNlIGNvbG9ycyBhbHNvIGFmZmVjdCBzcGVjdWxhciBpbnN0ZWFkIG9mIHRoZSBkZWRpY2F0ZWQgc3BlY3VsYXIgbWFwLiBUaGlzIGNhbiBiZSB1c2VkIGFzXG4gKiBhbHRlcm5hdGl2ZSB0byBzcGVjdWxhciBjb2xvciB0byBzYXZlIHNwYWNlLiBXaXRoIG1ldGFsbmVzcyA9PSAwLCB0aGUgcGl4ZWwgaXMgYXNzdW1lZCB0byBiZVxuICogZGllbGVjdHJpYywgYW5kIGRpZmZ1c2UgY29sb3IgaXMgdXNlZCBhcyBub3JtYWwuIFdpdGggbWV0YWxuZXNzID09IDEsIHRoZSBwaXhlbCBpcyBmdWxseVxuICogbWV0YWxsaWMsIGFuZCBkaWZmdXNlIGNvbG9yIGlzIHVzZWQgYXMgc3BlY3VsYXIgY29sb3IgaW5zdGVhZC5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gdXNlTWV0YWxuZXNzU3BlY3VsYXJDb2xvciBXaGVuIG1ldGFsbmVzcyBpcyBlbmFibGVkLCB1c2UgdGhlXG4gKiBzcGVjdWxhciBtYXAgdG8gYXBwbHkgY29sb3IgdGludCB0byBzcGVjdWxhciByZWZsZWN0aW9ucy5cbiAqIGF0IGRpcmVjdCBhbmdsZXMuXG4gKiBAcHJvcGVydHkge251bWJlcn0gbWV0YWxuZXNzIERlZmluZXMgaG93IG11Y2ggdGhlIHN1cmZhY2UgaXMgbWV0YWxsaWMuIEZyb20gMCAoZGllbGVjdHJpYykgdG8gMVxuICogKG1ldGFsKS5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJykuVGV4dHVyZXxudWxsfSBtZXRhbG5lc3NNYXAgTW9ub2Nocm9tZVxuICogbWV0YWxuZXNzIG1hcCAoZGVmYXVsdCBpcyBudWxsKS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBtZXRhbG5lc3NNYXBVdiBNZXRhbG5lc3MgbWFwIFVWIGNoYW5uZWwuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IG1ldGFsbmVzc01hcFRpbGluZyBDb250cm9scyB0aGUgMkQgdGlsaW5nIG9mIHRoZSBtZXRhbG5lc3MgbWFwLlxuICogQHByb3BlcnR5IHtWZWMyfSBtZXRhbG5lc3NNYXBPZmZzZXQgQ29udHJvbHMgdGhlIDJEIG9mZnNldCBvZiB0aGUgbWV0YWxuZXNzIG1hcC4gRWFjaCBjb21wb25lbnRcbiAqIGlzIGJldHdlZW4gMCBhbmQgMS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBtZXRhbG5lc3NNYXBSb3RhdGlvbiBDb250cm9scyB0aGUgMkQgcm90YXRpb24gKGluIGRlZ3JlZXMpIG9mIHRoZSBtZXRhbG5lc3NcbiAqIG1hcC5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBtZXRhbG5lc3NNYXBDaGFubmVsIENvbG9yIGNoYW5uZWwgb2YgdGhlIG1ldGFsbmVzcyBtYXAgdG8gdXNlLiBDYW4gYmUgXCJyXCIsXG4gKiBcImdcIiwgXCJiXCIgb3IgXCJhXCIuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IG1ldGFsbmVzc1ZlcnRleENvbG9yIFVzZSBtZXNoIHZlcnRleCBjb2xvcnMgZm9yIG1ldGFsbmVzcy4gSWYgbWV0YWxuZXNzTWFwXG4gKiBpcyBzZXQsIGl0J2xsIGJlIG11bHRpcGxpZWQgYnkgdmVydGV4IGNvbG9ycy5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBtZXRhbG5lc3NWZXJ0ZXhDb2xvckNoYW5uZWwgVmVydGV4IGNvbG9yIGNoYW5uZWwgdG8gdXNlIGZvciBtZXRhbG5lc3MuIENhbiBiZVxuICogXCJyXCIsIFwiZ1wiLCBcImJcIiBvciBcImFcIi5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBnbG9zcyBEZWZpbmVzIHRoZSBnbG9zc2luZXNzIG9mIHRoZSBtYXRlcmlhbCBmcm9tIDAgKHJvdWdoKSB0byAxIChzaGlueSkuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcycpLlRleHR1cmV8bnVsbH0gZ2xvc3NNYXAgR2xvc3MgbWFwXG4gKiAoZGVmYXVsdCBpcyBudWxsKS4gSWYgc3BlY2lmaWVkLCB3aWxsIGJlIG11bHRpcGxpZWQgYnkgbm9ybWFsaXplZCBnbG9zcyB2YWx1ZSBhbmQvb3IgdmVydGV4XG4gKiBjb2xvcnMuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IGdsb3NzSW52ZXJ0IEludmVydCB0aGUgZ2xvc3MgY29tcG9uZW50IChkZWZhdWx0IGlzIGZhbHNlKS4gRW5hYmxpbmcgdGhpc1xuICogZmxhZyByZXN1bHRzIGluIG1hdGVyaWFsIHRyZWF0aW5nIHRoZSBnbG9zcyBtZW1iZXJzIGFzIHJvdWdobmVzcy5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBnbG9zc01hcFV2IEdsb3NzIG1hcCBVViBjaGFubmVsLlxuICogQHByb3BlcnR5IHtzdHJpbmd9IGdsb3NzTWFwQ2hhbm5lbCBDb2xvciBjaGFubmVsIG9mIHRoZSBnbG9zcyBtYXAgdG8gdXNlLiBDYW4gYmUgXCJyXCIsIFwiZ1wiLCBcImJcIlxuICogb3IgXCJhXCIuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IGdsb3NzTWFwVGlsaW5nIENvbnRyb2xzIHRoZSAyRCB0aWxpbmcgb2YgdGhlIGdsb3NzIG1hcC5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gZ2xvc3NNYXBPZmZzZXQgQ29udHJvbHMgdGhlIDJEIG9mZnNldCBvZiB0aGUgZ2xvc3MgbWFwLiBFYWNoIGNvbXBvbmVudCBpc1xuICogYmV0d2VlbiAwIGFuZCAxLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGdsb3NzTWFwUm90YXRpb24gQ29udHJvbHMgdGhlIDJEIHJvdGF0aW9uIChpbiBkZWdyZWVzKSBvZiB0aGUgZ2xvc3MgbWFwLlxuICogQHByb3BlcnR5IHtib29sZWFufSBnbG9zc1ZlcnRleENvbG9yIFVzZSBtZXNoIHZlcnRleCBjb2xvcnMgZm9yIGdsb3NzaW5lc3MuIElmIGdsb3NzTWFwIGlzIHNldCxcbiAqIGl0J2xsIGJlIG11bHRpcGxpZWQgYnkgdmVydGV4IGNvbG9ycy5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBnbG9zc1ZlcnRleENvbG9yQ2hhbm5lbCBWZXJ0ZXggY29sb3IgY2hhbm5lbCB0byB1c2UgZm9yIGdsb3NzaW5lc3MuIENhbiBiZVxuICogXCJyXCIsIFwiZ1wiLCBcImJcIiBvciBcImFcIi5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSByZWZyYWN0aW9uIERlZmluZXMgdGhlIHZpc2liaWxpdHkgb2YgcmVmcmFjdGlvbi4gTWF0ZXJpYWwgY2FuIHJlZnJhY3QgdGhlXG4gKiBzYW1lIGN1YmUgbWFwIGFzIHVzZWQgZm9yIHJlZmxlY3Rpb25zLlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnKS5UZXh0dXJlfG51bGx9IHJlZnJhY3Rpb25NYXAgVGhlIG1hcCBvZlxuICogdGhlIHJlZnJhY3Rpb24gdmlzaWJpbGl0eS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSByZWZyYWN0aW9uTWFwVXYgUmVmcmFjdGlvbiBtYXAgVVYgY2hhbm5lbC5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gcmVmcmFjdGlvbk1hcFRpbGluZyBDb250cm9scyB0aGUgMkQgdGlsaW5nIG9mIHRoZSByZWZyYWN0aW9uIG1hcC5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gcmVmcmFjdGlvbk1hcE9mZnNldCBDb250cm9scyB0aGUgMkQgb2Zmc2V0IG9mIHRoZSByZWZyYWN0aW9uIG1hcC4gRWFjaCBjb21wb25lbnRcbiAqIGlzIGJldHdlZW4gMCBhbmQgMS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSByZWZyYWN0aW9uTWFwUm90YXRpb24gQ29udHJvbHMgdGhlIDJEIHJvdGF0aW9uIChpbiBkZWdyZWVzKSBvZiB0aGUgZW1pc3NpdmVcbiAqIG1hcC5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSByZWZyYWN0aW9uTWFwQ2hhbm5lbCBDb2xvciBjaGFubmVscyBvZiB0aGUgcmVmcmFjdGlvbiBtYXAgdG8gdXNlLiBDYW4gYmUgXCJyXCIsXG4gKiBcImdcIiwgXCJiXCIsIFwiYVwiLCBcInJnYlwiIG9yIGFueSBzd2l6emxlZCBjb21iaW5hdGlvbi5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gcmVmcmFjdGlvblZlcnRleENvbG9yIFVzZSBtZXNoIHZlcnRleCBjb2xvcnMgZm9yIHJlZnJhY3Rpb24uIElmXG4gKiByZWZyYWN0aW9uIG1hcCBpcyBzZXQsIGl0IHdpbGwgYmUgYmUgbXVsdGlwbGllZCBieSB2ZXJ0ZXggY29sb3JzLlxuICogQHByb3BlcnR5IHtib29sZWFufSByZWZyYWN0aW9uVmVydGV4Q29sb3JDaGFubmVsIFZlcnRleCBjb2xvciBjaGFubmVsIHRvIHVzZSBmb3IgcmVmcmFjdGlvbi5cbiAqIENhbiBiZSBcInJcIiwgXCJnXCIsIFwiYlwiIG9yIFwiYVwiLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHJlZnJhY3Rpb25JbmRleCBEZWZpbmVzIHRoZSBpbmRleCBvZiByZWZyYWN0aW9uLCBpLmUuIFRoZSBhbW91bnQgb2ZcbiAqIGRpc3RvcnRpb24uIFRoZSB2YWx1ZSBpcyBjYWxjdWxhdGVkIGFzIChvdXRlcklvciAvIHN1cmZhY2VJb3IpLCB3aGVyZSBpbnB1dHMgYXJlIG1lYXN1cmVkXG4gKiBpbmRpY2VzIG9mIHJlZnJhY3Rpb24sIHRoZSBvbmUgYXJvdW5kIHRoZSBvYmplY3QgYW5kIHRoZSBvbmUgb2YgaXRzIG93biBzdXJmYWNlLiBJbiBtb3N0XG4gKiBzaXR1YXRpb25zIG91dGVyIG1lZGl1bSBpcyBhaXIsIHNvIG91dGVySW9yIHdpbGwgYmUgYXBwcm94aW1hdGVseSAxLiBUaGVuIHlvdSBvbmx5IG5lZWQgdG8gZG9cbiAqICgxLjAgLyBzdXJmYWNlSW9yKS5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gdXNlRHluYW1pY1JlZnJhY3Rpb24gRW5hYmxlcyBoaWdoZXIgcXVhbGl0eSByZWZyYWN0aW9ucyB1c2luZyB0aGUgZ3JhYiBwYXNzXG4gKiBpbnN0ZWFkIG9mIHByZS1jb21wdXRlZCBjdWJlIG1hcHMgZm9yIHJlZnJhY3Rpb25zLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHRoaWNrbmVzcyBUaGUgdGhpY2tuZXNzIG9mIHRoZSBtZWRpdW0sIG9ubHkgdXNlZCB3aGVuIHVzZUR5bmFtaWNSZWZyYWN0aW9uXG4gKiBpcyBlbmFibGVkLiBUaGUgdW5pdCBpcyBpbiBiYXNlIHVuaXRzLCBhbmQgc2NhbGVzIHdpdGggdGhlIHNpemUgb2YgdGhlIG9iamVjdC5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJykuVGV4dHVyZXxudWxsfSB0aGlja25lc3NNYXAgVGhlXG4gKiBwZXItcGl4ZWwgdGhpY2tuZXNzIG9mIHRoZSBtZWRpdW0sIG9ubHkgdXNlZCB3aGVuIHVzZUR5bmFtaWNSZWZyYWN0aW9uIGlzIGVuYWJsZWQuXG4gKiBAcHJvcGVydHkge251bWJlcn0gdGhpY2tuZXNzTWFwVXYgVGhpY2tuZXNzIG1hcCBVViBjaGFubmVsLlxuICogQHByb3BlcnR5IHtWZWMyfSB0aGlja25lc3NNYXBUaWxpbmcgQ29udHJvbHMgdGhlIDJEIHRpbGluZyBvZiB0aGUgdGhpY2tuZXNzIG1hcC5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gdGhpY2tuZXNzTWFwT2Zmc2V0IENvbnRyb2xzIHRoZSAyRCBvZmZzZXQgb2YgdGhlIHRoaWNrbmVzcyBtYXAuIEVhY2ggY29tcG9uZW50IGlzXG4gKiBiZXR3ZWVuIDAgYW5kIDEuXG4gKiBAcHJvcGVydHkge251bWJlcn0gdGhpY2tuZXNzTWFwUm90YXRpb24gQ29udHJvbHMgdGhlIDJEIHJvdGF0aW9uIChpbiBkZWdyZWVzKSBvZiB0aGUgdGhpY2tuZXNzXG4gKiBtYXAuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gdGhpY2tuZXNzTWFwQ2hhbm5lbCBDb2xvciBjaGFubmVscyBvZiB0aGUgdGhpY2tuZXNzIG1hcCB0byB1c2UuIENhbiBiZSBcInJcIixcbiAqIFwiZ1wiLCBcImJcIiBvciBcImFcIi5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gdGhpY2tuZXNzVmVydGV4Q29sb3IgVXNlIG1lc2ggdmVydGV4IGNvbG9ycyBmb3IgdGhpY2tuZXNzLiBJZlxuICogdGhpY2tuZXNzIG1hcCBpcyBzZXQsIGl0IHdpbGwgYmUgYmUgbXVsdGlwbGllZCBieSB2ZXJ0ZXggY29sb3JzLlxuICogQHByb3BlcnR5IHtDb2xvcn0gYXR0ZW51YXRpb24gVGhlIGF0dGVudWF0aW9uIGNvbG9yIGZvciByZWZyYWN0aXZlIG1hdGVyaWFscywgb25seSB1c2VkIHdoZW5cbiAqIHVzZUR5bmFtaWNSZWZyYWN0aW9uIGlzIGVuYWJsZWQuXG4gKiBAcHJvcGVydHkge251bWJlcn0gYXR0ZW51YXRpb25EaXN0YW5jZSBUaGUgZGlzdGFuY2UgZGVmaW5pbmcgdGhlIGFic29ycHRpb24gcmF0ZSBvZiBsaWdodFxuICogd2l0aGluIHRoZSBtZWRpdW0uIE9ubHkgdXNlZCB3aGVuIHVzZUR5bmFtaWNSZWZyYWN0aW9uIGlzIGVuYWJsZWQuXG4gKiBAcHJvcGVydHkge0NvbG9yfSBlbWlzc2l2ZSBUaGUgZW1pc3NpdmUgY29sb3Igb2YgdGhlIG1hdGVyaWFsLiBUaGlzIGNvbG9yIHZhbHVlIGlzIDMtY29tcG9uZW50XG4gKiAoUkdCKSwgd2hlcmUgZWFjaCBjb21wb25lbnQgaXMgYmV0d2VlbiAwIGFuZCAxLlxuICogQHByb3BlcnR5IHtib29sZWFufSBlbWlzc2l2ZVRpbnQgTXVsdGlwbHkgZW1pc3NpdmUgbWFwIGFuZC9vciBlbWlzc2l2ZSB2ZXJ0ZXggY29sb3IgYnkgdGhlXG4gKiBjb25zdGFudCBlbWlzc2l2ZSB2YWx1ZS5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJykuVGV4dHVyZXxudWxsfSBlbWlzc2l2ZU1hcCBUaGUgZW1pc3NpdmVcbiAqIG1hcCBvZiB0aGUgbWF0ZXJpYWwgKGRlZmF1bHQgaXMgbnVsbCkuIENhbiBiZSBIRFIuXG4gKiBAcHJvcGVydHkge251bWJlcn0gZW1pc3NpdmVJbnRlbnNpdHkgRW1pc3NpdmUgY29sb3IgbXVsdGlwbGllci5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBlbWlzc2l2ZU1hcFV2IEVtaXNzaXZlIG1hcCBVViBjaGFubmVsLlxuICogQHByb3BlcnR5IHtWZWMyfSBlbWlzc2l2ZU1hcFRpbGluZyBDb250cm9scyB0aGUgMkQgdGlsaW5nIG9mIHRoZSBlbWlzc2l2ZSBtYXAuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IGVtaXNzaXZlTWFwT2Zmc2V0IENvbnRyb2xzIHRoZSAyRCBvZmZzZXQgb2YgdGhlIGVtaXNzaXZlIG1hcC4gRWFjaCBjb21wb25lbnQgaXNcbiAqIGJldHdlZW4gMCBhbmQgMS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBlbWlzc2l2ZU1hcFJvdGF0aW9uIENvbnRyb2xzIHRoZSAyRCByb3RhdGlvbiAoaW4gZGVncmVlcykgb2YgdGhlIGVtaXNzaXZlXG4gKiBtYXAuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gZW1pc3NpdmVNYXBDaGFubmVsIENvbG9yIGNoYW5uZWxzIG9mIHRoZSBlbWlzc2l2ZSBtYXAgdG8gdXNlLiBDYW4gYmUgXCJyXCIsXG4gKiBcImdcIiwgXCJiXCIsIFwiYVwiLCBcInJnYlwiIG9yIGFueSBzd2l6emxlZCBjb21iaW5hdGlvbi5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gZW1pc3NpdmVWZXJ0ZXhDb2xvciBVc2UgbWVzaCB2ZXJ0ZXggY29sb3JzIGZvciBlbWlzc2lvbi4gSWYgZW1pc3NpdmVNYXAgb3JcbiAqIGVtaXNzaXZlVGludCBhcmUgc2V0LCB0aGV5J2xsIGJlIG11bHRpcGxpZWQgYnkgdmVydGV4IGNvbG9ycy5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBlbWlzc2l2ZVZlcnRleENvbG9yQ2hhbm5lbCBWZXJ0ZXggY29sb3IgY2hhbm5lbHMgdG8gdXNlIGZvciBlbWlzc2lvbi4gQ2FuIGJlXG4gKiBcInJcIiwgXCJnXCIsIFwiYlwiLCBcImFcIiwgXCJyZ2JcIiBvciBhbnkgc3dpenpsZWQgY29tYmluYXRpb24uXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IHVzZVNoZWVuIFRvZ2dsZSBzaGVlbiBzcGVjdWxhciBlZmZlY3Qgb24vb2ZmLlxuICogQHByb3BlcnR5IHtDb2xvcn0gc2hlZW4gVGhlIHNwZWN1bGFyIGNvbG9yIG9mIHRoZSBzaGVlbiAoZmFicmljKSBtaWNyb2ZpYmVyIHN0cnVjdHVyZS5cbiAqIFRoaXMgY29sb3IgdmFsdWUgaXMgMy1jb21wb25lbnQgKFJHQiksIHdoZXJlIGVhY2ggY29tcG9uZW50IGlzIGJldHdlZW4gMCBhbmQgMS5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gc2hlZW5UaW50IE11bHRpcGx5IHNoZWVuIG1hcCBhbmQvb3Igc2hlZW4gdmVydGV4IGNvbG9yIGJ5IHRoZSBjb25zdGFudFxuICogc2hlZW4gdmFsdWUuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcycpLlRleHR1cmV8bnVsbH0gc2hlZW5NYXAgVGhlIHNoZWVuXG4gKiBtaWNyb3N0cnVjdHVyZSBjb2xvciBtYXAgb2YgdGhlIG1hdGVyaWFsIChkZWZhdWx0IGlzIG51bGwpLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHNoZWVuTWFwVXYgU2hlZW4gbWFwIFVWIGNoYW5uZWwuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IHNoZWVuTWFwVGlsaW5nIENvbnRyb2xzIHRoZSAyRCB0aWxpbmcgb2YgdGhlIHNoZWVuIG1hcC5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gc2hlZW5NYXBPZmZzZXQgQ29udHJvbHMgdGhlIDJEIG9mZnNldCBvZiB0aGUgc2hlZW4gbWFwLiBFYWNoIGNvbXBvbmVudCBpc1xuICogYmV0d2VlbiAwIGFuZCAxLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHNoZWVuTWFwUm90YXRpb24gQ29udHJvbHMgdGhlIDJEIHJvdGF0aW9uIChpbiBkZWdyZWVzKSBvZiB0aGUgc2hlZW5cbiAqIG1hcC5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBzaGVlbk1hcENoYW5uZWwgQ29sb3IgY2hhbm5lbHMgb2YgdGhlIHNoZWVuIG1hcCB0byB1c2UuIENhbiBiZSBcInJcIixcbiAqIFwiZ1wiLCBcImJcIiwgXCJhXCIsIFwicmdiXCIgb3IgYW55IHN3aXp6bGVkIGNvbWJpbmF0aW9uLlxuICogQHByb3BlcnR5IHtib29sZWFufSBzaGVlblZlcnRleENvbG9yIFVzZSBtZXNoIHZlcnRleCBjb2xvcnMgZm9yIHNoZWVuLiBJZiBzaGVlbiBtYXAgb3JcbiAqIHNoZWVuIHRpbnQgYXJlIHNldCwgdGhleSdsbCBiZSBtdWx0aXBsaWVkIGJ5IHZlcnRleCBjb2xvcnMuXG4gKiBAcHJvcGVydHkge251bWJlcn0gc2hlZW5HbG9zcyBUaGUgZ2xvc3NpbmVzcyBvZiB0aGUgc2hlZW4gKGZhYnJpYykgbWljcm9maWJlciBzdHJ1Y3R1cmUuXG4gKiBUaGlzIGNvbG9yIHZhbHVlIGlzIGEgc2luZ2xlIHZhbHVlIGJldHdlZW4gMCBhbmQgMS5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gc2hlZW5HbG9zc0ludmVydCBJbnZlcnQgdGhlIHNoZWVuIGdsb3NzIGNvbXBvbmVudCAoZGVmYXVsdCBpcyBmYWxzZSkuXG4gKiBFbmFibGluZyB0aGlzIGZsYWcgcmVzdWx0cyBpbiBtYXRlcmlhbCB0cmVhdGluZyB0aGUgc2hlZW4gZ2xvc3MgbWVtYmVycyBhcyByb3VnaG5lc3MuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IHNoZWVuR2xvc3NUaW50IE11bHRpcGx5IHNoZWVuIGdsb3NzaW5lc3MgbWFwIGFuZC9vciBzaGVlbiBnbG9zc2luZXNzIHZlcnRleFxuICogdmFsdWUgYnkgdGhlIHNjYWxhciBzaGVlbiBnbG9zc2luZXNzIHZhbHVlLlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnKS5UZXh0dXJlfG51bGx9IHNoZWVuR2xvc3NNYXAgVGhlIHNoZWVuXG4gKiBnbG9zc2luZXNzIG1pY3Jvc3RydWN0dXJlIGNvbG9yIG1hcCBvZiB0aGUgbWF0ZXJpYWwgKGRlZmF1bHQgaXMgbnVsbCkuXG4gKiBAcHJvcGVydHkge251bWJlcn0gc2hlZW5HbG9zc01hcFV2IFNoZWVuIG1hcCBVViBjaGFubmVsLlxuICogQHByb3BlcnR5IHtWZWMyfSBzaGVlbkdsb3NzTWFwVGlsaW5nIENvbnRyb2xzIHRoZSAyRCB0aWxpbmcgb2YgdGhlIHNoZWVuIGdsb3NzaW5lc3MgbWFwLlxuICogQHByb3BlcnR5IHtWZWMyfSBzaGVlbkdsb3NzTWFwT2Zmc2V0IENvbnRyb2xzIHRoZSAyRCBvZmZzZXQgb2YgdGhlIHNoZWVuIGdsb3NzaW5lc3MgbWFwLlxuICogRWFjaCBjb21wb25lbnQgaXMgYmV0d2VlbiAwIGFuZCAxLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHNoZWVuR2xvc3NNYXBSb3RhdGlvbiBDb250cm9scyB0aGUgMkQgcm90YXRpb24gKGluIGRlZ3JlZXMpIG9mIHRoZSBzaGVlblxuICogZ2xvc3NpbmVzcyBtYXAuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gc2hlZW5HbG9zc01hcENoYW5uZWwgQ29sb3IgY2hhbm5lbHMgb2YgdGhlIHNoZWVuIGdsb3NzaW5lc3MgbWFwIHRvIHVzZS5cbiAqIENhbiBiZSBcInJcIiwgXCJnXCIsIFwiYlwiLCBcImFcIiwgXCJyZ2JcIiBvciBhbnkgc3dpenpsZWQgY29tYmluYXRpb24uXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IHNoZWVuR2xvc3NWZXJ0ZXhDb2xvciBVc2UgbWVzaCB2ZXJ0ZXggY29sb3JzIGZvciBzaGVlbiBnbG9zc2luZXNzLlxuICogSWYgc2hlZW4gZ2xvc3NpbmVzcyBtYXAgb3Igc2hlZW4gZ2xvc3NpbmVzcyB0aW50IGFyZSBzZXQsIHRoZXknbGwgYmUgbXVsdGlwbGllZCBieSB2ZXJ0ZXggY29sb3JzLlxuICogQHByb3BlcnR5IHtzdHJpbmd9IHNoZWVuR2xvc3NWZXJ0ZXhDb2xvckNoYW5uZWwgVmVydGV4IGNvbG9yIGNoYW5uZWxzIHRvIHVzZSBmb3Igc2hlZW4gZ2xvc3NpbmVzcy5cbiAqIENhbiBiZSBcInJcIiwgXCJnXCIsIFwiYlwiIG9yIFwiYVwiLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IG9wYWNpdHkgVGhlIG9wYWNpdHkgb2YgdGhlIG1hdGVyaWFsLiBUaGlzIHZhbHVlIGNhbiBiZSBiZXR3ZWVuIDAgYW5kIDEsIHdoZXJlXG4gKiAwIGlzIGZ1bGx5IHRyYW5zcGFyZW50IGFuZCAxIGlzIGZ1bGx5IG9wYXF1ZS4gSWYgeW91IHdhbnQgdGhlIG1hdGVyaWFsIHRvIGJlIHNlbWktdHJhbnNwYXJlbnRcbiAqIHlvdSBhbHNvIG5lZWQgdG8gc2V0IHRoZSB7QGxpbmsgTWF0ZXJpYWwjYmxlbmRUeXBlfSB0byB7QGxpbmsgQkxFTkRfTk9STUFMfSxcbiAqIHtAbGluayBCTEVORF9BRERJVElWRX0gb3IgYW55IG90aGVyIG1vZGUuIEFsc28gbm90ZSB0aGF0IGZvciBtb3N0IHNlbWktdHJhbnNwYXJlbnQgb2JqZWN0cyB5b3VcbiAqIHdhbnQge0BsaW5rIE1hdGVyaWFsI2RlcHRoV3JpdGV9IHRvIGJlIGZhbHNlLCBvdGhlcndpc2UgdGhleSBjYW4gZnVsbHkgb2NjbHVkZSBvYmplY3RzIGJlaGluZFxuICogdGhlbS5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJykuVGV4dHVyZXxudWxsfSBvcGFjaXR5TWFwIFRoZSBvcGFjaXR5IG1hcFxuICogb2YgdGhlIG1hdGVyaWFsIChkZWZhdWx0IGlzIG51bGwpLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IG9wYWNpdHlNYXBVdiBPcGFjaXR5IG1hcCBVViBjaGFubmVsLlxuICogQHByb3BlcnR5IHtzdHJpbmd9IG9wYWNpdHlNYXBDaGFubmVsIENvbG9yIGNoYW5uZWwgb2YgdGhlIG9wYWNpdHkgbWFwIHRvIHVzZS4gQ2FuIGJlIFwiclwiLCBcImdcIixcbiAqIFwiYlwiIG9yIFwiYVwiLlxuICogQHByb3BlcnR5IHtWZWMyfSBvcGFjaXR5TWFwVGlsaW5nIENvbnRyb2xzIHRoZSAyRCB0aWxpbmcgb2YgdGhlIG9wYWNpdHkgbWFwLlxuICogQHByb3BlcnR5IHtWZWMyfSBvcGFjaXR5TWFwT2Zmc2V0IENvbnRyb2xzIHRoZSAyRCBvZmZzZXQgb2YgdGhlIG9wYWNpdHkgbWFwLiBFYWNoIGNvbXBvbmVudCBpc1xuICogYmV0d2VlbiAwIGFuZCAxLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IG9wYWNpdHlNYXBSb3RhdGlvbiBDb250cm9scyB0aGUgMkQgcm90YXRpb24gKGluIGRlZ3JlZXMpIG9mIHRoZSBvcGFjaXR5IG1hcC5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gb3BhY2l0eVZlcnRleENvbG9yIFVzZSBtZXNoIHZlcnRleCBjb2xvcnMgZm9yIG9wYWNpdHkuIElmIG9wYWNpdHlNYXAgaXMgc2V0LFxuICogaXQnbGwgYmUgbXVsdGlwbGllZCBieSB2ZXJ0ZXggY29sb3JzLlxuICogQHByb3BlcnR5IHtzdHJpbmd9IG9wYWNpdHlWZXJ0ZXhDb2xvckNoYW5uZWwgVmVydGV4IGNvbG9yIGNoYW5uZWxzIHRvIHVzZSBmb3Igb3BhY2l0eS4gQ2FuIGJlXG4gKiBcInJcIiwgXCJnXCIsIFwiYlwiIG9yIFwiYVwiLlxuICogQHByb3BlcnR5IHtib29sZWFufSBvcGFjaXR5RmFkZXNTcGVjdWxhciB1c2VkIHRvIHNwZWNpZnkgd2hldGhlciBzcGVjdWxhciBhbmQgcmVmbGVjdGlvbnMgYXJlXG4gKiBmYWRlZCBvdXQgdXNpbmcge0BsaW5rIFN0YW5kYXJkTWF0ZXJpYWwjb3BhY2l0eX0uIERlZmF1bHQgaXMgdHJ1ZS4gV2hlbiBzZXQgdG8gZmFsc2UgdXNlXG4gKiB7QGxpbmsgTWF0ZXJpYWwjYWxwaGFGYWRlfSB0byBmYWRlIG91dCBtYXRlcmlhbHMuXG4gKiBAcHJvcGVydHkge251bWJlcn0gYWxwaGFGYWRlIHVzZWQgdG8gZmFkZSBvdXQgbWF0ZXJpYWxzIHdoZW5cbiAqIHtAbGluayBTdGFuZGFyZE1hdGVyaWFsI29wYWNpdHlGYWRlc1NwZWN1bGFyfSBpcyBzZXQgdG8gZmFsc2UuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcycpLlRleHR1cmV8bnVsbH0gbm9ybWFsTWFwIFRoZSBtYWluXG4gKiAocHJpbWFyeSkgbm9ybWFsIG1hcCBvZiB0aGUgbWF0ZXJpYWwgKGRlZmF1bHQgaXMgbnVsbCkuIFRoZSB0ZXh0dXJlIG11c3QgY29udGFpbnMgbm9ybWFsaXplZCxcbiAqIHRhbmdlbnQgc3BhY2Ugbm9ybWFscy5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBub3JtYWxNYXBVdiBNYWluIChwcmltYXJ5KSBub3JtYWwgbWFwIFVWIGNoYW5uZWwuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IG5vcm1hbE1hcFRpbGluZyBDb250cm9scyB0aGUgMkQgdGlsaW5nIG9mIHRoZSBtYWluIChwcmltYXJ5KSBub3JtYWwgbWFwLlxuICogQHByb3BlcnR5IHtWZWMyfSBub3JtYWxNYXBPZmZzZXQgQ29udHJvbHMgdGhlIDJEIG9mZnNldCBvZiB0aGUgbWFpbiAocHJpbWFyeSkgbm9ybWFsIG1hcC4gRWFjaFxuICogY29tcG9uZW50IGlzIGJldHdlZW4gMCBhbmQgMS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBub3JtYWxNYXBSb3RhdGlvbiBDb250cm9scyB0aGUgMkQgcm90YXRpb24gKGluIGRlZ3JlZXMpIG9mIHRoZSBtYWluIChwcmltYXJ5KVxuICogbm9ybWFsIG1hcC5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBidW1waW5lc3MgVGhlIGJ1bXBpbmVzcyBvZiB0aGUgbWF0ZXJpYWwuIFRoaXMgdmFsdWUgc2NhbGVzIHRoZSBhc3NpZ25lZCBtYWluXG4gKiAocHJpbWFyeSkgbm9ybWFsIG1hcC4gSXQgc2hvdWxkIGJlIG5vcm1hbGx5IGJldHdlZW4gMCAobm8gYnVtcCBtYXBwaW5nKSBhbmQgMSAoZnVsbCBidW1wXG4gKiBtYXBwaW5nKSwgYnV0IGNhbiBiZSBzZXQgdG8gZS5nLiAyIHRvIGdpdmUgZXZlbiBtb3JlIHByb25vdW5jZWQgYnVtcCBlZmZlY3QuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcycpLlRleHR1cmV8bnVsbH0gbm9ybWFsRGV0YWlsTWFwIFRoZSBkZXRhaWxcbiAqIChzZWNvbmRhcnkpIG5vcm1hbCBtYXAgb2YgdGhlIG1hdGVyaWFsIChkZWZhdWx0IGlzIG51bGwpLiBXaWxsIG9ubHkgYmUgdXNlZCBpZiBtYWluIChwcmltYXJ5KVxuICogbm9ybWFsIG1hcCBpcyBub24tbnVsbC5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBub3JtYWxEZXRhaWxNYXBVdiBEZXRhaWwgKHNlY29uZGFyeSkgbm9ybWFsIG1hcCBVViBjaGFubmVsLlxuICogQHByb3BlcnR5IHtWZWMyfSBub3JtYWxEZXRhaWxNYXBUaWxpbmcgQ29udHJvbHMgdGhlIDJEIHRpbGluZyBvZiB0aGUgZGV0YWlsIChzZWNvbmRhcnkpIG5vcm1hbFxuICogbWFwLlxuICogQHByb3BlcnR5IHtWZWMyfSBub3JtYWxEZXRhaWxNYXBPZmZzZXQgQ29udHJvbHMgdGhlIDJEIG9mZnNldCBvZiB0aGUgZGV0YWlsIChzZWNvbmRhcnkpIG5vcm1hbFxuICogbWFwLiBFYWNoIGNvbXBvbmVudCBpcyBiZXR3ZWVuIDAgYW5kIDEuXG4gKiBAcHJvcGVydHkge251bWJlcn0gbm9ybWFsRGV0YWlsTWFwUm90YXRpb24gQ29udHJvbHMgdGhlIDJEIHJvdGF0aW9uIChpbiBkZWdyZWVzKSBvZiB0aGUgZGV0YWlsXG4gKiAoc2Vjb25kYXJ5KSBub3JtYWwgbWFwLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IG5vcm1hbERldGFpbE1hcEJ1bXBpbmVzcyBUaGUgYnVtcGluZXNzIG9mIHRoZSBtYXRlcmlhbC4gVGhpcyB2YWx1ZSBzY2FsZXMgdGhlXG4gKiBhc3NpZ25lZCBkZXRhaWwgKHNlY29uZGFyeSkgbm9ybWFsIG1hcC4gSXQgc2hvdWxkIGJlIG5vcm1hbGx5IGJldHdlZW4gMCAobm8gYnVtcCBtYXBwaW5nKSBhbmQgMVxuICogKGZ1bGwgYnVtcCBtYXBwaW5nKSwgYnV0IGNhbiBiZSBzZXQgdG8gZS5nLiAyIHRvIGdpdmUgZXZlbiBtb3JlIHByb25vdW5jZWQgYnVtcCBlZmZlY3QuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcycpLlRleHR1cmV8bnVsbH0gaGVpZ2h0TWFwIFRoZSBoZWlnaHQgbWFwXG4gKiBvZiB0aGUgbWF0ZXJpYWwgKGRlZmF1bHQgaXMgbnVsbCkuIFVzZWQgZm9yIGEgdmlldy1kZXBlbmRlbnQgcGFyYWxsYXggZWZmZWN0LiBUaGUgdGV4dHVyZSBtdXN0XG4gKiByZXByZXNlbnQgdGhlIGhlaWdodCBvZiB0aGUgc3VyZmFjZSB3aGVyZSBkYXJrZXIgcGl4ZWxzIGFyZSBsb3dlciBhbmQgbGlnaHRlciBwaXhlbHMgYXJlIGhpZ2hlci5cbiAqIEl0IGlzIHJlY29tbWVuZGVkIHRvIHVzZSBpdCB0b2dldGhlciB3aXRoIGEgbm9ybWFsIG1hcC5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBoZWlnaHRNYXBVdiBIZWlnaHQgbWFwIFVWIGNoYW5uZWwuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gaGVpZ2h0TWFwQ2hhbm5lbCBDb2xvciBjaGFubmVsIG9mIHRoZSBoZWlnaHQgbWFwIHRvIHVzZS4gQ2FuIGJlIFwiclwiLCBcImdcIiwgXCJiXCJcbiAqIG9yIFwiYVwiLlxuICogQHByb3BlcnR5IHtWZWMyfSBoZWlnaHRNYXBUaWxpbmcgQ29udHJvbHMgdGhlIDJEIHRpbGluZyBvZiB0aGUgaGVpZ2h0IG1hcC5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gaGVpZ2h0TWFwT2Zmc2V0IENvbnRyb2xzIHRoZSAyRCBvZmZzZXQgb2YgdGhlIGhlaWdodCBtYXAuIEVhY2ggY29tcG9uZW50IGlzXG4gKiBiZXR3ZWVuIDAgYW5kIDEuXG4gKiBAcHJvcGVydHkge251bWJlcn0gaGVpZ2h0TWFwUm90YXRpb24gQ29udHJvbHMgdGhlIDJEIHJvdGF0aW9uIChpbiBkZWdyZWVzKSBvZiB0aGUgaGVpZ2h0IG1hcC5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBoZWlnaHRNYXBGYWN0b3IgSGVpZ2h0IG1hcCBtdWx0aXBsaWVyLiBBZmZlY3RzIHRoZSBzdHJlbmd0aCBvZiB0aGUgcGFyYWxsYXhcbiAqIGVmZmVjdC5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJykuVGV4dHVyZXxudWxsfSBlbnZBdGxhcyBUaGUgcHJlZmlsdGVyZWRcbiAqIGVudmlyb25tZW50IGxpZ2h0aW5nIGF0bGFzIChkZWZhdWx0IGlzIG51bGwpLiBUaGlzIHNldHRpbmcgb3ZlcnJpZGVzIGN1YmVNYXAgYW5kIHNwaGVyZU1hcCBhbmRcbiAqIHdpbGwgcmVwbGFjZSB0aGUgc2NlbmUgbGlnaHRpbmcgZW52aXJvbm1lbnQuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcycpLlRleHR1cmV8bnVsbH0gY3ViZU1hcCBUaGUgY3ViaWNcbiAqIGVudmlyb25tZW50IG1hcCBvZiB0aGUgbWF0ZXJpYWwgKGRlZmF1bHQgaXMgbnVsbCkuIFRoaXMgc2V0dGluZyBvdmVycmlkZXMgc3BoZXJlTWFwIGFuZCB3aWxsXG4gKiByZXBsYWNlIHRoZSBzY2VuZSBsaWdodGluZyBlbnZpcm9ubWVudC5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJykuVGV4dHVyZXxudWxsfSBzcGhlcmVNYXAgVGhlIHNwaGVyaWNhbFxuICogZW52aXJvbm1lbnQgbWFwIG9mIHRoZSBtYXRlcmlhbCAoZGVmYXVsdCBpcyBudWxsKS4gVGhpcyB3aWxsIHJlcGxhY2UgdGhlIHNjZW5lIGxpZ2h0aW5nXG4gKiBlbnZpcm9ubWVudC5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBjdWJlTWFwUHJvamVjdGlvbiBUaGUgdHlwZSBvZiBwcm9qZWN0aW9uIGFwcGxpZWQgdG8gdGhlIGN1YmVNYXAgcHJvcGVydHk6XG4gKiAtIHtAbGluayBDVUJFUFJPSl9OT05FfTogVGhlIGN1YmUgbWFwIGlzIHRyZWF0ZWQgYXMgaWYgaXQgaXMgaW5maW5pdGVseSBmYXIgYXdheS5cbiAqIC0ge0BsaW5rIENVQkVQUk9KX0JPWH06IEJveC1wcm9qZWN0aW9uIGJhc2VkIG9uIGEgd29ybGQgc3BhY2UgYXhpcy1hbGlnbmVkIGJvdW5kaW5nIGJveC5cbiAqIERlZmF1bHRzIHRvIHtAbGluayBDVUJFUFJPSl9OT05FfS5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi9jb3JlL3NoYXBlL2JvdW5kaW5nLWJveC5qcycpLkJvdW5kaW5nQm94fSBjdWJlTWFwUHJvamVjdGlvbkJveCBUaGVcbiAqIHdvcmxkIHNwYWNlIGF4aXMtYWxpZ25lZCBib3VuZGluZyBib3ggZGVmaW5pbmcgdGhlIGJveC1wcm9qZWN0aW9uIHVzZWQgZm9yIHRoZSBjdWJlTWFwIHByb3BlcnR5LlxuICogT25seSB1c2VkIHdoZW4gY3ViZU1hcFByb2plY3Rpb24gaXMgc2V0IHRvIHtAbGluayBDVUJFUFJPSl9CT1h9LlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHJlZmxlY3Rpdml0eSBFbnZpcm9ubWVudCBtYXAgaW50ZW5zaXR5LlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnKS5UZXh0dXJlfG51bGx9IGxpZ2h0TWFwIEEgY3VzdG9tIGxpZ2h0bWFwXG4gKiBvZiB0aGUgbWF0ZXJpYWwgKGRlZmF1bHQgaXMgbnVsbCkuIExpZ2h0bWFwcyBhcmUgdGV4dHVyZXMgdGhhdCBjb250YWluIHByZS1yZW5kZXJlZCBsaWdodGluZy5cbiAqIENhbiBiZSBIRFIuXG4gKiBAcHJvcGVydHkge251bWJlcn0gbGlnaHRNYXBVdiBMaWdodG1hcCBVViBjaGFubmVsXG4gKiBAcHJvcGVydHkge3N0cmluZ30gbGlnaHRNYXBDaGFubmVsIENvbG9yIGNoYW5uZWxzIG9mIHRoZSBsaWdodG1hcCB0byB1c2UuIENhbiBiZSBcInJcIiwgXCJnXCIsIFwiYlwiLFxuICogXCJhXCIsIFwicmdiXCIgb3IgYW55IHN3aXp6bGVkIGNvbWJpbmF0aW9uLlxuICogQHByb3BlcnR5IHtWZWMyfSBsaWdodE1hcFRpbGluZyBDb250cm9scyB0aGUgMkQgdGlsaW5nIG9mIHRoZSBsaWdodG1hcC5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gbGlnaHRNYXBPZmZzZXQgQ29udHJvbHMgdGhlIDJEIG9mZnNldCBvZiB0aGUgbGlnaHRtYXAuIEVhY2ggY29tcG9uZW50IGlzXG4gKiBiZXR3ZWVuIDAgYW5kIDEuXG4gKiBAcHJvcGVydHkge251bWJlcn0gbGlnaHRNYXBSb3RhdGlvbiBDb250cm9scyB0aGUgMkQgcm90YXRpb24gKGluIGRlZ3JlZXMpIG9mIHRoZSBsaWdodG1hcC5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gbGlnaHRWZXJ0ZXhDb2xvciBVc2UgYmFrZWQgdmVydGV4IGxpZ2h0aW5nLiBJZiBsaWdodE1hcCBpcyBzZXQsIGl0J2xsIGJlXG4gKiBtdWx0aXBsaWVkIGJ5IHZlcnRleCBjb2xvcnMuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gbGlnaHRWZXJ0ZXhDb2xvckNoYW5uZWwgVmVydGV4IGNvbG9yIGNoYW5uZWxzIHRvIHVzZSBmb3IgYmFrZWQgbGlnaHRpbmcuIENhblxuICogYmUgXCJyXCIsIFwiZ1wiLCBcImJcIiwgXCJhXCIsIFwicmdiXCIgb3IgYW55IHN3aXp6bGVkIGNvbWJpbmF0aW9uLlxuICogQHByb3BlcnR5IHtib29sZWFufSBhbWJpZW50VGludCBFbmFibGVzIHNjZW5lIGFtYmllbnQgbXVsdGlwbGljYXRpb24gYnkgbWF0ZXJpYWwgYW1iaWVudCBjb2xvci5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJykuVGV4dHVyZXxudWxsfSBhb01hcCBCYWtlZCBhbWJpZW50XG4gKiBvY2NsdXNpb24gKEFPKSBtYXAgKGRlZmF1bHQgaXMgbnVsbCkuIE1vZHVsYXRlcyBhbWJpZW50IGNvbG9yLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGFvTWFwVXYgQU8gbWFwIFVWIGNoYW5uZWxcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBhb01hcENoYW5uZWwgQ29sb3IgY2hhbm5lbCBvZiB0aGUgQU8gbWFwIHRvIHVzZS4gQ2FuIGJlIFwiclwiLCBcImdcIiwgXCJiXCIgb3IgXCJhXCIuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IGFvTWFwVGlsaW5nIENvbnRyb2xzIHRoZSAyRCB0aWxpbmcgb2YgdGhlIEFPIG1hcC5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gYW9NYXBPZmZzZXQgQ29udHJvbHMgdGhlIDJEIG9mZnNldCBvZiB0aGUgQU8gbWFwLiBFYWNoIGNvbXBvbmVudCBpcyBiZXR3ZWVuIDBcbiAqIGFuZCAxLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGFvTWFwUm90YXRpb24gQ29udHJvbHMgdGhlIDJEIHJvdGF0aW9uIChpbiBkZWdyZWVzKSBvZiB0aGUgQU8gbWFwLlxuICogQHByb3BlcnR5IHtib29sZWFufSBhb1ZlcnRleENvbG9yIFVzZSBtZXNoIHZlcnRleCBjb2xvcnMgZm9yIEFPLiBJZiBhb01hcCBpcyBzZXQsIGl0J2xsIGJlXG4gKiBtdWx0aXBsaWVkIGJ5IHZlcnRleCBjb2xvcnMuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gYW9WZXJ0ZXhDb2xvckNoYW5uZWwgVmVydGV4IGNvbG9yIGNoYW5uZWxzIHRvIHVzZSBmb3IgQU8uIENhbiBiZSBcInJcIiwgXCJnXCIsXG4gKiBcImJcIiBvciBcImFcIi5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBvY2NsdWRlU3BlY3VsYXIgVXNlcyBhbWJpZW50IG9jY2x1c2lvbiB0byBkYXJrZW4gc3BlY3VsYXIvcmVmbGVjdGlvbi4gSXQncyBhXG4gKiBoYWNrLCBiZWNhdXNlIHJlYWwgc3BlY3VsYXIgb2NjbHVzaW9uIGlzIHZpZXctZGVwZW5kZW50LiBIb3dldmVyLCBpdCBjYW4gYmUgYmV0dGVyIHRoYW4gbm90aGluZy5cbiAqXG4gKiAtIHtAbGluayBTUEVDT0NDX05PTkV9OiBObyBzcGVjdWxhciBvY2NsdXNpb25cbiAqIC0ge0BsaW5rIFNQRUNPQ0NfQU99OiBVc2UgQU8gZGlyZWN0bHkgdG8gb2NjbHVkZSBzcGVjdWxhci5cbiAqIC0ge0BsaW5rIFNQRUNPQ0NfR0xPU1NERVBFTkRFTlR9OiBNb2RpZnkgQU8gYmFzZWQgb24gbWF0ZXJpYWwgZ2xvc3NpbmVzcy92aWV3IGFuZ2xlIHRvIG9jY2x1ZGVcbiAqIHNwZWN1bGFyLlxuICpcbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBvY2NsdWRlU3BlY3VsYXJJbnRlbnNpdHkgQ29udHJvbHMgdmlzaWJpbGl0eSBvZiBzcGVjdWxhciBvY2NsdXNpb24uXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IG9jY2x1ZGVEaXJlY3QgVGVsbHMgaWYgQU8gc2hvdWxkIGRhcmtlbiBkaXJlY3Rpb25hbCBsaWdodGluZy4gRGVmYXVsdHMgdG9cbiAqIGZhbHNlLlxuICogQHByb3BlcnR5IHtib29sZWFufSBjb25zZXJ2ZUVuZXJneSBEZWZpbmVzIGhvdyBkaWZmdXNlIGFuZCBzcGVjdWxhciBjb21wb25lbnRzIGFyZSBjb21iaW5lZCB3aGVuXG4gKiBGcmVzbmVsIGlzIG9uLiBJdCBpcyByZWNvbW1lbmRlZCB0aGF0IHlvdSBsZWF2ZSB0aGlzIG9wdGlvbiBlbmFibGVkLCBhbHRob3VnaCB5b3UgbWF5IHdhbnQgdG9cbiAqIGRpc2FibGUgaXQgaW4gY2FzZSB3aGVuIGFsbCByZWZsZWN0aW9uIGNvbWVzIG9ubHkgZnJvbSBhIGZldyBsaWdodCBzb3VyY2VzLCBhbmQgeW91IGRvbid0IHVzZSBhblxuICogZW52aXJvbm1lbnQgbWFwLCB0aGVyZWZvcmUgaGF2aW5nIG1vc3RseSBibGFjayByZWZsZWN0aW9uLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHNoYWRpbmdNb2RlbCBEZWZpbmVzIHRoZSBzaGFkaW5nIG1vZGVsLlxuICogLSB7QGxpbmsgU1BFQ1VMQVJfUEhPTkd9OiBQaG9uZyB3aXRob3V0IGVuZXJneSBjb25zZXJ2YXRpb24uIFlvdSBzaG91bGQgb25seSB1c2UgaXQgYXMgYVxuICogYmFja3dhcmRzIGNvbXBhdGliaWxpdHkgd2l0aCBvbGRlciBwcm9qZWN0cy5cbiAqIC0ge0BsaW5rIFNQRUNVTEFSX0JMSU5OfTogRW5lcmd5LWNvbnNlcnZpbmcgQmxpbm4tUGhvbmcuXG4gKiBAcHJvcGVydHkge251bWJlcn0gZnJlc25lbE1vZGVsIERlZmluZXMgdGhlIGZvcm11bGEgdXNlZCBmb3IgRnJlc25lbCBlZmZlY3QuXG4gKiBBcyBhIHNpZGUtZWZmZWN0LCBlbmFibGluZyBhbnkgRnJlc25lbCBtb2RlbCBjaGFuZ2VzIHRoZSB3YXkgZGlmZnVzZSBhbmQgcmVmbGVjdGlvbiBjb21wb25lbnRzXG4gKiBhcmUgY29tYmluZWQuIFdoZW4gRnJlc25lbCBpcyBvZmYsIGxlZ2FjeSBub24gZW5lcmd5LWNvbnNlcnZpbmcgY29tYmluaW5nIGlzIHVzZWQuIFdoZW4gaXQgaXNcbiAqIG9uLCBjb21iaW5pbmcgYmVoYXZpb3IgaXMgZGVmaW5lZCBieSBjb25zZXJ2ZUVuZXJneSBwYXJhbWV0ZXIuXG4gKlxuICogLSB7QGxpbmsgRlJFU05FTF9OT05FfTogTm8gRnJlc25lbC5cbiAqIC0ge0BsaW5rIEZSRVNORUxfU0NITElDS306IFNjaGxpY2sncyBhcHByb3hpbWF0aW9uIG9mIEZyZXNuZWwgKHJlY29tbWVuZGVkKS4gUGFyYW1ldGVyaXplZCBieVxuICogc3BlY3VsYXIgY29sb3IuXG4gKlxuICogQHByb3BlcnR5IHtib29sZWFufSB1c2VGb2cgQXBwbHkgZm9nZ2luZyAoYXMgY29uZmlndXJlZCBpbiBzY2VuZSBzZXR0aW5ncylcbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gdXNlTGlnaHRpbmcgQXBwbHkgbGlnaHRpbmdcbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gdXNlU2t5Ym94IEFwcGx5IHNjZW5lIHNreWJveCBhcyBwcmVmaWx0ZXJlZCBlbnZpcm9ubWVudCBtYXBcbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gdXNlR2FtbWFUb25lbWFwIEFwcGx5IGdhbW1hIGNvcnJlY3Rpb24gYW5kIHRvbmVtYXBwaW5nIChhcyBjb25maWd1cmVkIGluXG4gKiBzY2VuZSBzZXR0aW5ncykuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IHBpeGVsU25hcCBBbGlnbiB2ZXJ0aWNlcyB0byBwaXhlbCBjb29yZGluYXRlcyB3aGVuIHJlbmRlcmluZy4gVXNlZnVsIGZvclxuICogcGl4ZWwgcGVyZmVjdCAyRCBncmFwaGljcy5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gdHdvU2lkZWRMaWdodGluZyBDYWxjdWxhdGUgcHJvcGVyIG5vcm1hbHMgKGFuZCB0aGVyZWZvcmUgbGlnaHRpbmcpIG9uXG4gKiBiYWNrZmFjZXMuXG4gKiBAcHJvcGVydHkge1VwZGF0ZVNoYWRlckNhbGxiYWNrfSBvblVwZGF0ZVNoYWRlciBBIGN1c3RvbSBmdW5jdGlvbiB0aGF0IHdpbGwgYmUgY2FsbGVkIGFmdGVyIGFsbFxuICogc2hhZGVyIGdlbmVyYXRvciBwcm9wZXJ0aWVzIGFyZSBjb2xsZWN0ZWQgYW5kIGJlZm9yZSBzaGFkZXIgY29kZSBpcyBnZW5lcmF0ZWQuIFRoaXMgZnVuY3Rpb25cbiAqIHdpbGwgcmVjZWl2ZSBhbiBvYmplY3Qgd2l0aCBzaGFkZXIgZ2VuZXJhdG9yIHNldHRpbmdzIChiYXNlZCBvbiBjdXJyZW50IG1hdGVyaWFsIGFuZCBzY2VuZVxuICogcHJvcGVydGllcyksIHRoYXQgeW91IGNhbiBjaGFuZ2UgYW5kIHRoZW4gcmV0dXJuLiBSZXR1cm5lZCB2YWx1ZSB3aWxsIGJlIHVzZWQgaW5zdGVhZC4gVGhpcyBpc1xuICogbW9zdGx5IHVzZWZ1bCB3aGVuIHJlbmRlcmluZyB0aGUgc2FtZSBzZXQgb2Ygb2JqZWN0cywgYnV0IHdpdGggZGlmZmVyZW50IHNoYWRlciB2YXJpYXRpb25zIGJhc2VkXG4gKiBvbiB0aGUgc2FtZSBtYXRlcmlhbC4gRm9yIGV4YW1wbGUsIHlvdSBtYXkgd2lzaCB0byByZW5kZXIgYSBkZXB0aCBvciBub3JtYWwgcGFzcyB1c2luZyB0ZXh0dXJlc1xuICogYXNzaWduZWQgdG8gdGhlIG1hdGVyaWFsLCBhIHJlZmxlY3Rpb24gcGFzcyB3aXRoIHNpbXBsZXIgc2hhZGVycyBhbmQgc28gb24uIFRoZXNlIHByb3BlcnRpZXMgYXJlXG4gKiBzcGxpdCBpbnRvIHR3byBzZWN0aW9ucywgZ2VuZXJpYyBzdGFuZGFyZCBtYXRlcmlhbCBvcHRpb25zIGFuZCBsaXQgb3B0aW9ucy4gUHJvcGVydGllcyBvZiB0aGVcbiAqIHN0YW5kYXJkIG1hdGVyaWFsIG9wdGlvbnMgYXJlIHtAbGluayBTdGFuZGFyZE1hdGVyaWFsT3B0aW9uc30gYW5kIHRoZSBvcHRpb25zIGZvciB0aGUgbGl0IG9wdGlvbnNcbiAqIGFyZSB7QGxpbmsgTGl0T3B0aW9uc30uXG4gKiBAYXVnbWVudHMgTWF0ZXJpYWxcbiAqL1xuY2xhc3MgU3RhbmRhcmRNYXRlcmlhbCBleHRlbmRzIE1hdGVyaWFsIHtcbiAgICBzdGF0aWMgVEVYVFVSRV9QQVJBTUVURVJTID0gc3RhbmRhcmRNYXRlcmlhbFRleHR1cmVQYXJhbWV0ZXJzO1xuXG4gICAgc3RhdGljIENVQkVNQVBfUEFSQU1FVEVSUyA9IHN0YW5kYXJkTWF0ZXJpYWxDdWJlbWFwUGFyYW1ldGVycztcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBTdGFuZGFyZE1hdGVyaWFsIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBDcmVhdGUgYSBuZXcgU3RhbmRhcmQgbWF0ZXJpYWxcbiAgICAgKiB2YXIgbWF0ZXJpYWwgPSBuZXcgcGMuU3RhbmRhcmRNYXRlcmlhbCgpO1xuICAgICAqXG4gICAgICogLy8gVXBkYXRlIHRoZSBtYXRlcmlhbCdzIGRpZmZ1c2UgYW5kIHNwZWN1bGFyIHByb3BlcnRpZXNcbiAgICAgKiBtYXRlcmlhbC5kaWZmdXNlLnNldCgxLCAwLCAwKTtcbiAgICAgKiBtYXRlcmlhbC5zcGVjdWxhci5zZXQoMSwgMSwgMSk7XG4gICAgICpcbiAgICAgKiAvLyBOb3RpZnkgdGhlIG1hdGVyaWFsIHRoYXQgaXQgaGFzIGJlZW4gbW9kaWZpZWRcbiAgICAgKiBtYXRlcmlhbC51cGRhdGUoKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIENyZWF0ZSBhIG5ldyBTdGFuZGFyZCBtYXRlcmlhbFxuICAgICAqIHZhciBtYXRlcmlhbCA9IG5ldyBwYy5TdGFuZGFyZE1hdGVyaWFsKCk7XG4gICAgICpcbiAgICAgKiAvLyBBc3NpZ24gYSB0ZXh0dXJlIHRvIHRoZSBkaWZmdXNlIHNsb3RcbiAgICAgKiBtYXRlcmlhbC5kaWZmdXNlTWFwID0gdGV4dHVyZTtcbiAgICAgKlxuICAgICAqIC8vIFVzZSB0aGUgYWxwaGEgY2hhbm5lbCBvZiB0aGUgdGV4dHVyZSBmb3IgYWxwaGEgdGVzdGluZyB3aXRoIGEgcmVmZXJlbmNlIHZhbHVlIG9mIDAuNVxuICAgICAqIG1hdGVyaWFsLm9wYWNpdHlNYXAgPSB0ZXh0dXJlO1xuICAgICAqIG1hdGVyaWFsLmFscGhhVGVzdCA9IDAuNTtcbiAgICAgKlxuICAgICAqIC8vIE5vdGlmeSB0aGUgbWF0ZXJpYWwgdGhhdCBpdCBoYXMgYmVlbiBtb2RpZmllZFxuICAgICAqIG1hdGVyaWFsLnVwZGF0ZSgpO1xuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuXG4gICAgICAgIHRoaXMuX2RpcnR5U2hhZGVyID0gdHJ1ZTtcblxuICAgICAgICAvLyBzdG9yYWdlIGZvciB0ZXh0dXJlIGFuZCBjdWJlbWFwIGFzc2V0IHJlZmVyZW5jZXNcbiAgICAgICAgdGhpcy5fYXNzZXRSZWZlcmVuY2VzID0ge307XG5cbiAgICAgICAgdGhpcy5fYWN0aXZlUGFyYW1zID0gbmV3IFNldCgpO1xuICAgICAgICB0aGlzLl9hY3RpdmVMaWdodGluZ1BhcmFtcyA9IG5ldyBTZXQoKTtcblxuICAgICAgICB0aGlzLnNoYWRlck9wdEJ1aWxkZXIgPSBuZXcgU3RhbmRhcmRNYXRlcmlhbE9wdGlvbnNCdWlsZGVyKCk7XG5cbiAgICAgICAgdGhpcy5yZXNldCgpO1xuICAgIH1cblxuICAgIHJlc2V0KCkge1xuICAgICAgICAvLyBzZXQgZGVmYXVsdCB2YWx1ZXNcbiAgICAgICAgT2JqZWN0LmtleXMoX3Byb3BzKS5mb3JFYWNoKChuYW1lKSA9PiB7XG4gICAgICAgICAgICB0aGlzW2BfJHtuYW1lfWBdID0gX3Byb3BzW25hbWVdLnZhbHVlKCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7T2JqZWN0PHN0cmluZywgc3RyaW5nPn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2NodW5rcyA9IHsgfTtcbiAgICAgICAgdGhpcy5fdW5pZm9ybUNhY2hlID0geyB9O1xuICAgIH1cblxuICAgIHNldCBzaGFkZXIoc2hhZGVyKSB7XG4gICAgICAgIERlYnVnLndhcm4oJ1N0YW5kYXJkTWF0ZXJpYWwjc2hhZGVyIHByb3BlcnR5IGlzIG5vdCBpbXBsZW1lbnRlZCwgYW5kIHNob3VsZCBub3QgYmUgdXNlZC4nKTtcbiAgICB9XG5cbiAgICBnZXQgc2hhZGVyKCkge1xuICAgICAgICBEZWJ1Zy53YXJuKCdTdGFuZGFyZE1hdGVyaWFsI3NoYWRlciBwcm9wZXJ0eSBpcyBub3QgaW1wbGVtZW50ZWQsIGFuZCBzaG91bGQgbm90IGJlIHVzZWQuJyk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE9iamVjdCBjb250YWluaW5nIGN1c3RvbSBzaGFkZXIgY2h1bmtzIHRoYXQgd2lsbCByZXBsYWNlIGRlZmF1bHQgb25lcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtPYmplY3Q8c3RyaW5nLCBzdHJpbmc+fVxuICAgICAqL1xuICAgIHNldCBjaHVua3ModmFsdWUpIHtcbiAgICAgICAgdGhpcy5fZGlydHlTaGFkZXIgPSB0cnVlO1xuICAgICAgICB0aGlzLl9jaHVua3MgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgY2h1bmtzKCkge1xuICAgICAgICB0aGlzLl9kaXJ0eVNoYWRlciA9IHRydWU7XG4gICAgICAgIHJldHVybiB0aGlzLl9jaHVua3M7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29weSBhIGBTdGFuZGFyZE1hdGVyaWFsYC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7U3RhbmRhcmRNYXRlcmlhbH0gc291cmNlIC0gVGhlIG1hdGVyaWFsIHRvIGNvcHkgZnJvbS5cbiAgICAgKiBAcmV0dXJucyB7U3RhbmRhcmRNYXRlcmlhbH0gVGhlIGRlc3RpbmF0aW9uIG1hdGVyaWFsLlxuICAgICAqL1xuICAgIGNvcHkoc291cmNlKSB7XG4gICAgICAgIHN1cGVyLmNvcHkoc291cmNlKTtcblxuICAgICAgICAvLyBzZXQgcHJvcGVydGllc1xuICAgICAgICBPYmplY3Qua2V5cyhfcHJvcHMpLmZvckVhY2goKGspID0+IHtcbiAgICAgICAgICAgIHRoaXNba10gPSBzb3VyY2Vba107XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIGNsb25lIGNodW5rc1xuICAgICAgICBmb3IgKGNvbnN0IHAgaW4gc291cmNlLl9jaHVua3MpIHtcbiAgICAgICAgICAgIGlmIChzb3VyY2UuX2NodW5rcy5oYXNPd25Qcm9wZXJ0eShwKSlcbiAgICAgICAgICAgICAgICB0aGlzLl9jaHVua3NbcF0gPSBzb3VyY2UuX2NodW5rc1twXTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIF9zZXRQYXJhbWV0ZXIobmFtZSwgdmFsdWUpIHtcbiAgICAgICAgX3BhcmFtcy5hZGQobmFtZSk7XG4gICAgICAgIHRoaXMuc2V0UGFyYW1ldGVyKG5hbWUsIHZhbHVlKTtcbiAgICB9XG5cbiAgICBfc2V0UGFyYW1ldGVycyhwYXJhbWV0ZXJzKSB7XG4gICAgICAgIHBhcmFtZXRlcnMuZm9yRWFjaCgodikgPT4ge1xuICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKHYubmFtZSwgdi52YWx1ZSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIF9wcm9jZXNzUGFyYW1ldGVycyhwYXJhbXNOYW1lKSB7XG4gICAgICAgIGNvbnN0IHByZXZQYXJhbXMgPSB0aGlzW3BhcmFtc05hbWVdO1xuICAgICAgICBwcmV2UGFyYW1zLmZvckVhY2goKHBhcmFtKSA9PiB7XG4gICAgICAgICAgICBpZiAoIV9wYXJhbXMuaGFzKHBhcmFtKSkge1xuICAgICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLnBhcmFtZXRlcnNbcGFyYW1dO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzW3BhcmFtc05hbWVdID0gX3BhcmFtcztcbiAgICAgICAgX3BhcmFtcyA9IHByZXZQYXJhbXM7XG4gICAgICAgIF9wYXJhbXMuY2xlYXIoKTtcbiAgICB9XG5cbiAgICBfdXBkYXRlTWFwKHApIHtcbiAgICAgICAgY29uc3QgbW5hbWUgPSBwICsgJ01hcCc7XG4gICAgICAgIGNvbnN0IG1hcCA9IHRoaXNbbW5hbWVdO1xuICAgICAgICBpZiAobWFwKSB7XG4gICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ3RleHR1cmVfJyArIG1uYW1lLCBtYXApO1xuXG4gICAgICAgICAgICBjb25zdCB0bmFtZSA9IG1uYW1lICsgJ1RyYW5zZm9ybSc7XG4gICAgICAgICAgICBjb25zdCB1bmlmb3JtID0gdGhpcy5nZXRVbmlmb3JtKHRuYW1lKTtcbiAgICAgICAgICAgIGlmICh1bmlmb3JtKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVycyh1bmlmb3JtKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGFsbG9jYXRlIGEgdW5pZm9ybSBpZiBpdCBkb2Vzbid0IGFscmVhZHkgZXhpc3QgaW4gdGhlIHVuaWZvcm0gY2FjaGVcbiAgICBfYWxsb2NVbmlmb3JtKG5hbWUsIGFsbG9jRnVuYykge1xuICAgICAgICBsZXQgdW5pZm9ybSA9IHRoaXMuX3VuaWZvcm1DYWNoZVtuYW1lXTtcbiAgICAgICAgaWYgKCF1bmlmb3JtKSB7XG4gICAgICAgICAgICB1bmlmb3JtID0gYWxsb2NGdW5jKCk7XG4gICAgICAgICAgICB0aGlzLl91bmlmb3JtQ2FjaGVbbmFtZV0gPSB1bmlmb3JtO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB1bmlmb3JtO1xuICAgIH1cblxuICAgIGdldFVuaWZvcm0obmFtZSwgZGV2aWNlLCBzY2VuZSkge1xuICAgICAgICByZXR1cm4gX3VuaWZvcm1zW25hbWVdKHRoaXMsIGRldmljZSwgc2NlbmUpO1xuICAgIH1cblxuICAgIHVwZGF0ZVVuaWZvcm1zKGRldmljZSwgc2NlbmUpIHtcbiAgICAgICAgY29uc3QgZ2V0VW5pZm9ybSA9IChuYW1lKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5nZXRVbmlmb3JtKG5hbWUsIGRldmljZSwgc2NlbmUpO1xuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcignbWF0ZXJpYWxfYW1iaWVudCcsIGdldFVuaWZvcm0oJ2FtYmllbnQnKSk7XG5cbiAgICAgICAgaWYgKCF0aGlzLmRpZmZ1c2VNYXAgfHwgdGhpcy5kaWZmdXNlVGludCkge1xuICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9kaWZmdXNlJywgZ2V0VW5pZm9ybSgnZGlmZnVzZScpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy51c2VNZXRhbG5lc3MpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5zcGVjdWxhck1hcCB8fCB0aGlzLnNwZWN1bGFyVGludCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcignbWF0ZXJpYWxfc3BlY3VsYXInLCBnZXRVbmlmb3JtKCdzcGVjdWxhcicpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5tZXRhbG5lc3NNYXAgfHwgdGhpcy5tZXRhbG5lc3MgPCAxKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9tZXRhbG5lc3MnLCB0aGlzLm1ldGFsbmVzcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIXRoaXMuc3BlY3VsYXJNYXAgfHwgdGhpcy5zcGVjdWxhclRpbnQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX3NwZWN1bGFyJywgZ2V0VW5pZm9ybSgnc3BlY3VsYXInKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIXRoaXMuc3BlY3VsYXJpdHlGYWN0b3JNYXAgfHwgdGhpcy5zcGVjdWxhcml0eUZhY3RvclRpbnQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX3NwZWN1bGFyaXR5RmFjdG9yJywgdGhpcy5zcGVjdWxhcml0eUZhY3Rvcik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIXRoaXMuc2hlZW5NYXAgfHwgdGhpcy5zaGVlblRpbnQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX3NoZWVuJywgZ2V0VW5pZm9ybSgnc2hlZW4nKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIXRoaXMuc2hlZW5HbG9zc01hcCB8fCB0aGlzLnNoZWVuR2xvc3NUaW50KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9zaGVlbkdsb3NzJywgdGhpcy5zaGVlbkdsb3NzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHRoaXMucmVmcmFjdGlvbkluZGV4ICE9PSAxLjAgLyAxLjUpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBvbmVPdmVyUmVmcmFjdGlvbkluZGV4ID0gMS4wIC8gdGhpcy5yZWZyYWN0aW9uSW5kZXg7XG4gICAgICAgICAgICAgICAgY29uc3QgZjAgPSAob25lT3ZlclJlZnJhY3Rpb25JbmRleCAtIDEpIC8gKG9uZU92ZXJSZWZyYWN0aW9uSW5kZXggKyAxKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX2YwJywgZjAgKiBmMCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcignbWF0ZXJpYWxfZjAnLCAwLjA0KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuZW5hYmxlR0dYU3BlY3VsYXIpIHtcbiAgICAgICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcignbWF0ZXJpYWxfYW5pc290cm9weScsIHRoaXMuYW5pc290cm9weSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5jbGVhckNvYXQgPiAwKSB7XG4gICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX2NsZWFyQ29hdCcsIHRoaXMuY2xlYXJDb2F0KTtcbiAgICAgICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcignbWF0ZXJpYWxfY2xlYXJDb2F0R2xvc3MnLCB0aGlzLmNsZWFyQ29hdEdsb3NzKTtcbiAgICAgICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcignbWF0ZXJpYWxfY2xlYXJDb2F0QnVtcGluZXNzJywgdGhpcy5jbGVhckNvYXRCdW1waW5lc3MpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9nbG9zcycsIGdldFVuaWZvcm0oJ2dsb3NzJykpO1xuXG4gICAgICAgIGlmICghdGhpcy5lbWlzc2l2ZU1hcCB8fCB0aGlzLmVtaXNzaXZlVGludCkge1xuICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9lbWlzc2l2ZScsIGdldFVuaWZvcm0oJ2VtaXNzaXZlJykpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLmVtaXNzaXZlSW50ZW5zaXR5ICE9PSAxKSB7XG4gICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX2VtaXNzaXZlSW50ZW5zaXR5JywgdGhpcy5lbWlzc2l2ZUludGVuc2l0eSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5yZWZyYWN0aW9uID4gMCkge1xuICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9yZWZyYWN0aW9uJywgdGhpcy5yZWZyYWN0aW9uKTtcbiAgICAgICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcignbWF0ZXJpYWxfcmVmcmFjdGlvbkluZGV4JywgdGhpcy5yZWZyYWN0aW9uSW5kZXgpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMudXNlRHluYW1pY1JlZnJhY3Rpb24pIHtcbiAgICAgICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcignbWF0ZXJpYWxfdGhpY2tuZXNzJywgdGhpcy50aGlja25lc3MpO1xuICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9hdHRlbnVhdGlvbicsIGdldFVuaWZvcm0oJ2F0dGVudWF0aW9uJykpO1xuICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9pbnZBdHRlbnVhdGlvbkRpc3RhbmNlJywgdGhpcy5hdHRlbnVhdGlvbkRpc3RhbmNlID09PSAwID8gMCA6IDEuMCAvIHRoaXMuYXR0ZW51YXRpb25EaXN0YW5jZSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy51c2VJcmlkZXNjZW5jZSkge1xuICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9pcmlkZXNjZW5jZScsIHRoaXMuaXJpZGVzY2VuY2UpO1xuICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9pcmlkZXNjZW5jZVJlZnJhY3Rpb25JbmRleCcsIHRoaXMuaXJpZGVzY2VuY2VSZWZyYWN0aW9uSW5kZXgpO1xuICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9pcmlkZXNjZW5jZVRoaWNrbmVzc01pbicsIHRoaXMuaXJpZGVzY2VuY2VUaGlja25lc3NNaW4pO1xuICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9pcmlkZXNjZW5jZVRoaWNrbmVzc01heCcsIHRoaXMuaXJpZGVzY2VuY2VUaGlja25lc3NNYXgpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9vcGFjaXR5JywgdGhpcy5vcGFjaXR5KTtcblxuICAgICAgICBpZiAodGhpcy5vcGFjaXR5RmFkZXNTcGVjdWxhciA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcignbWF0ZXJpYWxfYWxwaGFGYWRlJywgdGhpcy5hbHBoYUZhZGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMub2NjbHVkZVNwZWN1bGFyKSB7XG4gICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX29jY2x1ZGVTcGVjdWxhckludGVuc2l0eScsIHRoaXMub2NjbHVkZVNwZWN1bGFySW50ZW5zaXR5KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmN1YmVNYXBQcm9qZWN0aW9uID09PSBDVUJFUFJPSl9CT1gpIHtcbiAgICAgICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcihnZXRVbmlmb3JtKCdjdWJlTWFwUHJvamVjdGlvbkJveCcpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAoY29uc3QgcCBpbiBfbWF0VGV4MkQpIHtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZU1hcChwKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmFtYmllbnRTSCkge1xuICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCdhbWJpZW50U0hbMF0nLCB0aGlzLmFtYmllbnRTSCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5ub3JtYWxNYXApIHtcbiAgICAgICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcignbWF0ZXJpYWxfYnVtcGluZXNzJywgdGhpcy5idW1waW5lc3MpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMubm9ybWFsTWFwICYmIHRoaXMubm9ybWFsRGV0YWlsTWFwKSB7XG4gICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX25vcm1hbERldGFpbE1hcEJ1bXBpbmVzcycsIHRoaXMubm9ybWFsRGV0YWlsTWFwQnVtcGluZXNzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmhlaWdodE1hcCkge1xuICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9oZWlnaHRNYXBGYWN0b3InLCBnZXRVbmlmb3JtKCdoZWlnaHRNYXBGYWN0b3InKSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBpc1Bob25nID0gdGhpcy5zaGFkaW5nTW9kZWwgPT09IFNQRUNVTEFSX1BIT05HO1xuXG4gICAgICAgIC8vIHNldCBvdmVycmlkZGVuIGVudmlyb25tZW50IHRleHR1cmVzXG4gICAgICAgIGlmICh0aGlzLmVudkF0bGFzICYmIHRoaXMuY3ViZU1hcCAmJiAhaXNQaG9uZykge1xuICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCd0ZXh0dXJlX2VudkF0bGFzJywgdGhpcy5lbnZBdGxhcyk7XG4gICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ3RleHR1cmVfY3ViZU1hcCcsIHRoaXMuY3ViZU1hcCk7XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5lbnZBdGxhcyAmJiAhaXNQaG9uZykge1xuICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCd0ZXh0dXJlX2VudkF0bGFzJywgdGhpcy5lbnZBdGxhcyk7XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5jdWJlTWFwKSB7XG4gICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ3RleHR1cmVfY3ViZU1hcCcsIHRoaXMuY3ViZU1hcCk7XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5zcGhlcmVNYXApIHtcbiAgICAgICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcigndGV4dHVyZV9zcGhlcmVNYXAnLCB0aGlzLnNwaGVyZU1hcCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX3JlZmxlY3Rpdml0eScsIHRoaXMucmVmbGVjdGl2aXR5KTtcblxuICAgICAgICAvLyByZW1vdmUgdW51c2VkIHBhcmFtc1xuICAgICAgICB0aGlzLl9wcm9jZXNzUGFyYW1ldGVycygnX2FjdGl2ZVBhcmFtcycpO1xuXG4gICAgICAgIGlmICh0aGlzLl9kaXJ0eVNoYWRlcikge1xuICAgICAgICAgICAgdGhpcy5jbGVhclZhcmlhbnRzKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB1cGRhdGVFbnZVbmlmb3JtcyhkZXZpY2UsIHNjZW5lKSB7XG4gICAgICAgIGNvbnN0IGlzUGhvbmcgPSB0aGlzLnNoYWRpbmdNb2RlbCA9PT0gU1BFQ1VMQVJfUEhPTkc7XG4gICAgICAgIGNvbnN0IGhhc0xvY2FsRW52T3ZlcnJpZGUgPSAodGhpcy5lbnZBdGxhcyAmJiAhaXNQaG9uZykgfHwgdGhpcy5jdWJlTWFwIHx8IHRoaXMuc3BoZXJlTWFwO1xuXG4gICAgICAgIGlmICghaGFzTG9jYWxFbnZPdmVycmlkZSAmJiB0aGlzLnVzZVNreWJveCkge1xuICAgICAgICAgICAgaWYgKHNjZW5lLmVudkF0bGFzICYmIHNjZW5lLnNreWJveCAmJiAhaXNQaG9uZykge1xuICAgICAgICAgICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcigndGV4dHVyZV9lbnZBdGxhcycsIHNjZW5lLmVudkF0bGFzKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ3RleHR1cmVfY3ViZU1hcCcsIHNjZW5lLnNreWJveCk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHNjZW5lLmVudkF0bGFzICYmICFpc1Bob25nKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCd0ZXh0dXJlX2VudkF0bGFzJywgc2NlbmUuZW52QXRsYXMpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChzY2VuZS5za3lib3gpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ3RleHR1cmVfY3ViZU1hcCcsIHNjZW5lLnNreWJveCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9wcm9jZXNzUGFyYW1ldGVycygnX2FjdGl2ZUxpZ2h0aW5nUGFyYW1zJyk7XG4gICAgfVxuXG4gICAgZ2V0U2hhZGVyVmFyaWFudChkZXZpY2UsIHNjZW5lLCBvYmpEZWZzLCBzdGF0aWNMaWdodExpc3QsIHBhc3MsIHNvcnRlZExpZ2h0cywgdmlld1VuaWZvcm1Gb3JtYXQsIHZpZXdCaW5kR3JvdXBGb3JtYXQsIHZlcnRleEZvcm1hdCkge1xuXG4gICAgICAgIC8vIHVwZGF0ZSBwcmVmaWx0ZXJlZCBsaWdodGluZyBkYXRhXG4gICAgICAgIHRoaXMudXBkYXRlRW52VW5pZm9ybXMoZGV2aWNlLCBzY2VuZSk7XG5cbiAgICAgICAgLy8gTWluaW1hbCBvcHRpb25zIGZvciBEZXB0aCBhbmQgU2hhZG93IHBhc3Nlc1xuICAgICAgICBjb25zdCBtaW5pbWFsT3B0aW9ucyA9IHBhc3MgPT09IFNIQURFUl9ERVBUSCB8fCBwYXNzID09PSBTSEFERVJfUElDSyB8fCBTaGFkZXJQYXNzLmlzU2hhZG93KHBhc3MpO1xuICAgICAgICBsZXQgb3B0aW9ucyA9IG1pbmltYWxPcHRpb25zID8gc3RhbmRhcmQub3B0aW9uc0NvbnRleHRNaW4gOiBzdGFuZGFyZC5vcHRpb25zQ29udGV4dDtcblxuICAgICAgICBpZiAobWluaW1hbE9wdGlvbnMpXG4gICAgICAgICAgICB0aGlzLnNoYWRlck9wdEJ1aWxkZXIudXBkYXRlTWluUmVmKG9wdGlvbnMsIHNjZW5lLCB0aGlzLCBvYmpEZWZzLCBzdGF0aWNMaWdodExpc3QsIHBhc3MsIHNvcnRlZExpZ2h0cyk7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICAgIHRoaXMuc2hhZGVyT3B0QnVpbGRlci51cGRhdGVSZWYob3B0aW9ucywgc2NlbmUsIHRoaXMsIG9iakRlZnMsIHN0YXRpY0xpZ2h0TGlzdCwgcGFzcywgc29ydGVkTGlnaHRzKTtcblxuICAgICAgICAvLyBleGVjdXRlIHVzZXIgY2FsbGJhY2sgdG8gbW9kaWZ5IHRoZSBvcHRpb25zXG4gICAgICAgIGlmICh0aGlzLm9uVXBkYXRlU2hhZGVyKSB7XG4gICAgICAgICAgICBvcHRpb25zID0gdGhpcy5vblVwZGF0ZVNoYWRlcihvcHRpb25zKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHByb2Nlc3NpbmdPcHRpb25zID0gbmV3IFNoYWRlclByb2Nlc3Nvck9wdGlvbnModmlld1VuaWZvcm1Gb3JtYXQsIHZpZXdCaW5kR3JvdXBGb3JtYXQsIHZlcnRleEZvcm1hdCk7XG5cbiAgICAgICAgY29uc3QgbGlicmFyeSA9IGdldFByb2dyYW1MaWJyYXJ5KGRldmljZSk7XG4gICAgICAgIGxpYnJhcnkucmVnaXN0ZXIoJ3N0YW5kYXJkJywgc3RhbmRhcmQpO1xuICAgICAgICBjb25zdCBzaGFkZXIgPSBsaWJyYXJ5LmdldFByb2dyYW0oJ3N0YW5kYXJkJywgb3B0aW9ucywgcHJvY2Vzc2luZ09wdGlvbnMpO1xuXG4gICAgICAgIHRoaXMuX2RpcnR5U2hhZGVyID0gZmFsc2U7XG4gICAgICAgIHJldHVybiBzaGFkZXI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlcyB0aGlzIG1hdGVyaWFsIGZyb20gdGhlIHNjZW5lIGFuZCBwb3NzaWJseSBmcmVlcyB1cCBtZW1vcnkgZnJvbSBpdHMgc2hhZGVycyAoaWYgdGhlcmVcbiAgICAgKiBhcmUgbm8gb3RoZXIgbWF0ZXJpYWxzIHVzaW5nIGl0KS5cbiAgICAgKi9cbiAgICBkZXN0cm95KCkge1xuICAgICAgICAvLyB1bmJpbmQgKHRleHR1cmUpIGFzc2V0IHJlZmVyZW5jZXNcbiAgICAgICAgZm9yIChjb25zdCBhc3NldCBpbiB0aGlzLl9hc3NldFJlZmVyZW5jZXMpIHtcbiAgICAgICAgICAgIHRoaXMuX2Fzc2V0UmVmZXJlbmNlc1thc3NldF0uX3VuYmluZCgpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2Fzc2V0UmVmZXJlbmNlcyA9IG51bGw7XG5cbiAgICAgICAgc3VwZXIuZGVzdHJveSgpO1xuICAgIH1cbn1cblxuLy8gZGVmaW5lIGEgdW5pZm9ybSBnZXQgZnVuY3Rpb25cbmNvbnN0IGRlZmluZVVuaWZvcm0gPSAobmFtZSwgZ2V0VW5pZm9ybUZ1bmMpID0+IHtcbiAgICBfdW5pZm9ybXNbbmFtZV0gPSBnZXRVbmlmb3JtRnVuYztcbn07XG5cbmNvbnN0IGRlZmluZVByb3BJbnRlcm5hbCA9IChuYW1lLCBjb25zdHJ1Y3RvckZ1bmMsIHNldHRlckZ1bmMsIGdldHRlckZ1bmMpID0+IHtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoU3RhbmRhcmRNYXRlcmlhbC5wcm90b3R5cGUsIG5hbWUsIHtcbiAgICAgICAgZ2V0OiBnZXR0ZXJGdW5jIHx8IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzW2BfJHtuYW1lfWBdO1xuICAgICAgICB9LFxuICAgICAgICBzZXQ6IHNldHRlckZ1bmNcbiAgICB9KTtcblxuICAgIF9wcm9wc1tuYW1lXSA9IHtcbiAgICAgICAgdmFsdWU6IGNvbnN0cnVjdG9yRnVuY1xuICAgIH07XG59O1xuXG4vLyBkZWZpbmUgYSBzaW1wbGUgdmFsdWUgcHJvcGVydHkgKGZsb2F0LCBzdHJpbmcgZXRjKVxuY29uc3QgZGVmaW5lVmFsdWVQcm9wID0gKHByb3ApID0+IHtcbiAgICBjb25zdCBpbnRlcm5hbE5hbWUgPSBgXyR7cHJvcC5uYW1lfWA7XG4gICAgY29uc3QgZGlydHlTaGFkZXJGdW5jID0gcHJvcC5kaXJ0eVNoYWRlckZ1bmMgfHwgKCgpID0+IHRydWUpO1xuXG4gICAgY29uc3Qgc2V0dGVyRnVuYyA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICBjb25zdCBvbGRWYWx1ZSA9IHRoaXNbaW50ZXJuYWxOYW1lXTtcbiAgICAgICAgaWYgKG9sZFZhbHVlICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5fZGlydHlTaGFkZXIgPSB0aGlzLl9kaXJ0eVNoYWRlciB8fCBkaXJ0eVNoYWRlckZ1bmMob2xkVmFsdWUsIHZhbHVlKTtcbiAgICAgICAgICAgIHRoaXNbaW50ZXJuYWxOYW1lXSA9IHZhbHVlO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIGRlZmluZVByb3BJbnRlcm5hbChwcm9wLm5hbWUsICgpID0+IHByb3AuZGVmYXVsdFZhbHVlLCBzZXR0ZXJGdW5jLCBwcm9wLmdldHRlckZ1bmMpO1xufTtcblxuLy8gZGVmaW5lIGFuIGFnZ3JlZ2F0ZSBwcm9wZXJ0eSAoY29sb3IsIHZlYzMgZXRjKVxuY29uc3QgZGVmaW5lQWdnUHJvcCA9IChwcm9wKSA9PiB7XG4gICAgY29uc3QgaW50ZXJuYWxOYW1lID0gYF8ke3Byb3AubmFtZX1gO1xuICAgIGNvbnN0IGRpcnR5U2hhZGVyRnVuYyA9IHByb3AuZGlydHlTaGFkZXJGdW5jIHx8ICgoKSA9PiB0cnVlKTtcblxuICAgIGNvbnN0IHNldHRlckZ1bmMgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgY29uc3Qgb2xkVmFsdWUgPSB0aGlzW2ludGVybmFsTmFtZV07XG4gICAgICAgIGlmICghb2xkVmFsdWUuZXF1YWxzKHZhbHVlKSkge1xuICAgICAgICAgICAgdGhpcy5fZGlydHlTaGFkZXIgPSB0aGlzLl9kaXJ0eVNoYWRlciB8fCBkaXJ0eVNoYWRlckZ1bmMob2xkVmFsdWUsIHZhbHVlKTtcbiAgICAgICAgICAgIHRoaXNbaW50ZXJuYWxOYW1lXSA9IG9sZFZhbHVlLmNvcHkodmFsdWUpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIGRlZmluZVByb3BJbnRlcm5hbChwcm9wLm5hbWUsICgpID0+IHByb3AuZGVmYXVsdFZhbHVlLmNsb25lKCksIHNldHRlckZ1bmMsIHByb3AuZ2V0dGVyRnVuYyk7XG59O1xuXG4vLyBkZWZpbmUgZWl0aGVyIGEgdmFsdWUgb3IgYWdncmVnYXRlIHByb3BlcnR5XG5jb25zdCBkZWZpbmVQcm9wID0gKHByb3ApID0+IHtcbiAgICByZXR1cm4gcHJvcC5kZWZhdWx0VmFsdWUgJiYgcHJvcC5kZWZhdWx0VmFsdWUuY2xvbmUgPyBkZWZpbmVBZ2dQcm9wKHByb3ApIDogZGVmaW5lVmFsdWVQcm9wKHByb3ApO1xufTtcblxuZnVuY3Rpb24gX2RlZmluZVRleDJEKG5hbWUsIGNoYW5uZWwgPSBcInJnYlwiLCB2ZXJ0ZXhDb2xvciA9IHRydWUsIHV2ID0gMCkge1xuICAgIC8vIHN0b3JlIHRleHR1cmUgbmFtZVxuICAgIF9tYXRUZXgyRFtuYW1lXSA9IGNoYW5uZWwubGVuZ3RoIHx8IC0xO1xuXG4gICAgZGVmaW5lUHJvcCh7XG4gICAgICAgIG5hbWU6IGAke25hbWV9TWFwYCxcbiAgICAgICAgZGVmYXVsdFZhbHVlOiBudWxsLFxuICAgICAgICBkaXJ0eVNoYWRlckZ1bmM6IChvbGRWYWx1ZSwgbmV3VmFsdWUpID0+IHtcbiAgICAgICAgICAgIHJldHVybiAhIW9sZFZhbHVlICE9PSAhIW5ld1ZhbHVlIHx8XG4gICAgICAgICAgICAgICAgb2xkVmFsdWUgJiYgKG9sZFZhbHVlLnR5cGUgIT09IG5ld1ZhbHVlLnR5cGUgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2xkVmFsdWUuZml4Q3ViZW1hcFNlYW1zICE9PSBuZXdWYWx1ZS5maXhDdWJlbWFwU2VhbXMgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2xkVmFsdWUuZm9ybWF0ICE9PSBuZXdWYWx1ZS5mb3JtYXQpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBkZWZpbmVQcm9wKHtcbiAgICAgICAgbmFtZTogYCR7bmFtZX1NYXBUaWxpbmdgLFxuICAgICAgICBkZWZhdWx0VmFsdWU6IG5ldyBWZWMyKDEsIDEpXG4gICAgfSk7XG5cbiAgICBkZWZpbmVQcm9wKHtcbiAgICAgICAgbmFtZTogYCR7bmFtZX1NYXBPZmZzZXRgLFxuICAgICAgICBkZWZhdWx0VmFsdWU6IG5ldyBWZWMyKDAsIDApXG4gICAgfSk7XG5cbiAgICBkZWZpbmVQcm9wKHtcbiAgICAgICAgbmFtZTogYCR7bmFtZX1NYXBSb3RhdGlvbmAsXG4gICAgICAgIGRlZmF1bHRWYWx1ZTogMFxuICAgIH0pO1xuXG4gICAgZGVmaW5lUHJvcCh7XG4gICAgICAgIG5hbWU6IGAke25hbWV9TWFwVXZgLFxuICAgICAgICBkZWZhdWx0VmFsdWU6IHV2XG4gICAgfSk7XG5cbiAgICBpZiAoY2hhbm5lbCkge1xuICAgICAgICBkZWZpbmVQcm9wKHtcbiAgICAgICAgICAgIG5hbWU6IGAke25hbWV9TWFwQ2hhbm5lbGAsXG4gICAgICAgICAgICBkZWZhdWx0VmFsdWU6IGNoYW5uZWxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKHZlcnRleENvbG9yKSB7XG4gICAgICAgICAgICBkZWZpbmVQcm9wKHtcbiAgICAgICAgICAgICAgICBuYW1lOiBgJHtuYW1lfVZlcnRleENvbG9yYCxcbiAgICAgICAgICAgICAgICBkZWZhdWx0VmFsdWU6IGZhbHNlXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgZGVmaW5lUHJvcCh7XG4gICAgICAgICAgICAgICAgbmFtZTogYCR7bmFtZX1WZXJ0ZXhDb2xvckNoYW5uZWxgLFxuICAgICAgICAgICAgICAgIGRlZmF1bHRWYWx1ZTogY2hhbm5lbFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBjb25zdHJ1Y3QgdGhlIHRyYW5zZm9ybSB1bmlmb3JtXG4gICAgY29uc3QgbWFwVGlsaW5nID0gYCR7bmFtZX1NYXBUaWxpbmdgO1xuICAgIGNvbnN0IG1hcE9mZnNldCA9IGAke25hbWV9TWFwT2Zmc2V0YDtcbiAgICBjb25zdCBtYXBSb3RhdGlvbiA9IGAke25hbWV9TWFwUm90YXRpb25gO1xuICAgIGNvbnN0IG1hcFRyYW5zZm9ybSA9IGAke25hbWV9TWFwVHJhbnNmb3JtYDtcbiAgICBkZWZpbmVVbmlmb3JtKG1hcFRyYW5zZm9ybSwgKG1hdGVyaWFsLCBkZXZpY2UsIHNjZW5lKSA9PiB7XG4gICAgICAgIGNvbnN0IHRpbGluZyA9IG1hdGVyaWFsW21hcFRpbGluZ107XG4gICAgICAgIGNvbnN0IG9mZnNldCA9IG1hdGVyaWFsW21hcE9mZnNldF07XG4gICAgICAgIGNvbnN0IHJvdGF0aW9uID0gbWF0ZXJpYWxbbWFwUm90YXRpb25dO1xuXG4gICAgICAgIGlmICh0aWxpbmcueCA9PT0gMSAmJiB0aWxpbmcueSA9PT0gMSAmJlxuICAgICAgICAgICAgb2Zmc2V0LnggPT09IDAgJiYgb2Zmc2V0LnkgPT09IDAgJiZcbiAgICAgICAgICAgIHJvdGF0aW9uID09PSAwKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHVuaWZvcm0gPSBtYXRlcmlhbC5fYWxsb2NVbmlmb3JtKG1hcFRyYW5zZm9ybSwgKCkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIFt7XG4gICAgICAgICAgICAgICAgbmFtZTogYHRleHR1cmVfJHttYXBUcmFuc2Zvcm19MGAsXG4gICAgICAgICAgICAgICAgdmFsdWU6IG5ldyBGbG9hdDMyQXJyYXkoMylcbiAgICAgICAgICAgIH0sIHtcbiAgICAgICAgICAgICAgICBuYW1lOiBgdGV4dHVyZV8ke21hcFRyYW5zZm9ybX0xYCxcbiAgICAgICAgICAgICAgICB2YWx1ZTogbmV3IEZsb2F0MzJBcnJheSgzKVxuICAgICAgICAgICAgfV07XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IGNyID0gTWF0aC5jb3Mocm90YXRpb24gKiBtYXRoLkRFR19UT19SQUQpO1xuICAgICAgICBjb25zdCBzciA9IE1hdGguc2luKHJvdGF0aW9uICogbWF0aC5ERUdfVE9fUkFEKTtcblxuICAgICAgICBjb25zdCB1bmlmb3JtMCA9IHVuaWZvcm1bMF0udmFsdWU7XG4gICAgICAgIHVuaWZvcm0wWzBdID0gY3IgKiB0aWxpbmcueDtcbiAgICAgICAgdW5pZm9ybTBbMV0gPSAtc3IgKiB0aWxpbmcueTtcbiAgICAgICAgdW5pZm9ybTBbMl0gPSBvZmZzZXQueDtcblxuICAgICAgICBjb25zdCB1bmlmb3JtMSA9IHVuaWZvcm1bMV0udmFsdWU7XG4gICAgICAgIHVuaWZvcm0xWzBdID0gc3IgKiB0aWxpbmcueDtcbiAgICAgICAgdW5pZm9ybTFbMV0gPSBjciAqIHRpbGluZy55O1xuICAgICAgICB1bmlmb3JtMVsyXSA9IDEuMCAtIHRpbGluZy55IC0gb2Zmc2V0Lnk7XG5cbiAgICAgICAgcmV0dXJuIHVuaWZvcm07XG4gICAgfSk7XG59XG5cbmZ1bmN0aW9uIF9kZWZpbmVDb2xvcihuYW1lLCBkZWZhdWx0VmFsdWUpIHtcbiAgICBkZWZpbmVQcm9wKHtcbiAgICAgICAgbmFtZTogbmFtZSxcbiAgICAgICAgZGVmYXVsdFZhbHVlOiBkZWZhdWx0VmFsdWUsXG4gICAgICAgIGdldHRlckZ1bmM6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIC8vIEhBQ0s6IHNpbmNlIHdlIGNhbid0IGRldGVjdCB3aGV0aGVyIGEgdXNlciBpcyBnb2luZyB0byBzZXQgYSBjb2xvciBwcm9wZXJ0eVxuICAgICAgICAgICAgLy8gYWZ0ZXIgY2FsbGluZyB0aGlzIGdldHRlciAoaS5lIGRvaW5nIG1hdGVyaWFsLmFtYmllbnQuciA9IDAuNSkgd2UgbXVzdCBhc3N1bWVcbiAgICAgICAgICAgIC8vIHRoZSB3b3JzdCBhbmQgZmxhZyB0aGUgc2hhZGVyIGFzIGRpcnR5LlxuICAgICAgICAgICAgLy8gVGhpcyBtZWFucyBjdXJyZW50bHkgYW5pbWF0aW5nIGEgbWF0ZXJpYWwgY29sb3IgaXMgaG9ycmlibHkgc2xvdy5cbiAgICAgICAgICAgIHRoaXMuX2RpcnR5U2hhZGVyID0gdHJ1ZTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzW2BfJHtuYW1lfWBdO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBkZWZpbmVVbmlmb3JtKG5hbWUsIChtYXRlcmlhbCwgZGV2aWNlLCBzY2VuZSkgPT4ge1xuICAgICAgICBjb25zdCB1bmlmb3JtID0gbWF0ZXJpYWwuX2FsbG9jVW5pZm9ybShuYW1lLCAoKSA9PiBuZXcgRmxvYXQzMkFycmF5KDMpKTtcbiAgICAgICAgY29uc3QgY29sb3IgPSBtYXRlcmlhbFtuYW1lXTtcbiAgICAgICAgY29uc3QgZ2FtbWEgPSBtYXRlcmlhbC51c2VHYW1tYVRvbmVtYXAgJiYgc2NlbmUuZ2FtbWFDb3JyZWN0aW9uO1xuXG4gICAgICAgIGlmIChnYW1tYSkge1xuICAgICAgICAgICAgdW5pZm9ybVswXSA9IE1hdGgucG93KGNvbG9yLnIsIDIuMik7XG4gICAgICAgICAgICB1bmlmb3JtWzFdID0gTWF0aC5wb3coY29sb3IuZywgMi4yKTtcbiAgICAgICAgICAgIHVuaWZvcm1bMl0gPSBNYXRoLnBvdyhjb2xvci5iLCAyLjIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdW5pZm9ybVswXSA9IGNvbG9yLnI7XG4gICAgICAgICAgICB1bmlmb3JtWzFdID0gY29sb3IuZztcbiAgICAgICAgICAgIHVuaWZvcm1bMl0gPSBjb2xvci5iO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHVuaWZvcm07XG4gICAgfSk7XG59XG5cbmZ1bmN0aW9uIF9kZWZpbmVGbG9hdChuYW1lLCBkZWZhdWx0VmFsdWUsIGdldFVuaWZvcm1GdW5jKSB7XG4gICAgZGVmaW5lUHJvcCh7XG4gICAgICAgIG5hbWU6IG5hbWUsXG4gICAgICAgIGRlZmF1bHRWYWx1ZTogZGVmYXVsdFZhbHVlLFxuICAgICAgICBkaXJ0eVNoYWRlckZ1bmM6IChvbGRWYWx1ZSwgbmV3VmFsdWUpID0+IHtcbiAgICAgICAgICAgIC8vIFRoaXMgaXMgbm90IGFsd2F5cyBvcHRpbWFsIGFuZCB3aWxsIHNvbWV0aW1lcyB0cmlnZ2VyIHJlZHVuZGFudCBzaGFkZXJcbiAgICAgICAgICAgIC8vIHJlY29tcGlsYXRpb24uIEhvd2V2ZXIsIG5vIG51bWJlciBwcm9wZXJ0eSBvbiBhIHN0YW5kYXJkIG1hdGVyaWFsXG4gICAgICAgICAgICAvLyB0cmlnZ2VycyBhIHNoYWRlciByZWNvbXBpbGUgaWYgdGhlIHByZXZpb3VzIGFuZCBjdXJyZW50IHZhbHVlcyBib3RoXG4gICAgICAgICAgICAvLyBoYXZlIGEgZnJhY3Rpb25hbCBwYXJ0LlxuICAgICAgICAgICAgcmV0dXJuIChvbGRWYWx1ZSA9PT0gMCB8fCBvbGRWYWx1ZSA9PT0gMSkgIT09IChuZXdWYWx1ZSA9PT0gMCB8fCBuZXdWYWx1ZSA9PT0gMSk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIGRlZmluZVVuaWZvcm0obmFtZSwgZ2V0VW5pZm9ybUZ1bmMpO1xufVxuXG5mdW5jdGlvbiBfZGVmaW5lT2JqZWN0KG5hbWUsIGdldFVuaWZvcm1GdW5jKSB7XG4gICAgZGVmaW5lUHJvcCh7XG4gICAgICAgIG5hbWU6IG5hbWUsXG4gICAgICAgIGRlZmF1bHRWYWx1ZTogbnVsbCxcbiAgICAgICAgZGlydHlTaGFkZXJGdW5jOiAob2xkVmFsdWUsIG5ld1ZhbHVlKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gISFvbGRWYWx1ZSA9PT0gISFuZXdWYWx1ZTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgZGVmaW5lVW5pZm9ybShuYW1lLCBnZXRVbmlmb3JtRnVuYyk7XG59XG5cbmZ1bmN0aW9uIF9kZWZpbmVGbGFnKG5hbWUsIGRlZmF1bHRWYWx1ZSkge1xuICAgIGRlZmluZVByb3Aoe1xuICAgICAgICBuYW1lOiBuYW1lLFxuICAgICAgICBkZWZhdWx0VmFsdWU6IGRlZmF1bHRWYWx1ZVxuICAgIH0pO1xufVxuXG5mdW5jdGlvbiBfZGVmaW5lTWF0ZXJpYWxQcm9wcygpIHtcbiAgICBfZGVmaW5lQ29sb3IoJ2FtYmllbnQnLCBuZXcgQ29sb3IoMC43LCAwLjcsIDAuNykpO1xuICAgIF9kZWZpbmVDb2xvcignZGlmZnVzZScsIG5ldyBDb2xvcigxLCAxLCAxKSk7XG4gICAgX2RlZmluZUNvbG9yKCdzcGVjdWxhcicsIG5ldyBDb2xvcigwLCAwLCAwKSk7XG4gICAgX2RlZmluZUNvbG9yKCdlbWlzc2l2ZScsIG5ldyBDb2xvcigwLCAwLCAwKSk7XG4gICAgX2RlZmluZUNvbG9yKCdzaGVlbicsIG5ldyBDb2xvcigxLCAxLCAxKSk7XG4gICAgX2RlZmluZUNvbG9yKCdhdHRlbnVhdGlvbicsIG5ldyBDb2xvcigxLCAxLCAxKSk7XG4gICAgX2RlZmluZUZsb2F0KCdlbWlzc2l2ZUludGVuc2l0eScsIDEpO1xuICAgIF9kZWZpbmVGbG9hdCgnc3BlY3VsYXJpdHlGYWN0b3InLCAxKTtcbiAgICBfZGVmaW5lRmxvYXQoJ3NoZWVuR2xvc3MnLCAwLjApO1xuXG4gICAgX2RlZmluZUZsb2F0KCdnbG9zcycsIDAuMjUsIChtYXRlcmlhbCwgZGV2aWNlLCBzY2VuZSkgPT4ge1xuICAgICAgICByZXR1cm4gbWF0ZXJpYWwuc2hhZGluZ01vZGVsID09PSBTUEVDVUxBUl9QSE9ORyA/XG4gICAgICAgICAgICAvLyBsZWdhY3k6IGV4cGFuZCBiYWNrIHRvIHNwZWN1bGFyIHBvd2VyXG4gICAgICAgICAgICBNYXRoLnBvdygyLCBtYXRlcmlhbC5nbG9zcyAqIDExKSA6XG4gICAgICAgICAgICBtYXRlcmlhbC5nbG9zcztcbiAgICB9KTtcblxuICAgIF9kZWZpbmVGbG9hdCgnaGVpZ2h0TWFwRmFjdG9yJywgMSwgKG1hdGVyaWFsLCBkZXZpY2UsIHNjZW5lKSA9PiB7XG4gICAgICAgIHJldHVybiBtYXRlcmlhbC5oZWlnaHRNYXBGYWN0b3IgKiAwLjAyNTtcbiAgICB9KTtcbiAgICBfZGVmaW5lRmxvYXQoJ29wYWNpdHknLCAxKTtcbiAgICBfZGVmaW5lRmxvYXQoJ2FscGhhRmFkZScsIDEpO1xuICAgIF9kZWZpbmVGbG9hdCgnYWxwaGFUZXN0JywgMCk7ICAgICAgIC8vIE5PVEU6IG92ZXJ3cml0ZXMgTWF0ZXJpYWwuYWxwaGFUZXN0XG4gICAgX2RlZmluZUZsb2F0KCdidW1waW5lc3MnLCAxKTtcbiAgICBfZGVmaW5lRmxvYXQoJ25vcm1hbERldGFpbE1hcEJ1bXBpbmVzcycsIDEpO1xuICAgIF9kZWZpbmVGbG9hdCgncmVmbGVjdGl2aXR5JywgMSk7XG4gICAgX2RlZmluZUZsb2F0KCdvY2NsdWRlU3BlY3VsYXJJbnRlbnNpdHknLCAxKTtcbiAgICBfZGVmaW5lRmxvYXQoJ3JlZnJhY3Rpb24nLCAwKTtcbiAgICBfZGVmaW5lRmxvYXQoJ3JlZnJhY3Rpb25JbmRleCcsIDEuMCAvIDEuNSk7IC8vIGFwcHJveC4gKGFpciBpb3IgLyBnbGFzcyBpb3IpXG4gICAgX2RlZmluZUZsb2F0KCd0aGlja25lc3MnLCAwKTtcbiAgICBfZGVmaW5lRmxvYXQoJ2F0dGVudWF0aW9uRGlzdGFuY2UnLCAwKTtcbiAgICBfZGVmaW5lRmxvYXQoJ21ldGFsbmVzcycsIDEpO1xuICAgIF9kZWZpbmVGbG9hdCgnYW5pc290cm9weScsIDApO1xuICAgIF9kZWZpbmVGbG9hdCgnY2xlYXJDb2F0JywgMCk7XG4gICAgX2RlZmluZUZsb2F0KCdjbGVhckNvYXRHbG9zcycsIDEpO1xuICAgIF9kZWZpbmVGbG9hdCgnY2xlYXJDb2F0QnVtcGluZXNzJywgMSk7XG4gICAgX2RlZmluZUZsb2F0KCdhb1V2U2V0JywgMCwgbnVsbCk7IC8vIGxlZ2FjeVxuXG4gICAgX2RlZmluZUZsb2F0KCdpcmlkZXNjZW5jZScsIDApO1xuICAgIF9kZWZpbmVGbG9hdCgnaXJpZGVzY2VuY2VSZWZyYWN0aW9uSW5kZXgnLCAxLjAgLyAxLjUpO1xuICAgIF9kZWZpbmVGbG9hdCgnaXJpZGVzY2VuY2VUaGlja25lc3NNaW4nLCAwKTtcbiAgICBfZGVmaW5lRmxvYXQoJ2lyaWRlc2NlbmNlVGhpY2tuZXNzTWF4JywgMCk7XG5cbiAgICBfZGVmaW5lT2JqZWN0KCdhbWJpZW50U0gnKTtcblxuICAgIF9kZWZpbmVPYmplY3QoJ2N1YmVNYXBQcm9qZWN0aW9uQm94JywgKG1hdGVyaWFsLCBkZXZpY2UsIHNjZW5lKSA9PiB7XG4gICAgICAgIGNvbnN0IHVuaWZvcm0gPSBtYXRlcmlhbC5fYWxsb2NVbmlmb3JtKCdjdWJlTWFwUHJvamVjdGlvbkJveCcsICgpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBbe1xuICAgICAgICAgICAgICAgIG5hbWU6ICdlbnZCb3hNaW4nLFxuICAgICAgICAgICAgICAgIHZhbHVlOiBuZXcgRmxvYXQzMkFycmF5KDMpXG4gICAgICAgICAgICB9LCB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2VudkJveE1heCcsXG4gICAgICAgICAgICAgICAgdmFsdWU6IG5ldyBGbG9hdDMyQXJyYXkoMylcbiAgICAgICAgICAgIH1dO1xuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCBiYm94TWluID0gbWF0ZXJpYWwuY3ViZU1hcFByb2plY3Rpb25Cb3guZ2V0TWluKCk7XG4gICAgICAgIGNvbnN0IG1pblVuaWZvcm0gPSB1bmlmb3JtWzBdLnZhbHVlO1xuICAgICAgICBtaW5Vbmlmb3JtWzBdID0gYmJveE1pbi54O1xuICAgICAgICBtaW5Vbmlmb3JtWzFdID0gYmJveE1pbi55O1xuICAgICAgICBtaW5Vbmlmb3JtWzJdID0gYmJveE1pbi56O1xuXG4gICAgICAgIGNvbnN0IGJib3hNYXggPSBtYXRlcmlhbC5jdWJlTWFwUHJvamVjdGlvbkJveC5nZXRNYXgoKTtcbiAgICAgICAgY29uc3QgbWF4VW5pZm9ybSA9IHVuaWZvcm1bMV0udmFsdWU7XG4gICAgICAgIG1heFVuaWZvcm1bMF0gPSBiYm94TWF4Lng7XG4gICAgICAgIG1heFVuaWZvcm1bMV0gPSBiYm94TWF4Lnk7XG4gICAgICAgIG1heFVuaWZvcm1bMl0gPSBiYm94TWF4Lno7XG5cbiAgICAgICAgcmV0dXJuIHVuaWZvcm07XG4gICAgfSk7XG5cbiAgICBfZGVmaW5lRmxhZygnYW1iaWVudFRpbnQnLCBmYWxzZSk7XG4gICAgX2RlZmluZUZsYWcoJ2RpZmZ1c2VUaW50JywgZmFsc2UpO1xuICAgIF9kZWZpbmVGbGFnKCdzcGVjdWxhclRpbnQnLCBmYWxzZSk7XG4gICAgX2RlZmluZUZsYWcoJ3NwZWN1bGFyaXR5RmFjdG9yVGludCcsIGZhbHNlKTtcbiAgICBfZGVmaW5lRmxhZygnZW1pc3NpdmVUaW50JywgZmFsc2UpO1xuICAgIF9kZWZpbmVGbGFnKCdmYXN0VGJuJywgZmFsc2UpO1xuICAgIF9kZWZpbmVGbGFnKCd1c2VNZXRhbG5lc3MnLCBmYWxzZSk7XG4gICAgX2RlZmluZUZsYWcoJ3VzZU1ldGFsbmVzc1NwZWN1bGFyQ29sb3InLCBmYWxzZSk7XG4gICAgX2RlZmluZUZsYWcoJ3VzZVNoZWVuJywgZmFsc2UpO1xuICAgIF9kZWZpbmVGbGFnKCdlbmFibGVHR1hTcGVjdWxhcicsIGZhbHNlKTtcbiAgICBfZGVmaW5lRmxhZygnb2NjbHVkZURpcmVjdCcsIGZhbHNlKTtcbiAgICBfZGVmaW5lRmxhZygnbm9ybWFsaXplTm9ybWFsTWFwJywgdHJ1ZSk7XG4gICAgX2RlZmluZUZsYWcoJ2NvbnNlcnZlRW5lcmd5JywgdHJ1ZSk7XG4gICAgX2RlZmluZUZsYWcoJ29wYWNpdHlGYWRlc1NwZWN1bGFyJywgdHJ1ZSk7XG4gICAgX2RlZmluZUZsYWcoJ29jY2x1ZGVTcGVjdWxhcicsIFNQRUNPQ0NfQU8pO1xuICAgIF9kZWZpbmVGbGFnKCdzaGFkaW5nTW9kZWwnLCBTUEVDVUxBUl9CTElOTik7XG4gICAgX2RlZmluZUZsYWcoJ2ZyZXNuZWxNb2RlbCcsIEZSRVNORUxfU0NITElDSyk7IC8vIE5PVEU6IHRoaXMgaGFzIGJlZW4gbWFkZSB0byBtYXRjaCB0aGUgZGVmYXVsdCBzaGFkaW5nIG1vZGVsICh0byBmaXggYSBidWcpXG4gICAgX2RlZmluZUZsYWcoJ3VzZUR5bmFtaWNSZWZyYWN0aW9uJywgZmFsc2UpO1xuICAgIF9kZWZpbmVGbGFnKCdjdWJlTWFwUHJvamVjdGlvbicsIENVQkVQUk9KX05PTkUpO1xuICAgIF9kZWZpbmVGbGFnKCdjdXN0b21GcmFnbWVudFNoYWRlcicsIG51bGwpO1xuICAgIF9kZWZpbmVGbGFnKCdmb3JjZUZyYWdtZW50UHJlY2lzaW9uJywgbnVsbCk7XG4gICAgX2RlZmluZUZsYWcoJ3VzZUZvZycsIHRydWUpO1xuICAgIF9kZWZpbmVGbGFnKCd1c2VMaWdodGluZycsIHRydWUpO1xuICAgIF9kZWZpbmVGbGFnKCd1c2VHYW1tYVRvbmVtYXAnLCB0cnVlKTtcbiAgICBfZGVmaW5lRmxhZygndXNlU2t5Ym94JywgdHJ1ZSk7XG4gICAgX2RlZmluZUZsYWcoJ2ZvcmNlVXYxJywgZmFsc2UpO1xuICAgIF9kZWZpbmVGbGFnKCdwaXhlbFNuYXAnLCBmYWxzZSk7XG4gICAgX2RlZmluZUZsYWcoJ3R3b1NpZGVkTGlnaHRpbmcnLCBmYWxzZSk7XG4gICAgX2RlZmluZUZsYWcoJ25pbmVTbGljZWRNb2RlJywgdW5kZWZpbmVkKTsgLy8gTk9URTogdGhpcyB1c2VkIHRvIGJlIFNQUklURV9SRU5ERVJNT0RFX1NMSUNFRCBidXQgd2FzIHVuZGVmaW5lZCBwcmUtUm9sbHVwXG4gICAgX2RlZmluZUZsYWcoJ21zZGZUZXh0QXR0cmlidXRlJywgZmFsc2UpO1xuICAgIF9kZWZpbmVGbGFnKCd1c2VJcmlkZXNjZW5jZScsIGZhbHNlKTtcbiAgICBfZGVmaW5lRmxhZygnZ2xvc3NJbnZlcnQnLCBmYWxzZSk7XG4gICAgX2RlZmluZUZsYWcoJ3NoZWVuR2xvc3NJbnZlcnQnLCBmYWxzZSk7XG4gICAgX2RlZmluZUZsYWcoJ2NsZWFyQ29hdEdsb3NzSW52ZXJ0JywgZmFsc2UpO1xuXG4gICAgX2RlZmluZVRleDJEKCdkaWZmdXNlJyk7XG4gICAgX2RlZmluZVRleDJEKCdzcGVjdWxhcicpO1xuICAgIF9kZWZpbmVUZXgyRCgnZW1pc3NpdmUnKTtcbiAgICBfZGVmaW5lVGV4MkQoJ3RoaWNrbmVzcycsICdnJyk7XG4gICAgX2RlZmluZVRleDJEKCdzcGVjdWxhcml0eUZhY3RvcicsICdnJyk7XG4gICAgX2RlZmluZVRleDJEKCdub3JtYWwnLCAnJyk7XG4gICAgX2RlZmluZVRleDJEKCdtZXRhbG5lc3MnLCAnZycpO1xuICAgIF9kZWZpbmVUZXgyRCgnZ2xvc3MnLCAnZycpO1xuICAgIF9kZWZpbmVUZXgyRCgnb3BhY2l0eScsICdhJyk7XG4gICAgX2RlZmluZVRleDJEKCdyZWZyYWN0aW9uJywgJ2cnKTtcbiAgICBfZGVmaW5lVGV4MkQoJ2hlaWdodCcsICdnJywgZmFsc2UpO1xuICAgIF9kZWZpbmVUZXgyRCgnYW8nLCAnZycpO1xuICAgIF9kZWZpbmVUZXgyRCgnbGlnaHQnLCAncmdiJywgdHJ1ZSwgMSk7XG4gICAgX2RlZmluZVRleDJEKCdtc2RmJywgJycpO1xuICAgIF9kZWZpbmVUZXgyRCgnZGlmZnVzZURldGFpbCcsICdyZ2InLCBmYWxzZSk7XG4gICAgX2RlZmluZVRleDJEKCdub3JtYWxEZXRhaWwnLCAnJyk7XG4gICAgX2RlZmluZVRleDJEKCdjbGVhckNvYXQnLCAnZycpO1xuICAgIF9kZWZpbmVUZXgyRCgnY2xlYXJDb2F0R2xvc3MnLCAnZycpO1xuICAgIF9kZWZpbmVUZXgyRCgnY2xlYXJDb2F0Tm9ybWFsJywgJycpO1xuICAgIF9kZWZpbmVUZXgyRCgnc2hlZW4nLCAncmdiJyk7XG4gICAgX2RlZmluZVRleDJEKCdzaGVlbkdsb3NzJywgJ2cnKTtcbiAgICBfZGVmaW5lVGV4MkQoJ2lyaWRlc2NlbmNlJywgJ2cnKTtcbiAgICBfZGVmaW5lVGV4MkQoJ2lyaWRlc2NlbmNlVGhpY2tuZXNzJywgJ2cnKTtcblxuICAgIF9kZWZpbmVGbGFnKCdkaWZmdXNlRGV0YWlsTW9kZScsIERFVEFJTE1PREVfTVVMKTtcblxuICAgIF9kZWZpbmVPYmplY3QoJ2N1YmVNYXAnKTtcbiAgICBfZGVmaW5lT2JqZWN0KCdzcGhlcmVNYXAnKTtcbiAgICBfZGVmaW5lT2JqZWN0KCdlbnZBdGxhcycpO1xuXG4gICAgLy8gcHJlZmlsdGVyZWQgY3ViZW1hcCBnZXR0ZXJcbiAgICBjb25zdCBnZXR0ZXJGdW5jID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcHJlZmlsdGVyZWRDdWJlbWFwcztcbiAgICB9O1xuXG4gICAgLy8gcHJlZmlsdGVyZWQgY3ViZW1hcCBzZXR0ZXJcbiAgICBjb25zdCBzZXR0ZXJGdW5jID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIGNvbnN0IGN1YmVtYXBzID0gdGhpcy5fcHJlZmlsdGVyZWRDdWJlbWFwcztcblxuICAgICAgICB2YWx1ZSA9IHZhbHVlIHx8IFtdO1xuXG4gICAgICAgIGxldCBjaGFuZ2VkID0gZmFsc2U7XG4gICAgICAgIGxldCBjb21wbGV0ZSA9IHRydWU7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgNjsgKytpKSB7XG4gICAgICAgICAgICBjb25zdCB2ID0gdmFsdWVbaV0gfHwgbnVsbDtcbiAgICAgICAgICAgIGlmIChjdWJlbWFwc1tpXSAhPT0gdikge1xuICAgICAgICAgICAgICAgIGN1YmVtYXBzW2ldID0gdjtcbiAgICAgICAgICAgICAgICBjaGFuZ2VkID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbXBsZXRlID0gY29tcGxldGUgJiYgKCEhY3ViZW1hcHNbaV0pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGNoYW5nZWQpIHtcbiAgICAgICAgICAgIGlmIChjb21wbGV0ZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuZW52QXRsYXMgPSBFbnZMaWdodGluZy5nZW5lcmF0ZVByZWZpbHRlcmVkQXRsYXMoY3ViZW1hcHMsIHtcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0OiB0aGlzLmVudkF0bGFzXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmVudkF0bGFzKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZW52QXRsYXMuZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmVudkF0bGFzID0gbnVsbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLl9kaXJ0eVNoYWRlciA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgY29uc3QgZW1wdHkgPSBbbnVsbCwgbnVsbCwgbnVsbCwgbnVsbCwgbnVsbCwgbnVsbF07XG5cbiAgICBkZWZpbmVQcm9wSW50ZXJuYWwoJ3ByZWZpbHRlcmVkQ3ViZW1hcHMnLCAoKSA9PiBlbXB0eS5zbGljZSgpLCBzZXR0ZXJGdW5jLCBnZXR0ZXJGdW5jKTtcbn1cblxuX2RlZmluZU1hdGVyaWFsUHJvcHMoKTtcblxuZXhwb3J0IHsgU3RhbmRhcmRNYXRlcmlhbCB9O1xuIl0sIm5hbWVzIjpbIl9wcm9wcyIsIl91bmlmb3JtcyIsIl9wYXJhbXMiLCJTZXQiLCJTdGFuZGFyZE1hdGVyaWFsIiwiTWF0ZXJpYWwiLCJjb25zdHJ1Y3RvciIsIl9kaXJ0eVNoYWRlciIsIl9hc3NldFJlZmVyZW5jZXMiLCJfYWN0aXZlUGFyYW1zIiwiX2FjdGl2ZUxpZ2h0aW5nUGFyYW1zIiwic2hhZGVyT3B0QnVpbGRlciIsIlN0YW5kYXJkTWF0ZXJpYWxPcHRpb25zQnVpbGRlciIsInJlc2V0IiwiT2JqZWN0Iiwia2V5cyIsImZvckVhY2giLCJuYW1lIiwidmFsdWUiLCJfY2h1bmtzIiwiX3VuaWZvcm1DYWNoZSIsInNoYWRlciIsIkRlYnVnIiwid2FybiIsImNodW5rcyIsImNvcHkiLCJzb3VyY2UiLCJrIiwicCIsImhhc093blByb3BlcnR5IiwiX3NldFBhcmFtZXRlciIsImFkZCIsInNldFBhcmFtZXRlciIsIl9zZXRQYXJhbWV0ZXJzIiwicGFyYW1ldGVycyIsInYiLCJfcHJvY2Vzc1BhcmFtZXRlcnMiLCJwYXJhbXNOYW1lIiwicHJldlBhcmFtcyIsInBhcmFtIiwiaGFzIiwiY2xlYXIiLCJfdXBkYXRlTWFwIiwibW5hbWUiLCJtYXAiLCJ0bmFtZSIsInVuaWZvcm0iLCJnZXRVbmlmb3JtIiwiX2FsbG9jVW5pZm9ybSIsImFsbG9jRnVuYyIsImRldmljZSIsInNjZW5lIiwidXBkYXRlVW5pZm9ybXMiLCJkaWZmdXNlTWFwIiwiZGlmZnVzZVRpbnQiLCJ1c2VNZXRhbG5lc3MiLCJzcGVjdWxhck1hcCIsInNwZWN1bGFyVGludCIsIm1ldGFsbmVzc01hcCIsIm1ldGFsbmVzcyIsInNwZWN1bGFyaXR5RmFjdG9yTWFwIiwic3BlY3VsYXJpdHlGYWN0b3JUaW50Iiwic3BlY3VsYXJpdHlGYWN0b3IiLCJzaGVlbk1hcCIsInNoZWVuVGludCIsInNoZWVuR2xvc3NNYXAiLCJzaGVlbkdsb3NzVGludCIsInNoZWVuR2xvc3MiLCJyZWZyYWN0aW9uSW5kZXgiLCJvbmVPdmVyUmVmcmFjdGlvbkluZGV4IiwiZjAiLCJlbmFibGVHR1hTcGVjdWxhciIsImFuaXNvdHJvcHkiLCJjbGVhckNvYXQiLCJjbGVhckNvYXRHbG9zcyIsImNsZWFyQ29hdEJ1bXBpbmVzcyIsImVtaXNzaXZlTWFwIiwiZW1pc3NpdmVUaW50IiwiZW1pc3NpdmVJbnRlbnNpdHkiLCJyZWZyYWN0aW9uIiwidXNlRHluYW1pY1JlZnJhY3Rpb24iLCJ0aGlja25lc3MiLCJhdHRlbnVhdGlvbkRpc3RhbmNlIiwidXNlSXJpZGVzY2VuY2UiLCJpcmlkZXNjZW5jZSIsImlyaWRlc2NlbmNlUmVmcmFjdGlvbkluZGV4IiwiaXJpZGVzY2VuY2VUaGlja25lc3NNaW4iLCJpcmlkZXNjZW5jZVRoaWNrbmVzc01heCIsIm9wYWNpdHkiLCJvcGFjaXR5RmFkZXNTcGVjdWxhciIsImFscGhhRmFkZSIsIm9jY2x1ZGVTcGVjdWxhciIsIm9jY2x1ZGVTcGVjdWxhckludGVuc2l0eSIsImN1YmVNYXBQcm9qZWN0aW9uIiwiQ1VCRVBST0pfQk9YIiwiX21hdFRleDJEIiwiYW1iaWVudFNIIiwibm9ybWFsTWFwIiwiYnVtcGluZXNzIiwibm9ybWFsRGV0YWlsTWFwIiwibm9ybWFsRGV0YWlsTWFwQnVtcGluZXNzIiwiaGVpZ2h0TWFwIiwiaXNQaG9uZyIsInNoYWRpbmdNb2RlbCIsIlNQRUNVTEFSX1BIT05HIiwiZW52QXRsYXMiLCJjdWJlTWFwIiwic3BoZXJlTWFwIiwicmVmbGVjdGl2aXR5IiwiY2xlYXJWYXJpYW50cyIsInVwZGF0ZUVudlVuaWZvcm1zIiwiaGFzTG9jYWxFbnZPdmVycmlkZSIsInVzZVNreWJveCIsInNreWJveCIsImdldFNoYWRlclZhcmlhbnQiLCJvYmpEZWZzIiwic3RhdGljTGlnaHRMaXN0IiwicGFzcyIsInNvcnRlZExpZ2h0cyIsInZpZXdVbmlmb3JtRm9ybWF0Iiwidmlld0JpbmRHcm91cEZvcm1hdCIsInZlcnRleEZvcm1hdCIsIm1pbmltYWxPcHRpb25zIiwiU0hBREVSX0RFUFRIIiwiU0hBREVSX1BJQ0siLCJTaGFkZXJQYXNzIiwiaXNTaGFkb3ciLCJvcHRpb25zIiwic3RhbmRhcmQiLCJvcHRpb25zQ29udGV4dE1pbiIsIm9wdGlvbnNDb250ZXh0IiwidXBkYXRlTWluUmVmIiwidXBkYXRlUmVmIiwib25VcGRhdGVTaGFkZXIiLCJwcm9jZXNzaW5nT3B0aW9ucyIsIlNoYWRlclByb2Nlc3Nvck9wdGlvbnMiLCJsaWJyYXJ5IiwiZ2V0UHJvZ3JhbUxpYnJhcnkiLCJyZWdpc3RlciIsImdldFByb2dyYW0iLCJkZXN0cm95IiwiYXNzZXQiLCJfdW5iaW5kIiwiVEVYVFVSRV9QQVJBTUVURVJTIiwic3RhbmRhcmRNYXRlcmlhbFRleHR1cmVQYXJhbWV0ZXJzIiwiQ1VCRU1BUF9QQVJBTUVURVJTIiwic3RhbmRhcmRNYXRlcmlhbEN1YmVtYXBQYXJhbWV0ZXJzIiwiZGVmaW5lVW5pZm9ybSIsImdldFVuaWZvcm1GdW5jIiwiZGVmaW5lUHJvcEludGVybmFsIiwiY29uc3RydWN0b3JGdW5jIiwic2V0dGVyRnVuYyIsImdldHRlckZ1bmMiLCJkZWZpbmVQcm9wZXJ0eSIsInByb3RvdHlwZSIsImdldCIsInNldCIsImRlZmluZVZhbHVlUHJvcCIsInByb3AiLCJpbnRlcm5hbE5hbWUiLCJkaXJ0eVNoYWRlckZ1bmMiLCJvbGRWYWx1ZSIsImRlZmF1bHRWYWx1ZSIsImRlZmluZUFnZ1Byb3AiLCJlcXVhbHMiLCJjbG9uZSIsImRlZmluZVByb3AiLCJfZGVmaW5lVGV4MkQiLCJjaGFubmVsIiwidmVydGV4Q29sb3IiLCJ1diIsImxlbmd0aCIsIm5ld1ZhbHVlIiwidHlwZSIsImZpeEN1YmVtYXBTZWFtcyIsImZvcm1hdCIsIlZlYzIiLCJtYXBUaWxpbmciLCJtYXBPZmZzZXQiLCJtYXBSb3RhdGlvbiIsIm1hcFRyYW5zZm9ybSIsIm1hdGVyaWFsIiwidGlsaW5nIiwib2Zmc2V0Iiwicm90YXRpb24iLCJ4IiwieSIsIkZsb2F0MzJBcnJheSIsImNyIiwiTWF0aCIsImNvcyIsIm1hdGgiLCJERUdfVE9fUkFEIiwic3IiLCJzaW4iLCJ1bmlmb3JtMCIsInVuaWZvcm0xIiwiX2RlZmluZUNvbG9yIiwiY29sb3IiLCJnYW1tYSIsInVzZUdhbW1hVG9uZW1hcCIsImdhbW1hQ29ycmVjdGlvbiIsInBvdyIsInIiLCJnIiwiYiIsIl9kZWZpbmVGbG9hdCIsIl9kZWZpbmVPYmplY3QiLCJfZGVmaW5lRmxhZyIsIl9kZWZpbmVNYXRlcmlhbFByb3BzIiwiQ29sb3IiLCJnbG9zcyIsImhlaWdodE1hcEZhY3RvciIsImJib3hNaW4iLCJjdWJlTWFwUHJvamVjdGlvbkJveCIsImdldE1pbiIsIm1pblVuaWZvcm0iLCJ6IiwiYmJveE1heCIsImdldE1heCIsIm1heFVuaWZvcm0iLCJTUEVDT0NDX0FPIiwiU1BFQ1VMQVJfQkxJTk4iLCJGUkVTTkVMX1NDSExJQ0siLCJDVUJFUFJPSl9OT05FIiwidW5kZWZpbmVkIiwiREVUQUlMTU9ERV9NVUwiLCJfcHJlZmlsdGVyZWRDdWJlbWFwcyIsImN1YmVtYXBzIiwiY2hhbmdlZCIsImNvbXBsZXRlIiwiaSIsIkVudkxpZ2h0aW5nIiwiZ2VuZXJhdGVQcmVmaWx0ZXJlZEF0bGFzIiwidGFyZ2V0IiwiZW1wdHkiLCJzbGljZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQXVCQTtBQUNBLE1BQU1BLE1BQU0sR0FBRyxFQUFFLENBQUE7O0FBRWpCO0FBQ0EsTUFBTUMsU0FBUyxHQUFHLEVBQUUsQ0FBQTs7QUFFcEI7QUFDQSxJQUFJQyxPQUFPLEdBQUcsSUFBSUMsR0FBRyxFQUFFLENBQUE7O0FBRXZCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNB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
