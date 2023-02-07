/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
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
 * alternative to specular color to save space. With metaless == 0, the pixel is assumed to be
 * dielectric, and diffuse color is used as normal. With metaless == 1, the pixel is fully
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
 * @property {number} shininess Defines glossiness of the material from 0 (rough) to 100 (shiny
 * mirror). A higher shininess value results in a more focused specular highlight. Glossiness map/
 * vertex colors are always multiplied by this value (normalized to 0 - 1 range), or it is used
 * directly as constant output.
 * @property {number} gloss Defines the glossiness of the material from 0 (rough) to 1 (shiny).
 * @property {import('../../platform/graphics/texture.js').Texture|null} glossMap Glossiness map
 * (default is null). If specified, will be multiplied by normalized 'shininess' value and/or
 * vertex colors.
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
 * If sheen glossiness map or sheen glosiness tint are set, they'll be multiplied by vertex colors.
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
  getShaderVariant(device, scene, objDefs, staticLightList, pass, sortedLights, viewUniformFormat, viewBindGroupFormat) {
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
    const processingOptions = new ShaderProcessorOptions(viewUniformFormat, viewBindGroupFormat);
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
      // This means currently animating a material colour is horribly slow.
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

  // shininess (range 0..100) - maps to internal gloss value (range 0..1)
  Object.defineProperty(StandardMaterial.prototype, 'shininess', {
    get: function () {
      return this.gloss * 100;
    },
    set: function (value) {
      this.gloss = value * 0.01;
    }
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhbmRhcmQtbWF0ZXJpYWwuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9zY2VuZS9tYXRlcmlhbHMvc3RhbmRhcmQtbWF0ZXJpYWwuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL2NvbG9yLmpzJztcbmltcG9ydCB7IG1hdGggfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvbWF0aC5qcyc7XG5pbXBvcnQgeyBWZWMyIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzIuanMnO1xuXG5pbXBvcnQgeyBTaGFkZXJQcm9jZXNzb3JPcHRpb25zIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3Mvc2hhZGVyLXByb2Nlc3Nvci1vcHRpb25zLmpzJztcblxuaW1wb3J0IHtcbiAgICBDVUJFUFJPSl9CT1gsIENVQkVQUk9KX05PTkUsXG4gICAgREVUQUlMTU9ERV9NVUwsXG4gICAgRlJFU05FTF9TQ0hMSUNLLFxuICAgIFNIQURFUl9ERVBUSCwgU0hBREVSX1BJQ0ssXG4gICAgU1BFQ09DQ19BTyxcbiAgICBTUEVDVUxBUl9CTElOTiwgU1BFQ1VMQVJfUEhPTkdcbn0gZnJvbSAnLi4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IFNoYWRlclBhc3MgfSBmcm9tICcuLi9zaGFkZXItcGFzcy5qcyc7XG5pbXBvcnQgeyBFbnZMaWdodGluZyB9IGZyb20gJy4uL2dyYXBoaWNzL2Vudi1saWdodGluZy5qcyc7XG5pbXBvcnQgeyBnZXRQcm9ncmFtTGlicmFyeSB9IGZyb20gJy4uL3NoYWRlci1saWIvZ2V0LXByb2dyYW0tbGlicmFyeS5qcyc7XG5pbXBvcnQgeyBfbWF0VGV4MkQsIHN0YW5kYXJkIH0gZnJvbSAnLi4vc2hhZGVyLWxpYi9wcm9ncmFtcy9zdGFuZGFyZC5qcyc7XG5pbXBvcnQgeyBNYXRlcmlhbCB9IGZyb20gJy4vbWF0ZXJpYWwuanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRNYXRlcmlhbE9wdGlvbnNCdWlsZGVyIH0gZnJvbSAnLi9zdGFuZGFyZC1tYXRlcmlhbC1vcHRpb25zLWJ1aWxkZXIuanMnO1xuaW1wb3J0IHsgc3RhbmRhcmRNYXRlcmlhbEN1YmVtYXBQYXJhbWV0ZXJzLCBzdGFuZGFyZE1hdGVyaWFsVGV4dHVyZVBhcmFtZXRlcnMgfSBmcm9tICcuL3N0YW5kYXJkLW1hdGVyaWFsLXBhcmFtZXRlcnMuanMnO1xuXG4vLyBwcm9wZXJ0aWVzIHRoYXQgZ2V0IGNyZWF0ZWQgb24gYSBzdGFuZGFyZCBtYXRlcmlhbFxuY29uc3QgX3Byb3BzID0ge307XG5cbi8vIHNwZWNpYWwgdW5pZm9ybSBmdW5jdGlvbnMgb24gYSBzdGFuZGFyZCBtYXRlcmlhbFxuY29uc3QgX3VuaWZvcm1zID0ge307XG5cbi8vIHRlbXBvcmFyeSBzZXQgb2YgcGFyYW1zXG5sZXQgX3BhcmFtcyA9IG5ldyBTZXQoKTtcblxuLyoqXG4gKiBDYWxsYmFjayB1c2VkIGJ5IHtAbGluayBTdGFuZGFyZE1hdGVyaWFsI29uVXBkYXRlU2hhZGVyfS5cbiAqXG4gKiBAY2FsbGJhY2sgVXBkYXRlU2hhZGVyQ2FsbGJhY2tcbiAqIEBwYXJhbSB7aW1wb3J0KCcuL3N0YW5kYXJkLW1hdGVyaWFsLW9wdGlvbnMuanMnKS5TdGFuZGFyZE1hdGVyaWFsT3B0aW9uc30gb3B0aW9ucyAtIEFuIG9iamVjdCB3aXRoIHNoYWRlciBnZW5lcmF0b3Igc2V0dGluZ3MgKGJhc2VkIG9uIGN1cnJlbnRcbiAqIG1hdGVyaWFsIGFuZCBzY2VuZSBwcm9wZXJ0aWVzKSwgdGhhdCB5b3UgY2FuIGNoYW5nZSBhbmQgdGhlbiByZXR1cm4uIFByb3BlcnRpZXMgb2YgdGhlIG9iamVjdCBwYXNzZWRcbiAqIGludG8gdGhpcyBmdW5jdGlvbiBhcmUgZG9jdW1lbnRlZCBpbiB7QGxpbmsgU3RhbmRhcmRNYXRlcmlhbH0uIEFsc28gY29udGFpbnMgYSBtZW1iZXIgbmFtZWQgbGl0T3B0aW9uc1xuICogd2hpY2ggaG9sZHMgc29tZSBvZiB0aGUgb3B0aW9ucyBvbmx5IHVzZWQgYnkgdGhlIGxpdCBzaGFkZXIgYmFja2VuZCB7QGxpbmsgTGl0T3B0aW9uc30uXG4gKiBAcmV0dXJucyB7aW1wb3J0KCcuL3N0YW5kYXJkLW1hdGVyaWFsLW9wdGlvbnMuanMnKS5TdGFuZGFyZE1hdGVyaWFsT3B0aW9uc30gUmV0dXJuZWQgc2V0dGluZ3Mgd2lsbCBiZSB1c2VkIGJ5IHRoZSBzaGFkZXIuXG4gKi9cblxuLyoqXG4gKiBBIFN0YW5kYXJkIG1hdGVyaWFsIGlzIHRoZSBtYWluLCBnZW5lcmFsIHB1cnBvc2UgbWF0ZXJpYWwgdGhhdCBpcyBtb3N0IG9mdGVuIHVzZWQgZm9yIHJlbmRlcmluZy5cbiAqIEl0IGNhbiBhcHByb3hpbWF0ZSBhIHdpZGUgdmFyaWV0eSBvZiBzdXJmYWNlIHR5cGVzIGFuZCBjYW4gc2ltdWxhdGUgZHluYW1pYyByZWZsZWN0ZWQgbGlnaHQuXG4gKiBNb3N0IG1hcHMgY2FuIHVzZSAzIHR5cGVzIG9mIGlucHV0IHZhbHVlcyBpbiBhbnkgY29tYmluYXRpb246IGNvbnN0YW50IChjb2xvciBvciBudW1iZXIpLCBtZXNoXG4gKiB2ZXJ0ZXggY29sb3JzIGFuZCBhIHRleHR1cmUuIEFsbCBlbmFibGVkIGlucHV0cyBhcmUgbXVsdGlwbGllZCB0b2dldGhlci5cbiAqXG4gKiBAcHJvcGVydHkge0NvbG9yfSBhbWJpZW50IFRoZSBhbWJpZW50IGNvbG9yIG9mIHRoZSBtYXRlcmlhbC4gVGhpcyBjb2xvciB2YWx1ZSBpcyAzLWNvbXBvbmVudFxuICogKFJHQiksIHdoZXJlIGVhY2ggY29tcG9uZW50IGlzIGJldHdlZW4gMCBhbmQgMS5cbiAqIEBwcm9wZXJ0eSB7Q29sb3J9IGRpZmZ1c2UgVGhlIGRpZmZ1c2UgY29sb3Igb2YgdGhlIG1hdGVyaWFsLiBUaGlzIGNvbG9yIHZhbHVlIGlzIDMtY29tcG9uZW50XG4gKiAoUkdCKSwgd2hlcmUgZWFjaCBjb21wb25lbnQgaXMgYmV0d2VlbiAwIGFuZCAxLiBEZWZpbmVzIGJhc2ljIHN1cmZhY2UgY29sb3IgKGFrYSBhbGJlZG8pLlxuICogQHByb3BlcnR5IHtib29sZWFufSBkaWZmdXNlVGludCBNdWx0aXBseSBtYWluIChwcmltYXJ5KSBkaWZmdXNlIG1hcCBhbmQvb3IgZGlmZnVzZSB2ZXJ0ZXggY29sb3JcbiAqIGJ5IHRoZSBjb25zdGFudCBkaWZmdXNlIHZhbHVlLlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnKS5UZXh0dXJlfG51bGx9IGRpZmZ1c2VNYXAgVGhlIG1haW5cbiAqIChwcmltYXJ5KSBkaWZmdXNlIG1hcCBvZiB0aGUgbWF0ZXJpYWwgKGRlZmF1bHQgaXMgbnVsbCkuXG4gKiBAcHJvcGVydHkge251bWJlcn0gZGlmZnVzZU1hcFV2IE1haW4gKHByaW1hcnkpIGRpZmZ1c2UgbWFwIFVWIGNoYW5uZWwuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IGRpZmZ1c2VNYXBUaWxpbmcgQ29udHJvbHMgdGhlIDJEIHRpbGluZyBvZiB0aGUgbWFpbiAocHJpbWFyeSkgZGlmZnVzZSBtYXAuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IGRpZmZ1c2VNYXBPZmZzZXQgQ29udHJvbHMgdGhlIDJEIG9mZnNldCBvZiB0aGUgbWFpbiAocHJpbWFyeSkgZGlmZnVzZSBtYXAuIEVhY2hcbiAqIGNvbXBvbmVudCBpcyBiZXR3ZWVuIDAgYW5kIDEuXG4gKiBAcHJvcGVydHkge251bWJlcn0gZGlmZnVzZU1hcFJvdGF0aW9uIENvbnRyb2xzIHRoZSAyRCByb3RhdGlvbiAoaW4gZGVncmVlcykgb2YgdGhlIG1haW5cbiAqIChwcmltYXJ5KSBkaWZmdXNlIG1hcC5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBkaWZmdXNlTWFwQ2hhbm5lbCBDb2xvciBjaGFubmVscyBvZiB0aGUgbWFpbiAocHJpbWFyeSkgZGlmZnVzZSBtYXAgdG8gdXNlLlxuICogQ2FuIGJlIFwiclwiLCBcImdcIiwgXCJiXCIsIFwiYVwiLCBcInJnYlwiIG9yIGFueSBzd2l6emxlZCBjb21iaW5hdGlvbi5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gZGlmZnVzZVZlcnRleENvbG9yIFVzZSBtZXNoIHZlcnRleCBjb2xvcnMgZm9yIGRpZmZ1c2UuIElmIGRpZmZ1c2VNYXAgb3IgYXJlXG4gKiBkaWZmdXNlVGludCBhcmUgc2V0LCB0aGV5J2xsIGJlIG11bHRpcGxpZWQgYnkgdmVydGV4IGNvbG9ycy5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBkaWZmdXNlVmVydGV4Q29sb3JDaGFubmVsIFZlcnRleCBjb2xvciBjaGFubmVscyB0byB1c2UgZm9yIGRpZmZ1c2UuIENhbiBiZVxuICogXCJyXCIsIFwiZ1wiLCBcImJcIiwgXCJhXCIsIFwicmdiXCIgb3IgYW55IHN3aXp6bGVkIGNvbWJpbmF0aW9uLlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnKS5UZXh0dXJlfG51bGx9IGRpZmZ1c2VEZXRhaWxNYXAgVGhlXG4gKiBkZXRhaWwgKHNlY29uZGFyeSkgZGlmZnVzZSBtYXAgb2YgdGhlIG1hdGVyaWFsIChkZWZhdWx0IGlzIG51bGwpLiBXaWxsIG9ubHkgYmUgdXNlZCBpZiBtYWluXG4gKiAocHJpbWFyeSkgZGlmZnVzZSBtYXAgaXMgbm9uLW51bGwuXG4gKiBAcHJvcGVydHkge251bWJlcn0gZGlmZnVzZURldGFpbE1hcFV2IERldGFpbCAoc2Vjb25kYXJ5KSBkaWZmdXNlIG1hcCBVViBjaGFubmVsLlxuICogQHByb3BlcnR5IHtWZWMyfSBkaWZmdXNlRGV0YWlsTWFwVGlsaW5nIENvbnRyb2xzIHRoZSAyRCB0aWxpbmcgb2YgdGhlIGRldGFpbCAoc2Vjb25kYXJ5KSBkaWZmdXNlXG4gKiBtYXAuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IGRpZmZ1c2VEZXRhaWxNYXBPZmZzZXQgQ29udHJvbHMgdGhlIDJEIG9mZnNldCBvZiB0aGUgZGV0YWlsIChzZWNvbmRhcnkpIGRpZmZ1c2VcbiAqIG1hcC4gRWFjaCBjb21wb25lbnQgaXMgYmV0d2VlbiAwIGFuZCAxLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGRpZmZ1c2VEZXRhaWxNYXBSb3RhdGlvbiBDb250cm9scyB0aGUgMkQgcm90YXRpb24gKGluIGRlZ3JlZXMpIG9mIHRoZSBtYWluXG4gKiAoc2Vjb25kYXJ5KSBkaWZmdXNlIG1hcC5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBkaWZmdXNlRGV0YWlsTWFwQ2hhbm5lbCBDb2xvciBjaGFubmVscyBvZiB0aGUgZGV0YWlsIChzZWNvbmRhcnkpIGRpZmZ1c2UgbWFwXG4gKiB0byB1c2UuIENhbiBiZSBcInJcIiwgXCJnXCIsIFwiYlwiLCBcImFcIiwgXCJyZ2JcIiBvciBhbnkgc3dpenpsZWQgY29tYmluYXRpb24uXG4gKiBAcHJvcGVydHkge3N0cmluZ30gZGlmZnVzZURldGFpbE1vZGUgRGV0ZXJtaW5lcyBob3cgdGhlIG1haW4gKHByaW1hcnkpIGFuZCBkZXRhaWwgKHNlY29uZGFyeSlcbiAqIGRpZmZ1c2UgbWFwcyBhcmUgYmxlbmRlZCB0b2dldGhlci4gQ2FuIGJlOlxuICpcbiAqIC0ge0BsaW5rIERFVEFJTE1PREVfTVVMfTogTXVsdGlwbHkgdG9nZXRoZXIgdGhlIHByaW1hcnkgYW5kIHNlY29uZGFyeSBjb2xvcnMuXG4gKiAtIHtAbGluayBERVRBSUxNT0RFX0FERH06IEFkZCB0b2dldGhlciB0aGUgcHJpbWFyeSBhbmQgc2Vjb25kYXJ5IGNvbG9ycy5cbiAqIC0ge0BsaW5rIERFVEFJTE1PREVfU0NSRUVOfTogU29mdGVyIHZlcnNpb24gb2Yge0BsaW5rIERFVEFJTE1PREVfQUREfS5cbiAqIC0ge0BsaW5rIERFVEFJTE1PREVfT1ZFUkxBWX06IE11bHRpcGxpZXMgb3Igc2NyZWVucyB0aGUgY29sb3JzLCBkZXBlbmRpbmcgb24gdGhlIHByaW1hcnkgY29sb3IuXG4gKiAtIHtAbGluayBERVRBSUxNT0RFX01JTn06IFNlbGVjdCB3aGljaGV2ZXIgb2YgdGhlIHByaW1hcnkgYW5kIHNlY29uZGFyeSBjb2xvcnMgaXMgZGFya2VyLFxuICogY29tcG9uZW50LXdpc2UuXG4gKiAtIHtAbGluayBERVRBSUxNT0RFX01BWH06IFNlbGVjdCB3aGljaGV2ZXIgb2YgdGhlIHByaW1hcnkgYW5kIHNlY29uZGFyeSBjb2xvcnMgaXMgbGlnaHRlcixcbiAqIGNvbXBvbmVudC13aXNlLlxuICpcbiAqIERlZmF1bHRzIHRvIHtAbGluayBERVRBSUxNT0RFX01VTH0uXG4gKiBAcHJvcGVydHkge0NvbG9yfSBzcGVjdWxhciBUaGUgc3BlY3VsYXIgY29sb3Igb2YgdGhlIG1hdGVyaWFsLiBUaGlzIGNvbG9yIHZhbHVlIGlzIDMtY29tcG9uZW50XG4gKiAoUkdCKSwgd2hlcmUgZWFjaCBjb21wb25lbnQgaXMgYmV0d2VlbiAwIGFuZCAxLiBEZWZpbmVzIHN1cmZhY2UgcmVmbGVjdGlvbi9zcGVjdWxhciBjb2xvci5cbiAqIEFmZmVjdHMgc3BlY3VsYXIgaW50ZW5zaXR5IGFuZCB0aW50LlxuICogQHByb3BlcnR5IHtib29sZWFufSBzcGVjdWxhclRpbnQgTXVsdGlwbHkgc3BlY3VsYXIgbWFwIGFuZC9vciBzcGVjdWxhciB2ZXJ0ZXggY29sb3IgYnkgdGhlXG4gKiBjb25zdGFudCBzcGVjdWxhciB2YWx1ZS5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJykuVGV4dHVyZXxudWxsfSBzcGVjdWxhck1hcCBUaGUgc3BlY3VsYXJcbiAqIG1hcCBvZiB0aGUgbWF0ZXJpYWwgKGRlZmF1bHQgaXMgbnVsbCkuXG4gKiBAcHJvcGVydHkge251bWJlcn0gc3BlY3VsYXJNYXBVdiBTcGVjdWxhciBtYXAgVVYgY2hhbm5lbC5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gc3BlY3VsYXJNYXBUaWxpbmcgQ29udHJvbHMgdGhlIDJEIHRpbGluZyBvZiB0aGUgc3BlY3VsYXIgbWFwLlxuICogQHByb3BlcnR5IHtWZWMyfSBzcGVjdWxhck1hcE9mZnNldCBDb250cm9scyB0aGUgMkQgb2Zmc2V0IG9mIHRoZSBzcGVjdWxhciBtYXAuIEVhY2ggY29tcG9uZW50IGlzXG4gKiBiZXR3ZWVuIDAgYW5kIDEuXG4gKiBAcHJvcGVydHkge251bWJlcn0gc3BlY3VsYXJNYXBSb3RhdGlvbiBDb250cm9scyB0aGUgMkQgcm90YXRpb24gKGluIGRlZ3JlZXMpIG9mIHRoZSBzcGVjdWxhciBtYXAuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gc3BlY3VsYXJNYXBDaGFubmVsIENvbG9yIGNoYW5uZWxzIG9mIHRoZSBzcGVjdWxhciBtYXAgdG8gdXNlLiBDYW4gYmUgXCJyXCIsIFwiZ1wiLFxuICogXCJiXCIsIFwiYVwiLCBcInJnYlwiIG9yIGFueSBzd2l6emxlZCBjb21iaW5hdGlvbi5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gc3BlY3VsYXJWZXJ0ZXhDb2xvciBVc2UgbWVzaCB2ZXJ0ZXggY29sb3JzIGZvciBzcGVjdWxhci4gSWYgc3BlY3VsYXJNYXAgb3JcbiAqIGFyZSBzcGVjdWxhclRpbnQgYXJlIHNldCwgdGhleSdsbCBiZSBtdWx0aXBsaWVkIGJ5IHZlcnRleCBjb2xvcnMuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gc3BlY3VsYXJWZXJ0ZXhDb2xvckNoYW5uZWwgVmVydGV4IGNvbG9yIGNoYW5uZWxzIHRvIHVzZSBmb3Igc3BlY3VsYXIuIENhbiBiZVxuICogQHByb3BlcnR5IHtib29sZWFufSBzcGVjdWxhcml0eUZhY3RvclRpbnQgTXVsdGlwbHkgc3BlY3VsYXJpdHkgZmFjdG9yIG1hcCBhbmQvb3Igc3BlY3VsYXIgdmVydGV4IGNvbG9yIGJ5IHRoZVxuICogY29uc3RhbnQgc3BlY3VsYXIgdmFsdWUuXG4gKiBcInJcIiwgXCJnXCIsIFwiYlwiLCBcImFcIiwgXCJyZ2JcIiBvciBhbnkgc3dpenpsZWQgY29tYmluYXRpb24uXG4gKiBAcHJvcGVydHkge251bWJlcn0gc3BlY3VsYXJpdHlGYWN0b3IgVGhlIGZhY3RvciBvZiBzcGVjdWxhciBpbnRlbnNpdHksIHVzZWQgdG8gd2VpZ2h0IHRoZSBmcmVzbmVsIGFuZCBzcGVjdWxhcml0eS4gRGVmYXVsdCBpcyAxLjAuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcycpLlRleHR1cmV8bnVsbH0gc3BlY3VsYXJpdHlGYWN0b3JNYXAgVGhlXG4gKiBmYWN0b3Igb2Ygc3BlY3VsYXJpdHkgYXMgYSB0ZXh0dXJlIChkZWZhdWx0IGlzIG51bGwpLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHNwZWN1bGFyaXR5RmFjdG9yTWFwVXYgU3BlY3VsYXJpdHkgZmFjdG9yIG1hcCBVViBjaGFubmVsLlxuICogQHByb3BlcnR5IHtWZWMyfSBzcGVjdWxhcml0eUZhY3Rvck1hcFRpbGluZyBDb250cm9scyB0aGUgMkQgdGlsaW5nIG9mIHRoZSBzcGVjdWxhcml0eSBmYWN0b3IgbWFwLlxuICogQHByb3BlcnR5IHtWZWMyfSBzcGVjdWxhcml0eUZhY3Rvck1hcE9mZnNldCBDb250cm9scyB0aGUgMkQgb2Zmc2V0IG9mIHRoZSBzcGVjdWxhcml0eSBmYWN0b3IgbWFwLiBFYWNoIGNvbXBvbmVudCBpc1xuICogYmV0d2VlbiAwIGFuZCAxLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHNwZWN1bGFyaXR5RmFjdG9yTWFwUm90YXRpb24gQ29udHJvbHMgdGhlIDJEIHJvdGF0aW9uIChpbiBkZWdyZWVzKSBvZiB0aGUgc3BlY3VsYXJpdHkgZmFjdG9yIG1hcC5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBzcGVjdWxhcml0eUZhY3Rvck1hcENoYW5uZWwgVGhlIGNoYW5uZWwgdXNlZCBieSB0aGUgc3BlY3VsYXJpdHkgZmFjdG9yIHRleHR1cmUgdG8gc2FtcGxlIGZyb20gKGRlZmF1bHQgaXMgJ2EnKS5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gc3BlY3VsYXJpdHlGYWN0b3JWZXJ0ZXhDb2xvciBVc2UgbWVzaCB2ZXJ0ZXggY29sb3JzIGZvciBzcGVjdWxhcml0eSBmYWN0b3IuIElmIHNwZWN1bGFyaXR5RmFjdG9yTWFwIG9yXG4gKiBhcmUgc3BlY3VsYXJpdHlGYWN0b3JUaW50IGFyZSBzZXQsIHRoZXknbGwgYmUgbXVsdGlwbGllZCBieSB2ZXJ0ZXggY29sb3JzLlxuICogQHByb3BlcnR5IHtzdHJpbmd9IHNwZWN1bGFyaXR5RmFjdG9yVmVydGV4Q29sb3JDaGFubmVsIFZlcnRleCBjb2xvciBjaGFubmVscyB0byB1c2UgZm9yIHNwZWN1bGFyaXR5IGZhY3Rvci4gQ2FuIGJlXG4gKiBcInJcIiwgXCJnXCIsIFwiYlwiLCBcImFcIiwgXCJyZ2JcIiBvciBhbnkgc3dpenpsZWQgY29tYmluYXRpb24uXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IGVuYWJsZUdHWFNwZWN1bGFyIEVuYWJsZXMgR0dYIHNwZWN1bGFyLiBBbHNvIGVuYWJsZXNcbiAqIHtAbGluayBTdGFuZGFyZE1hdGVyaWFsI2FuaXNvdHJvcHl9ICBwYXJhbWV0ZXIgdG8gc2V0IG1hdGVyaWFsIGFuaXNvdHJvcHkuXG4gKiBAcHJvcGVydHkge251bWJlcn0gYW5pc290cm9weSBEZWZpbmVzIGFtb3VudCBvZiBhbmlzb3Ryb3B5LiBSZXF1aXJlc1xuICoge0BsaW5rIFN0YW5kYXJkTWF0ZXJpYWwjZW5hYmxlR0dYU3BlY3VsYXJ9IGlzIHNldCB0byB0cnVlLlxuICpcbiAqIC0gV2hlbiBhbmlzb3Ryb3B5ID09IDAsIHNwZWN1bGFyIGlzIGlzb3Ryb3BpYy5cbiAqIC0gV2hlbiBhbmlzb3Ryb3B5IDwgMCwgYW5pc290cm9weSBkaXJlY3Rpb24gYWxpZ25zIHdpdGggdGhlIHRhbmdlbnQsIGFuZCBzcGVjdWxhciBhbmlzb3Ryb3B5XG4gKiBpbmNyZWFzZXMgYXMgdGhlIGFuaXNvdHJvcHkgdmFsdWUgZGVjcmVhc2VzIHRvIG1pbmltdW0gb2YgLTEuXG4gKiAtIFdoZW4gYW5pc290cm9weSA+IDAsIGFuaXNvdHJvcHkgZGlyZWN0aW9uIGFsaWducyB3aXRoIHRoZSBiaS1ub3JtYWwsIGFuZCBzcGVjdWxhciBhbmlzb3Ryb3B5XG4gKiBpbmNyZWFzZXMgYXMgYW5pc290cm9weSB2YWx1ZSBpbmNyZWFzZXMgdG8gbWF4aW11bSBvZiAxLlxuICpcbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBjbGVhckNvYXQgRGVmaW5lcyBpbnRlbnNpdHkgb2YgY2xlYXJjb2F0IGxheWVyIGZyb20gMCB0byAxLiBDbGVhcmNvYXQgbGF5ZXJcbiAqIGlzIGRpc2FibGVkIHdoZW4gY2xlYXJDb2F0ID09IDAuIERlZmF1bHQgdmFsdWUgaXMgMCAoZGlzYWJsZWQpLlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnKS5UZXh0dXJlfG51bGx9IGNsZWFyQ29hdE1hcCBNb25vY2hyb21lXG4gKiBjbGVhcmNvYXQgaW50ZW5zaXR5IG1hcCAoZGVmYXVsdCBpcyBudWxsKS4gSWYgc3BlY2lmaWVkLCB3aWxsIGJlIG11bHRpcGxpZWQgYnkgbm9ybWFsaXplZFxuICogJ2NsZWFyQ29hdCcgdmFsdWUgYW5kL29yIHZlcnRleCBjb2xvcnMuXG4gKiBAcHJvcGVydHkge251bWJlcn0gY2xlYXJDb2F0TWFwVXYgQ2xlYXJjb2F0IGludGVuc2l0eSBtYXAgVVYgY2hhbm5lbC5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gY2xlYXJDb2F0TWFwVGlsaW5nIENvbnRyb2xzIHRoZSAyRCB0aWxpbmcgb2YgdGhlIGNsZWFyY29hdCBpbnRlbnNpdHkgbWFwLlxuICogQHByb3BlcnR5IHtWZWMyfSBjbGVhckNvYXRNYXBPZmZzZXQgQ29udHJvbHMgdGhlIDJEIG9mZnNldCBvZiB0aGUgY2xlYXJjb2F0IGludGVuc2l0eSBtYXAuIEVhY2hcbiAqIGNvbXBvbmVudCBpcyBiZXR3ZWVuIDAgYW5kIDEuXG4gKiBAcHJvcGVydHkge251bWJlcn0gY2xlYXJDb2F0TWFwUm90YXRpb24gQ29udHJvbHMgdGhlIDJEIHJvdGF0aW9uIChpbiBkZWdyZWVzKSBvZiB0aGUgY2xlYXJjb2F0XG4gKiBpbnRlbnNpdHkgbWFwLlxuICogQHByb3BlcnR5IHtzdHJpbmd9IGNsZWFyQ29hdE1hcENoYW5uZWwgQ29sb3IgY2hhbm5lbCBvZiB0aGUgY2xlYXJjb2F0IGludGVuc2l0eSBtYXAgdG8gdXNlLiBDYW5cbiAqIGJlIFwiclwiLCBcImdcIiwgXCJiXCIgb3IgXCJhXCIuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IGNsZWFyQ29hdFZlcnRleENvbG9yIFVzZSBtZXNoIHZlcnRleCBjb2xvcnMgZm9yIGNsZWFyY29hdCBpbnRlbnNpdHkuIElmXG4gKiBjbGVhckNvYXRNYXAgaXMgc2V0LCBpdCdsbCBiZSBtdWx0aXBsaWVkIGJ5IHZlcnRleCBjb2xvcnMuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gY2xlYXJDb2F0VmVydGV4Q29sb3JDaGFubmVsIFZlcnRleCBjb2xvciBjaGFubmVsIHRvIHVzZSBmb3IgY2xlYXJjb2F0XG4gKiBpbnRlbnNpdHkuIENhbiBiZSBcInJcIiwgXCJnXCIsIFwiYlwiIG9yIFwiYVwiLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGNsZWFyQ29hdEdsb3NzIERlZmluZXMgdGhlIGNsZWFyY29hdCBnbG9zc2luZXNzIG9mIHRoZSBjbGVhcmNvYXQgbGF5ZXJcbiAqIGZyb20gMCAocm91Z2gpIHRvIDEgKG1pcnJvcikuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IGNsZWFyQ29hdEdsb3NzSW52ZXJ0IEludmVydCB0aGUgY2xlYXJjb2F0IGdsb3NzIGNvbXBvbmVudCAoZGVmYXVsdCBpcyBmYWxzZSkuXG4gKiBFbmFibGluZyB0aGlzIGZsYWcgcmVzdWx0cyBpbiBtYXRlcmlhbCB0cmVhdGluZyB0aGUgY2xlYXIgY29hdCBnbG9zcyBtZW1iZXJzIGFzIHJvdWdobmVzcy5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJykuVGV4dHVyZXxudWxsfSBjbGVhckNvYXRHbG9zc01hcCBNb25vY2hyb21lXG4gKiBjbGVhcmNvYXQgZ2xvc3NpbmVzcyBtYXAgKGRlZmF1bHQgaXMgbnVsbCkuIElmIHNwZWNpZmllZCwgd2lsbCBiZSBtdWx0aXBsaWVkIGJ5IG5vcm1hbGl6ZWRcbiAqICdjbGVhckNvYXRHbG9zcycgdmFsdWUgYW5kL29yIHZlcnRleCBjb2xvcnMuXG4gKiBAcHJvcGVydHkge251bWJlcn0gY2xlYXJDb2F0R2xvc3NNYXBVdiBDbGVhcmNvYXQgZ2xvc3MgbWFwIFVWIGNoYW5uZWwuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IGNsZWFyQ29hdEdsb3NzTWFwVGlsaW5nIENvbnRyb2xzIHRoZSAyRCB0aWxpbmcgb2YgdGhlIGNsZWFyY29hdCBnbG9zcyBtYXAuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IGNsZWFyQ29hdEdsb3NzTWFwT2Zmc2V0IENvbnRyb2xzIHRoZSAyRCBvZmZzZXQgb2YgdGhlIGNsZWFyY29hdCBnbG9zcyBtYXAuXG4gKiBFYWNoIGNvbXBvbmVudCBpcyBiZXR3ZWVuIDAgYW5kIDEuXG4gKiBAcHJvcGVydHkge251bWJlcn0gY2xlYXJDb2F0R2xvc3NNYXBSb3RhdGlvbiBDb250cm9scyB0aGUgMkQgcm90YXRpb24gKGluIGRlZ3JlZXMpIG9mIHRoZSBjbGVhclxuICogY29hdCBnbG9zcyBtYXAuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gY2xlYXJDb2F0R2xvc3NNYXBDaGFubmVsIENvbG9yIGNoYW5uZWwgb2YgdGhlIGNsZWFyY29hdCBnbG9zcyBtYXAgdG8gdXNlLlxuICogQ2FuIGJlIFwiclwiLCBcImdcIiwgXCJiXCIgb3IgXCJhXCIuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IGNsZWFyQ29hdEdsb3NzVmVydGV4Q29sb3IgVXNlIG1lc2ggdmVydGV4IGNvbG9ycyBmb3IgY2xlYXJjb2F0IGdsb3NzaW5lc3MuXG4gKiBJZiBjbGVhckNvYXRHbG9zc01hcCBpcyBzZXQsIGl0J2xsIGJlIG11bHRpcGxpZWQgYnkgdmVydGV4IGNvbG9ycy5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBjbGVhckNvYXRHbG9zc1ZlcnRleENvbG9yQ2hhbm5lbCBWZXJ0ZXggY29sb3IgY2hhbm5lbCB0byB1c2UgZm9yIGNsZWFyY29hdFxuICogZ2xvc3NpbmVzcy4gQ2FuIGJlIFwiclwiLCBcImdcIiwgXCJiXCIgb3IgXCJhXCIuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcycpLlRleHR1cmV8bnVsbH0gY2xlYXJDb2F0Tm9ybWFsTWFwIFRoZVxuICogY2xlYXJjb2F0IG5vcm1hbCBtYXAgb2YgdGhlIG1hdGVyaWFsIChkZWZhdWx0IGlzIG51bGwpLiBUaGUgdGV4dHVyZSBtdXN0IGNvbnRhaW5zIG5vcm1hbGl6ZWQsXG4gKiB0YW5nZW50IHNwYWNlIG5vcm1hbHMuXG4gKiBAcHJvcGVydHkge251bWJlcn0gY2xlYXJDb2F0Tm9ybWFsTWFwVXYgQ2xlYXJjb2F0IG5vcm1hbCBtYXAgVVYgY2hhbm5lbC5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gY2xlYXJDb2F0Tm9ybWFsTWFwVGlsaW5nIENvbnRyb2xzIHRoZSAyRCB0aWxpbmcgb2YgdGhlIG1haW4gY2xlYXJjb2F0IG5vcm1hbFxuICogbWFwLlxuICogQHByb3BlcnR5IHtWZWMyfSBjbGVhckNvYXROb3JtYWxNYXBPZmZzZXQgQ29udHJvbHMgdGhlIDJEIG9mZnNldCBvZiB0aGUgbWFpbiBjbGVhcmNvYXQgbm9ybWFsXG4gKiBtYXAuIEVhY2ggY29tcG9uZW50IGlzIGJldHdlZW4gMCBhbmQgMS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBjbGVhckNvYXROb3JtYWxNYXBSb3RhdGlvbiBDb250cm9scyB0aGUgMkQgcm90YXRpb24gKGluIGRlZ3JlZXMpIG9mIHRoZSBtYWluXG4gKiBjbGVhcmNvYXQgbWFwLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGNsZWFyQ29hdEJ1bXBpbmVzcyBUaGUgYnVtcGluZXNzIG9mIHRoZSBjbGVhcmNvYXQgbGF5ZXIuIFRoaXMgdmFsdWUgc2NhbGVzXG4gKiB0aGUgYXNzaWduZWQgbWFpbiBjbGVhcmNvYXQgbm9ybWFsIG1hcC4gSXQgc2hvdWxkIGJlIG5vcm1hbGx5IGJldHdlZW4gMCAobm8gYnVtcCBtYXBwaW5nKSBhbmQgMVxuICogKGZ1bGwgYnVtcCBtYXBwaW5nKSwgYnV0IGNhbiBiZSBzZXQgdG8gZS5nLiAyIHRvIGdpdmUgZXZlbiBtb3JlIHByb25vdW5jZWQgYnVtcCBlZmZlY3QuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IHVzZUlyaWRlc2NlbmNlIEVuYWJsZSB0aGluLWZpbG0gaXJpZGVzY2VuY2UuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcycpLlRleHR1cmV8bnVsbH0gaXJpZGVzY2VuY2VNYXAgVGhlXG4gKiBwZXItcGl4ZWwgaXJpZGVzY2VuY2UgaW50ZW5zaXR5LiBPbmx5IHVzZWQgd2hlbiB1c2VJcmlkZXNjZW5jZSBpcyBlbmFibGVkLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGlyaWRlc2NlbmNlTWFwVXYgSXJpZGVzY2VuY2UgbWFwIFVWIGNoYW5uZWwuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IGlyaWRlc2NlbmNlTWFwVGlsaW5nIENvbnRyb2xzIHRoZSAyRCB0aWxpbmcgb2YgdGhlIGlyaWRlc2NlbmNlIG1hcC5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gaXJpZGVzY2VuY2VNYXBPZmZzZXQgQ29udHJvbHMgdGhlIDJEIG9mZnNldCBvZiB0aGUgaXJpZGVzY2VuY2UgbWFwLiBFYWNoIGNvbXBvbmVudCBpc1xuICogYmV0d2VlbiAwIGFuZCAxLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGlyaWRlc2NlbmNlTWFwUm90YXRpb24gQ29udHJvbHMgdGhlIDJEIHJvdGF0aW9uIChpbiBkZWdyZWVzKSBvZiB0aGUgaXJpZGVzY2VuY2VcbiAqIG1hcC5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBpcmlkZXNjZW5jZU1hcENoYW5uZWwgQ29sb3IgY2hhbm5lbHMgb2YgdGhlIGlyaWRlc2NlbmNlIG1hcCB0byB1c2UuIENhbiBiZSBcInJcIixcbiAqIFwiZ1wiLCBcImJcIiBvciBcImFcIi5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJykuVGV4dHVyZXxudWxsfSBpcmlkZXNjZW5jZVRoaWNrbmVzc01hcCBUaGVcbiAqIHBlci1waXhlbCBpcmlkZXNjZW5jZSB0aGlja25lc3MuIERlZmluZXMgYSBncmFkaWVudCB3ZWlnaHQgYmV0d2VlbiBpcmlkZXNjZW5jZVRoaWNrbmVzc01pbiBhbmRcbiAqIGlyaWRlc2NlbmNlVGhpY2tuZXNzTWF4LiBPbmx5IHVzZWQgd2hlbiB1c2VJcmlkZXNjZW5jZSBpcyBlbmFibGVkLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGlyaWRlc2NlbmNlVGhpY2tuZXNzTWFwVXYgSXJpZGVzY2VuY2UgdGhpY2tuZXNzIG1hcCBVViBjaGFubmVsLlxuICogQHByb3BlcnR5IHtWZWMyfSBpcmlkZXNjZW5jZVRoaWNrbmVzc01hcFRpbGluZyBDb250cm9scyB0aGUgMkQgdGlsaW5nIG9mIHRoZSBpcmlkZXNjZW5jZVxuICogdGhpY2tuZXNzIG1hcC5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gaXJpZGVzY2VuY2VUaGlja25lc3NNYXBPZmZzZXQgQ29udHJvbHMgdGhlIDJEIG9mZnNldCBvZiB0aGUgaXJpZGVzY2VuY2VcbiAqIHRoaWNrbmVzcyBtYXAuIEVhY2ggY29tcG9uZW50IGlzIGJldHdlZW4gMCBhbmQgMS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBpcmlkZXNjZW5jZVRoaWNrbmVzc01hcFJvdGF0aW9uIENvbnRyb2xzIHRoZSAyRCByb3RhdGlvbiAoaW4gZGVncmVlcylcbiAqIG9mIHRoZSBpcmlkZXNjZW5jZSBtYXAuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gaXJpZGVzY2VuY2VUaGlja25lc3NNYXBDaGFubmVsIENvbG9yIGNoYW5uZWxzIG9mIHRoZSBpcmlkZXNjZW5jZSB0aGlja25lc3NcbiAqIG1hcCB0byB1c2UuIENhbiBiZSBcInJcIiwgXCJnXCIsIFwiYlwiIG9yIFwiYVwiLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGlyaWRlc2NlbmNlVGhpY2tuZXNzTWluIFRoZSBtaW5pbXVtIHRoaWNrbmVzcyBmb3IgdGhlIGlyaWRlc2NlbmNlIGxheWVyLlxuICogT25seSB1c2VkIHdoZW4gYW4gaXJpZGVzY2VuY2UgdGhpY2tuZXNzIG1hcCBpcyB1c2VkLiBUaGUgdW5pdCBpcyBpbiBubS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBpcmlkZXNjZW5jZVRoaWNrbmVzc01heCBUaGUgbWF4aW11bSB0aGlja25lc3MgZm9yIHRoZSBpcmlkZXNjZW5jZSBsYXllci5cbiAqIFVzZWQgYXMgdGhlICdiYXNlJyB0aGlja25lc3Mgd2hlbiBubyBpcmlkZXNjZW5jZSB0aGlja25lc3MgbWFwIGlzIGRlZmluZWQuIFRoZSB1bml0IGlzIGluIG5tLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGlyaWRlc2NlbmNlUmVmcmFjdGlvbkluZGV4IFRoZSBpbmRleCBvZiByZWZyYWN0aW9uIG9mIHRoZSBpcmlkZXNjZW50XG4gKiB0aGluLWZpbG0uIEFmZmVjdHMgdGhlIGNvbG9yIHBoYXNlIHNoaWZ0IGFzIGRlc2NyaWJlZCBoZXJlOlxuICogaHR0cHM6Ly9naXRodWIuY29tL0tocm9ub3NHcm91cC9nbFRGL3RyZWUvbWFpbi9leHRlbnNpb25zLzIuMC9LaHJvbm9zL0tIUl9tYXRlcmlhbHNfaXJpZGVzY2VuY2VcbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gdXNlTWV0YWxuZXNzIFVzZSBtZXRhbG5lc3MgcHJvcGVydGllcyBpbnN0ZWFkIG9mIHNwZWN1bGFyLiBXaGVuIGVuYWJsZWQsXG4gKiBkaWZmdXNlIGNvbG9ycyBhbHNvIGFmZmVjdCBzcGVjdWxhciBpbnN0ZWFkIG9mIHRoZSBkZWRpY2F0ZWQgc3BlY3VsYXIgbWFwLiBUaGlzIGNhbiBiZSB1c2VkIGFzXG4gKiBhbHRlcm5hdGl2ZSB0byBzcGVjdWxhciBjb2xvciB0byBzYXZlIHNwYWNlLiBXaXRoIG1ldGFsZXNzID09IDAsIHRoZSBwaXhlbCBpcyBhc3N1bWVkIHRvIGJlXG4gKiBkaWVsZWN0cmljLCBhbmQgZGlmZnVzZSBjb2xvciBpcyB1c2VkIGFzIG5vcm1hbC4gV2l0aCBtZXRhbGVzcyA9PSAxLCB0aGUgcGl4ZWwgaXMgZnVsbHlcbiAqIG1ldGFsbGljLCBhbmQgZGlmZnVzZSBjb2xvciBpcyB1c2VkIGFzIHNwZWN1bGFyIGNvbG9yIGluc3RlYWQuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IHVzZU1ldGFsbmVzc1NwZWN1bGFyQ29sb3IgV2hlbiBtZXRhbG5lc3MgaXMgZW5hYmxlZCwgdXNlIHRoZVxuICogc3BlY3VsYXIgbWFwIHRvIGFwcGx5IGNvbG9yIHRpbnQgdG8gc3BlY3VsYXIgcmVmbGVjdGlvbnMuXG4gKiBhdCBkaXJlY3QgYW5nbGVzLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IG1ldGFsbmVzcyBEZWZpbmVzIGhvdyBtdWNoIHRoZSBzdXJmYWNlIGlzIG1ldGFsbGljLiBGcm9tIDAgKGRpZWxlY3RyaWMpIHRvIDFcbiAqIChtZXRhbCkuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcycpLlRleHR1cmV8bnVsbH0gbWV0YWxuZXNzTWFwIE1vbm9jaHJvbWVcbiAqIG1ldGFsbmVzcyBtYXAgKGRlZmF1bHQgaXMgbnVsbCkuXG4gKiBAcHJvcGVydHkge251bWJlcn0gbWV0YWxuZXNzTWFwVXYgTWV0YWxuZXNzIG1hcCBVViBjaGFubmVsLlxuICogQHByb3BlcnR5IHtWZWMyfSBtZXRhbG5lc3NNYXBUaWxpbmcgQ29udHJvbHMgdGhlIDJEIHRpbGluZyBvZiB0aGUgbWV0YWxuZXNzIG1hcC5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gbWV0YWxuZXNzTWFwT2Zmc2V0IENvbnRyb2xzIHRoZSAyRCBvZmZzZXQgb2YgdGhlIG1ldGFsbmVzcyBtYXAuIEVhY2ggY29tcG9uZW50XG4gKiBpcyBiZXR3ZWVuIDAgYW5kIDEuXG4gKiBAcHJvcGVydHkge251bWJlcn0gbWV0YWxuZXNzTWFwUm90YXRpb24gQ29udHJvbHMgdGhlIDJEIHJvdGF0aW9uIChpbiBkZWdyZWVzKSBvZiB0aGUgbWV0YWxuZXNzXG4gKiBtYXAuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gbWV0YWxuZXNzTWFwQ2hhbm5lbCBDb2xvciBjaGFubmVsIG9mIHRoZSBtZXRhbG5lc3MgbWFwIHRvIHVzZS4gQ2FuIGJlIFwiclwiLFxuICogXCJnXCIsIFwiYlwiIG9yIFwiYVwiLlxuICogQHByb3BlcnR5IHtib29sZWFufSBtZXRhbG5lc3NWZXJ0ZXhDb2xvciBVc2UgbWVzaCB2ZXJ0ZXggY29sb3JzIGZvciBtZXRhbG5lc3MuIElmIG1ldGFsbmVzc01hcFxuICogaXMgc2V0LCBpdCdsbCBiZSBtdWx0aXBsaWVkIGJ5IHZlcnRleCBjb2xvcnMuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gbWV0YWxuZXNzVmVydGV4Q29sb3JDaGFubmVsIFZlcnRleCBjb2xvciBjaGFubmVsIHRvIHVzZSBmb3IgbWV0YWxuZXNzLiBDYW4gYmVcbiAqIFwiclwiLCBcImdcIiwgXCJiXCIgb3IgXCJhXCIuXG4gKiBAcHJvcGVydHkge251bWJlcn0gc2hpbmluZXNzIERlZmluZXMgZ2xvc3NpbmVzcyBvZiB0aGUgbWF0ZXJpYWwgZnJvbSAwIChyb3VnaCkgdG8gMTAwIChzaGlueVxuICogbWlycm9yKS4gQSBoaWdoZXIgc2hpbmluZXNzIHZhbHVlIHJlc3VsdHMgaW4gYSBtb3JlIGZvY3VzZWQgc3BlY3VsYXIgaGlnaGxpZ2h0LiBHbG9zc2luZXNzIG1hcC9cbiAqIHZlcnRleCBjb2xvcnMgYXJlIGFsd2F5cyBtdWx0aXBsaWVkIGJ5IHRoaXMgdmFsdWUgKG5vcm1hbGl6ZWQgdG8gMCAtIDEgcmFuZ2UpLCBvciBpdCBpcyB1c2VkXG4gKiBkaXJlY3RseSBhcyBjb25zdGFudCBvdXRwdXQuXG4gKiBAcHJvcGVydHkge251bWJlcn0gZ2xvc3MgRGVmaW5lcyB0aGUgZ2xvc3NpbmVzcyBvZiB0aGUgbWF0ZXJpYWwgZnJvbSAwIChyb3VnaCkgdG8gMSAoc2hpbnkpLlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnKS5UZXh0dXJlfG51bGx9IGdsb3NzTWFwIEdsb3NzaW5lc3MgbWFwXG4gKiAoZGVmYXVsdCBpcyBudWxsKS4gSWYgc3BlY2lmaWVkLCB3aWxsIGJlIG11bHRpcGxpZWQgYnkgbm9ybWFsaXplZCAnc2hpbmluZXNzJyB2YWx1ZSBhbmQvb3JcbiAqIHZlcnRleCBjb2xvcnMuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IGdsb3NzSW52ZXJ0IEludmVydCB0aGUgZ2xvc3MgY29tcG9uZW50IChkZWZhdWx0IGlzIGZhbHNlKS4gRW5hYmxpbmcgdGhpc1xuICogZmxhZyByZXN1bHRzIGluIG1hdGVyaWFsIHRyZWF0aW5nIHRoZSBnbG9zcyBtZW1iZXJzIGFzIHJvdWdobmVzcy5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBnbG9zc01hcFV2IEdsb3NzIG1hcCBVViBjaGFubmVsLlxuICogQHByb3BlcnR5IHtzdHJpbmd9IGdsb3NzTWFwQ2hhbm5lbCBDb2xvciBjaGFubmVsIG9mIHRoZSBnbG9zcyBtYXAgdG8gdXNlLiBDYW4gYmUgXCJyXCIsIFwiZ1wiLCBcImJcIlxuICogb3IgXCJhXCIuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IGdsb3NzTWFwVGlsaW5nIENvbnRyb2xzIHRoZSAyRCB0aWxpbmcgb2YgdGhlIGdsb3NzIG1hcC5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gZ2xvc3NNYXBPZmZzZXQgQ29udHJvbHMgdGhlIDJEIG9mZnNldCBvZiB0aGUgZ2xvc3MgbWFwLiBFYWNoIGNvbXBvbmVudCBpc1xuICogYmV0d2VlbiAwIGFuZCAxLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGdsb3NzTWFwUm90YXRpb24gQ29udHJvbHMgdGhlIDJEIHJvdGF0aW9uIChpbiBkZWdyZWVzKSBvZiB0aGUgZ2xvc3MgbWFwLlxuICogQHByb3BlcnR5IHtib29sZWFufSBnbG9zc1ZlcnRleENvbG9yIFVzZSBtZXNoIHZlcnRleCBjb2xvcnMgZm9yIGdsb3NzaW5lc3MuIElmIGdsb3NzTWFwIGlzIHNldCxcbiAqIGl0J2xsIGJlIG11bHRpcGxpZWQgYnkgdmVydGV4IGNvbG9ycy5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBnbG9zc1ZlcnRleENvbG9yQ2hhbm5lbCBWZXJ0ZXggY29sb3IgY2hhbm5lbCB0byB1c2UgZm9yIGdsb3NzaW5lc3MuIENhbiBiZVxuICogXCJyXCIsIFwiZ1wiLCBcImJcIiBvciBcImFcIi5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSByZWZyYWN0aW9uIERlZmluZXMgdGhlIHZpc2liaWxpdHkgb2YgcmVmcmFjdGlvbi4gTWF0ZXJpYWwgY2FuIHJlZnJhY3QgdGhlXG4gKiBzYW1lIGN1YmUgbWFwIGFzIHVzZWQgZm9yIHJlZmxlY3Rpb25zLlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnKS5UZXh0dXJlfG51bGx9IHJlZnJhY3Rpb25NYXAgVGhlIG1hcCBvZlxuICogdGhlIHJlZnJhY3Rpb24gdmlzaWJpbGl0eS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSByZWZyYWN0aW9uTWFwVXYgUmVmcmFjdGlvbiBtYXAgVVYgY2hhbm5lbC5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gcmVmcmFjdGlvbk1hcFRpbGluZyBDb250cm9scyB0aGUgMkQgdGlsaW5nIG9mIHRoZSByZWZyYWN0aW9uIG1hcC5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gcmVmcmFjdGlvbk1hcE9mZnNldCBDb250cm9scyB0aGUgMkQgb2Zmc2V0IG9mIHRoZSByZWZyYWN0aW9uIG1hcC4gRWFjaCBjb21wb25lbnRcbiAqIGlzIGJldHdlZW4gMCBhbmQgMS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSByZWZyYWN0aW9uTWFwUm90YXRpb24gQ29udHJvbHMgdGhlIDJEIHJvdGF0aW9uIChpbiBkZWdyZWVzKSBvZiB0aGUgZW1pc3NpdmVcbiAqIG1hcC5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSByZWZyYWN0aW9uTWFwQ2hhbm5lbCBDb2xvciBjaGFubmVscyBvZiB0aGUgcmVmcmFjdGlvbiBtYXAgdG8gdXNlLiBDYW4gYmUgXCJyXCIsXG4gKiBcImdcIiwgXCJiXCIsIFwiYVwiLCBcInJnYlwiIG9yIGFueSBzd2l6emxlZCBjb21iaW5hdGlvbi5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gcmVmcmFjdGlvblZlcnRleENvbG9yIFVzZSBtZXNoIHZlcnRleCBjb2xvcnMgZm9yIHJlZnJhY3Rpb24uIElmXG4gKiByZWZyYWN0aW9uIG1hcCBpcyBzZXQsIGl0IHdpbGwgYmUgYmUgbXVsdGlwbGllZCBieSB2ZXJ0ZXggY29sb3JzLlxuICogQHByb3BlcnR5IHtib29sZWFufSByZWZyYWN0aW9uVmVydGV4Q29sb3JDaGFubmVsIFZlcnRleCBjb2xvciBjaGFubmVsIHRvIHVzZSBmb3IgcmVmcmFjdGlvbi5cbiAqIENhbiBiZSBcInJcIiwgXCJnXCIsIFwiYlwiIG9yIFwiYVwiLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHJlZnJhY3Rpb25JbmRleCBEZWZpbmVzIHRoZSBpbmRleCBvZiByZWZyYWN0aW9uLCBpLmUuIFRoZSBhbW91bnQgb2ZcbiAqIGRpc3RvcnRpb24uIFRoZSB2YWx1ZSBpcyBjYWxjdWxhdGVkIGFzIChvdXRlcklvciAvIHN1cmZhY2VJb3IpLCB3aGVyZSBpbnB1dHMgYXJlIG1lYXN1cmVkXG4gKiBpbmRpY2VzIG9mIHJlZnJhY3Rpb24sIHRoZSBvbmUgYXJvdW5kIHRoZSBvYmplY3QgYW5kIHRoZSBvbmUgb2YgaXRzIG93biBzdXJmYWNlLiBJbiBtb3N0XG4gKiBzaXR1YXRpb25zIG91dGVyIG1lZGl1bSBpcyBhaXIsIHNvIG91dGVySW9yIHdpbGwgYmUgYXBwcm94aW1hdGVseSAxLiBUaGVuIHlvdSBvbmx5IG5lZWQgdG8gZG9cbiAqICgxLjAgLyBzdXJmYWNlSW9yKS5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gdXNlRHluYW1pY1JlZnJhY3Rpb24gRW5hYmxlcyBoaWdoZXIgcXVhbGl0eSByZWZyYWN0aW9ucyB1c2luZyB0aGUgZ3JhYiBwYXNzXG4gKiBpbnN0ZWFkIG9mIHByZS1jb21wdXRlZCBjdWJlIG1hcHMgZm9yIHJlZnJhY3Rpb25zLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHRoaWNrbmVzcyBUaGUgdGhpY2tuZXNzIG9mIHRoZSBtZWRpdW0sIG9ubHkgdXNlZCB3aGVuIHVzZUR5bmFtaWNSZWZyYWN0aW9uXG4gKiBpcyBlbmFibGVkLiBUaGUgdW5pdCBpcyBpbiBiYXNlIHVuaXRzLCBhbmQgc2NhbGVzIHdpdGggdGhlIHNpemUgb2YgdGhlIG9iamVjdC5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJykuVGV4dHVyZXxudWxsfSB0aGlja25lc3NNYXAgVGhlXG4gKiBwZXItcGl4ZWwgdGhpY2tuZXNzIG9mIHRoZSBtZWRpdW0sIG9ubHkgdXNlZCB3aGVuIHVzZUR5bmFtaWNSZWZyYWN0aW9uIGlzIGVuYWJsZWQuXG4gKiBAcHJvcGVydHkge251bWJlcn0gdGhpY2tuZXNzTWFwVXYgVGhpY2tuZXNzIG1hcCBVViBjaGFubmVsLlxuICogQHByb3BlcnR5IHtWZWMyfSB0aGlja25lc3NNYXBUaWxpbmcgQ29udHJvbHMgdGhlIDJEIHRpbGluZyBvZiB0aGUgdGhpY2tuZXNzIG1hcC5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gdGhpY2tuZXNzTWFwT2Zmc2V0IENvbnRyb2xzIHRoZSAyRCBvZmZzZXQgb2YgdGhlIHRoaWNrbmVzcyBtYXAuIEVhY2ggY29tcG9uZW50IGlzXG4gKiBiZXR3ZWVuIDAgYW5kIDEuXG4gKiBAcHJvcGVydHkge251bWJlcn0gdGhpY2tuZXNzTWFwUm90YXRpb24gQ29udHJvbHMgdGhlIDJEIHJvdGF0aW9uIChpbiBkZWdyZWVzKSBvZiB0aGUgdGhpY2tuZXNzXG4gKiBtYXAuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gdGhpY2tuZXNzTWFwQ2hhbm5lbCBDb2xvciBjaGFubmVscyBvZiB0aGUgdGhpY2tuZXNzIG1hcCB0byB1c2UuIENhbiBiZSBcInJcIixcbiAqIFwiZ1wiLCBcImJcIiBvciBcImFcIi5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gdGhpY2tuZXNzVmVydGV4Q29sb3IgVXNlIG1lc2ggdmVydGV4IGNvbG9ycyBmb3IgdGhpY2tuZXNzLiBJZlxuICogdGhpY2tuZXNzIG1hcCBpcyBzZXQsIGl0IHdpbGwgYmUgYmUgbXVsdGlwbGllZCBieSB2ZXJ0ZXggY29sb3JzLlxuICogQHByb3BlcnR5IHtDb2xvcn0gYXR0ZW51YXRpb24gVGhlIGF0dGVudWF0aW9uIGNvbG9yIGZvciByZWZyYWN0aXZlIG1hdGVyaWFscywgb25seSB1c2VkIHdoZW5cbiAqIHVzZUR5bmFtaWNSZWZyYWN0aW9uIGlzIGVuYWJsZWQuXG4gKiBAcHJvcGVydHkge251bWJlcn0gYXR0ZW51YXRpb25EaXN0YW5jZSBUaGUgZGlzdGFuY2UgZGVmaW5pbmcgdGhlIGFic29ycHRpb24gcmF0ZSBvZiBsaWdodFxuICogd2l0aGluIHRoZSBtZWRpdW0uIE9ubHkgdXNlZCB3aGVuIHVzZUR5bmFtaWNSZWZyYWN0aW9uIGlzIGVuYWJsZWQuXG4gKiBAcHJvcGVydHkge0NvbG9yfSBlbWlzc2l2ZSBUaGUgZW1pc3NpdmUgY29sb3Igb2YgdGhlIG1hdGVyaWFsLiBUaGlzIGNvbG9yIHZhbHVlIGlzIDMtY29tcG9uZW50XG4gKiAoUkdCKSwgd2hlcmUgZWFjaCBjb21wb25lbnQgaXMgYmV0d2VlbiAwIGFuZCAxLlxuICogQHByb3BlcnR5IHtib29sZWFufSBlbWlzc2l2ZVRpbnQgTXVsdGlwbHkgZW1pc3NpdmUgbWFwIGFuZC9vciBlbWlzc2l2ZSB2ZXJ0ZXggY29sb3IgYnkgdGhlXG4gKiBjb25zdGFudCBlbWlzc2l2ZSB2YWx1ZS5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJykuVGV4dHVyZXxudWxsfSBlbWlzc2l2ZU1hcCBUaGUgZW1pc3NpdmVcbiAqIG1hcCBvZiB0aGUgbWF0ZXJpYWwgKGRlZmF1bHQgaXMgbnVsbCkuIENhbiBiZSBIRFIuXG4gKiBAcHJvcGVydHkge251bWJlcn0gZW1pc3NpdmVJbnRlbnNpdHkgRW1pc3NpdmUgY29sb3IgbXVsdGlwbGllci5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBlbWlzc2l2ZU1hcFV2IEVtaXNzaXZlIG1hcCBVViBjaGFubmVsLlxuICogQHByb3BlcnR5IHtWZWMyfSBlbWlzc2l2ZU1hcFRpbGluZyBDb250cm9scyB0aGUgMkQgdGlsaW5nIG9mIHRoZSBlbWlzc2l2ZSBtYXAuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IGVtaXNzaXZlTWFwT2Zmc2V0IENvbnRyb2xzIHRoZSAyRCBvZmZzZXQgb2YgdGhlIGVtaXNzaXZlIG1hcC4gRWFjaCBjb21wb25lbnQgaXNcbiAqIGJldHdlZW4gMCBhbmQgMS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBlbWlzc2l2ZU1hcFJvdGF0aW9uIENvbnRyb2xzIHRoZSAyRCByb3RhdGlvbiAoaW4gZGVncmVlcykgb2YgdGhlIGVtaXNzaXZlXG4gKiBtYXAuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gZW1pc3NpdmVNYXBDaGFubmVsIENvbG9yIGNoYW5uZWxzIG9mIHRoZSBlbWlzc2l2ZSBtYXAgdG8gdXNlLiBDYW4gYmUgXCJyXCIsXG4gKiBcImdcIiwgXCJiXCIsIFwiYVwiLCBcInJnYlwiIG9yIGFueSBzd2l6emxlZCBjb21iaW5hdGlvbi5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gZW1pc3NpdmVWZXJ0ZXhDb2xvciBVc2UgbWVzaCB2ZXJ0ZXggY29sb3JzIGZvciBlbWlzc2lvbi4gSWYgZW1pc3NpdmVNYXAgb3JcbiAqIGVtaXNzaXZlVGludCBhcmUgc2V0LCB0aGV5J2xsIGJlIG11bHRpcGxpZWQgYnkgdmVydGV4IGNvbG9ycy5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBlbWlzc2l2ZVZlcnRleENvbG9yQ2hhbm5lbCBWZXJ0ZXggY29sb3IgY2hhbm5lbHMgdG8gdXNlIGZvciBlbWlzc2lvbi4gQ2FuIGJlXG4gKiBcInJcIiwgXCJnXCIsIFwiYlwiLCBcImFcIiwgXCJyZ2JcIiBvciBhbnkgc3dpenpsZWQgY29tYmluYXRpb24uXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IHVzZVNoZWVuIFRvZ2dsZSBzaGVlbiBzcGVjdWxhciBlZmZlY3Qgb24vb2ZmLlxuICogQHByb3BlcnR5IHtDb2xvcn0gc2hlZW4gVGhlIHNwZWN1bGFyIGNvbG9yIG9mIHRoZSBzaGVlbiAoZmFicmljKSBtaWNyb2ZpYmVyIHN0cnVjdHVyZS5cbiAqIFRoaXMgY29sb3IgdmFsdWUgaXMgMy1jb21wb25lbnQgKFJHQiksIHdoZXJlIGVhY2ggY29tcG9uZW50IGlzIGJldHdlZW4gMCBhbmQgMS5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gc2hlZW5UaW50IE11bHRpcGx5IHNoZWVuIG1hcCBhbmQvb3Igc2hlZW4gdmVydGV4IGNvbG9yIGJ5IHRoZSBjb25zdGFudFxuICogc2hlZW4gdmFsdWUuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcycpLlRleHR1cmV8bnVsbH0gc2hlZW5NYXAgVGhlIHNoZWVuXG4gKiBtaWNyb3N0cnVjdHVyZSBjb2xvciBtYXAgb2YgdGhlIG1hdGVyaWFsIChkZWZhdWx0IGlzIG51bGwpLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHNoZWVuTWFwVXYgU2hlZW4gbWFwIFVWIGNoYW5uZWwuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IHNoZWVuTWFwVGlsaW5nIENvbnRyb2xzIHRoZSAyRCB0aWxpbmcgb2YgdGhlIHNoZWVuIG1hcC5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gc2hlZW5NYXBPZmZzZXQgQ29udHJvbHMgdGhlIDJEIG9mZnNldCBvZiB0aGUgc2hlZW4gbWFwLiBFYWNoIGNvbXBvbmVudCBpc1xuICogYmV0d2VlbiAwIGFuZCAxLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHNoZWVuTWFwUm90YXRpb24gQ29udHJvbHMgdGhlIDJEIHJvdGF0aW9uIChpbiBkZWdyZWVzKSBvZiB0aGUgc2hlZW5cbiAqIG1hcC5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBzaGVlbk1hcENoYW5uZWwgQ29sb3IgY2hhbm5lbHMgb2YgdGhlIHNoZWVuIG1hcCB0byB1c2UuIENhbiBiZSBcInJcIixcbiAqIFwiZ1wiLCBcImJcIiwgXCJhXCIsIFwicmdiXCIgb3IgYW55IHN3aXp6bGVkIGNvbWJpbmF0aW9uLlxuICogQHByb3BlcnR5IHtib29sZWFufSBzaGVlblZlcnRleENvbG9yIFVzZSBtZXNoIHZlcnRleCBjb2xvcnMgZm9yIHNoZWVuLiBJZiBzaGVlbiBtYXAgb3JcbiAqIHNoZWVuIHRpbnQgYXJlIHNldCwgdGhleSdsbCBiZSBtdWx0aXBsaWVkIGJ5IHZlcnRleCBjb2xvcnMuXG4gKiBAcHJvcGVydHkge251bWJlcn0gc2hlZW5HbG9zcyBUaGUgZ2xvc3NpbmVzcyBvZiB0aGUgc2hlZW4gKGZhYnJpYykgbWljcm9maWJlciBzdHJ1Y3R1cmUuXG4gKiBUaGlzIGNvbG9yIHZhbHVlIGlzIGEgc2luZ2xlIHZhbHVlIGJldHdlZW4gMCBhbmQgMS5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gc2hlZW5HbG9zc0ludmVydCBJbnZlcnQgdGhlIHNoZWVuIGdsb3NzIGNvbXBvbmVudCAoZGVmYXVsdCBpcyBmYWxzZSkuXG4gKiBFbmFibGluZyB0aGlzIGZsYWcgcmVzdWx0cyBpbiBtYXRlcmlhbCB0cmVhdGluZyB0aGUgc2hlZW4gZ2xvc3MgbWVtYmVycyBhcyByb3VnaG5lc3MuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IHNoZWVuR2xvc3NUaW50IE11bHRpcGx5IHNoZWVuIGdsb3NzaW5lc3MgbWFwIGFuZC9vciBzaGVlbiBnbG9zc2luZXNzIHZlcnRleFxuICogdmFsdWUgYnkgdGhlIHNjYWxhciBzaGVlbiBnbG9zc2luZXNzIHZhbHVlLlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnKS5UZXh0dXJlfG51bGx9IHNoZWVuR2xvc3NNYXAgVGhlIHNoZWVuXG4gKiBnbG9zc2luZXNzIG1pY3Jvc3RydWN0dXJlIGNvbG9yIG1hcCBvZiB0aGUgbWF0ZXJpYWwgKGRlZmF1bHQgaXMgbnVsbCkuXG4gKiBAcHJvcGVydHkge251bWJlcn0gc2hlZW5HbG9zc01hcFV2IFNoZWVuIG1hcCBVViBjaGFubmVsLlxuICogQHByb3BlcnR5IHtWZWMyfSBzaGVlbkdsb3NzTWFwVGlsaW5nIENvbnRyb2xzIHRoZSAyRCB0aWxpbmcgb2YgdGhlIHNoZWVuIGdsb3NzaW5lc3MgbWFwLlxuICogQHByb3BlcnR5IHtWZWMyfSBzaGVlbkdsb3NzTWFwT2Zmc2V0IENvbnRyb2xzIHRoZSAyRCBvZmZzZXQgb2YgdGhlIHNoZWVuIGdsb3NzaW5lc3MgbWFwLlxuICogRWFjaCBjb21wb25lbnQgaXMgYmV0d2VlbiAwIGFuZCAxLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHNoZWVuR2xvc3NNYXBSb3RhdGlvbiBDb250cm9scyB0aGUgMkQgcm90YXRpb24gKGluIGRlZ3JlZXMpIG9mIHRoZSBzaGVlblxuICogZ2xvc3NpbmVzcyBtYXAuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gc2hlZW5HbG9zc01hcENoYW5uZWwgQ29sb3IgY2hhbm5lbHMgb2YgdGhlIHNoZWVuIGdsb3NzaW5lc3MgbWFwIHRvIHVzZS5cbiAqIENhbiBiZSBcInJcIiwgXCJnXCIsIFwiYlwiLCBcImFcIiwgXCJyZ2JcIiBvciBhbnkgc3dpenpsZWQgY29tYmluYXRpb24uXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IHNoZWVuR2xvc3NWZXJ0ZXhDb2xvciBVc2UgbWVzaCB2ZXJ0ZXggY29sb3JzIGZvciBzaGVlbiBnbG9zc2luZXNzLlxuICogSWYgc2hlZW4gZ2xvc3NpbmVzcyBtYXAgb3Igc2hlZW4gZ2xvc2luZXNzIHRpbnQgYXJlIHNldCwgdGhleSdsbCBiZSBtdWx0aXBsaWVkIGJ5IHZlcnRleCBjb2xvcnMuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gc2hlZW5HbG9zc1ZlcnRleENvbG9yQ2hhbm5lbCBWZXJ0ZXggY29sb3IgY2hhbm5lbHMgdG8gdXNlIGZvciBzaGVlbiBnbG9zc2luZXNzLlxuICogQ2FuIGJlIFwiclwiLCBcImdcIiwgXCJiXCIgb3IgXCJhXCIuXG4gKiBAcHJvcGVydHkge251bWJlcn0gb3BhY2l0eSBUaGUgb3BhY2l0eSBvZiB0aGUgbWF0ZXJpYWwuIFRoaXMgdmFsdWUgY2FuIGJlIGJldHdlZW4gMCBhbmQgMSwgd2hlcmVcbiAqIDAgaXMgZnVsbHkgdHJhbnNwYXJlbnQgYW5kIDEgaXMgZnVsbHkgb3BhcXVlLiBJZiB5b3Ugd2FudCB0aGUgbWF0ZXJpYWwgdG8gYmUgc2VtaS10cmFuc3BhcmVudFxuICogeW91IGFsc28gbmVlZCB0byBzZXQgdGhlIHtAbGluayBNYXRlcmlhbCNibGVuZFR5cGV9IHRvIHtAbGluayBCTEVORF9OT1JNQUx9LFxuICoge0BsaW5rIEJMRU5EX0FERElUSVZFfSBvciBhbnkgb3RoZXIgbW9kZS4gQWxzbyBub3RlIHRoYXQgZm9yIG1vc3Qgc2VtaS10cmFuc3BhcmVudCBvYmplY3RzIHlvdVxuICogd2FudCB7QGxpbmsgTWF0ZXJpYWwjZGVwdGhXcml0ZX0gdG8gYmUgZmFsc2UsIG90aGVyd2lzZSB0aGV5IGNhbiBmdWxseSBvY2NsdWRlIG9iamVjdHMgYmVoaW5kXG4gKiB0aGVtLlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnKS5UZXh0dXJlfG51bGx9IG9wYWNpdHlNYXAgVGhlIG9wYWNpdHkgbWFwXG4gKiBvZiB0aGUgbWF0ZXJpYWwgKGRlZmF1bHQgaXMgbnVsbCkuXG4gKiBAcHJvcGVydHkge251bWJlcn0gb3BhY2l0eU1hcFV2IE9wYWNpdHkgbWFwIFVWIGNoYW5uZWwuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gb3BhY2l0eU1hcENoYW5uZWwgQ29sb3IgY2hhbm5lbCBvZiB0aGUgb3BhY2l0eSBtYXAgdG8gdXNlLiBDYW4gYmUgXCJyXCIsIFwiZ1wiLFxuICogXCJiXCIgb3IgXCJhXCIuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IG9wYWNpdHlNYXBUaWxpbmcgQ29udHJvbHMgdGhlIDJEIHRpbGluZyBvZiB0aGUgb3BhY2l0eSBtYXAuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IG9wYWNpdHlNYXBPZmZzZXQgQ29udHJvbHMgdGhlIDJEIG9mZnNldCBvZiB0aGUgb3BhY2l0eSBtYXAuIEVhY2ggY29tcG9uZW50IGlzXG4gKiBiZXR3ZWVuIDAgYW5kIDEuXG4gKiBAcHJvcGVydHkge251bWJlcn0gb3BhY2l0eU1hcFJvdGF0aW9uIENvbnRyb2xzIHRoZSAyRCByb3RhdGlvbiAoaW4gZGVncmVlcykgb2YgdGhlIG9wYWNpdHkgbWFwLlxuICogQHByb3BlcnR5IHtib29sZWFufSBvcGFjaXR5VmVydGV4Q29sb3IgVXNlIG1lc2ggdmVydGV4IGNvbG9ycyBmb3Igb3BhY2l0eS4gSWYgb3BhY2l0eU1hcCBpcyBzZXQsXG4gKiBpdCdsbCBiZSBtdWx0aXBsaWVkIGJ5IHZlcnRleCBjb2xvcnMuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gb3BhY2l0eVZlcnRleENvbG9yQ2hhbm5lbCBWZXJ0ZXggY29sb3IgY2hhbm5lbHMgdG8gdXNlIGZvciBvcGFjaXR5LiBDYW4gYmVcbiAqIFwiclwiLCBcImdcIiwgXCJiXCIgb3IgXCJhXCIuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IG9wYWNpdHlGYWRlc1NwZWN1bGFyIHVzZWQgdG8gc3BlY2lmeSB3aGV0aGVyIHNwZWN1bGFyIGFuZCByZWZsZWN0aW9ucyBhcmVcbiAqIGZhZGVkIG91dCB1c2luZyB7QGxpbmsgU3RhbmRhcmRNYXRlcmlhbCNvcGFjaXR5fS4gRGVmYXVsdCBpcyB0cnVlLiBXaGVuIHNldCB0byBmYWxzZSB1c2VcbiAqIHtAbGluayBNYXRlcmlhbCNhbHBoYUZhZGV9IHRvIGZhZGUgb3V0IG1hdGVyaWFscy5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBhbHBoYUZhZGUgdXNlZCB0byBmYWRlIG91dCBtYXRlcmlhbHMgd2hlblxuICoge0BsaW5rIFN0YW5kYXJkTWF0ZXJpYWwjb3BhY2l0eUZhZGVzU3BlY3VsYXJ9IGlzIHNldCB0byBmYWxzZS5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJykuVGV4dHVyZXxudWxsfSBub3JtYWxNYXAgVGhlIG1haW5cbiAqIChwcmltYXJ5KSBub3JtYWwgbWFwIG9mIHRoZSBtYXRlcmlhbCAoZGVmYXVsdCBpcyBudWxsKS4gVGhlIHRleHR1cmUgbXVzdCBjb250YWlucyBub3JtYWxpemVkLFxuICogdGFuZ2VudCBzcGFjZSBub3JtYWxzLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IG5vcm1hbE1hcFV2IE1haW4gKHByaW1hcnkpIG5vcm1hbCBtYXAgVVYgY2hhbm5lbC5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gbm9ybWFsTWFwVGlsaW5nIENvbnRyb2xzIHRoZSAyRCB0aWxpbmcgb2YgdGhlIG1haW4gKHByaW1hcnkpIG5vcm1hbCBtYXAuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IG5vcm1hbE1hcE9mZnNldCBDb250cm9scyB0aGUgMkQgb2Zmc2V0IG9mIHRoZSBtYWluIChwcmltYXJ5KSBub3JtYWwgbWFwLiBFYWNoXG4gKiBjb21wb25lbnQgaXMgYmV0d2VlbiAwIGFuZCAxLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IG5vcm1hbE1hcFJvdGF0aW9uIENvbnRyb2xzIHRoZSAyRCByb3RhdGlvbiAoaW4gZGVncmVlcykgb2YgdGhlIG1haW4gKHByaW1hcnkpXG4gKiBub3JtYWwgbWFwLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGJ1bXBpbmVzcyBUaGUgYnVtcGluZXNzIG9mIHRoZSBtYXRlcmlhbC4gVGhpcyB2YWx1ZSBzY2FsZXMgdGhlIGFzc2lnbmVkIG1haW5cbiAqIChwcmltYXJ5KSBub3JtYWwgbWFwLiBJdCBzaG91bGQgYmUgbm9ybWFsbHkgYmV0d2VlbiAwIChubyBidW1wIG1hcHBpbmcpIGFuZCAxIChmdWxsIGJ1bXBcbiAqIG1hcHBpbmcpLCBidXQgY2FuIGJlIHNldCB0byBlLmcuIDIgdG8gZ2l2ZSBldmVuIG1vcmUgcHJvbm91bmNlZCBidW1wIGVmZmVjdC5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJykuVGV4dHVyZXxudWxsfSBub3JtYWxEZXRhaWxNYXAgVGhlIGRldGFpbFxuICogKHNlY29uZGFyeSkgbm9ybWFsIG1hcCBvZiB0aGUgbWF0ZXJpYWwgKGRlZmF1bHQgaXMgbnVsbCkuIFdpbGwgb25seSBiZSB1c2VkIGlmIG1haW4gKHByaW1hcnkpXG4gKiBub3JtYWwgbWFwIGlzIG5vbi1udWxsLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IG5vcm1hbERldGFpbE1hcFV2IERldGFpbCAoc2Vjb25kYXJ5KSBub3JtYWwgbWFwIFVWIGNoYW5uZWwuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IG5vcm1hbERldGFpbE1hcFRpbGluZyBDb250cm9scyB0aGUgMkQgdGlsaW5nIG9mIHRoZSBkZXRhaWwgKHNlY29uZGFyeSkgbm9ybWFsXG4gKiBtYXAuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IG5vcm1hbERldGFpbE1hcE9mZnNldCBDb250cm9scyB0aGUgMkQgb2Zmc2V0IG9mIHRoZSBkZXRhaWwgKHNlY29uZGFyeSkgbm9ybWFsXG4gKiBtYXAuIEVhY2ggY29tcG9uZW50IGlzIGJldHdlZW4gMCBhbmQgMS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBub3JtYWxEZXRhaWxNYXBSb3RhdGlvbiBDb250cm9scyB0aGUgMkQgcm90YXRpb24gKGluIGRlZ3JlZXMpIG9mIHRoZSBkZXRhaWxcbiAqIChzZWNvbmRhcnkpIG5vcm1hbCBtYXAuXG4gKiBAcHJvcGVydHkge251bWJlcn0gbm9ybWFsRGV0YWlsTWFwQnVtcGluZXNzIFRoZSBidW1waW5lc3Mgb2YgdGhlIG1hdGVyaWFsLiBUaGlzIHZhbHVlIHNjYWxlcyB0aGVcbiAqIGFzc2lnbmVkIGRldGFpbCAoc2Vjb25kYXJ5KSBub3JtYWwgbWFwLiBJdCBzaG91bGQgYmUgbm9ybWFsbHkgYmV0d2VlbiAwIChubyBidW1wIG1hcHBpbmcpIGFuZCAxXG4gKiAoZnVsbCBidW1wIG1hcHBpbmcpLCBidXQgY2FuIGJlIHNldCB0byBlLmcuIDIgdG8gZ2l2ZSBldmVuIG1vcmUgcHJvbm91bmNlZCBidW1wIGVmZmVjdC5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJykuVGV4dHVyZXxudWxsfSBoZWlnaHRNYXAgVGhlIGhlaWdodCBtYXBcbiAqIG9mIHRoZSBtYXRlcmlhbCAoZGVmYXVsdCBpcyBudWxsKS4gVXNlZCBmb3IgYSB2aWV3LWRlcGVuZGVudCBwYXJhbGxheCBlZmZlY3QuIFRoZSB0ZXh0dXJlIG11c3RcbiAqIHJlcHJlc2VudCB0aGUgaGVpZ2h0IG9mIHRoZSBzdXJmYWNlIHdoZXJlIGRhcmtlciBwaXhlbHMgYXJlIGxvd2VyIGFuZCBsaWdodGVyIHBpeGVscyBhcmUgaGlnaGVyLlxuICogSXQgaXMgcmVjb21tZW5kZWQgdG8gdXNlIGl0IHRvZ2V0aGVyIHdpdGggYSBub3JtYWwgbWFwLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGhlaWdodE1hcFV2IEhlaWdodCBtYXAgVVYgY2hhbm5lbC5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBoZWlnaHRNYXBDaGFubmVsIENvbG9yIGNoYW5uZWwgb2YgdGhlIGhlaWdodCBtYXAgdG8gdXNlLiBDYW4gYmUgXCJyXCIsIFwiZ1wiLCBcImJcIlxuICogb3IgXCJhXCIuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IGhlaWdodE1hcFRpbGluZyBDb250cm9scyB0aGUgMkQgdGlsaW5nIG9mIHRoZSBoZWlnaHQgbWFwLlxuICogQHByb3BlcnR5IHtWZWMyfSBoZWlnaHRNYXBPZmZzZXQgQ29udHJvbHMgdGhlIDJEIG9mZnNldCBvZiB0aGUgaGVpZ2h0IG1hcC4gRWFjaCBjb21wb25lbnQgaXNcbiAqIGJldHdlZW4gMCBhbmQgMS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBoZWlnaHRNYXBSb3RhdGlvbiBDb250cm9scyB0aGUgMkQgcm90YXRpb24gKGluIGRlZ3JlZXMpIG9mIHRoZSBoZWlnaHQgbWFwLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGhlaWdodE1hcEZhY3RvciBIZWlnaHQgbWFwIG11bHRpcGxpZXIuIEFmZmVjdHMgdGhlIHN0cmVuZ3RoIG9mIHRoZSBwYXJhbGxheFxuICogZWZmZWN0LlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnKS5UZXh0dXJlfG51bGx9IGVudkF0bGFzIFRoZSBwcmVmaWx0ZXJlZFxuICogZW52aXJvbm1lbnQgbGlnaHRpbmcgYXRsYXMgKGRlZmF1bHQgaXMgbnVsbCkuIFRoaXMgc2V0dGluZyBvdmVycmlkZXMgY3ViZU1hcCBhbmQgc3BoZXJlTWFwIGFuZFxuICogd2lsbCByZXBsYWNlIHRoZSBzY2VuZSBsaWdodGluZyBlbnZpcm9ubWVudC5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJykuVGV4dHVyZXxudWxsfSBjdWJlTWFwIFRoZSBjdWJpY1xuICogZW52aXJvbm1lbnQgbWFwIG9mIHRoZSBtYXRlcmlhbCAoZGVmYXVsdCBpcyBudWxsKS4gVGhpcyBzZXR0aW5nIG92ZXJyaWRlcyBzcGhlcmVNYXAgYW5kIHdpbGxcbiAqIHJlcGxhY2UgdGhlIHNjZW5lIGxpZ2h0aW5nIGVudmlyb25tZW50LlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnKS5UZXh0dXJlfG51bGx9IHNwaGVyZU1hcCBUaGUgc3BoZXJpY2FsXG4gKiBlbnZpcm9ubWVudCBtYXAgb2YgdGhlIG1hdGVyaWFsIChkZWZhdWx0IGlzIG51bGwpLiBUaGlzIHdpbGwgcmVwbGFjZSB0aGUgc2NlbmUgbGlnaHRpbmdcbiAqIGVudmlyb25tZW50LlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGN1YmVNYXBQcm9qZWN0aW9uIFRoZSB0eXBlIG9mIHByb2plY3Rpb24gYXBwbGllZCB0byB0aGUgY3ViZU1hcCBwcm9wZXJ0eTpcbiAqIC0ge0BsaW5rIENVQkVQUk9KX05PTkV9OiBUaGUgY3ViZSBtYXAgaXMgdHJlYXRlZCBhcyBpZiBpdCBpcyBpbmZpbml0ZWx5IGZhciBhd2F5LlxuICogLSB7QGxpbmsgQ1VCRVBST0pfQk9YfTogQm94LXByb2plY3Rpb24gYmFzZWQgb24gYSB3b3JsZCBzcGFjZSBheGlzLWFsaWduZWQgYm91bmRpbmcgYm94LlxuICogRGVmYXVsdHMgdG8ge0BsaW5rIENVQkVQUk9KX05PTkV9LlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uLy4uL2NvcmUvc2hhcGUvYm91bmRpbmctYm94LmpzJykuQm91bmRpbmdCb3h9IGN1YmVNYXBQcm9qZWN0aW9uQm94IFRoZVxuICogd29ybGQgc3BhY2UgYXhpcy1hbGlnbmVkIGJvdW5kaW5nIGJveCBkZWZpbmluZyB0aGUgYm94LXByb2plY3Rpb24gdXNlZCBmb3IgdGhlIGN1YmVNYXAgcHJvcGVydHkuXG4gKiBPbmx5IHVzZWQgd2hlbiBjdWJlTWFwUHJvamVjdGlvbiBpcyBzZXQgdG8ge0BsaW5rIENVQkVQUk9KX0JPWH0uXG4gKiBAcHJvcGVydHkge251bWJlcn0gcmVmbGVjdGl2aXR5IEVudmlyb25tZW50IG1hcCBpbnRlbnNpdHkuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcycpLlRleHR1cmV8bnVsbH0gbGlnaHRNYXAgQSBjdXN0b20gbGlnaHRtYXBcbiAqIG9mIHRoZSBtYXRlcmlhbCAoZGVmYXVsdCBpcyBudWxsKS4gTGlnaHRtYXBzIGFyZSB0ZXh0dXJlcyB0aGF0IGNvbnRhaW4gcHJlLXJlbmRlcmVkIGxpZ2h0aW5nLlxuICogQ2FuIGJlIEhEUi5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBsaWdodE1hcFV2IExpZ2h0bWFwIFVWIGNoYW5uZWxcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBsaWdodE1hcENoYW5uZWwgQ29sb3IgY2hhbm5lbHMgb2YgdGhlIGxpZ2h0bWFwIHRvIHVzZS4gQ2FuIGJlIFwiclwiLCBcImdcIiwgXCJiXCIsXG4gKiBcImFcIiwgXCJyZ2JcIiBvciBhbnkgc3dpenpsZWQgY29tYmluYXRpb24uXG4gKiBAcHJvcGVydHkge1ZlYzJ9IGxpZ2h0TWFwVGlsaW5nIENvbnRyb2xzIHRoZSAyRCB0aWxpbmcgb2YgdGhlIGxpZ2h0bWFwLlxuICogQHByb3BlcnR5IHtWZWMyfSBsaWdodE1hcE9mZnNldCBDb250cm9scyB0aGUgMkQgb2Zmc2V0IG9mIHRoZSBsaWdodG1hcC4gRWFjaCBjb21wb25lbnQgaXNcbiAqIGJldHdlZW4gMCBhbmQgMS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBsaWdodE1hcFJvdGF0aW9uIENvbnRyb2xzIHRoZSAyRCByb3RhdGlvbiAoaW4gZGVncmVlcykgb2YgdGhlIGxpZ2h0bWFwLlxuICogQHByb3BlcnR5IHtib29sZWFufSBsaWdodFZlcnRleENvbG9yIFVzZSBiYWtlZCB2ZXJ0ZXggbGlnaHRpbmcuIElmIGxpZ2h0TWFwIGlzIHNldCwgaXQnbGwgYmVcbiAqIG11bHRpcGxpZWQgYnkgdmVydGV4IGNvbG9ycy5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBsaWdodFZlcnRleENvbG9yQ2hhbm5lbCBWZXJ0ZXggY29sb3IgY2hhbm5lbHMgdG8gdXNlIGZvciBiYWtlZCBsaWdodGluZy4gQ2FuXG4gKiBiZSBcInJcIiwgXCJnXCIsIFwiYlwiLCBcImFcIiwgXCJyZ2JcIiBvciBhbnkgc3dpenpsZWQgY29tYmluYXRpb24uXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IGFtYmllbnRUaW50IEVuYWJsZXMgc2NlbmUgYW1iaWVudCBtdWx0aXBsaWNhdGlvbiBieSBtYXRlcmlhbCBhbWJpZW50IGNvbG9yLlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnKS5UZXh0dXJlfG51bGx9IGFvTWFwIEJha2VkIGFtYmllbnRcbiAqIG9jY2x1c2lvbiAoQU8pIG1hcCAoZGVmYXVsdCBpcyBudWxsKS4gTW9kdWxhdGVzIGFtYmllbnQgY29sb3IuXG4gKiBAcHJvcGVydHkge251bWJlcn0gYW9NYXBVdiBBTyBtYXAgVVYgY2hhbm5lbFxuICogQHByb3BlcnR5IHtzdHJpbmd9IGFvTWFwQ2hhbm5lbCBDb2xvciBjaGFubmVsIG9mIHRoZSBBTyBtYXAgdG8gdXNlLiBDYW4gYmUgXCJyXCIsIFwiZ1wiLCBcImJcIiBvciBcImFcIi5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gYW9NYXBUaWxpbmcgQ29udHJvbHMgdGhlIDJEIHRpbGluZyBvZiB0aGUgQU8gbWFwLlxuICogQHByb3BlcnR5IHtWZWMyfSBhb01hcE9mZnNldCBDb250cm9scyB0aGUgMkQgb2Zmc2V0IG9mIHRoZSBBTyBtYXAuIEVhY2ggY29tcG9uZW50IGlzIGJldHdlZW4gMFxuICogYW5kIDEuXG4gKiBAcHJvcGVydHkge251bWJlcn0gYW9NYXBSb3RhdGlvbiBDb250cm9scyB0aGUgMkQgcm90YXRpb24gKGluIGRlZ3JlZXMpIG9mIHRoZSBBTyBtYXAuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IGFvVmVydGV4Q29sb3IgVXNlIG1lc2ggdmVydGV4IGNvbG9ycyBmb3IgQU8uIElmIGFvTWFwIGlzIHNldCwgaXQnbGwgYmVcbiAqIG11bHRpcGxpZWQgYnkgdmVydGV4IGNvbG9ycy5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBhb1ZlcnRleENvbG9yQ2hhbm5lbCBWZXJ0ZXggY29sb3IgY2hhbm5lbHMgdG8gdXNlIGZvciBBTy4gQ2FuIGJlIFwiclwiLCBcImdcIixcbiAqIFwiYlwiIG9yIFwiYVwiLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IG9jY2x1ZGVTcGVjdWxhciBVc2VzIGFtYmllbnQgb2NjbHVzaW9uIHRvIGRhcmtlbiBzcGVjdWxhci9yZWZsZWN0aW9uLiBJdCdzIGFcbiAqIGhhY2ssIGJlY2F1c2UgcmVhbCBzcGVjdWxhciBvY2NsdXNpb24gaXMgdmlldy1kZXBlbmRlbnQuIEhvd2V2ZXIsIGl0IGNhbiBiZSBiZXR0ZXIgdGhhbiBub3RoaW5nLlxuICpcbiAqIC0ge0BsaW5rIFNQRUNPQ0NfTk9ORX06IE5vIHNwZWN1bGFyIG9jY2x1c2lvblxuICogLSB7QGxpbmsgU1BFQ09DQ19BT306IFVzZSBBTyBkaXJlY3RseSB0byBvY2NsdWRlIHNwZWN1bGFyLlxuICogLSB7QGxpbmsgU1BFQ09DQ19HTE9TU0RFUEVOREVOVH06IE1vZGlmeSBBTyBiYXNlZCBvbiBtYXRlcmlhbCBnbG9zc2luZXNzL3ZpZXcgYW5nbGUgdG8gb2NjbHVkZVxuICogc3BlY3VsYXIuXG4gKlxuICogQHByb3BlcnR5IHtudW1iZXJ9IG9jY2x1ZGVTcGVjdWxhckludGVuc2l0eSBDb250cm9scyB2aXNpYmlsaXR5IG9mIHNwZWN1bGFyIG9jY2x1c2lvbi5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gb2NjbHVkZURpcmVjdCBUZWxscyBpZiBBTyBzaG91bGQgZGFya2VuIGRpcmVjdGlvbmFsIGxpZ2h0aW5nLiBEZWZhdWx0cyB0b1xuICogZmFsc2UuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IGNvbnNlcnZlRW5lcmd5IERlZmluZXMgaG93IGRpZmZ1c2UgYW5kIHNwZWN1bGFyIGNvbXBvbmVudHMgYXJlIGNvbWJpbmVkIHdoZW5cbiAqIEZyZXNuZWwgaXMgb24uIEl0IGlzIHJlY29tbWVuZGVkIHRoYXQgeW91IGxlYXZlIHRoaXMgb3B0aW9uIGVuYWJsZWQsIGFsdGhvdWdoIHlvdSBtYXkgd2FudCB0b1xuICogZGlzYWJsZSBpdCBpbiBjYXNlIHdoZW4gYWxsIHJlZmxlY3Rpb24gY29tZXMgb25seSBmcm9tIGEgZmV3IGxpZ2h0IHNvdXJjZXMsIGFuZCB5b3UgZG9uJ3QgdXNlIGFuXG4gKiBlbnZpcm9ubWVudCBtYXAsIHRoZXJlZm9yZSBoYXZpbmcgbW9zdGx5IGJsYWNrIHJlZmxlY3Rpb24uXG4gKiBAcHJvcGVydHkge251bWJlcn0gc2hhZGluZ01vZGVsIERlZmluZXMgdGhlIHNoYWRpbmcgbW9kZWwuXG4gKiAtIHtAbGluayBTUEVDVUxBUl9QSE9OR306IFBob25nIHdpdGhvdXQgZW5lcmd5IGNvbnNlcnZhdGlvbi4gWW91IHNob3VsZCBvbmx5IHVzZSBpdCBhcyBhXG4gKiBiYWNrd2FyZHMgY29tcGF0aWJpbGl0eSB3aXRoIG9sZGVyIHByb2plY3RzLlxuICogLSB7QGxpbmsgU1BFQ1VMQVJfQkxJTk59OiBFbmVyZ3ktY29uc2VydmluZyBCbGlubi1QaG9uZy5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBmcmVzbmVsTW9kZWwgRGVmaW5lcyB0aGUgZm9ybXVsYSB1c2VkIGZvciBGcmVzbmVsIGVmZmVjdC5cbiAqIEFzIGEgc2lkZS1lZmZlY3QsIGVuYWJsaW5nIGFueSBGcmVzbmVsIG1vZGVsIGNoYW5nZXMgdGhlIHdheSBkaWZmdXNlIGFuZCByZWZsZWN0aW9uIGNvbXBvbmVudHNcbiAqIGFyZSBjb21iaW5lZC4gV2hlbiBGcmVzbmVsIGlzIG9mZiwgbGVnYWN5IG5vbiBlbmVyZ3ktY29uc2VydmluZyBjb21iaW5pbmcgaXMgdXNlZC4gV2hlbiBpdCBpc1xuICogb24sIGNvbWJpbmluZyBiZWhhdmlvciBpcyBkZWZpbmVkIGJ5IGNvbnNlcnZlRW5lcmd5IHBhcmFtZXRlci5cbiAqXG4gKiAtIHtAbGluayBGUkVTTkVMX05PTkV9OiBObyBGcmVzbmVsLlxuICogLSB7QGxpbmsgRlJFU05FTF9TQ0hMSUNLfTogU2NobGljaydzIGFwcHJveGltYXRpb24gb2YgRnJlc25lbCAocmVjb21tZW5kZWQpLiBQYXJhbWV0ZXJpemVkIGJ5XG4gKiBzcGVjdWxhciBjb2xvci5cbiAqXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IHVzZUZvZyBBcHBseSBmb2dnaW5nIChhcyBjb25maWd1cmVkIGluIHNjZW5lIHNldHRpbmdzKVxuICogQHByb3BlcnR5IHtib29sZWFufSB1c2VMaWdodGluZyBBcHBseSBsaWdodGluZ1xuICogQHByb3BlcnR5IHtib29sZWFufSB1c2VTa3lib3ggQXBwbHkgc2NlbmUgc2t5Ym94IGFzIHByZWZpbHRlcmVkIGVudmlyb25tZW50IG1hcFxuICogQHByb3BlcnR5IHtib29sZWFufSB1c2VHYW1tYVRvbmVtYXAgQXBwbHkgZ2FtbWEgY29ycmVjdGlvbiBhbmQgdG9uZW1hcHBpbmcgKGFzIGNvbmZpZ3VyZWQgaW5cbiAqIHNjZW5lIHNldHRpbmdzKS5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gcGl4ZWxTbmFwIEFsaWduIHZlcnRpY2VzIHRvIHBpeGVsIGNvb3JkaW5hdGVzIHdoZW4gcmVuZGVyaW5nLiBVc2VmdWwgZm9yXG4gKiBwaXhlbCBwZXJmZWN0IDJEIGdyYXBoaWNzLlxuICogQHByb3BlcnR5IHtib29sZWFufSB0d29TaWRlZExpZ2h0aW5nIENhbGN1bGF0ZSBwcm9wZXIgbm9ybWFscyAoYW5kIHRoZXJlZm9yZSBsaWdodGluZykgb25cbiAqIGJhY2tmYWNlcy5cbiAqIEBwcm9wZXJ0eSB7VXBkYXRlU2hhZGVyQ2FsbGJhY2t9IG9uVXBkYXRlU2hhZGVyIEEgY3VzdG9tIGZ1bmN0aW9uIHRoYXQgd2lsbCBiZSBjYWxsZWQgYWZ0ZXIgYWxsXG4gKiBzaGFkZXIgZ2VuZXJhdG9yIHByb3BlcnRpZXMgYXJlIGNvbGxlY3RlZCBhbmQgYmVmb3JlIHNoYWRlciBjb2RlIGlzIGdlbmVyYXRlZC4gVGhpcyBmdW5jdGlvblxuICogd2lsbCByZWNlaXZlIGFuIG9iamVjdCB3aXRoIHNoYWRlciBnZW5lcmF0b3Igc2V0dGluZ3MgKGJhc2VkIG9uIGN1cnJlbnQgbWF0ZXJpYWwgYW5kIHNjZW5lXG4gKiBwcm9wZXJ0aWVzKSwgdGhhdCB5b3UgY2FuIGNoYW5nZSBhbmQgdGhlbiByZXR1cm4uIFJldHVybmVkIHZhbHVlIHdpbGwgYmUgdXNlZCBpbnN0ZWFkLiBUaGlzIGlzXG4gKiBtb3N0bHkgdXNlZnVsIHdoZW4gcmVuZGVyaW5nIHRoZSBzYW1lIHNldCBvZiBvYmplY3RzLCBidXQgd2l0aCBkaWZmZXJlbnQgc2hhZGVyIHZhcmlhdGlvbnMgYmFzZWRcbiAqIG9uIHRoZSBzYW1lIG1hdGVyaWFsLiBGb3IgZXhhbXBsZSwgeW91IG1heSB3aXNoIHRvIHJlbmRlciBhIGRlcHRoIG9yIG5vcm1hbCBwYXNzIHVzaW5nIHRleHR1cmVzXG4gKiBhc3NpZ25lZCB0byB0aGUgbWF0ZXJpYWwsIGEgcmVmbGVjdGlvbiBwYXNzIHdpdGggc2ltcGxlciBzaGFkZXJzIGFuZCBzbyBvbi4gVGhlc2UgcHJvcGVydGllcyBhcmVcbiAqIHNwbGl0IGludG8gdHdvIHNlY3Rpb25zLCBnZW5lcmljIHN0YW5kYXJkIG1hdGVyaWFsIG9wdGlvbnMgYW5kIGxpdCBvcHRpb25zLiBQcm9wZXJ0aWVzIG9mIHRoZVxuICogc3RhbmRhcmQgbWF0ZXJpYWwgb3B0aW9ucyBhcmUge0BsaW5rIFN0YW5kYXJkTWF0ZXJpYWxPcHRpb25zfSBhbmQgdGhlIG9wdGlvbnMgZm9yIHRoZSBsaXQgb3B0aW9uc1xuICogYXJlIHtAbGluayBMaXRPcHRpb25zfS5cbiAqIEBhdWdtZW50cyBNYXRlcmlhbFxuICovXG5jbGFzcyBTdGFuZGFyZE1hdGVyaWFsIGV4dGVuZHMgTWF0ZXJpYWwge1xuICAgIHN0YXRpYyBURVhUVVJFX1BBUkFNRVRFUlMgPSBzdGFuZGFyZE1hdGVyaWFsVGV4dHVyZVBhcmFtZXRlcnM7XG5cbiAgICBzdGF0aWMgQ1VCRU1BUF9QQVJBTUVURVJTID0gc3RhbmRhcmRNYXRlcmlhbEN1YmVtYXBQYXJhbWV0ZXJzO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFN0YW5kYXJkTWF0ZXJpYWwgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIENyZWF0ZSBhIG5ldyBTdGFuZGFyZCBtYXRlcmlhbFxuICAgICAqIHZhciBtYXRlcmlhbCA9IG5ldyBwYy5TdGFuZGFyZE1hdGVyaWFsKCk7XG4gICAgICpcbiAgICAgKiAvLyBVcGRhdGUgdGhlIG1hdGVyaWFsJ3MgZGlmZnVzZSBhbmQgc3BlY3VsYXIgcHJvcGVydGllc1xuICAgICAqIG1hdGVyaWFsLmRpZmZ1c2Uuc2V0KDEsIDAsIDApO1xuICAgICAqIG1hdGVyaWFsLnNwZWN1bGFyLnNldCgxLCAxLCAxKTtcbiAgICAgKlxuICAgICAqIC8vIE5vdGlmeSB0aGUgbWF0ZXJpYWwgdGhhdCBpdCBoYXMgYmVlbiBtb2RpZmllZFxuICAgICAqIG1hdGVyaWFsLnVwZGF0ZSgpO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQ3JlYXRlIGEgbmV3IFN0YW5kYXJkIG1hdGVyaWFsXG4gICAgICogdmFyIG1hdGVyaWFsID0gbmV3IHBjLlN0YW5kYXJkTWF0ZXJpYWwoKTtcbiAgICAgKlxuICAgICAqIC8vIEFzc2lnbiBhIHRleHR1cmUgdG8gdGhlIGRpZmZ1c2Ugc2xvdFxuICAgICAqIG1hdGVyaWFsLmRpZmZ1c2VNYXAgPSB0ZXh0dXJlO1xuICAgICAqXG4gICAgICogLy8gVXNlIHRoZSBhbHBoYSBjaGFubmVsIG9mIHRoZSB0ZXh0dXJlIGZvciBhbHBoYSB0ZXN0aW5nIHdpdGggYSByZWZlcmVuY2UgdmFsdWUgb2YgMC41XG4gICAgICogbWF0ZXJpYWwub3BhY2l0eU1hcCA9IHRleHR1cmU7XG4gICAgICogbWF0ZXJpYWwuYWxwaGFUZXN0ID0gMC41O1xuICAgICAqXG4gICAgICogLy8gTm90aWZ5IHRoZSBtYXRlcmlhbCB0aGF0IGl0IGhhcyBiZWVuIG1vZGlmaWVkXG4gICAgICogbWF0ZXJpYWwudXBkYXRlKCk7XG4gICAgICovXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG5cbiAgICAgICAgdGhpcy5fZGlydHlTaGFkZXIgPSB0cnVlO1xuXG4gICAgICAgIC8vIHN0b3JhZ2UgZm9yIHRleHR1cmUgYW5kIGN1YmVtYXAgYXNzZXQgcmVmZXJlbmNlc1xuICAgICAgICB0aGlzLl9hc3NldFJlZmVyZW5jZXMgPSB7fTtcblxuICAgICAgICB0aGlzLl9hY3RpdmVQYXJhbXMgPSBuZXcgU2V0KCk7XG4gICAgICAgIHRoaXMuX2FjdGl2ZUxpZ2h0aW5nUGFyYW1zID0gbmV3IFNldCgpO1xuXG4gICAgICAgIHRoaXMuc2hhZGVyT3B0QnVpbGRlciA9IG5ldyBTdGFuZGFyZE1hdGVyaWFsT3B0aW9uc0J1aWxkZXIoKTtcblxuICAgICAgICB0aGlzLnJlc2V0KCk7XG4gICAgfVxuXG4gICAgcmVzZXQoKSB7XG4gICAgICAgIC8vIHNldCBkZWZhdWx0IHZhbHVlc1xuICAgICAgICBPYmplY3Qua2V5cyhfcHJvcHMpLmZvckVhY2goKG5hbWUpID0+IHtcbiAgICAgICAgICAgIHRoaXNbYF8ke25hbWV9YF0gPSBfcHJvcHNbbmFtZV0udmFsdWUoKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtPYmplY3Q8c3RyaW5nLCBzdHJpbmc+fVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fY2h1bmtzID0geyB9O1xuICAgICAgICB0aGlzLl91bmlmb3JtQ2FjaGUgPSB7IH07XG4gICAgfVxuXG4gICAgc2V0IHNoYWRlcihzaGFkZXIpIHtcbiAgICAgICAgRGVidWcud2FybignU3RhbmRhcmRNYXRlcmlhbCNzaGFkZXIgcHJvcGVydHkgaXMgbm90IGltcGxlbWVudGVkLCBhbmQgc2hvdWxkIG5vdCBiZSB1c2VkLicpO1xuICAgIH1cblxuICAgIGdldCBzaGFkZXIoKSB7XG4gICAgICAgIERlYnVnLndhcm4oJ1N0YW5kYXJkTWF0ZXJpYWwjc2hhZGVyIHByb3BlcnR5IGlzIG5vdCBpbXBsZW1lbnRlZCwgYW5kIHNob3VsZCBub3QgYmUgdXNlZC4nKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogT2JqZWN0IGNvbnRhaW5pbmcgY3VzdG9tIHNoYWRlciBjaHVua3MgdGhhdCB3aWxsIHJlcGxhY2UgZGVmYXVsdCBvbmVzLlxuICAgICAqXG4gICAgICogQHR5cGUge09iamVjdDxzdHJpbmcsIHN0cmluZz59XG4gICAgICovXG4gICAgc2V0IGNodW5rcyh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9kaXJ0eVNoYWRlciA9IHRydWU7XG4gICAgICAgIHRoaXMuX2NodW5rcyA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBjaHVua3MoKSB7XG4gICAgICAgIHRoaXMuX2RpcnR5U2hhZGVyID0gdHJ1ZTtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NodW5rcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb3B5IGEgYFN0YW5kYXJkTWF0ZXJpYWxgLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtTdGFuZGFyZE1hdGVyaWFsfSBzb3VyY2UgLSBUaGUgbWF0ZXJpYWwgdG8gY29weSBmcm9tLlxuICAgICAqIEByZXR1cm5zIHtTdGFuZGFyZE1hdGVyaWFsfSBUaGUgZGVzdGluYXRpb24gbWF0ZXJpYWwuXG4gICAgICovXG4gICAgY29weShzb3VyY2UpIHtcbiAgICAgICAgc3VwZXIuY29weShzb3VyY2UpO1xuXG4gICAgICAgIC8vIHNldCBwcm9wZXJ0aWVzXG4gICAgICAgIE9iamVjdC5rZXlzKF9wcm9wcykuZm9yRWFjaCgoaykgPT4ge1xuICAgICAgICAgICAgdGhpc1trXSA9IHNvdXJjZVtrXTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gY2xvbmUgY2h1bmtzXG4gICAgICAgIGZvciAoY29uc3QgcCBpbiBzb3VyY2UuX2NodW5rcykge1xuICAgICAgICAgICAgaWYgKHNvdXJjZS5fY2h1bmtzLmhhc093blByb3BlcnR5KHApKVxuICAgICAgICAgICAgICAgIHRoaXMuX2NodW5rc1twXSA9IHNvdXJjZS5fY2h1bmtzW3BdO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgX3NldFBhcmFtZXRlcihuYW1lLCB2YWx1ZSkge1xuICAgICAgICBfcGFyYW1zLmFkZChuYW1lKTtcbiAgICAgICAgdGhpcy5zZXRQYXJhbWV0ZXIobmFtZSwgdmFsdWUpO1xuICAgIH1cblxuICAgIF9zZXRQYXJhbWV0ZXJzKHBhcmFtZXRlcnMpIHtcbiAgICAgICAgcGFyYW1ldGVycy5mb3JFYWNoKCh2KSA9PiB7XG4gICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIodi5uYW1lLCB2LnZhbHVlKTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgX3Byb2Nlc3NQYXJhbWV0ZXJzKHBhcmFtc05hbWUpIHtcbiAgICAgICAgY29uc3QgcHJldlBhcmFtcyA9IHRoaXNbcGFyYW1zTmFtZV07XG4gICAgICAgIHByZXZQYXJhbXMuZm9yRWFjaCgocGFyYW0pID0+IHtcbiAgICAgICAgICAgIGlmICghX3BhcmFtcy5oYXMocGFyYW0pKSB7XG4gICAgICAgICAgICAgICAgZGVsZXRlIHRoaXMucGFyYW1ldGVyc1twYXJhbV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXNbcGFyYW1zTmFtZV0gPSBfcGFyYW1zO1xuICAgICAgICBfcGFyYW1zID0gcHJldlBhcmFtcztcbiAgICAgICAgX3BhcmFtcy5jbGVhcigpO1xuICAgIH1cblxuICAgIF91cGRhdGVNYXAocCkge1xuICAgICAgICBjb25zdCBtbmFtZSA9IHAgKyAnTWFwJztcbiAgICAgICAgY29uc3QgbWFwID0gdGhpc1ttbmFtZV07XG4gICAgICAgIGlmIChtYXApIHtcbiAgICAgICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcigndGV4dHVyZV8nICsgbW5hbWUsIG1hcCk7XG5cbiAgICAgICAgICAgIGNvbnN0IHRuYW1lID0gbW5hbWUgKyAnVHJhbnNmb3JtJztcbiAgICAgICAgICAgIGNvbnN0IHVuaWZvcm0gPSB0aGlzLmdldFVuaWZvcm0odG5hbWUpO1xuICAgICAgICAgICAgaWYgKHVuaWZvcm0pIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXJzKHVuaWZvcm0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gYWxsb2NhdGUgYSB1bmlmb3JtIGlmIGl0IGRvZXNuJ3QgYWxyZWFkeSBleGlzdCBpbiB0aGUgdW5pZm9ybSBjYWNoZVxuICAgIF9hbGxvY1VuaWZvcm0obmFtZSwgYWxsb2NGdW5jKSB7XG4gICAgICAgIGxldCB1bmlmb3JtID0gdGhpcy5fdW5pZm9ybUNhY2hlW25hbWVdO1xuICAgICAgICBpZiAoIXVuaWZvcm0pIHtcbiAgICAgICAgICAgIHVuaWZvcm0gPSBhbGxvY0Z1bmMoKTtcbiAgICAgICAgICAgIHRoaXMuX3VuaWZvcm1DYWNoZVtuYW1lXSA9IHVuaWZvcm07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHVuaWZvcm07XG4gICAgfVxuXG4gICAgZ2V0VW5pZm9ybShuYW1lLCBkZXZpY2UsIHNjZW5lKSB7XG4gICAgICAgIHJldHVybiBfdW5pZm9ybXNbbmFtZV0odGhpcywgZGV2aWNlLCBzY2VuZSk7XG4gICAgfVxuXG4gICAgdXBkYXRlVW5pZm9ybXMoZGV2aWNlLCBzY2VuZSkge1xuICAgICAgICBjb25zdCBnZXRVbmlmb3JtID0gKG5hbWUpID0+IHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmdldFVuaWZvcm0obmFtZSwgZGV2aWNlLCBzY2VuZSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9hbWJpZW50JywgZ2V0VW5pZm9ybSgnYW1iaWVudCcpKTtcblxuICAgICAgICBpZiAoIXRoaXMuZGlmZnVzZU1hcCB8fCB0aGlzLmRpZmZ1c2VUaW50KSB7XG4gICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX2RpZmZ1c2UnLCBnZXRVbmlmb3JtKCdkaWZmdXNlJykpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0aGlzLnVzZU1ldGFsbmVzcykge1xuICAgICAgICAgICAgaWYgKCF0aGlzLnNwZWN1bGFyTWFwIHx8IHRoaXMuc3BlY3VsYXJUaW50KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9zcGVjdWxhcicsIGdldFVuaWZvcm0oJ3NwZWN1bGFyJykpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKCF0aGlzLm1ldGFsbmVzc01hcCB8fCB0aGlzLm1ldGFsbmVzcyA8IDEpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX21ldGFsbmVzcycsIHRoaXMubWV0YWxuZXNzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghdGhpcy5zcGVjdWxhck1hcCB8fCB0aGlzLnNwZWN1bGFyVGludCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcignbWF0ZXJpYWxfc3BlY3VsYXInLCBnZXRVbmlmb3JtKCdzcGVjdWxhcicpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghdGhpcy5zcGVjdWxhcml0eUZhY3Rvck1hcCB8fCB0aGlzLnNwZWN1bGFyaXR5RmFjdG9yVGludCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcignbWF0ZXJpYWxfc3BlY3VsYXJpdHlGYWN0b3InLCB0aGlzLnNwZWN1bGFyaXR5RmFjdG9yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghdGhpcy5zaGVlbk1hcCB8fCB0aGlzLnNoZWVuVGludCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcignbWF0ZXJpYWxfc2hlZW4nLCBnZXRVbmlmb3JtKCdzaGVlbicpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghdGhpcy5zaGVlbkdsb3NzTWFwIHx8IHRoaXMuc2hlZW5HbG9zc1RpbnQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX3NoZWVuR2xvc3MnLCB0aGlzLnNoZWVuR2xvc3MpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5yZWZyYWN0aW9uSW5kZXggIT09IDEuMCAvIDEuNSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG9uZU92ZXJSZWZyYWN0aW9uSW5kZXggPSAxLjAgLyB0aGlzLnJlZnJhY3Rpb25JbmRleDtcbiAgICAgICAgICAgICAgICBjb25zdCBmMCA9IChvbmVPdmVyUmVmcmFjdGlvbkluZGV4IC0gMSkgLyAob25lT3ZlclJlZnJhY3Rpb25JbmRleCArIDEpO1xuICAgICAgICAgICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcignbWF0ZXJpYWxfZjAnLCBmMCAqIGYwKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9mMCcsIDAuMDQpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5lbmFibGVHR1hTcGVjdWxhcikge1xuICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9hbmlzb3Ryb3B5JywgdGhpcy5hbmlzb3Ryb3B5KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmNsZWFyQ29hdCA+IDApIHtcbiAgICAgICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcignbWF0ZXJpYWxfY2xlYXJDb2F0JywgdGhpcy5jbGVhckNvYXQpO1xuICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9jbGVhckNvYXRHbG9zcycsIHRoaXMuY2xlYXJDb2F0R2xvc3MpO1xuICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9jbGVhckNvYXRCdW1waW5lc3MnLCB0aGlzLmNsZWFyQ29hdEJ1bXBpbmVzcyk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX2dsb3NzJywgZ2V0VW5pZm9ybSgnZ2xvc3MnKSk7XG5cbiAgICAgICAgaWYgKCF0aGlzLmVtaXNzaXZlTWFwIHx8IHRoaXMuZW1pc3NpdmVUaW50KSB7XG4gICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX2VtaXNzaXZlJywgZ2V0VW5pZm9ybSgnZW1pc3NpdmUnKSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuZW1pc3NpdmVJbnRlbnNpdHkgIT09IDEpIHtcbiAgICAgICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcignbWF0ZXJpYWxfZW1pc3NpdmVJbnRlbnNpdHknLCB0aGlzLmVtaXNzaXZlSW50ZW5zaXR5KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnJlZnJhY3Rpb24gPiAwKSB7XG4gICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX3JlZnJhY3Rpb24nLCB0aGlzLnJlZnJhY3Rpb24pO1xuICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9yZWZyYWN0aW9uSW5kZXgnLCB0aGlzLnJlZnJhY3Rpb25JbmRleCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy51c2VEeW5hbWljUmVmcmFjdGlvbikge1xuICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF90aGlja25lc3MnLCB0aGlzLnRoaWNrbmVzcyk7XG4gICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX2F0dGVudWF0aW9uJywgZ2V0VW5pZm9ybSgnYXR0ZW51YXRpb24nKSk7XG4gICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX2ludkF0dGVudWF0aW9uRGlzdGFuY2UnLCB0aGlzLmF0dGVudWF0aW9uRGlzdGFuY2UgPT09IDAgPyAwIDogMS4wIC8gdGhpcy5hdHRlbnVhdGlvbkRpc3RhbmNlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnVzZUlyaWRlc2NlbmNlKSB7XG4gICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX2lyaWRlc2NlbmNlJywgdGhpcy5pcmlkZXNjZW5jZSk7XG4gICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX2lyaWRlc2NlbmNlUmVmcmFjdGlvbkluZGV4JywgdGhpcy5pcmlkZXNjZW5jZVJlZnJhY3Rpb25JbmRleCk7XG4gICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX2lyaWRlc2NlbmNlVGhpY2tuZXNzTWluJywgdGhpcy5pcmlkZXNjZW5jZVRoaWNrbmVzc01pbik7XG4gICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX2lyaWRlc2NlbmNlVGhpY2tuZXNzTWF4JywgdGhpcy5pcmlkZXNjZW5jZVRoaWNrbmVzc01heCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX29wYWNpdHknLCB0aGlzLm9wYWNpdHkpO1xuXG4gICAgICAgIGlmICh0aGlzLm9wYWNpdHlGYWRlc1NwZWN1bGFyID09PSBmYWxzZSkge1xuICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9hbHBoYUZhZGUnLCB0aGlzLmFscGhhRmFkZSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5vY2NsdWRlU3BlY3VsYXIpIHtcbiAgICAgICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcignbWF0ZXJpYWxfb2NjbHVkZVNwZWN1bGFySW50ZW5zaXR5JywgdGhpcy5vY2NsdWRlU3BlY3VsYXJJbnRlbnNpdHkpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuY3ViZU1hcFByb2plY3Rpb24gPT09IENVQkVQUk9KX0JPWCkge1xuICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKGdldFVuaWZvcm0oJ2N1YmVNYXBQcm9qZWN0aW9uQm94JykpO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChjb25zdCBwIGluIF9tYXRUZXgyRCkge1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlTWFwKHApO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuYW1iaWVudFNIKSB7XG4gICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ2FtYmllbnRTSFswXScsIHRoaXMuYW1iaWVudFNIKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLm5vcm1hbE1hcCkge1xuICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9idW1waW5lc3MnLCB0aGlzLmJ1bXBpbmVzcyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5ub3JtYWxNYXAgJiYgdGhpcy5ub3JtYWxEZXRhaWxNYXApIHtcbiAgICAgICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcignbWF0ZXJpYWxfbm9ybWFsRGV0YWlsTWFwQnVtcGluZXNzJywgdGhpcy5ub3JtYWxEZXRhaWxNYXBCdW1waW5lc3MpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuaGVpZ2h0TWFwKSB7XG4gICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX2hlaWdodE1hcEZhY3RvcicsIGdldFVuaWZvcm0oJ2hlaWdodE1hcEZhY3RvcicpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGlzUGhvbmcgPSB0aGlzLnNoYWRpbmdNb2RlbCA9PT0gU1BFQ1VMQVJfUEhPTkc7XG5cbiAgICAgICAgLy8gc2V0IG92ZXJyaWRkZW4gZW52aXJvbm1lbnQgdGV4dHVyZXNcbiAgICAgICAgaWYgKHRoaXMuZW52QXRsYXMgJiYgdGhpcy5jdWJlTWFwICYmICFpc1Bob25nKSB7XG4gICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ3RleHR1cmVfZW52QXRsYXMnLCB0aGlzLmVudkF0bGFzKTtcbiAgICAgICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcigndGV4dHVyZV9jdWJlTWFwJywgdGhpcy5jdWJlTWFwKTtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLmVudkF0bGFzICYmICFpc1Bob25nKSB7XG4gICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ3RleHR1cmVfZW52QXRsYXMnLCB0aGlzLmVudkF0bGFzKTtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLmN1YmVNYXApIHtcbiAgICAgICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcigndGV4dHVyZV9jdWJlTWFwJywgdGhpcy5jdWJlTWFwKTtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLnNwaGVyZU1hcCkge1xuICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCd0ZXh0dXJlX3NwaGVyZU1hcCcsIHRoaXMuc3BoZXJlTWFwKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcignbWF0ZXJpYWxfcmVmbGVjdGl2aXR5JywgdGhpcy5yZWZsZWN0aXZpdHkpO1xuXG4gICAgICAgIC8vIHJlbW92ZSB1bnVzZWQgcGFyYW1zXG4gICAgICAgIHRoaXMuX3Byb2Nlc3NQYXJhbWV0ZXJzKCdfYWN0aXZlUGFyYW1zJyk7XG5cbiAgICAgICAgaWYgKHRoaXMuX2RpcnR5U2hhZGVyKSB7XG4gICAgICAgICAgICB0aGlzLmNsZWFyVmFyaWFudHMoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVwZGF0ZUVudlVuaWZvcm1zKGRldmljZSwgc2NlbmUpIHtcbiAgICAgICAgY29uc3QgaXNQaG9uZyA9IHRoaXMuc2hhZGluZ01vZGVsID09PSBTUEVDVUxBUl9QSE9ORztcbiAgICAgICAgY29uc3QgaGFzTG9jYWxFbnZPdmVycmlkZSA9ICh0aGlzLmVudkF0bGFzICYmICFpc1Bob25nKSB8fCB0aGlzLmN1YmVNYXAgfHwgdGhpcy5zcGhlcmVNYXA7XG5cbiAgICAgICAgaWYgKCFoYXNMb2NhbEVudk92ZXJyaWRlICYmIHRoaXMudXNlU2t5Ym94KSB7XG4gICAgICAgICAgICBpZiAoc2NlbmUuZW52QXRsYXMgJiYgc2NlbmUuc2t5Ym94ICYmICFpc1Bob25nKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCd0ZXh0dXJlX2VudkF0bGFzJywgc2NlbmUuZW52QXRsYXMpO1xuICAgICAgICAgICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcigndGV4dHVyZV9jdWJlTWFwJywgc2NlbmUuc2t5Ym94KTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoc2NlbmUuZW52QXRsYXMgJiYgIWlzUGhvbmcpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ3RleHR1cmVfZW52QXRsYXMnLCBzY2VuZS5lbnZBdGxhcyk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHNjZW5lLnNreWJveCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcigndGV4dHVyZV9jdWJlTWFwJywgc2NlbmUuc2t5Ym94KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3Byb2Nlc3NQYXJhbWV0ZXJzKCdfYWN0aXZlTGlnaHRpbmdQYXJhbXMnKTtcbiAgICB9XG5cbiAgICBnZXRTaGFkZXJWYXJpYW50KGRldmljZSwgc2NlbmUsIG9iakRlZnMsIHN0YXRpY0xpZ2h0TGlzdCwgcGFzcywgc29ydGVkTGlnaHRzLCB2aWV3VW5pZm9ybUZvcm1hdCwgdmlld0JpbmRHcm91cEZvcm1hdCkge1xuXG4gICAgICAgIC8vIHVwZGF0ZSBwcmVmaWx0ZXJlZCBsaWdodGluZyBkYXRhXG4gICAgICAgIHRoaXMudXBkYXRlRW52VW5pZm9ybXMoZGV2aWNlLCBzY2VuZSk7XG5cbiAgICAgICAgLy8gTWluaW1hbCBvcHRpb25zIGZvciBEZXB0aCBhbmQgU2hhZG93IHBhc3Nlc1xuICAgICAgICBjb25zdCBtaW5pbWFsT3B0aW9ucyA9IHBhc3MgPT09IFNIQURFUl9ERVBUSCB8fCBwYXNzID09PSBTSEFERVJfUElDSyB8fCBTaGFkZXJQYXNzLmlzU2hhZG93KHBhc3MpO1xuICAgICAgICBsZXQgb3B0aW9ucyA9IG1pbmltYWxPcHRpb25zID8gc3RhbmRhcmQub3B0aW9uc0NvbnRleHRNaW4gOiBzdGFuZGFyZC5vcHRpb25zQ29udGV4dDtcblxuICAgICAgICBpZiAobWluaW1hbE9wdGlvbnMpXG4gICAgICAgICAgICB0aGlzLnNoYWRlck9wdEJ1aWxkZXIudXBkYXRlTWluUmVmKG9wdGlvbnMsIHNjZW5lLCB0aGlzLCBvYmpEZWZzLCBzdGF0aWNMaWdodExpc3QsIHBhc3MsIHNvcnRlZExpZ2h0cyk7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICAgIHRoaXMuc2hhZGVyT3B0QnVpbGRlci51cGRhdGVSZWYob3B0aW9ucywgc2NlbmUsIHRoaXMsIG9iakRlZnMsIHN0YXRpY0xpZ2h0TGlzdCwgcGFzcywgc29ydGVkTGlnaHRzKTtcblxuICAgICAgICAvLyBleGVjdXRlIHVzZXIgY2FsbGJhY2sgdG8gbW9kaWZ5IHRoZSBvcHRpb25zXG4gICAgICAgIGlmICh0aGlzLm9uVXBkYXRlU2hhZGVyKSB7XG4gICAgICAgICAgICBvcHRpb25zID0gdGhpcy5vblVwZGF0ZVNoYWRlcihvcHRpb25zKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHByb2Nlc3NpbmdPcHRpb25zID0gbmV3IFNoYWRlclByb2Nlc3Nvck9wdGlvbnModmlld1VuaWZvcm1Gb3JtYXQsIHZpZXdCaW5kR3JvdXBGb3JtYXQpO1xuXG4gICAgICAgIGNvbnN0IGxpYnJhcnkgPSBnZXRQcm9ncmFtTGlicmFyeShkZXZpY2UpO1xuICAgICAgICBsaWJyYXJ5LnJlZ2lzdGVyKCdzdGFuZGFyZCcsIHN0YW5kYXJkKTtcbiAgICAgICAgY29uc3Qgc2hhZGVyID0gbGlicmFyeS5nZXRQcm9ncmFtKCdzdGFuZGFyZCcsIG9wdGlvbnMsIHByb2Nlc3NpbmdPcHRpb25zKTtcblxuICAgICAgICB0aGlzLl9kaXJ0eVNoYWRlciA9IGZhbHNlO1xuICAgICAgICByZXR1cm4gc2hhZGVyO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZXMgdGhpcyBtYXRlcmlhbCBmcm9tIHRoZSBzY2VuZSBhbmQgcG9zc2libHkgZnJlZXMgdXAgbWVtb3J5IGZyb20gaXRzIHNoYWRlcnMgKGlmIHRoZXJlXG4gICAgICogYXJlIG5vIG90aGVyIG1hdGVyaWFscyB1c2luZyBpdCkuXG4gICAgICovXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgLy8gdW5iaW5kICh0ZXh0dXJlKSBhc3NldCByZWZlcmVuY2VzXG4gICAgICAgIGZvciAoY29uc3QgYXNzZXQgaW4gdGhpcy5fYXNzZXRSZWZlcmVuY2VzKSB7XG4gICAgICAgICAgICB0aGlzLl9hc3NldFJlZmVyZW5jZXNbYXNzZXRdLl91bmJpbmQoKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9hc3NldFJlZmVyZW5jZXMgPSBudWxsO1xuXG4gICAgICAgIHN1cGVyLmRlc3Ryb3koKTtcbiAgICB9XG59XG5cbi8vIGRlZmluZSBhIHVuaWZvcm0gZ2V0IGZ1bmN0aW9uXG5jb25zdCBkZWZpbmVVbmlmb3JtID0gKG5hbWUsIGdldFVuaWZvcm1GdW5jKSA9PiB7XG4gICAgX3VuaWZvcm1zW25hbWVdID0gZ2V0VW5pZm9ybUZ1bmM7XG59O1xuXG5jb25zdCBkZWZpbmVQcm9wSW50ZXJuYWwgPSAobmFtZSwgY29uc3RydWN0b3JGdW5jLCBzZXR0ZXJGdW5jLCBnZXR0ZXJGdW5jKSA9PiB7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KFN0YW5kYXJkTWF0ZXJpYWwucHJvdG90eXBlLCBuYW1lLCB7XG4gICAgICAgIGdldDogZ2V0dGVyRnVuYyB8fCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpc1tgXyR7bmFtZX1gXTtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBzZXR0ZXJGdW5jXG4gICAgfSk7XG5cbiAgICBfcHJvcHNbbmFtZV0gPSB7XG4gICAgICAgIHZhbHVlOiBjb25zdHJ1Y3RvckZ1bmNcbiAgICB9O1xufTtcblxuLy8gZGVmaW5lIGEgc2ltcGxlIHZhbHVlIHByb3BlcnR5IChmbG9hdCwgc3RyaW5nIGV0YylcbmNvbnN0IGRlZmluZVZhbHVlUHJvcCA9IChwcm9wKSA9PiB7XG4gICAgY29uc3QgaW50ZXJuYWxOYW1lID0gYF8ke3Byb3AubmFtZX1gO1xuICAgIGNvbnN0IGRpcnR5U2hhZGVyRnVuYyA9IHByb3AuZGlydHlTaGFkZXJGdW5jIHx8ICgoKSA9PiB0cnVlKTtcblxuICAgIGNvbnN0IHNldHRlckZ1bmMgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgY29uc3Qgb2xkVmFsdWUgPSB0aGlzW2ludGVybmFsTmFtZV07XG4gICAgICAgIGlmIChvbGRWYWx1ZSAhPT0gdmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMuX2RpcnR5U2hhZGVyID0gdGhpcy5fZGlydHlTaGFkZXIgfHwgZGlydHlTaGFkZXJGdW5jKG9sZFZhbHVlLCB2YWx1ZSk7XG4gICAgICAgICAgICB0aGlzW2ludGVybmFsTmFtZV0gPSB2YWx1ZTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBkZWZpbmVQcm9wSW50ZXJuYWwocHJvcC5uYW1lLCAoKSA9PiBwcm9wLmRlZmF1bHRWYWx1ZSwgc2V0dGVyRnVuYywgcHJvcC5nZXR0ZXJGdW5jKTtcbn07XG5cbi8vIGRlZmluZSBhbiBhZ2dyZWdhdGUgcHJvcGVydHkgKGNvbG9yLCB2ZWMzIGV0YylcbmNvbnN0IGRlZmluZUFnZ1Byb3AgPSAocHJvcCkgPT4ge1xuICAgIGNvbnN0IGludGVybmFsTmFtZSA9IGBfJHtwcm9wLm5hbWV9YDtcbiAgICBjb25zdCBkaXJ0eVNoYWRlckZ1bmMgPSBwcm9wLmRpcnR5U2hhZGVyRnVuYyB8fCAoKCkgPT4gdHJ1ZSk7XG5cbiAgICBjb25zdCBzZXR0ZXJGdW5jID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIGNvbnN0IG9sZFZhbHVlID0gdGhpc1tpbnRlcm5hbE5hbWVdO1xuICAgICAgICBpZiAoIW9sZFZhbHVlLmVxdWFscyh2YWx1ZSkpIHtcbiAgICAgICAgICAgIHRoaXMuX2RpcnR5U2hhZGVyID0gdGhpcy5fZGlydHlTaGFkZXIgfHwgZGlydHlTaGFkZXJGdW5jKG9sZFZhbHVlLCB2YWx1ZSk7XG4gICAgICAgICAgICB0aGlzW2ludGVybmFsTmFtZV0gPSBvbGRWYWx1ZS5jb3B5KHZhbHVlKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBkZWZpbmVQcm9wSW50ZXJuYWwocHJvcC5uYW1lLCAoKSA9PiBwcm9wLmRlZmF1bHRWYWx1ZS5jbG9uZSgpLCBzZXR0ZXJGdW5jLCBwcm9wLmdldHRlckZ1bmMpO1xufTtcblxuLy8gZGVmaW5lIGVpdGhlciBhIHZhbHVlIG9yIGFnZ3JlZ2F0ZSBwcm9wZXJ0eVxuY29uc3QgZGVmaW5lUHJvcCA9IChwcm9wKSA9PiB7XG4gICAgcmV0dXJuIHByb3AuZGVmYXVsdFZhbHVlICYmIHByb3AuZGVmYXVsdFZhbHVlLmNsb25lID8gZGVmaW5lQWdnUHJvcChwcm9wKSA6IGRlZmluZVZhbHVlUHJvcChwcm9wKTtcbn07XG5cbmZ1bmN0aW9uIF9kZWZpbmVUZXgyRChuYW1lLCBjaGFubmVsID0gXCJyZ2JcIiwgdmVydGV4Q29sb3IgPSB0cnVlLCB1diA9IDApIHtcbiAgICAvLyBzdG9yZSB0ZXh0dXJlIG5hbWVcbiAgICBfbWF0VGV4MkRbbmFtZV0gPSBjaGFubmVsLmxlbmd0aCB8fCAtMTtcblxuICAgIGRlZmluZVByb3Aoe1xuICAgICAgICBuYW1lOiBgJHtuYW1lfU1hcGAsXG4gICAgICAgIGRlZmF1bHRWYWx1ZTogbnVsbCxcbiAgICAgICAgZGlydHlTaGFkZXJGdW5jOiAob2xkVmFsdWUsIG5ld1ZhbHVlKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gISFvbGRWYWx1ZSAhPT0gISFuZXdWYWx1ZSB8fFxuICAgICAgICAgICAgICAgIG9sZFZhbHVlICYmIChvbGRWYWx1ZS50eXBlICE9PSBuZXdWYWx1ZS50eXBlIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9sZFZhbHVlLmZpeEN1YmVtYXBTZWFtcyAhPT0gbmV3VmFsdWUuZml4Q3ViZW1hcFNlYW1zIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9sZFZhbHVlLmZvcm1hdCAhPT0gbmV3VmFsdWUuZm9ybWF0KTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgZGVmaW5lUHJvcCh7XG4gICAgICAgIG5hbWU6IGAke25hbWV9TWFwVGlsaW5nYCxcbiAgICAgICAgZGVmYXVsdFZhbHVlOiBuZXcgVmVjMigxLCAxKVxuICAgIH0pO1xuXG4gICAgZGVmaW5lUHJvcCh7XG4gICAgICAgIG5hbWU6IGAke25hbWV9TWFwT2Zmc2V0YCxcbiAgICAgICAgZGVmYXVsdFZhbHVlOiBuZXcgVmVjMigwLCAwKVxuICAgIH0pO1xuXG4gICAgZGVmaW5lUHJvcCh7XG4gICAgICAgIG5hbWU6IGAke25hbWV9TWFwUm90YXRpb25gLFxuICAgICAgICBkZWZhdWx0VmFsdWU6IDBcbiAgICB9KTtcblxuICAgIGRlZmluZVByb3Aoe1xuICAgICAgICBuYW1lOiBgJHtuYW1lfU1hcFV2YCxcbiAgICAgICAgZGVmYXVsdFZhbHVlOiB1dlxuICAgIH0pO1xuXG4gICAgaWYgKGNoYW5uZWwpIHtcbiAgICAgICAgZGVmaW5lUHJvcCh7XG4gICAgICAgICAgICBuYW1lOiBgJHtuYW1lfU1hcENoYW5uZWxgLFxuICAgICAgICAgICAgZGVmYXVsdFZhbHVlOiBjaGFubmVsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmICh2ZXJ0ZXhDb2xvcikge1xuICAgICAgICAgICAgZGVmaW5lUHJvcCh7XG4gICAgICAgICAgICAgICAgbmFtZTogYCR7bmFtZX1WZXJ0ZXhDb2xvcmAsXG4gICAgICAgICAgICAgICAgZGVmYXVsdFZhbHVlOiBmYWxzZVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGRlZmluZVByb3Aoe1xuICAgICAgICAgICAgICAgIG5hbWU6IGAke25hbWV9VmVydGV4Q29sb3JDaGFubmVsYCxcbiAgICAgICAgICAgICAgICBkZWZhdWx0VmFsdWU6IGNoYW5uZWxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gY29uc3RydWN0IHRoZSB0cmFuc2Zvcm0gdW5pZm9ybVxuICAgIGNvbnN0IG1hcFRpbGluZyA9IGAke25hbWV9TWFwVGlsaW5nYDtcbiAgICBjb25zdCBtYXBPZmZzZXQgPSBgJHtuYW1lfU1hcE9mZnNldGA7XG4gICAgY29uc3QgbWFwUm90YXRpb24gPSBgJHtuYW1lfU1hcFJvdGF0aW9uYDtcbiAgICBjb25zdCBtYXBUcmFuc2Zvcm0gPSBgJHtuYW1lfU1hcFRyYW5zZm9ybWA7XG4gICAgZGVmaW5lVW5pZm9ybShtYXBUcmFuc2Zvcm0sIChtYXRlcmlhbCwgZGV2aWNlLCBzY2VuZSkgPT4ge1xuICAgICAgICBjb25zdCB0aWxpbmcgPSBtYXRlcmlhbFttYXBUaWxpbmddO1xuICAgICAgICBjb25zdCBvZmZzZXQgPSBtYXRlcmlhbFttYXBPZmZzZXRdO1xuICAgICAgICBjb25zdCByb3RhdGlvbiA9IG1hdGVyaWFsW21hcFJvdGF0aW9uXTtcblxuICAgICAgICBpZiAodGlsaW5nLnggPT09IDEgJiYgdGlsaW5nLnkgPT09IDEgJiZcbiAgICAgICAgICAgIG9mZnNldC54ID09PSAwICYmIG9mZnNldC55ID09PSAwICYmXG4gICAgICAgICAgICByb3RhdGlvbiA9PT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB1bmlmb3JtID0gbWF0ZXJpYWwuX2FsbG9jVW5pZm9ybShtYXBUcmFuc2Zvcm0sICgpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBbe1xuICAgICAgICAgICAgICAgIG5hbWU6IGB0ZXh0dXJlXyR7bWFwVHJhbnNmb3JtfTBgLFxuICAgICAgICAgICAgICAgIHZhbHVlOiBuZXcgRmxvYXQzMkFycmF5KDMpXG4gICAgICAgICAgICB9LCB7XG4gICAgICAgICAgICAgICAgbmFtZTogYHRleHR1cmVfJHttYXBUcmFuc2Zvcm19MWAsXG4gICAgICAgICAgICAgICAgdmFsdWU6IG5ldyBGbG9hdDMyQXJyYXkoMylcbiAgICAgICAgICAgIH1dO1xuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCBjciA9IE1hdGguY29zKHJvdGF0aW9uICogbWF0aC5ERUdfVE9fUkFEKTtcbiAgICAgICAgY29uc3Qgc3IgPSBNYXRoLnNpbihyb3RhdGlvbiAqIG1hdGguREVHX1RPX1JBRCk7XG5cbiAgICAgICAgY29uc3QgdW5pZm9ybTAgPSB1bmlmb3JtWzBdLnZhbHVlO1xuICAgICAgICB1bmlmb3JtMFswXSA9IGNyICogdGlsaW5nLng7XG4gICAgICAgIHVuaWZvcm0wWzFdID0gLXNyICogdGlsaW5nLnk7XG4gICAgICAgIHVuaWZvcm0wWzJdID0gb2Zmc2V0Lng7XG5cbiAgICAgICAgY29uc3QgdW5pZm9ybTEgPSB1bmlmb3JtWzFdLnZhbHVlO1xuICAgICAgICB1bmlmb3JtMVswXSA9IHNyICogdGlsaW5nLng7XG4gICAgICAgIHVuaWZvcm0xWzFdID0gY3IgKiB0aWxpbmcueTtcbiAgICAgICAgdW5pZm9ybTFbMl0gPSAxLjAgLSB0aWxpbmcueSAtIG9mZnNldC55O1xuXG4gICAgICAgIHJldHVybiB1bmlmb3JtO1xuICAgIH0pO1xufVxuXG5mdW5jdGlvbiBfZGVmaW5lQ29sb3IobmFtZSwgZGVmYXVsdFZhbHVlKSB7XG4gICAgZGVmaW5lUHJvcCh7XG4gICAgICAgIG5hbWU6IG5hbWUsXG4gICAgICAgIGRlZmF1bHRWYWx1ZTogZGVmYXVsdFZhbHVlLFxuICAgICAgICBnZXR0ZXJGdW5jOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAvLyBIQUNLOiBzaW5jZSB3ZSBjYW4ndCBkZXRlY3Qgd2hldGhlciBhIHVzZXIgaXMgZ29pbmcgdG8gc2V0IGEgY29sb3IgcHJvcGVydHlcbiAgICAgICAgICAgIC8vIGFmdGVyIGNhbGxpbmcgdGhpcyBnZXR0ZXIgKGkuZSBkb2luZyBtYXRlcmlhbC5hbWJpZW50LnIgPSAwLjUpIHdlIG11c3QgYXNzdW1lXG4gICAgICAgICAgICAvLyB0aGUgd29yc3QgYW5kIGZsYWcgdGhlIHNoYWRlciBhcyBkaXJ0eS5cbiAgICAgICAgICAgIC8vIFRoaXMgbWVhbnMgY3VycmVudGx5IGFuaW1hdGluZyBhIG1hdGVyaWFsIGNvbG91ciBpcyBob3JyaWJseSBzbG93LlxuICAgICAgICAgICAgdGhpcy5fZGlydHlTaGFkZXIgPSB0cnVlO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXNbYF8ke25hbWV9YF07XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIGRlZmluZVVuaWZvcm0obmFtZSwgKG1hdGVyaWFsLCBkZXZpY2UsIHNjZW5lKSA9PiB7XG4gICAgICAgIGNvbnN0IHVuaWZvcm0gPSBtYXRlcmlhbC5fYWxsb2NVbmlmb3JtKG5hbWUsICgpID0+IG5ldyBGbG9hdDMyQXJyYXkoMykpO1xuICAgICAgICBjb25zdCBjb2xvciA9IG1hdGVyaWFsW25hbWVdO1xuICAgICAgICBjb25zdCBnYW1tYSA9IG1hdGVyaWFsLnVzZUdhbW1hVG9uZW1hcCAmJiBzY2VuZS5nYW1tYUNvcnJlY3Rpb247XG5cbiAgICAgICAgaWYgKGdhbW1hKSB7XG4gICAgICAgICAgICB1bmlmb3JtWzBdID0gTWF0aC5wb3coY29sb3IuciwgMi4yKTtcbiAgICAgICAgICAgIHVuaWZvcm1bMV0gPSBNYXRoLnBvdyhjb2xvci5nLCAyLjIpO1xuICAgICAgICAgICAgdW5pZm9ybVsyXSA9IE1hdGgucG93KGNvbG9yLmIsIDIuMik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB1bmlmb3JtWzBdID0gY29sb3IucjtcbiAgICAgICAgICAgIHVuaWZvcm1bMV0gPSBjb2xvci5nO1xuICAgICAgICAgICAgdW5pZm9ybVsyXSA9IGNvbG9yLmI7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdW5pZm9ybTtcbiAgICB9KTtcbn1cblxuZnVuY3Rpb24gX2RlZmluZUZsb2F0KG5hbWUsIGRlZmF1bHRWYWx1ZSwgZ2V0VW5pZm9ybUZ1bmMpIHtcbiAgICBkZWZpbmVQcm9wKHtcbiAgICAgICAgbmFtZTogbmFtZSxcbiAgICAgICAgZGVmYXVsdFZhbHVlOiBkZWZhdWx0VmFsdWUsXG4gICAgICAgIGRpcnR5U2hhZGVyRnVuYzogKG9sZFZhbHVlLCBuZXdWYWx1ZSkgPT4ge1xuICAgICAgICAgICAgLy8gVGhpcyBpcyBub3QgYWx3YXlzIG9wdGltYWwgYW5kIHdpbGwgc29tZXRpbWVzIHRyaWdnZXIgcmVkdW5kYW50IHNoYWRlclxuICAgICAgICAgICAgLy8gcmVjb21waWxhdGlvbi4gSG93ZXZlciwgbm8gbnVtYmVyIHByb3BlcnR5IG9uIGEgc3RhbmRhcmQgbWF0ZXJpYWxcbiAgICAgICAgICAgIC8vIHRyaWdnZXJzIGEgc2hhZGVyIHJlY29tcGlsZSBpZiB0aGUgcHJldmlvdXMgYW5kIGN1cnJlbnQgdmFsdWVzIGJvdGhcbiAgICAgICAgICAgIC8vIGhhdmUgYSBmcmFjdGlvbmFsIHBhcnQuXG4gICAgICAgICAgICByZXR1cm4gKG9sZFZhbHVlID09PSAwIHx8IG9sZFZhbHVlID09PSAxKSAhPT0gKG5ld1ZhbHVlID09PSAwIHx8IG5ld1ZhbHVlID09PSAxKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgZGVmaW5lVW5pZm9ybShuYW1lLCBnZXRVbmlmb3JtRnVuYyk7XG59XG5cbmZ1bmN0aW9uIF9kZWZpbmVPYmplY3QobmFtZSwgZ2V0VW5pZm9ybUZ1bmMpIHtcbiAgICBkZWZpbmVQcm9wKHtcbiAgICAgICAgbmFtZTogbmFtZSxcbiAgICAgICAgZGVmYXVsdFZhbHVlOiBudWxsLFxuICAgICAgICBkaXJ0eVNoYWRlckZ1bmM6IChvbGRWYWx1ZSwgbmV3VmFsdWUpID0+IHtcbiAgICAgICAgICAgIHJldHVybiAhIW9sZFZhbHVlID09PSAhIW5ld1ZhbHVlO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBkZWZpbmVVbmlmb3JtKG5hbWUsIGdldFVuaWZvcm1GdW5jKTtcbn1cblxuZnVuY3Rpb24gX2RlZmluZUZsYWcobmFtZSwgZGVmYXVsdFZhbHVlKSB7XG4gICAgZGVmaW5lUHJvcCh7XG4gICAgICAgIG5hbWU6IG5hbWUsXG4gICAgICAgIGRlZmF1bHRWYWx1ZTogZGVmYXVsdFZhbHVlXG4gICAgfSk7XG59XG5cbmZ1bmN0aW9uIF9kZWZpbmVNYXRlcmlhbFByb3BzKCkge1xuICAgIF9kZWZpbmVDb2xvcignYW1iaWVudCcsIG5ldyBDb2xvcigwLjcsIDAuNywgMC43KSk7XG4gICAgX2RlZmluZUNvbG9yKCdkaWZmdXNlJywgbmV3IENvbG9yKDEsIDEsIDEpKTtcbiAgICBfZGVmaW5lQ29sb3IoJ3NwZWN1bGFyJywgbmV3IENvbG9yKDAsIDAsIDApKTtcbiAgICBfZGVmaW5lQ29sb3IoJ2VtaXNzaXZlJywgbmV3IENvbG9yKDAsIDAsIDApKTtcbiAgICBfZGVmaW5lQ29sb3IoJ3NoZWVuJywgbmV3IENvbG9yKDEsIDEsIDEpKTtcbiAgICBfZGVmaW5lQ29sb3IoJ2F0dGVudWF0aW9uJywgbmV3IENvbG9yKDEsIDEsIDEpKTtcbiAgICBfZGVmaW5lRmxvYXQoJ2VtaXNzaXZlSW50ZW5zaXR5JywgMSk7XG4gICAgX2RlZmluZUZsb2F0KCdzcGVjdWxhcml0eUZhY3RvcicsIDEpO1xuICAgIF9kZWZpbmVGbG9hdCgnc2hlZW5HbG9zcycsIDAuMCk7XG5cbiAgICBfZGVmaW5lRmxvYXQoJ2dsb3NzJywgMC4yNSwgKG1hdGVyaWFsLCBkZXZpY2UsIHNjZW5lKSA9PiB7XG4gICAgICAgIHJldHVybiBtYXRlcmlhbC5zaGFkaW5nTW9kZWwgPT09IFNQRUNVTEFSX1BIT05HID9cbiAgICAgICAgICAgIC8vIGxlZ2FjeTogZXhwYW5kIGJhY2sgdG8gc3BlY3VsYXIgcG93ZXJcbiAgICAgICAgICAgIE1hdGgucG93KDIsIG1hdGVyaWFsLmdsb3NzICogMTEpIDpcbiAgICAgICAgICAgIG1hdGVyaWFsLmdsb3NzO1xuICAgIH0pO1xuXG4gICAgLy8gc2hpbmluZXNzIChyYW5nZSAwLi4xMDApIC0gbWFwcyB0byBpbnRlcm5hbCBnbG9zcyB2YWx1ZSAocmFuZ2UgMC4uMSlcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoU3RhbmRhcmRNYXRlcmlhbC5wcm90b3R5cGUsICdzaGluaW5lc3MnLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZ2xvc3MgKiAxMDA7XG4gICAgICAgIH0sXG4gICAgICAgIHNldDogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLmdsb3NzID0gdmFsdWUgKiAwLjAxO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBfZGVmaW5lRmxvYXQoJ2hlaWdodE1hcEZhY3RvcicsIDEsIChtYXRlcmlhbCwgZGV2aWNlLCBzY2VuZSkgPT4ge1xuICAgICAgICByZXR1cm4gbWF0ZXJpYWwuaGVpZ2h0TWFwRmFjdG9yICogMC4wMjU7XG4gICAgfSk7XG4gICAgX2RlZmluZUZsb2F0KCdvcGFjaXR5JywgMSk7XG4gICAgX2RlZmluZUZsb2F0KCdhbHBoYUZhZGUnLCAxKTtcbiAgICBfZGVmaW5lRmxvYXQoJ2FscGhhVGVzdCcsIDApOyAgICAgICAvLyBOT1RFOiBvdmVyd3JpdGVzIE1hdGVyaWFsLmFscGhhVGVzdFxuICAgIF9kZWZpbmVGbG9hdCgnYnVtcGluZXNzJywgMSk7XG4gICAgX2RlZmluZUZsb2F0KCdub3JtYWxEZXRhaWxNYXBCdW1waW5lc3MnLCAxKTtcbiAgICBfZGVmaW5lRmxvYXQoJ3JlZmxlY3Rpdml0eScsIDEpO1xuICAgIF9kZWZpbmVGbG9hdCgnb2NjbHVkZVNwZWN1bGFySW50ZW5zaXR5JywgMSk7XG4gICAgX2RlZmluZUZsb2F0KCdyZWZyYWN0aW9uJywgMCk7XG4gICAgX2RlZmluZUZsb2F0KCdyZWZyYWN0aW9uSW5kZXgnLCAxLjAgLyAxLjUpOyAvLyBhcHByb3guIChhaXIgaW9yIC8gZ2xhc3MgaW9yKVxuICAgIF9kZWZpbmVGbG9hdCgndGhpY2tuZXNzJywgMCk7XG4gICAgX2RlZmluZUZsb2F0KCdhdHRlbnVhdGlvbkRpc3RhbmNlJywgMCk7XG4gICAgX2RlZmluZUZsb2F0KCdtZXRhbG5lc3MnLCAxKTtcbiAgICBfZGVmaW5lRmxvYXQoJ2FuaXNvdHJvcHknLCAwKTtcbiAgICBfZGVmaW5lRmxvYXQoJ2NsZWFyQ29hdCcsIDApO1xuICAgIF9kZWZpbmVGbG9hdCgnY2xlYXJDb2F0R2xvc3MnLCAxKTtcbiAgICBfZGVmaW5lRmxvYXQoJ2NsZWFyQ29hdEJ1bXBpbmVzcycsIDEpO1xuICAgIF9kZWZpbmVGbG9hdCgnYW9VdlNldCcsIDAsIG51bGwpOyAvLyBsZWdhY3lcblxuICAgIF9kZWZpbmVGbG9hdCgnaXJpZGVzY2VuY2UnLCAwKTtcbiAgICBfZGVmaW5lRmxvYXQoJ2lyaWRlc2NlbmNlUmVmcmFjdGlvbkluZGV4JywgMS4wIC8gMS41KTtcbiAgICBfZGVmaW5lRmxvYXQoJ2lyaWRlc2NlbmNlVGhpY2tuZXNzTWluJywgMCk7XG4gICAgX2RlZmluZUZsb2F0KCdpcmlkZXNjZW5jZVRoaWNrbmVzc01heCcsIDApO1xuXG4gICAgX2RlZmluZU9iamVjdCgnYW1iaWVudFNIJyk7XG5cbiAgICBfZGVmaW5lT2JqZWN0KCdjdWJlTWFwUHJvamVjdGlvbkJveCcsIChtYXRlcmlhbCwgZGV2aWNlLCBzY2VuZSkgPT4ge1xuICAgICAgICBjb25zdCB1bmlmb3JtID0gbWF0ZXJpYWwuX2FsbG9jVW5pZm9ybSgnY3ViZU1hcFByb2plY3Rpb25Cb3gnLCAoKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gW3tcbiAgICAgICAgICAgICAgICBuYW1lOiAnZW52Qm94TWluJyxcbiAgICAgICAgICAgICAgICB2YWx1ZTogbmV3IEZsb2F0MzJBcnJheSgzKVxuICAgICAgICAgICAgfSwge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdlbnZCb3hNYXgnLFxuICAgICAgICAgICAgICAgIHZhbHVlOiBuZXcgRmxvYXQzMkFycmF5KDMpXG4gICAgICAgICAgICB9XTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgYmJveE1pbiA9IG1hdGVyaWFsLmN1YmVNYXBQcm9qZWN0aW9uQm94LmdldE1pbigpO1xuICAgICAgICBjb25zdCBtaW5Vbmlmb3JtID0gdW5pZm9ybVswXS52YWx1ZTtcbiAgICAgICAgbWluVW5pZm9ybVswXSA9IGJib3hNaW4ueDtcbiAgICAgICAgbWluVW5pZm9ybVsxXSA9IGJib3hNaW4ueTtcbiAgICAgICAgbWluVW5pZm9ybVsyXSA9IGJib3hNaW4uejtcblxuICAgICAgICBjb25zdCBiYm94TWF4ID0gbWF0ZXJpYWwuY3ViZU1hcFByb2plY3Rpb25Cb3guZ2V0TWF4KCk7XG4gICAgICAgIGNvbnN0IG1heFVuaWZvcm0gPSB1bmlmb3JtWzFdLnZhbHVlO1xuICAgICAgICBtYXhVbmlmb3JtWzBdID0gYmJveE1heC54O1xuICAgICAgICBtYXhVbmlmb3JtWzFdID0gYmJveE1heC55O1xuICAgICAgICBtYXhVbmlmb3JtWzJdID0gYmJveE1heC56O1xuXG4gICAgICAgIHJldHVybiB1bmlmb3JtO1xuICAgIH0pO1xuXG4gICAgX2RlZmluZUZsYWcoJ2FtYmllbnRUaW50JywgZmFsc2UpO1xuICAgIF9kZWZpbmVGbGFnKCdkaWZmdXNlVGludCcsIGZhbHNlKTtcbiAgICBfZGVmaW5lRmxhZygnc3BlY3VsYXJUaW50JywgZmFsc2UpO1xuICAgIF9kZWZpbmVGbGFnKCdzcGVjdWxhcml0eUZhY3RvclRpbnQnLCBmYWxzZSk7XG4gICAgX2RlZmluZUZsYWcoJ2VtaXNzaXZlVGludCcsIGZhbHNlKTtcbiAgICBfZGVmaW5lRmxhZygnZmFzdFRibicsIGZhbHNlKTtcbiAgICBfZGVmaW5lRmxhZygndXNlTWV0YWxuZXNzJywgZmFsc2UpO1xuICAgIF9kZWZpbmVGbGFnKCd1c2VNZXRhbG5lc3NTcGVjdWxhckNvbG9yJywgZmFsc2UpO1xuICAgIF9kZWZpbmVGbGFnKCd1c2VTaGVlbicsIGZhbHNlKTtcbiAgICBfZGVmaW5lRmxhZygnZW5hYmxlR0dYU3BlY3VsYXInLCBmYWxzZSk7XG4gICAgX2RlZmluZUZsYWcoJ29jY2x1ZGVEaXJlY3QnLCBmYWxzZSk7XG4gICAgX2RlZmluZUZsYWcoJ25vcm1hbGl6ZU5vcm1hbE1hcCcsIHRydWUpO1xuICAgIF9kZWZpbmVGbGFnKCdjb25zZXJ2ZUVuZXJneScsIHRydWUpO1xuICAgIF9kZWZpbmVGbGFnKCdvcGFjaXR5RmFkZXNTcGVjdWxhcicsIHRydWUpO1xuICAgIF9kZWZpbmVGbGFnKCdvY2NsdWRlU3BlY3VsYXInLCBTUEVDT0NDX0FPKTtcbiAgICBfZGVmaW5lRmxhZygnc2hhZGluZ01vZGVsJywgU1BFQ1VMQVJfQkxJTk4pO1xuICAgIF9kZWZpbmVGbGFnKCdmcmVzbmVsTW9kZWwnLCBGUkVTTkVMX1NDSExJQ0spOyAvLyBOT1RFOiB0aGlzIGhhcyBiZWVuIG1hZGUgdG8gbWF0Y2ggdGhlIGRlZmF1bHQgc2hhZGluZyBtb2RlbCAodG8gZml4IGEgYnVnKVxuICAgIF9kZWZpbmVGbGFnKCd1c2VEeW5hbWljUmVmcmFjdGlvbicsIGZhbHNlKTtcbiAgICBfZGVmaW5lRmxhZygnY3ViZU1hcFByb2plY3Rpb24nLCBDVUJFUFJPSl9OT05FKTtcbiAgICBfZGVmaW5lRmxhZygnY3VzdG9tRnJhZ21lbnRTaGFkZXInLCBudWxsKTtcbiAgICBfZGVmaW5lRmxhZygnZm9yY2VGcmFnbWVudFByZWNpc2lvbicsIG51bGwpO1xuICAgIF9kZWZpbmVGbGFnKCd1c2VGb2cnLCB0cnVlKTtcbiAgICBfZGVmaW5lRmxhZygndXNlTGlnaHRpbmcnLCB0cnVlKTtcbiAgICBfZGVmaW5lRmxhZygndXNlR2FtbWFUb25lbWFwJywgdHJ1ZSk7XG4gICAgX2RlZmluZUZsYWcoJ3VzZVNreWJveCcsIHRydWUpO1xuICAgIF9kZWZpbmVGbGFnKCdmb3JjZVV2MScsIGZhbHNlKTtcbiAgICBfZGVmaW5lRmxhZygncGl4ZWxTbmFwJywgZmFsc2UpO1xuICAgIF9kZWZpbmVGbGFnKCd0d29TaWRlZExpZ2h0aW5nJywgZmFsc2UpO1xuICAgIF9kZWZpbmVGbGFnKCduaW5lU2xpY2VkTW9kZScsIHVuZGVmaW5lZCk7IC8vIE5PVEU6IHRoaXMgdXNlZCB0byBiZSBTUFJJVEVfUkVOREVSTU9ERV9TTElDRUQgYnV0IHdhcyB1bmRlZmluZWQgcHJlLVJvbGx1cFxuICAgIF9kZWZpbmVGbGFnKCdtc2RmVGV4dEF0dHJpYnV0ZScsIGZhbHNlKTtcbiAgICBfZGVmaW5lRmxhZygndXNlSXJpZGVzY2VuY2UnLCBmYWxzZSk7XG4gICAgX2RlZmluZUZsYWcoJ2dsb3NzSW52ZXJ0JywgZmFsc2UpO1xuICAgIF9kZWZpbmVGbGFnKCdzaGVlbkdsb3NzSW52ZXJ0JywgZmFsc2UpO1xuICAgIF9kZWZpbmVGbGFnKCdjbGVhckNvYXRHbG9zc0ludmVydCcsIGZhbHNlKTtcblxuICAgIF9kZWZpbmVUZXgyRCgnZGlmZnVzZScpO1xuICAgIF9kZWZpbmVUZXgyRCgnc3BlY3VsYXInKTtcbiAgICBfZGVmaW5lVGV4MkQoJ2VtaXNzaXZlJyk7XG4gICAgX2RlZmluZVRleDJEKCd0aGlja25lc3MnLCAnZycpO1xuICAgIF9kZWZpbmVUZXgyRCgnc3BlY3VsYXJpdHlGYWN0b3InLCAnZycpO1xuICAgIF9kZWZpbmVUZXgyRCgnbm9ybWFsJywgJycpO1xuICAgIF9kZWZpbmVUZXgyRCgnbWV0YWxuZXNzJywgJ2cnKTtcbiAgICBfZGVmaW5lVGV4MkQoJ2dsb3NzJywgJ2cnKTtcbiAgICBfZGVmaW5lVGV4MkQoJ29wYWNpdHknLCAnYScpO1xuICAgIF9kZWZpbmVUZXgyRCgncmVmcmFjdGlvbicsICdnJyk7XG4gICAgX2RlZmluZVRleDJEKCdoZWlnaHQnLCAnZycsIGZhbHNlKTtcbiAgICBfZGVmaW5lVGV4MkQoJ2FvJywgJ2cnKTtcbiAgICBfZGVmaW5lVGV4MkQoJ2xpZ2h0JywgJ3JnYicsIHRydWUsIDEpO1xuICAgIF9kZWZpbmVUZXgyRCgnbXNkZicsICcnKTtcbiAgICBfZGVmaW5lVGV4MkQoJ2RpZmZ1c2VEZXRhaWwnLCAncmdiJywgZmFsc2UpO1xuICAgIF9kZWZpbmVUZXgyRCgnbm9ybWFsRGV0YWlsJywgJycpO1xuICAgIF9kZWZpbmVUZXgyRCgnY2xlYXJDb2F0JywgJ2cnKTtcbiAgICBfZGVmaW5lVGV4MkQoJ2NsZWFyQ29hdEdsb3NzJywgJ2cnKTtcbiAgICBfZGVmaW5lVGV4MkQoJ2NsZWFyQ29hdE5vcm1hbCcsICcnKTtcbiAgICBfZGVmaW5lVGV4MkQoJ3NoZWVuJywgJ3JnYicpO1xuICAgIF9kZWZpbmVUZXgyRCgnc2hlZW5HbG9zcycsICdnJyk7XG4gICAgX2RlZmluZVRleDJEKCdpcmlkZXNjZW5jZScsICdnJyk7XG4gICAgX2RlZmluZVRleDJEKCdpcmlkZXNjZW5jZVRoaWNrbmVzcycsICdnJyk7XG5cbiAgICBfZGVmaW5lRmxhZygnZGlmZnVzZURldGFpbE1vZGUnLCBERVRBSUxNT0RFX01VTCk7XG5cbiAgICBfZGVmaW5lT2JqZWN0KCdjdWJlTWFwJyk7XG4gICAgX2RlZmluZU9iamVjdCgnc3BoZXJlTWFwJyk7XG4gICAgX2RlZmluZU9iamVjdCgnZW52QXRsYXMnKTtcblxuICAgIC8vIHByZWZpbHRlcmVkIGN1YmVtYXAgZ2V0dGVyXG4gICAgY29uc3QgZ2V0dGVyRnVuYyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3ByZWZpbHRlcmVkQ3ViZW1hcHM7XG4gICAgfTtcblxuICAgIC8vIHByZWZpbHRlcmVkIGN1YmVtYXAgc2V0dGVyXG4gICAgY29uc3Qgc2V0dGVyRnVuYyA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICBjb25zdCBjdWJlbWFwcyA9IHRoaXMuX3ByZWZpbHRlcmVkQ3ViZW1hcHM7XG5cbiAgICAgICAgdmFsdWUgPSB2YWx1ZSB8fCBbXTtcblxuICAgICAgICBsZXQgY2hhbmdlZCA9IGZhbHNlO1xuICAgICAgICBsZXQgY29tcGxldGUgPSB0cnVlO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDY7ICsraSkge1xuICAgICAgICAgICAgY29uc3QgdiA9IHZhbHVlW2ldIHx8IG51bGw7XG4gICAgICAgICAgICBpZiAoY3ViZW1hcHNbaV0gIT09IHYpIHtcbiAgICAgICAgICAgICAgICBjdWJlbWFwc1tpXSA9IHY7XG4gICAgICAgICAgICAgICAgY2hhbmdlZCA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb21wbGV0ZSA9IGNvbXBsZXRlICYmICghIWN1YmVtYXBzW2ldKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjaGFuZ2VkKSB7XG4gICAgICAgICAgICBpZiAoY29tcGxldGUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmVudkF0bGFzID0gRW52TGlnaHRpbmcuZ2VuZXJhdGVQcmVmaWx0ZXJlZEF0bGFzKGN1YmVtYXBzLCB7XG4gICAgICAgICAgICAgICAgICAgIHRhcmdldDogdGhpcy5lbnZBdGxhc1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5lbnZBdGxhcykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmVudkF0bGFzLmRlc3Ryb3koKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5lbnZBdGxhcyA9IG51bGw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5fZGlydHlTaGFkZXIgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIGNvbnN0IGVtcHR5ID0gW251bGwsIG51bGwsIG51bGwsIG51bGwsIG51bGwsIG51bGxdO1xuXG4gICAgZGVmaW5lUHJvcEludGVybmFsKCdwcmVmaWx0ZXJlZEN1YmVtYXBzJywgKCkgPT4gZW1wdHkuc2xpY2UoKSwgc2V0dGVyRnVuYywgZ2V0dGVyRnVuYyk7XG59XG5cbl9kZWZpbmVNYXRlcmlhbFByb3BzKCk7XG5cbmV4cG9ydCB7IFN0YW5kYXJkTWF0ZXJpYWwgfTtcbiJdLCJuYW1lcyI6WyJfcHJvcHMiLCJfdW5pZm9ybXMiLCJfcGFyYW1zIiwiU2V0IiwiU3RhbmRhcmRNYXRlcmlhbCIsIk1hdGVyaWFsIiwiY29uc3RydWN0b3IiLCJfZGlydHlTaGFkZXIiLCJfYXNzZXRSZWZlcmVuY2VzIiwiX2FjdGl2ZVBhcmFtcyIsIl9hY3RpdmVMaWdodGluZ1BhcmFtcyIsInNoYWRlck9wdEJ1aWxkZXIiLCJTdGFuZGFyZE1hdGVyaWFsT3B0aW9uc0J1aWxkZXIiLCJyZXNldCIsIk9iamVjdCIsImtleXMiLCJmb3JFYWNoIiwibmFtZSIsInZhbHVlIiwiX2NodW5rcyIsIl91bmlmb3JtQ2FjaGUiLCJzaGFkZXIiLCJEZWJ1ZyIsIndhcm4iLCJjaHVua3MiLCJjb3B5Iiwic291cmNlIiwiayIsInAiLCJoYXNPd25Qcm9wZXJ0eSIsIl9zZXRQYXJhbWV0ZXIiLCJhZGQiLCJzZXRQYXJhbWV0ZXIiLCJfc2V0UGFyYW1ldGVycyIsInBhcmFtZXRlcnMiLCJ2IiwiX3Byb2Nlc3NQYXJhbWV0ZXJzIiwicGFyYW1zTmFtZSIsInByZXZQYXJhbXMiLCJwYXJhbSIsImhhcyIsImNsZWFyIiwiX3VwZGF0ZU1hcCIsIm1uYW1lIiwibWFwIiwidG5hbWUiLCJ1bmlmb3JtIiwiZ2V0VW5pZm9ybSIsIl9hbGxvY1VuaWZvcm0iLCJhbGxvY0Z1bmMiLCJkZXZpY2UiLCJzY2VuZSIsInVwZGF0ZVVuaWZvcm1zIiwiZGlmZnVzZU1hcCIsImRpZmZ1c2VUaW50IiwidXNlTWV0YWxuZXNzIiwic3BlY3VsYXJNYXAiLCJzcGVjdWxhclRpbnQiLCJtZXRhbG5lc3NNYXAiLCJtZXRhbG5lc3MiLCJzcGVjdWxhcml0eUZhY3Rvck1hcCIsInNwZWN1bGFyaXR5RmFjdG9yVGludCIsInNwZWN1bGFyaXR5RmFjdG9yIiwic2hlZW5NYXAiLCJzaGVlblRpbnQiLCJzaGVlbkdsb3NzTWFwIiwic2hlZW5HbG9zc1RpbnQiLCJzaGVlbkdsb3NzIiwicmVmcmFjdGlvbkluZGV4Iiwib25lT3ZlclJlZnJhY3Rpb25JbmRleCIsImYwIiwiZW5hYmxlR0dYU3BlY3VsYXIiLCJhbmlzb3Ryb3B5IiwiY2xlYXJDb2F0IiwiY2xlYXJDb2F0R2xvc3MiLCJjbGVhckNvYXRCdW1waW5lc3MiLCJlbWlzc2l2ZU1hcCIsImVtaXNzaXZlVGludCIsImVtaXNzaXZlSW50ZW5zaXR5IiwicmVmcmFjdGlvbiIsInVzZUR5bmFtaWNSZWZyYWN0aW9uIiwidGhpY2tuZXNzIiwiYXR0ZW51YXRpb25EaXN0YW5jZSIsInVzZUlyaWRlc2NlbmNlIiwiaXJpZGVzY2VuY2UiLCJpcmlkZXNjZW5jZVJlZnJhY3Rpb25JbmRleCIsImlyaWRlc2NlbmNlVGhpY2tuZXNzTWluIiwiaXJpZGVzY2VuY2VUaGlja25lc3NNYXgiLCJvcGFjaXR5Iiwib3BhY2l0eUZhZGVzU3BlY3VsYXIiLCJhbHBoYUZhZGUiLCJvY2NsdWRlU3BlY3VsYXIiLCJvY2NsdWRlU3BlY3VsYXJJbnRlbnNpdHkiLCJjdWJlTWFwUHJvamVjdGlvbiIsIkNVQkVQUk9KX0JPWCIsIl9tYXRUZXgyRCIsImFtYmllbnRTSCIsIm5vcm1hbE1hcCIsImJ1bXBpbmVzcyIsIm5vcm1hbERldGFpbE1hcCIsIm5vcm1hbERldGFpbE1hcEJ1bXBpbmVzcyIsImhlaWdodE1hcCIsImlzUGhvbmciLCJzaGFkaW5nTW9kZWwiLCJTUEVDVUxBUl9QSE9ORyIsImVudkF0bGFzIiwiY3ViZU1hcCIsInNwaGVyZU1hcCIsInJlZmxlY3Rpdml0eSIsImNsZWFyVmFyaWFudHMiLCJ1cGRhdGVFbnZVbmlmb3JtcyIsImhhc0xvY2FsRW52T3ZlcnJpZGUiLCJ1c2VTa3lib3giLCJza3lib3giLCJnZXRTaGFkZXJWYXJpYW50Iiwib2JqRGVmcyIsInN0YXRpY0xpZ2h0TGlzdCIsInBhc3MiLCJzb3J0ZWRMaWdodHMiLCJ2aWV3VW5pZm9ybUZvcm1hdCIsInZpZXdCaW5kR3JvdXBGb3JtYXQiLCJtaW5pbWFsT3B0aW9ucyIsIlNIQURFUl9ERVBUSCIsIlNIQURFUl9QSUNLIiwiU2hhZGVyUGFzcyIsImlzU2hhZG93Iiwib3B0aW9ucyIsInN0YW5kYXJkIiwib3B0aW9uc0NvbnRleHRNaW4iLCJvcHRpb25zQ29udGV4dCIsInVwZGF0ZU1pblJlZiIsInVwZGF0ZVJlZiIsIm9uVXBkYXRlU2hhZGVyIiwicHJvY2Vzc2luZ09wdGlvbnMiLCJTaGFkZXJQcm9jZXNzb3JPcHRpb25zIiwibGlicmFyeSIsImdldFByb2dyYW1MaWJyYXJ5IiwicmVnaXN0ZXIiLCJnZXRQcm9ncmFtIiwiZGVzdHJveSIsImFzc2V0IiwiX3VuYmluZCIsIlRFWFRVUkVfUEFSQU1FVEVSUyIsInN0YW5kYXJkTWF0ZXJpYWxUZXh0dXJlUGFyYW1ldGVycyIsIkNVQkVNQVBfUEFSQU1FVEVSUyIsInN0YW5kYXJkTWF0ZXJpYWxDdWJlbWFwUGFyYW1ldGVycyIsImRlZmluZVVuaWZvcm0iLCJnZXRVbmlmb3JtRnVuYyIsImRlZmluZVByb3BJbnRlcm5hbCIsImNvbnN0cnVjdG9yRnVuYyIsInNldHRlckZ1bmMiLCJnZXR0ZXJGdW5jIiwiZGVmaW5lUHJvcGVydHkiLCJwcm90b3R5cGUiLCJnZXQiLCJzZXQiLCJkZWZpbmVWYWx1ZVByb3AiLCJwcm9wIiwiaW50ZXJuYWxOYW1lIiwiZGlydHlTaGFkZXJGdW5jIiwib2xkVmFsdWUiLCJkZWZhdWx0VmFsdWUiLCJkZWZpbmVBZ2dQcm9wIiwiZXF1YWxzIiwiY2xvbmUiLCJkZWZpbmVQcm9wIiwiX2RlZmluZVRleDJEIiwiY2hhbm5lbCIsInZlcnRleENvbG9yIiwidXYiLCJsZW5ndGgiLCJuZXdWYWx1ZSIsInR5cGUiLCJmaXhDdWJlbWFwU2VhbXMiLCJmb3JtYXQiLCJWZWMyIiwibWFwVGlsaW5nIiwibWFwT2Zmc2V0IiwibWFwUm90YXRpb24iLCJtYXBUcmFuc2Zvcm0iLCJtYXRlcmlhbCIsInRpbGluZyIsIm9mZnNldCIsInJvdGF0aW9uIiwieCIsInkiLCJGbG9hdDMyQXJyYXkiLCJjciIsIk1hdGgiLCJjb3MiLCJtYXRoIiwiREVHX1RPX1JBRCIsInNyIiwic2luIiwidW5pZm9ybTAiLCJ1bmlmb3JtMSIsIl9kZWZpbmVDb2xvciIsImNvbG9yIiwiZ2FtbWEiLCJ1c2VHYW1tYVRvbmVtYXAiLCJnYW1tYUNvcnJlY3Rpb24iLCJwb3ciLCJyIiwiZyIsImIiLCJfZGVmaW5lRmxvYXQiLCJfZGVmaW5lT2JqZWN0IiwiX2RlZmluZUZsYWciLCJfZGVmaW5lTWF0ZXJpYWxQcm9wcyIsIkNvbG9yIiwiZ2xvc3MiLCJoZWlnaHRNYXBGYWN0b3IiLCJiYm94TWluIiwiY3ViZU1hcFByb2plY3Rpb25Cb3giLCJnZXRNaW4iLCJtaW5Vbmlmb3JtIiwieiIsImJib3hNYXgiLCJnZXRNYXgiLCJtYXhVbmlmb3JtIiwiU1BFQ09DQ19BTyIsIlNQRUNVTEFSX0JMSU5OIiwiRlJFU05FTF9TQ0hMSUNLIiwiQ1VCRVBST0pfTk9ORSIsInVuZGVmaW5lZCIsIkRFVEFJTE1PREVfTVVMIiwiX3ByZWZpbHRlcmVkQ3ViZW1hcHMiLCJjdWJlbWFwcyIsImNoYW5nZWQiLCJjb21wbGV0ZSIsImkiLCJFbnZMaWdodGluZyIsImdlbmVyYXRlUHJlZmlsdGVyZWRBdGxhcyIsInRhcmdldCIsImVtcHR5Iiwic2xpY2UiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUF1QkE7QUFDQSxNQUFNQSxNQUFNLEdBQUcsRUFBRSxDQUFBOztBQUVqQjtBQUNBLE1BQU1DLFNBQVMsR0FBRyxFQUFFLENBQUE7O0FBRXBCO0FBQ0EsSUFBSUMsT0FBTyxHQUFHLElBQUlDLEdBQUcsRUFBRSxDQUFBOztBQUV2QjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtB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
