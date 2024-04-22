/**
 * Subtract the color of the source fragment from the destination fragment and write the result to
 * the frame buffer.
 *
 * @type {number}
 * @category Graphics
 */
const BLEND_SUBTRACTIVE = 0;

/**
 * Add the color of the source fragment to the destination fragment and write the result to the
 * frame buffer.
 *
 * @type {number}
 * @category Graphics
 */
const BLEND_ADDITIVE = 1;

/**
 * Enable simple translucency for materials such as glass. This is equivalent to enabling a source
 * blend mode of {@link BLENDMODE_SRC_ALPHA} and a destination blend mode of
 * {@link BLENDMODE_ONE_MINUS_SRC_ALPHA}.
 *
 * @type {number}
 * @category Graphics
 */
const BLEND_NORMAL = 2;

/**
 * Disable blending.
 *
 * @type {number}
 * @category Graphics
 */
const BLEND_NONE = 3;

/**
 * Similar to {@link BLEND_NORMAL} expect the source fragment is assumed to have already been
 * multiplied by the source alpha value.
 *
 * @type {number}
 * @category Graphics
 */
const BLEND_PREMULTIPLIED = 4;

/**
 * Multiply the color of the source fragment by the color of the destination fragment and write the
 * result to the frame buffer.
 *
 * @type {number}
 * @category Graphics
 */
const BLEND_MULTIPLICATIVE = 5;

/**
 * Same as {@link BLEND_ADDITIVE} except the source RGB is multiplied by the source alpha.
 *
 * @type {number}
 * @category Graphics
 */
const BLEND_ADDITIVEALPHA = 6;

/**
 * Multiplies colors and doubles the result.
 *
 * @type {number}
 * @category Graphics
 */
const BLEND_MULTIPLICATIVE2X = 7;

/**
 * Softer version of additive.
 *
 * @type {number}
 * @category Graphics
 */
const BLEND_SCREEN = 8;

/**
 * Minimum color. Check app.graphicsDevice.extBlendMinmax for support.
 *
 * @type {number}
 * @category Graphics
 */
const BLEND_MIN = 9;

/**
 * Maximum color. Check app.graphicsDevice.extBlendMinmax for support.
 *
 * @type {number}
 * @category Graphics
 */
const BLEND_MAX = 10;

/**
 * No fog is applied to the scene.
 *
 * @type {string}
 * @category Graphics
 */
const FOG_NONE = 'none';

/**
 * Fog rises linearly from zero to 1 between a start and end depth.
 *
 * @type {string}
 * @category Graphics
 */
const FOG_LINEAR = 'linear';

/**
 * Fog rises according to an exponential curve controlled by a density value.
 *
 * @type {string}
 * @category Graphics
 */
const FOG_EXP = 'exp';

/**
 * Fog rises according to an exponential curve controlled by a density value.
 *
 * @type {string}
 * @category Graphics
 */
const FOG_EXP2 = 'exp2';

/**
 * No Fresnel.
 *
 * @type {number}
 * @category Graphics
 */
const FRESNEL_NONE = 0;

/**
 * Schlick's approximation of Fresnel.
 *
 * @type {number}
 * @category Graphics
 */
const FRESNEL_SCHLICK = 2;

// Legacy
const LAYER_HUD = 0;
const LAYER_GIZMO = 1;
const LAYER_FX = 2;
// 3 - 14 are custom user layers
const LAYER_WORLD = 15;

// New layers
/**
 * The world layer.
 *
 * @type {number}
 * @category Graphics
 */
const LAYERID_WORLD = 0;

/**
 * The depth layer.
 *
 * @type {number}
 * @category Graphics
 */
const LAYERID_DEPTH = 1;

/**
 * The skybox layer.
 *
 * @type {number}
 * @category Graphics
 */
const LAYERID_SKYBOX = 2;

/**
 * The immediate layer.
 *
 * @type {number}
 * @category Graphics
 */
const LAYERID_IMMEDIATE = 3;

/**
 * The UI layer.
 *
 * @type {number}
 * @category Graphics
 */
const LAYERID_UI = 4;

/**
 * Directional (global) light source.
 *
 * @type {number}
 * @category Graphics
 */
const LIGHTTYPE_DIRECTIONAL = 0;

/**
 * Omni-directional (local) light source.
 *
 * @type {number}
 * @category Graphics
 */
const LIGHTTYPE_OMNI = 1;

/**
 * Point (local) light source.
 *
 * @type {number}
 * @ignore
 * @category Graphics
 */
const LIGHTTYPE_POINT = LIGHTTYPE_OMNI;

/**
 * Spot (local) light source.
 *
 * @type {number}
 * @category Graphics
 */
const LIGHTTYPE_SPOT = 2;

// private - the number of light types
const LIGHTTYPE_COUNT = 3;

/**
 * Infinitesimally small point light source shape.
 *
 * @type {number}
 * @category Graphics
 */
const LIGHTSHAPE_PUNCTUAL = 0;

/**
 * Rectangle shape of light source.
 *
 * @type {number}
 * @category Graphics
 */
const LIGHTSHAPE_RECT = 1;

/**
 * Disk shape of light source.
 *
 * @type {number}
 * @category Graphics
 */
const LIGHTSHAPE_DISK = 2;

/**
 * Sphere shape of light source.
 *
 * @type {number}
 * @category Graphics
 */
const LIGHTSHAPE_SPHERE = 3;

/**
 * Linear distance falloff model for light attenuation.
 *
 * @type {number}
 * @category Graphics
 */
const LIGHTFALLOFF_LINEAR = 0;

/**
 * Inverse squared distance falloff model for light attenuation.
 *
 * @type {number}
 * @category Graphics
 */
const LIGHTFALLOFF_INVERSESQUARED = 1;

/**
 * Render depth (color-packed on WebGL 1.0), can be used for PCF 3x3 sampling.
 *
 * @type {number}
 * @category Graphics
 */
const SHADOW_PCF3 = 0;
const SHADOW_DEPTH = 0; // alias for SHADOW_PCF3 for backwards compatibility

/**
 * Render packed variance shadow map. All shadow receivers must also cast shadows for this mode to
 * work correctly.
 *
 * @type {number}
 * @category Graphics
 */
const SHADOW_VSM8 = 1;

/**
 * Render 16-bit exponential variance shadow map. Requires OES_texture_half_float extension. Falls
 * back to {@link SHADOW_VSM8}, if not supported.
 *
 * @type {number}
 * @category Graphics
 */
const SHADOW_VSM16 = 2;

/**
 * Render 32-bit exponential variance shadow map. Requires OES_texture_float extension. Falls back
 * to {@link SHADOW_VSM16}, if not supported.
 *
 * @type {number}
 * @category Graphics
 */
const SHADOW_VSM32 = 3;

/**
 * Render depth buffer only, can be used for hardware-accelerated PCF 5x5 sampling. Requires
 * WebGL 2. Falls back to {@link SHADOW_PCF3} on WebGL 1.
 *
 * @type {number}
 * @category Graphics
 */
const SHADOW_PCF5 = 4;

/**
 * Render depth (color-packed on WebGL 1.0), can be used for PCF 1x1 sampling.
 *
 * @type {number}
 * @category Graphics
 */
const SHADOW_PCF1 = 5;

/**
 * Render depth as color for PCSS software filtering.
 *
 * @type {number}
 * @category Graphics
 */
const SHADOW_PCSS = 6;

/**
 * map of engine SHADOW__*** to a string representation
 *
 * @type {object}
 * @ignore
 * @category Graphics
 */
const shadowTypeToString = {};
shadowTypeToString[SHADOW_PCF3] = 'PCF3';
shadowTypeToString[SHADOW_VSM8] = 'VSM8';
shadowTypeToString[SHADOW_VSM16] = 'VSM16';
shadowTypeToString[SHADOW_VSM32] = 'VSM32';
shadowTypeToString[SHADOW_PCF5] = 'PCF5';
shadowTypeToString[SHADOW_PCF1] = 'PCF1';
shadowTypeToString[SHADOW_PCSS] = 'PCSS';

/**
 * Box filter.
 *
 * @type {number}
 * @category Graphics
 */
const BLUR_BOX = 0;

/**
 * Gaussian filter. May look smoother than box, but requires more samples.
 *
 * @type {number}
 * @category Graphics
 */
const BLUR_GAUSSIAN = 1;

/**
 * No sorting, particles are drawn in arbitrary order. Can be simulated on GPU.
 *
 * @type {number}
 * @category Graphics
 */
const PARTICLESORT_NONE = 0;

/**
 * Sorting based on distance to the camera. CPU only.
 *
 * @type {number}
 * @category Graphics
 */
const PARTICLESORT_DISTANCE = 1;

/**
 * Newer particles are drawn first. CPU only.
 *
 * @type {number}
 * @category Graphics
 */
const PARTICLESORT_NEWER_FIRST = 2;

/**
 * Older particles are drawn first. CPU only.
 *
 * @type {number}
 * @category Graphics
 */
const PARTICLESORT_OLDER_FIRST = 3;
const PARTICLEMODE_GPU = 0;
const PARTICLEMODE_CPU = 1;

/**
 * Box shape parameterized by emitterExtents. Initial velocity is directed towards local Z axis.
 *
 * @type {number}
 * @category Graphics
 */
const EMITTERSHAPE_BOX = 0;

/**
 * Sphere shape parameterized by emitterRadius. Initial velocity is directed outwards from the
 * center.
 *
 * @type {number}
 * @category Graphics
 */
const EMITTERSHAPE_SPHERE = 1;

/**
 * Particles are facing camera.
 *
 * @type {number}
 * @category Graphics
 */
const PARTICLEORIENTATION_SCREEN = 0;

/**
 * User defines world space normal (particleNormal) to set planes orientation.
 *
 * @type {number}
 * @category Graphics
 */
const PARTICLEORIENTATION_WORLD = 1;

/**
 * Similar to previous, but the normal is affected by emitter(entity) transformation.
 *
 * @type {number}
 * @category Graphics
 */
const PARTICLEORIENTATION_EMITTER = 2;

/**
 * A perspective camera projection where the frustum shape is essentially pyramidal.
 *
 * @type {number}
 * @category Graphics
 */
const PROJECTION_PERSPECTIVE = 0;

/**
 * An orthographic camera projection where the frustum shape is essentially a cuboid.
 *
 * @type {number}
 * @category Graphics
 */
const PROJECTION_ORTHOGRAPHIC = 1;

/**
 * Render mesh instance as solid geometry.
 *
 * @type {number}
 * @category Graphics
 */
const RENDERSTYLE_SOLID = 0;

/**
 * Render mesh instance as wireframe.
 *
 * @type {number}
 * @category Graphics
 */
const RENDERSTYLE_WIREFRAME = 1;

/**
 * Render mesh instance as points.
 *
 * @type {number}
 * @category Graphics
 */
const RENDERSTYLE_POINTS = 2;

/**
 * The cube map is treated as if it is infinitely far away.
 *
 * @type {number}
 * @category Graphics
 */
const CUBEPROJ_NONE = 0;

/**
 * The cube map is box-projected based on a world space axis-aligned bounding box.
 *
 * @type {number}
 * @category Graphics
 */
const CUBEPROJ_BOX = 1;

/**
 * Phong without energy conservation. You should only use it as a backwards compatibility with
 * older projects.
 *
 * @type {number}
 * @category Graphics
 */
const SPECULAR_PHONG = 0;

/**
 * Energy-conserving Blinn-Phong.
 *
 * @type {number}
 * @category Graphics
 */
const SPECULAR_BLINN = 1;

/**
 * Multiply together the primary and secondary colors.
 *
 * @type {string}
 * @category Graphics
 */
const DETAILMODE_MUL = 'mul';

/**
 * Add together the primary and secondary colors.
 *
 * @type {string}
 * @category Graphics
 */
const DETAILMODE_ADD = 'add';

/**
 * Softer version of {@link DETAILMODE_ADD}.
 *
 * @type {string}
 * @category Graphics
 */
const DETAILMODE_SCREEN = 'screen';

/**
 * Multiplies or screens the colors, depending on the primary color.
 *
 * @type {string}
 * @category Graphics
 */
const DETAILMODE_OVERLAY = 'overlay';

/**
 * Select whichever of the primary and secondary colors is darker, component-wise.
 *
 * @type {string}
 * @category Graphics
 */
const DETAILMODE_MIN = 'min';

/**
 * Select whichever of the primary and secondary colors is lighter, component-wise.
 *
 * @type {string}
 * @category Graphics
 */
const DETAILMODE_MAX = 'max';

/**
 * No gamma correction.
 *
 * @type {number}
 * @category Graphics
 */
const GAMMA_NONE = 0;

/**
 * Apply sRGB gamma correction.
 *
 * @type {number}
 * @category Graphics
 */
const GAMMA_SRGB = 1;

/**
 * Apply sRGB (fast) gamma correction.
 *
 * @type {number}
 * @deprecated
 * @ignore
 * @category Graphics
 */
const GAMMA_SRGBFAST = 2; // deprecated

/**
 * Apply sRGB (HDR) gamma correction.
 *
 * @type {number}
 * @category Graphics
 */
const GAMMA_SRGBHDR = 3;

/**
 * Linear tonemapping.
 *
 * @type {number}
 * @category Graphics
 */
const TONEMAP_LINEAR = 0;

/**
 * Filmic tonemapping curve.
 *
 * @type {number}
 * @category Graphics
 */
const TONEMAP_FILMIC = 1;

/**
 * Hejl filmic tonemapping curve.
 *
 * @type {number}
 * @category Graphics
 */
const TONEMAP_HEJL = 2;

/**
 * ACES filmic tonemapping curve.
 *
 * @type {number}
 * @category Graphics
 */
const TONEMAP_ACES = 3;

/**
 * ACES v2 filmic tonemapping curve.
 *
 * @type {number}
 * @category Graphics
 */
const TONEMAP_ACES2 = 4;

/**
 * Khronos PBR Neutral tonemapping curve.
 *
 * @type {number}
 * @category Graphics
 */
const TONEMAP_NEUTRAL = 5;

/**
 * No specular occlusion.
 *
 * @type {number}
 * @category Graphics
 */
const SPECOCC_NONE = 0;

/**
 * Use AO directly to occlude specular.
 *
 * @type {number}
 * @category Graphics
 */
const SPECOCC_AO = 1;

/**
 * Modify AO based on material glossiness/view angle to occlude specular.
 *
 * @type {number}
 * @category Graphics
 */
const SPECOCC_GLOSSDEPENDENT = 2;

// 16 bits for shader defs
const SHADERDEF_NOSHADOW = 1;
const SHADERDEF_SKIN = 2;
const SHADERDEF_UV0 = 4;
const SHADERDEF_UV1 = 8;
const SHADERDEF_VCOLOR = 16;
const SHADERDEF_INSTANCING = 32;
const SHADERDEF_LM = 64;
const SHADERDEF_DIRLM = 128;
const SHADERDEF_SCREENSPACE = 256;
const SHADERDEF_TANGENTS = 512;
const SHADERDEF_MORPH_POSITION = 1024;
const SHADERDEF_MORPH_NORMAL = 2048;
const SHADERDEF_MORPH_TEXTURE_BASED = 4096;
const SHADERDEF_LMAMBIENT = 8192; // lightmaps contain ambient

/**
 * The shadow map is not to be updated.
 *
 * @type {number}
 * @category Graphics
 */
const SHADOWUPDATE_NONE = 0;

/**
 * The shadow map is regenerated this frame and not on subsequent frames.
 *
 * @type {number}
 * @category Graphics
 */
const SHADOWUPDATE_THISFRAME = 1;

/**
 * The shadow map is regenerated every frame.
 *
 * @type {number}
 * @category Graphics
 */
const SHADOWUPDATE_REALTIME = 2;
const SORTKEY_FORWARD = 0;
const SORTKEY_DEPTH = 1;

// flags used on the mask property of the Light, and also on mask property of the MeshInstance
const MASK_AFFECT_DYNAMIC = 1;
const MASK_AFFECT_LIGHTMAPPED = 2;
const MASK_BAKE = 4;

/**
 * Render shaded materials with gamma correction and tonemapping.
 *
 * @type {number}
 * @category Graphics
 */
const SHADER_FORWARD = 0;

/**
 * Render shaded materials without gamma correction and tonemapping.
 *
 * @type {number}
 * @category Graphics
 */
const SHADER_FORWARDHDR = 1;

/**
 * Render RGBA-encoded depth value.
 *
 * @type {number}
 * @category Graphics
 */
const SHADER_DEPTH = 2;

// shader pass used by the Picker class to render mesh ID
const SHADER_PICK = 3;

// shadow pass used by the shadow rendering code
const SHADER_SHADOW = 4;
const SHADER_PREPASS_VELOCITY = 5;

/**
 * Shader that performs forward rendering.
 *
 * @type {string}
 * @category Graphics
 */
const SHADERPASS_FORWARD = 'forward';

/**
 * Shader used for debug rendering of albedo.
 *
 * @type {string}
 * @category Graphics
 */
const SHADERPASS_ALBEDO = 'debug_albedo';

/**
 * Shader used for debug rendering of world normal.
 *
 * @type {string}
 * @category Graphics
 */
const SHADERPASS_WORLDNORMAL = 'debug_world_normal';

/**
 * Shader used for debug rendering of opacity.
 *
 * @type {string}
 * @category Graphics
 */
const SHADERPASS_OPACITY = 'debug_opacity';

/**
 * Shader used for debug rendering of specularity.
 *
 * @type {string}
 * @category Graphics
 */
const SHADERPASS_SPECULARITY = 'debug_specularity';

/**
 * Shader used for debug rendering of gloss.
 *
 * @type {string}
 * @category Graphics
 */
const SHADERPASS_GLOSS = 'debug_gloss';

/**
 * Shader used for debug rendering of metalness.
 *
 * @type {string}
 * @category Graphics
 */
const SHADERPASS_METALNESS = 'debug_metalness';

/**
 * Shader used for debug rendering of ao.
 *
 * @type {string}
 * @category Graphics
 */
const SHADERPASS_AO = 'debug_ao';

/**
 * Shader used for debug rendering of emission.
 *
 * @type {string}
 * @category Graphics
 */
const SHADERPASS_EMISSION = 'debug_emission';

/**
 * Shader used for debug rendering of lighting.
 *
 * @type {string}
 * @category Graphics
 */
const SHADERPASS_LIGHTING = 'debug_lighting';

/**
 * Shader used for debug rendering of UV0 texture coordinates.
 *
 * @type {string}
 * @category Graphics
 */
const SHADERPASS_UV0 = 'debug_uv0';

/**
 * This mode renders a sprite as a simple quad.
 *
 * @type {number}
 * @category Graphics
 */
const SPRITE_RENDERMODE_SIMPLE = 0;

/**
 * This mode renders a sprite using 9-slicing in 'sliced' mode. Sliced mode stretches the top and
 * bottom regions of the sprite horizontally, the left and right regions vertically and the middle
 * region both horizontally and vertically.
 *
 * @type {number}
 * @category Graphics
 */
const SPRITE_RENDERMODE_SLICED = 1;

/**
 * This mode renders a sprite using 9-slicing in 'tiled' mode. Tiled mode tiles the top and bottom
 * regions of the sprite horizontally, the left and right regions vertically and the middle region
 * both horizontally and vertically.
 *
 * @type {number}
 * @category Graphics
 */
const SPRITE_RENDERMODE_TILED = 2;

/**
 * Single color lightmap.
 *
 * @type {number}
 * @category Graphics
 */
const BAKE_COLOR = 0;

/**
 * Single color lightmap + dominant light direction (used for bump/specular).
 *
 * @type {number}
 * @category Graphics
 */
const BAKE_COLORDIR = 1;

/**
 * Center of view.
 *
 * @type {number}
 * @category Graphics
 */
const VIEW_CENTER = 0;

/**
 * Left of view. Only used in stereo rendering.
 *
 * @type {number}
 * @category Graphics
 */
const VIEW_LEFT = 1;

/**
 * Right of view. Only used in stereo rendering.
 *
 * @type {number}
 * @category Graphics
 */
const VIEW_RIGHT = 2;

/**
 * No sorting is applied. Mesh instances are rendered in the same order they were added to a layer.
 *
 * @type {number}
 * @category Graphics
 */
const SORTMODE_NONE = 0;

/**
 * Mesh instances are sorted based on {@link MeshInstance#drawOrder}.
 *
 * @type {number}
 * @category Graphics
 */
const SORTMODE_MANUAL = 1;

/**
 * Mesh instances are sorted to minimize switching between materials and meshes to improve
 * rendering performance.
 *
 * @type {number}
 * @category Graphics
 */
const SORTMODE_MATERIALMESH = 2;

/**
 * Mesh instances are sorted back to front. This is the way to properly render many
 * semi-transparent objects on different depth, one is blended on top of another.
 *
 * @type {number}
 * @category Graphics
 */
const SORTMODE_BACK2FRONT = 3;

/**
 * Mesh instances are sorted front to back. Depending on GPU and the scene, this option may give
 * better performance than {@link SORTMODE_MATERIALMESH} due to reduced overdraw.
 *
 * @type {number}
 * @category Graphics
 */
const SORTMODE_FRONT2BACK = 4;

/**
 * Provide custom functions for sorting drawcalls and calculating distance.
 *
 * @type {number}
 * @ignore
 * @category Graphics
 */
const SORTMODE_CUSTOM = 5;

/**
 * Automatically set aspect ratio to current render target's width divided by height.
 *
 * @type {number}
 * @category Graphics
 */
const ASPECT_AUTO = 0;

/**
 * Use the manual aspect ratio value.
 *
 * @type {number}
 * @category Graphics
 */
const ASPECT_MANUAL = 1;

/**
 * Horizontal orientation.
 *
 * @type {number}
 * @category Graphics
 */
const ORIENTATION_HORIZONTAL = 0;

/**
 * Vertical orientation.
 *
 * @type {number}
 * @category Graphics
 */
const ORIENTATION_VERTICAL = 1;

/**
 * A sky texture is rendered using an infinite projection.
 *
 * @type {string}
 * @category Graphics
 */
const SKYTYPE_INFINITE = 'infinite';

/**
 * A sky texture is rendered using a box projection. This is generally suitable for interior
 * environments.
 *
 * @type {string}
 * @category Graphics
 */
const SKYTYPE_BOX = 'box';

/**
 *  A sky texture is rendered using a dome projection. This is generally suitable for exterior
 * environments.
 *
 * @type {string}
 * @category Graphics
 */
const SKYTYPE_DOME = 'dome';

/**
 * Opacity dithering is disabled.
 *
 * @type {string}
 * @category Graphics
 */
const DITHER_NONE = 'none';

/**
 * Opacity is dithered using a Bayer 8 matrix.
 *
 * @type {string}
 * @category Graphics
 */
const DITHER_BAYER8 = 'bayer8';

/**
 * Opacity is dithered using a blue noise.
 *
 * @type {string}
 * @category Graphics
 */
const DITHER_BLUENOISE = 'bluenoise';

/**
 * Opacity is dithered using an interleaved gradient noise.
 *
 * @type {string}
 * @category Graphics
 */
const DITHER_IGNNOISE = 'ignnoise';

export { ASPECT_AUTO, ASPECT_MANUAL, BAKE_COLOR, BAKE_COLORDIR, BLEND_ADDITIVE, BLEND_ADDITIVEALPHA, BLEND_MAX, BLEND_MIN, BLEND_MULTIPLICATIVE, BLEND_MULTIPLICATIVE2X, BLEND_NONE, BLEND_NORMAL, BLEND_PREMULTIPLIED, BLEND_SCREEN, BLEND_SUBTRACTIVE, BLUR_BOX, BLUR_GAUSSIAN, CUBEPROJ_BOX, CUBEPROJ_NONE, DETAILMODE_ADD, DETAILMODE_MAX, DETAILMODE_MIN, DETAILMODE_MUL, DETAILMODE_OVERLAY, DETAILMODE_SCREEN, DITHER_BAYER8, DITHER_BLUENOISE, DITHER_IGNNOISE, DITHER_NONE, EMITTERSHAPE_BOX, EMITTERSHAPE_SPHERE, FOG_EXP, FOG_EXP2, FOG_LINEAR, FOG_NONE, FRESNEL_NONE, FRESNEL_SCHLICK, GAMMA_NONE, GAMMA_SRGB, GAMMA_SRGBFAST, GAMMA_SRGBHDR, LAYERID_DEPTH, LAYERID_IMMEDIATE, LAYERID_SKYBOX, LAYERID_UI, LAYERID_WORLD, LAYER_FX, LAYER_GIZMO, LAYER_HUD, LAYER_WORLD, LIGHTFALLOFF_INVERSESQUARED, LIGHTFALLOFF_LINEAR, LIGHTSHAPE_DISK, LIGHTSHAPE_PUNCTUAL, LIGHTSHAPE_RECT, LIGHTSHAPE_SPHERE, LIGHTTYPE_COUNT, LIGHTTYPE_DIRECTIONAL, LIGHTTYPE_OMNI, LIGHTTYPE_POINT, LIGHTTYPE_SPOT, MASK_AFFECT_DYNAMIC, MASK_AFFECT_LIGHTMAPPED, MASK_BAKE, ORIENTATION_HORIZONTAL, ORIENTATION_VERTICAL, PARTICLEMODE_CPU, PARTICLEMODE_GPU, PARTICLEORIENTATION_EMITTER, PARTICLEORIENTATION_SCREEN, PARTICLEORIENTATION_WORLD, PARTICLESORT_DISTANCE, PARTICLESORT_NEWER_FIRST, PARTICLESORT_NONE, PARTICLESORT_OLDER_FIRST, PROJECTION_ORTHOGRAPHIC, PROJECTION_PERSPECTIVE, RENDERSTYLE_POINTS, RENDERSTYLE_SOLID, RENDERSTYLE_WIREFRAME, SHADERDEF_DIRLM, SHADERDEF_INSTANCING, SHADERDEF_LM, SHADERDEF_LMAMBIENT, SHADERDEF_MORPH_NORMAL, SHADERDEF_MORPH_POSITION, SHADERDEF_MORPH_TEXTURE_BASED, SHADERDEF_NOSHADOW, SHADERDEF_SCREENSPACE, SHADERDEF_SKIN, SHADERDEF_TANGENTS, SHADERDEF_UV0, SHADERDEF_UV1, SHADERDEF_VCOLOR, SHADERPASS_ALBEDO, SHADERPASS_AO, SHADERPASS_EMISSION, SHADERPASS_FORWARD, SHADERPASS_GLOSS, SHADERPASS_LIGHTING, SHADERPASS_METALNESS, SHADERPASS_OPACITY, SHADERPASS_SPECULARITY, SHADERPASS_UV0, SHADERPASS_WORLDNORMAL, SHADER_DEPTH, SHADER_FORWARD, SHADER_FORWARDHDR, SHADER_PICK, SHADER_PREPASS_VELOCITY, SHADER_SHADOW, SHADOWUPDATE_NONE, SHADOWUPDATE_REALTIME, SHADOWUPDATE_THISFRAME, SHADOW_DEPTH, SHADOW_PCF1, SHADOW_PCF3, SHADOW_PCF5, SHADOW_PCSS, SHADOW_VSM16, SHADOW_VSM32, SHADOW_VSM8, SKYTYPE_BOX, SKYTYPE_DOME, SKYTYPE_INFINITE, SORTKEY_DEPTH, SORTKEY_FORWARD, SORTMODE_BACK2FRONT, SORTMODE_CUSTOM, SORTMODE_FRONT2BACK, SORTMODE_MANUAL, SORTMODE_MATERIALMESH, SORTMODE_NONE, SPECOCC_AO, SPECOCC_GLOSSDEPENDENT, SPECOCC_NONE, SPECULAR_BLINN, SPECULAR_PHONG, SPRITE_RENDERMODE_SIMPLE, SPRITE_RENDERMODE_SLICED, SPRITE_RENDERMODE_TILED, TONEMAP_ACES, TONEMAP_ACES2, TONEMAP_FILMIC, TONEMAP_HEJL, TONEMAP_LINEAR, TONEMAP_NEUTRAL, VIEW_CENTER, VIEW_LEFT, VIEW_RIGHT, shadowTypeToString };
