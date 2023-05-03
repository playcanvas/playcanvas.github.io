/**
 * Subtract the color of the source fragment from the destination fragment and write the result to
 * the frame buffer.
 *
 * @type {number}
 */
const BLEND_SUBTRACTIVE = 0;

/**
 * Add the color of the source fragment to the destination fragment and write the result to the
 * frame buffer.
 *
 * @type {number}
 */
const BLEND_ADDITIVE = 1;

/**
 * Enable simple translucency for materials such as glass. This is equivalent to enabling a source
 * blend mode of {@link BLENDMODE_SRC_ALPHA} and a destination blend mode of
 * {@link BLENDMODE_ONE_MINUS_SRC_ALPHA}.
 *
 * @type {number}
 */
const BLEND_NORMAL = 2;

/**
 * Disable blending.
 *
 * @type {number}
 */
const BLEND_NONE = 3;

/**
 * Similar to {@link BLEND_NORMAL} expect the source fragment is assumed to have already been
 * multiplied by the source alpha value.
 *
 * @type {number}
 */
const BLEND_PREMULTIPLIED = 4;

/**
 * Multiply the color of the source fragment by the color of the destination fragment and write the
 * result to the frame buffer.
 *
 * @type {number}
 */
const BLEND_MULTIPLICATIVE = 5;

/**
 * Same as {@link BLEND_ADDITIVE} except the source RGB is multiplied by the source alpha.
 *
 * @type {number}
 */
const BLEND_ADDITIVEALPHA = 6;

/**
 * Multiplies colors and doubles the result.
 *
 * @type {number}
 */
const BLEND_MULTIPLICATIVE2X = 7;

/**
 * Softer version of additive.
 *
 * @type {number}
 */
const BLEND_SCREEN = 8;

/**
 * Minimum color. Check app.graphicsDevice.extBlendMinmax for support.
 *
 * @type {number}
 */
const BLEND_MIN = 9;

/**
 * Maximum color. Check app.graphicsDevice.extBlendMinmax for support.
 *
 * @type {number}
 */
const BLEND_MAX = 10;

/**
 * No fog is applied to the scene.
 *
 * @type {string}
 */
const FOG_NONE = 'none';

/**
 * Fog rises linearly from zero to 1 between a start and end depth.
 *
 * @type {string}
 */
const FOG_LINEAR = 'linear';

/**
 * Fog rises according to an exponential curve controlled by a density value.
 *
 * @type {string}
 */
const FOG_EXP = 'exp';

/**
 * Fog rises according to an exponential curve controlled by a density value.
 *
 * @type {string}
 */
const FOG_EXP2 = 'exp2';

/**
 * No Fresnel.
 *
 * @type {number}
 */
const FRESNEL_NONE = 0;

/**
 * Schlick's approximation of Fresnel.
 *
 * @type {number}
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
 */
const LAYERID_WORLD = 0;

/**
 * The depth layer.
 *
 * @type {number}
 */
const LAYERID_DEPTH = 1;

/**
 * The skybox layer.
 *
 * @type {number}
 */
const LAYERID_SKYBOX = 2;

/**
 * The immediate layer.
 *
 * @type {number}
 */
const LAYERID_IMMEDIATE = 3;

/**
 * The UI layer.
 *
 * @type {number}
 */
const LAYERID_UI = 4;

/**
 * Directional (global) light source.
 *
 * @type {number}
 */
const LIGHTTYPE_DIRECTIONAL = 0;

/**
 * Omni-directional (local) light source.
 *
 * @type {number}
 */
const LIGHTTYPE_OMNI = 1;

/**
 * Point (local) light source.
 *
 * @type {number}
 * @ignore
 */
const LIGHTTYPE_POINT = LIGHTTYPE_OMNI;

/**
 * Spot (local) light source.
 *
 * @type {number}
 */
const LIGHTTYPE_SPOT = 2;

// private - the number of light types
const LIGHTTYPE_COUNT = 3;

/**
 * Infinitesimally small point light source shape.
 *
 * @type {number}
 */
const LIGHTSHAPE_PUNCTUAL = 0;

/**
 * Rectangle shape of light source.
 *
 * @type {number}
 */
const LIGHTSHAPE_RECT = 1;

/**
 * Disk shape of light source.
 *
 * @type {number}
 */
const LIGHTSHAPE_DISK = 2;

/**
 * Sphere shape of light source.
 *
 * @type {number}
 */
const LIGHTSHAPE_SPHERE = 3;

/**
 * Linear distance falloff model for light attenuation.
 *
 * @type {number}
 */
const LIGHTFALLOFF_LINEAR = 0;

/**
 * Inverse squared distance falloff model for light attenuation.
 *
 * @type {number}
 */
const LIGHTFALLOFF_INVERSESQUARED = 1;

/**
 * Render depth (color-packed on WebGL 1.0), can be used for PCF 3x3 sampling.
 *
 * @type {number}
 */
const SHADOW_PCF3 = 0;
const SHADOW_DEPTH = 0; // alias for SHADOW_PCF3 for backwards compatibility

/**
 * Render packed variance shadow map. All shadow receivers must also cast shadows for this mode to
 * work correctly.
 *
 * @type {number}
 */
const SHADOW_VSM8 = 1;

/**
 * Render 16-bit exponential variance shadow map. Requires OES_texture_half_float extension. Falls
 * back to {@link SHADOW_VSM8}, if not supported.
 *
 * @type {number}
 */
const SHADOW_VSM16 = 2;

/**
 * Render 32-bit exponential variance shadow map. Requires OES_texture_float extension. Falls back
 * to {@link SHADOW_VSM16}, if not supported.
 *
 * @type {number}
 */
const SHADOW_VSM32 = 3;

/**
 * Render depth buffer only, can be used for hardware-accelerated PCF 5x5 sampling. Requires
 * WebGL 2. Falls back to {@link SHADOW_PCF3} on WebGL 1.
 *
 * @type {number}
 */
const SHADOW_PCF5 = 4;

/**
 * Render depth (color-packed on WebGL 1.0), can be used for PCF 1x1 sampling.
 *
 * @type {number}
 */
const SHADOW_PCF1 = 5;

// non-public: number of supported depth shadow modes
const SHADOW_COUNT = 6;

/**
 * map of engine SHADOW__*** to a string representation
 *
 * @type {object}
 * @ignore
 */
const shadowTypeToString = {};
shadowTypeToString[SHADOW_PCF3] = 'PCF3';
shadowTypeToString[SHADOW_VSM8] = 'VSM8';
shadowTypeToString[SHADOW_VSM16] = 'VSM16';
shadowTypeToString[SHADOW_VSM32] = 'VSM32';
shadowTypeToString[SHADOW_PCF5] = 'PCF5';
shadowTypeToString[SHADOW_PCF1] = 'PCF1';

/**
 * Box filter.
 *
 * @type {number}
 */
const BLUR_BOX = 0;

/**
 * Gaussian filter. May look smoother than box, but requires more samples.
 *
 * @type {number}
 */
const BLUR_GAUSSIAN = 1;

/**
 * No sorting, particles are drawn in arbitrary order. Can be simulated on GPU.
 *
 * @type {number}
 */
const PARTICLESORT_NONE = 0;

/**
 * Sorting based on distance to the camera. CPU only.
 *
 * @type {number}
 */
const PARTICLESORT_DISTANCE = 1;

/**
 * Newer particles are drawn first. CPU only.
 *
 * @type {number}
 */
const PARTICLESORT_NEWER_FIRST = 2;

/**
 * Older particles are drawn first. CPU only.
 *
 * @type {number}
 */
const PARTICLESORT_OLDER_FIRST = 3;
const PARTICLEMODE_GPU = 0;
const PARTICLEMODE_CPU = 1;

/**
 * Box shape parameterized by emitterExtents. Initial velocity is directed towards local Z axis.
 *
 * @type {number}
 */
const EMITTERSHAPE_BOX = 0;

/**
 * Sphere shape parameterized by emitterRadius. Initial velocity is directed outwards from the
 * center.
 *
 * @type {number}
 */
const EMITTERSHAPE_SPHERE = 1;

/**
 * Particles are facing camera.
 *
 * @type {number}
 */
const PARTICLEORIENTATION_SCREEN = 0;

/**
 * User defines world space normal (particleNormal) to set planes orientation.
 *
 * @type {number}
 */
const PARTICLEORIENTATION_WORLD = 1;

/**
 * Similar to previous, but the normal is affected by emitter(entity) transformation.
 *
 * @type {number}
 */
const PARTICLEORIENTATION_EMITTER = 2;

/**
 * A perspective camera projection where the frustum shape is essentially pyramidal.
 *
 * @type {number}
 */
const PROJECTION_PERSPECTIVE = 0;

/**
 * An orthographic camera projection where the frustum shape is essentially a cuboid.
 *
 * @type {number}
 */
const PROJECTION_ORTHOGRAPHIC = 1;

/**
 * Render mesh instance as solid geometry.
 *
 * @type {number}
 */
const RENDERSTYLE_SOLID = 0;

/**
 * Render mesh instance as wireframe.
 *
 * @type {number}
 */
const RENDERSTYLE_WIREFRAME = 1;

/**
 * Render mesh instance as points.
 *
 * @type {number}
 */
const RENDERSTYLE_POINTS = 2;

/**
 * The cube map is treated as if it is infinitely far away.
 *
 * @type {number}
 */
const CUBEPROJ_NONE = 0;

/**
 * The cube map is box-projected based on a world space axis-aligned bounding box.
 *
 * @type {number}
 */
const CUBEPROJ_BOX = 1;

/**
 * Phong without energy conservation. You should only use it as a backwards compatibility with
 * older projects.
 *
 * @type {number}
 */
const SPECULAR_PHONG = 0;

/**
 * Energy-conserving Blinn-Phong.
 *
 * @type {number}
 */
const SPECULAR_BLINN = 1;

/**
 * Multiply together the primary and secondary colors.
 *
 * @type {string}
 */
const DETAILMODE_MUL = 'mul';

/**
 * Add together the primary and secondary colors.
 *
 * @type {string}
 */
const DETAILMODE_ADD = 'add';

/**
 * Softer version of {@link DETAILMODE_ADD}.
 *
 * @name DETAILMODE_SCREEN
 */
const DETAILMODE_SCREEN = 'screen';

/**
 * Multiplies or screens the colors, depending on the primary color.
 *
 * @type {string}
 */
const DETAILMODE_OVERLAY = 'overlay';

/**
 * Select whichever of the primary and secondary colors is darker, component-wise.
 *
 * @type {string}
 */
const DETAILMODE_MIN = 'min';

/**
 * Select whichever of the primary and secondary colors is lighter, component-wise.
 *
 * @type {string}
 */
const DETAILMODE_MAX = 'max';

/**
 * No gamma correction.
 *
 * @type {number}
 */
const GAMMA_NONE = 0;

/**
 * Apply sRGB gamma correction.
 *
 * @type {number}
 */
const GAMMA_SRGB = 1;

/**
 * Apply sRGB (fast) gamma correction.
 *
 * @type {number}
 * @deprecated
 * @ignore
 */
const GAMMA_SRGBFAST = 2; // deprecated

/**
 * Apply sRGB (HDR) gamma correction.
 *
 * @type {number}
 */
const GAMMA_SRGBHDR = 3;

/**
 * Linear tonemapping.
 *
 * @type {number}
 */
const TONEMAP_LINEAR = 0;

/**
 * Filmic tonemapping curve.
 *
 * @type {number}
 */
const TONEMAP_FILMIC = 1;

/**
 * Hejl filmic tonemapping curve.
 *
 * @type {number}
 */
const TONEMAP_HEJL = 2;

/**
 * ACES filmic tonemapping curve.
 *
 * @type {number}
 */
const TONEMAP_ACES = 3;

/**
 * ACES v2 filmic tonemapping curve.
 *
 * @type {number}
 */
const TONEMAP_ACES2 = 4;

/**
 * No specular occlusion.
 *
 * @type {number}
 */
const SPECOCC_NONE = 0;

/**
 * Use AO directly to occlude specular.
 *
 * @type {number}
 */
const SPECOCC_AO = 1;

/**
 * Modify AO based on material glossiness/view angle to occlude specular.
 *
 * @type {number}
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

const LINEBATCH_WORLD = 0;
const LINEBATCH_OVERLAY = 1;
const LINEBATCH_GIZMO = 2;

/**
 * The shadow map is not to be updated.
 *
 * @type {number}
 */
const SHADOWUPDATE_NONE = 0;

/**
 * The shadow map is regenerated this frame and not on subsequent frames.
 *
 * @type {number}
 */
const SHADOWUPDATE_THISFRAME = 1;

/**
 * The shadow map is regenerated every frame.
 *
 * @type {number}
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
 */
const SHADER_FORWARD = 0;

/**
 * Render shaded materials without gamma correction and tonemapping.
 *
 * @type {number}
 */
const SHADER_FORWARDHDR = 1;

/**
 * Render RGBA-encoded depth value.
 *
 * @type {number}
 */
const SHADER_DEPTH = 2;

// shader pass used by the Picker class to render mesh ID
const SHADER_PICK = 3;

// shadow pass used by the shadow rendering code
const SHADER_SHADOW = 4;

/**
 * Shader that performs forward rendering.
 *
 * @type {string}
 */
const SHADERPASS_FORWARD = 'forward';

/**
 * Shader used for debug rendering of albedo.
 *
 * @type {string}
 */
const SHADERPASS_ALBEDO = 'debug_albedo';

/**
 * Shader used for debug rendering of world normal.
 *
 * @type {string}
 */
const SHADERPASS_WORLDNORMAL = 'debug_world_normal';

/**
 * Shader used for debug rendering of opacity.
 *
 * @type {string}
 */
const SHADERPASS_OPACITY = 'debug_opacity';

/**
 * Shader used for debug rendering of specularity.
 *
 * @type {string}
 */
const SHADERPASS_SPECULARITY = 'debug_specularity';

/**
 * Shader used for debug rendering of gloss.
 *
 * @type {string}
 */
const SHADERPASS_GLOSS = 'debug_gloss';

/**
 * Shader used for debug rendering of metalness.
 *
 * @type {string}
 */
const SHADERPASS_METALNESS = 'debug_metalness';

/**
 * Shader used for debug rendering of ao.
 *
 * @type {string}
 */
const SHADERPASS_AO = 'debug_ao';

/**
 * Shader used for debug rendering of emission.
 *
 * @type {string}
 */
const SHADERPASS_EMISSION = 'debug_emission';

/**
 * Shader used for debug rendering of lighting.
 *
 * @type {string}
 */
const SHADERPASS_LIGHTING = 'debug_lighting';

/**
 * Shader used for debug rendering of UV0 texture coordinates.
 *
 * @type {string}
 */
const SHADERPASS_UV0 = 'debug_uv0';

/**
 * This mode renders a sprite as a simple quad.
 *
 * @type {number}
 */
const SPRITE_RENDERMODE_SIMPLE = 0;

/**
 * This mode renders a sprite using 9-slicing in 'sliced' mode. Sliced mode stretches the top and
 * bottom regions of the sprite horizontally, the left and right regions vertically and the middle
 * region both horizontally and vertically.
 *
 * @type {number}
 */
const SPRITE_RENDERMODE_SLICED = 1;

/**
 * This mode renders a sprite using 9-slicing in 'tiled' mode. Tiled mode tiles the top and bottom
 * regions of the sprite horizontally, the left and right regions vertically and the middle region
 * both horizontally and vertically.
 *
 * @type {number}
 */
const SPRITE_RENDERMODE_TILED = 2;

/**
 * Single color lightmap.
 *
 * @type {number}
 */
const BAKE_COLOR = 0;

/**
 * Single color lightmap + dominant light direction (used for bump/specular).
 *
 * @type {number}
 */
const BAKE_COLORDIR = 1;

/**
 * Center of view.
 *
 * @type {number}
 */
const VIEW_CENTER = 0;

/**
 * Left of view. Only used in stereo rendering.
 *
 * @type {number}
 */
const VIEW_LEFT = 1;

/**
 * Right of view. Only used in stereo rendering.
 *
 * @type {number}
 */
const VIEW_RIGHT = 2;

/**
 * No sorting is applied. Mesh instances are rendered in the same order they were added to a layer.
 *
 * @type {number}
 */
const SORTMODE_NONE = 0;

/**
 * Mesh instances are sorted based on {@link MeshInstance#drawOrder}.
 *
 * @type {number}
 */
const SORTMODE_MANUAL = 1;

/**
 * Mesh instances are sorted to minimize switching between materials and meshes to improve
 * rendering performance.
 *
 * @type {number}
 */
const SORTMODE_MATERIALMESH = 2;

/**
 * Mesh instances are sorted back to front. This is the way to properly render many
 * semi-transparent objects on different depth, one is blended on top of another.
 *
 * @type {number}
 */
const SORTMODE_BACK2FRONT = 3;

/**
 * Mesh instances are sorted front to back. Depending on GPU and the scene, this option may give
 * better performance than {@link SORTMODE_MATERIALMESH} due to reduced overdraw.
 *
 * @type {number}
 */
const SORTMODE_FRONT2BACK = 4;

/**
 * Provide custom functions for sorting drawcalls and calculating distance.
 *
 * @type {number}
 * @ignore
 */
const SORTMODE_CUSTOM = 5;
const COMPUPDATED_INSTANCES = 1;
const COMPUPDATED_LIGHTS = 2;
const COMPUPDATED_CAMERAS = 4;
const COMPUPDATED_BLEND = 8;

/**
 * Automatically set aspect ratio to current render target's width divided by height.
 *
 * @type {number}
 */
const ASPECT_AUTO = 0;

/**
 * Use the manual aspect ratio value.
 *
 * @type {number}
 */
const ASPECT_MANUAL = 1;

/**
 * Horizontal orientation.
 *
 * @type {number}
 */
const ORIENTATION_HORIZONTAL = 0;

/**
 * Vertical orientation.
 *
 * @type {number}
 */
const ORIENTATION_VERTICAL = 1;

export { ASPECT_AUTO, ASPECT_MANUAL, BAKE_COLOR, BAKE_COLORDIR, BLEND_ADDITIVE, BLEND_ADDITIVEALPHA, BLEND_MAX, BLEND_MIN, BLEND_MULTIPLICATIVE, BLEND_MULTIPLICATIVE2X, BLEND_NONE, BLEND_NORMAL, BLEND_PREMULTIPLIED, BLEND_SCREEN, BLEND_SUBTRACTIVE, BLUR_BOX, BLUR_GAUSSIAN, COMPUPDATED_BLEND, COMPUPDATED_CAMERAS, COMPUPDATED_INSTANCES, COMPUPDATED_LIGHTS, CUBEPROJ_BOX, CUBEPROJ_NONE, DETAILMODE_ADD, DETAILMODE_MAX, DETAILMODE_MIN, DETAILMODE_MUL, DETAILMODE_OVERLAY, DETAILMODE_SCREEN, EMITTERSHAPE_BOX, EMITTERSHAPE_SPHERE, FOG_EXP, FOG_EXP2, FOG_LINEAR, FOG_NONE, FRESNEL_NONE, FRESNEL_SCHLICK, GAMMA_NONE, GAMMA_SRGB, GAMMA_SRGBFAST, GAMMA_SRGBHDR, LAYERID_DEPTH, LAYERID_IMMEDIATE, LAYERID_SKYBOX, LAYERID_UI, LAYERID_WORLD, LAYER_FX, LAYER_GIZMO, LAYER_HUD, LAYER_WORLD, LIGHTFALLOFF_INVERSESQUARED, LIGHTFALLOFF_LINEAR, LIGHTSHAPE_DISK, LIGHTSHAPE_PUNCTUAL, LIGHTSHAPE_RECT, LIGHTSHAPE_SPHERE, LIGHTTYPE_COUNT, LIGHTTYPE_DIRECTIONAL, LIGHTTYPE_OMNI, LIGHTTYPE_POINT, LIGHTTYPE_SPOT, LINEBATCH_GIZMO, LINEBATCH_OVERLAY, LINEBATCH_WORLD, MASK_AFFECT_DYNAMIC, MASK_AFFECT_LIGHTMAPPED, MASK_BAKE, ORIENTATION_HORIZONTAL, ORIENTATION_VERTICAL, PARTICLEMODE_CPU, PARTICLEMODE_GPU, PARTICLEORIENTATION_EMITTER, PARTICLEORIENTATION_SCREEN, PARTICLEORIENTATION_WORLD, PARTICLESORT_DISTANCE, PARTICLESORT_NEWER_FIRST, PARTICLESORT_NONE, PARTICLESORT_OLDER_FIRST, PROJECTION_ORTHOGRAPHIC, PROJECTION_PERSPECTIVE, RENDERSTYLE_POINTS, RENDERSTYLE_SOLID, RENDERSTYLE_WIREFRAME, SHADERDEF_DIRLM, SHADERDEF_INSTANCING, SHADERDEF_LM, SHADERDEF_LMAMBIENT, SHADERDEF_MORPH_NORMAL, SHADERDEF_MORPH_POSITION, SHADERDEF_MORPH_TEXTURE_BASED, SHADERDEF_NOSHADOW, SHADERDEF_SCREENSPACE, SHADERDEF_SKIN, SHADERDEF_TANGENTS, SHADERDEF_UV0, SHADERDEF_UV1, SHADERDEF_VCOLOR, SHADERPASS_ALBEDO, SHADERPASS_AO, SHADERPASS_EMISSION, SHADERPASS_FORWARD, SHADERPASS_GLOSS, SHADERPASS_LIGHTING, SHADERPASS_METALNESS, SHADERPASS_OPACITY, SHADERPASS_SPECULARITY, SHADERPASS_UV0, SHADERPASS_WORLDNORMAL, SHADER_DEPTH, SHADER_FORWARD, SHADER_FORWARDHDR, SHADER_PICK, SHADER_SHADOW, SHADOWUPDATE_NONE, SHADOWUPDATE_REALTIME, SHADOWUPDATE_THISFRAME, SHADOW_COUNT, SHADOW_DEPTH, SHADOW_PCF1, SHADOW_PCF3, SHADOW_PCF5, SHADOW_VSM16, SHADOW_VSM32, SHADOW_VSM8, SORTKEY_DEPTH, SORTKEY_FORWARD, SORTMODE_BACK2FRONT, SORTMODE_CUSTOM, SORTMODE_FRONT2BACK, SORTMODE_MANUAL, SORTMODE_MATERIALMESH, SORTMODE_NONE, SPECOCC_AO, SPECOCC_GLOSSDEPENDENT, SPECOCC_NONE, SPECULAR_BLINN, SPECULAR_PHONG, SPRITE_RENDERMODE_SIMPLE, SPRITE_RENDERMODE_SLICED, SPRITE_RENDERMODE_TILED, TONEMAP_ACES, TONEMAP_ACES2, TONEMAP_FILMIC, TONEMAP_HEJL, TONEMAP_LINEAR, VIEW_CENTER, VIEW_LEFT, VIEW_RIGHT, shadowTypeToString };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uc3RhbnRzLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvc2NlbmUvY29uc3RhbnRzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogU3VidHJhY3QgdGhlIGNvbG9yIG9mIHRoZSBzb3VyY2UgZnJhZ21lbnQgZnJvbSB0aGUgZGVzdGluYXRpb24gZnJhZ21lbnQgYW5kIHdyaXRlIHRoZSByZXN1bHQgdG9cbiAqIHRoZSBmcmFtZSBidWZmZXIuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IEJMRU5EX1NVQlRSQUNUSVZFID0gMDtcblxuLyoqXG4gKiBBZGQgdGhlIGNvbG9yIG9mIHRoZSBzb3VyY2UgZnJhZ21lbnQgdG8gdGhlIGRlc3RpbmF0aW9uIGZyYWdtZW50IGFuZCB3cml0ZSB0aGUgcmVzdWx0IHRvIHRoZVxuICogZnJhbWUgYnVmZmVyLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBCTEVORF9BRERJVElWRSA9IDE7XG5cbi8qKlxuICogRW5hYmxlIHNpbXBsZSB0cmFuc2x1Y2VuY3kgZm9yIG1hdGVyaWFscyBzdWNoIGFzIGdsYXNzLiBUaGlzIGlzIGVxdWl2YWxlbnQgdG8gZW5hYmxpbmcgYSBzb3VyY2VcbiAqIGJsZW5kIG1vZGUgb2Yge0BsaW5rIEJMRU5ETU9ERV9TUkNfQUxQSEF9IGFuZCBhIGRlc3RpbmF0aW9uIGJsZW5kIG1vZGUgb2ZcbiAqIHtAbGluayBCTEVORE1PREVfT05FX01JTlVTX1NSQ19BTFBIQX0uXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IEJMRU5EX05PUk1BTCA9IDI7XG5cbi8qKlxuICogRGlzYWJsZSBibGVuZGluZy5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgQkxFTkRfTk9ORSA9IDM7XG5cbi8qKlxuICogU2ltaWxhciB0byB7QGxpbmsgQkxFTkRfTk9STUFMfSBleHBlY3QgdGhlIHNvdXJjZSBmcmFnbWVudCBpcyBhc3N1bWVkIHRvIGhhdmUgYWxyZWFkeSBiZWVuXG4gKiBtdWx0aXBsaWVkIGJ5IHRoZSBzb3VyY2UgYWxwaGEgdmFsdWUuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IEJMRU5EX1BSRU1VTFRJUExJRUQgPSA0O1xuXG4vKipcbiAqIE11bHRpcGx5IHRoZSBjb2xvciBvZiB0aGUgc291cmNlIGZyYWdtZW50IGJ5IHRoZSBjb2xvciBvZiB0aGUgZGVzdGluYXRpb24gZnJhZ21lbnQgYW5kIHdyaXRlIHRoZVxuICogcmVzdWx0IHRvIHRoZSBmcmFtZSBidWZmZXIuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IEJMRU5EX01VTFRJUExJQ0FUSVZFID0gNTtcblxuLyoqXG4gKiBTYW1lIGFzIHtAbGluayBCTEVORF9BRERJVElWRX0gZXhjZXB0IHRoZSBzb3VyY2UgUkdCIGlzIG11bHRpcGxpZWQgYnkgdGhlIHNvdXJjZSBhbHBoYS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgQkxFTkRfQURESVRJVkVBTFBIQSA9IDY7XG5cbi8qKlxuICogTXVsdGlwbGllcyBjb2xvcnMgYW5kIGRvdWJsZXMgdGhlIHJlc3VsdC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgQkxFTkRfTVVMVElQTElDQVRJVkUyWCA9IDc7XG5cbi8qKlxuICogU29mdGVyIHZlcnNpb24gb2YgYWRkaXRpdmUuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IEJMRU5EX1NDUkVFTiA9IDg7XG5cbi8qKlxuICogTWluaW11bSBjb2xvci4gQ2hlY2sgYXBwLmdyYXBoaWNzRGV2aWNlLmV4dEJsZW5kTWlubWF4IGZvciBzdXBwb3J0LlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBCTEVORF9NSU4gPSA5O1xuXG4vKipcbiAqIE1heGltdW0gY29sb3IuIENoZWNrIGFwcC5ncmFwaGljc0RldmljZS5leHRCbGVuZE1pbm1heCBmb3Igc3VwcG9ydC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgQkxFTkRfTUFYID0gMTA7XG5cbi8qKlxuICogTm8gZm9nIGlzIGFwcGxpZWQgdG8gdGhlIHNjZW5lLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbmV4cG9ydCBjb25zdCBGT0dfTk9ORSA9ICdub25lJztcblxuLyoqXG4gKiBGb2cgcmlzZXMgbGluZWFybHkgZnJvbSB6ZXJvIHRvIDEgYmV0d2VlbiBhIHN0YXJ0IGFuZCBlbmQgZGVwdGguXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuZXhwb3J0IGNvbnN0IEZPR19MSU5FQVIgPSAnbGluZWFyJztcblxuLyoqXG4gKiBGb2cgcmlzZXMgYWNjb3JkaW5nIHRvIGFuIGV4cG9uZW50aWFsIGN1cnZlIGNvbnRyb2xsZWQgYnkgYSBkZW5zaXR5IHZhbHVlLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbmV4cG9ydCBjb25zdCBGT0dfRVhQID0gJ2V4cCc7XG5cbi8qKlxuICogRm9nIHJpc2VzIGFjY29yZGluZyB0byBhbiBleHBvbmVudGlhbCBjdXJ2ZSBjb250cm9sbGVkIGJ5IGEgZGVuc2l0eSB2YWx1ZS5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5leHBvcnQgY29uc3QgRk9HX0VYUDIgPSAnZXhwMic7XG5cbi8qKlxuICogTm8gRnJlc25lbC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgRlJFU05FTF9OT05FID0gMDtcblxuLyoqXG4gKiBTY2hsaWNrJ3MgYXBwcm94aW1hdGlvbiBvZiBGcmVzbmVsLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBGUkVTTkVMX1NDSExJQ0sgPSAyO1xuXG4vLyBMZWdhY3lcbmV4cG9ydCBjb25zdCBMQVlFUl9IVUQgPSAwO1xuZXhwb3J0IGNvbnN0IExBWUVSX0dJWk1PID0gMTtcbmV4cG9ydCBjb25zdCBMQVlFUl9GWCA9IDI7XG4vLyAzIC0gMTQgYXJlIGN1c3RvbSB1c2VyIGxheWVyc1xuZXhwb3J0IGNvbnN0IExBWUVSX1dPUkxEID0gMTU7XG5cbi8vIE5ldyBsYXllcnNcbi8qKlxuICogVGhlIHdvcmxkIGxheWVyLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBMQVlFUklEX1dPUkxEID0gMDtcblxuLyoqXG4gKiBUaGUgZGVwdGggbGF5ZXIuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IExBWUVSSURfREVQVEggPSAxO1xuXG4vKipcbiAqIFRoZSBza3lib3ggbGF5ZXIuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IExBWUVSSURfU0tZQk9YID0gMjtcblxuLyoqXG4gKiBUaGUgaW1tZWRpYXRlIGxheWVyLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBMQVlFUklEX0lNTUVESUFURSA9IDM7XG5cbi8qKlxuICogVGhlIFVJIGxheWVyLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBMQVlFUklEX1VJID0gNDtcblxuLyoqXG4gKiBEaXJlY3Rpb25hbCAoZ2xvYmFsKSBsaWdodCBzb3VyY2UuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IExJR0hUVFlQRV9ESVJFQ1RJT05BTCA9IDA7XG5cbi8qKlxuICogT21uaS1kaXJlY3Rpb25hbCAobG9jYWwpIGxpZ2h0IHNvdXJjZS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgTElHSFRUWVBFX09NTkkgPSAxO1xuXG4vKipcbiAqIFBvaW50IChsb2NhbCkgbGlnaHQgc291cmNlLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAaWdub3JlXG4gKi9cbmV4cG9ydCBjb25zdCBMSUdIVFRZUEVfUE9JTlQgPSBMSUdIVFRZUEVfT01OSTtcblxuLyoqXG4gKiBTcG90IChsb2NhbCkgbGlnaHQgc291cmNlLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBMSUdIVFRZUEVfU1BPVCA9IDI7XG5cbi8vIHByaXZhdGUgLSB0aGUgbnVtYmVyIG9mIGxpZ2h0IHR5cGVzXG5leHBvcnQgY29uc3QgTElHSFRUWVBFX0NPVU5UID0gMztcblxuLyoqXG4gKiBJbmZpbml0ZXNpbWFsbHkgc21hbGwgcG9pbnQgbGlnaHQgc291cmNlIHNoYXBlLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBMSUdIVFNIQVBFX1BVTkNUVUFMID0gMDtcblxuLyoqXG4gKiBSZWN0YW5nbGUgc2hhcGUgb2YgbGlnaHQgc291cmNlLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBMSUdIVFNIQVBFX1JFQ1QgPSAxO1xuXG4vKipcbiAqIERpc2sgc2hhcGUgb2YgbGlnaHQgc291cmNlLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBMSUdIVFNIQVBFX0RJU0sgPSAyO1xuXG4vKipcbiAqIFNwaGVyZSBzaGFwZSBvZiBsaWdodCBzb3VyY2UuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IExJR0hUU0hBUEVfU1BIRVJFID0gMztcblxuLyoqXG4gKiBMaW5lYXIgZGlzdGFuY2UgZmFsbG9mZiBtb2RlbCBmb3IgbGlnaHQgYXR0ZW51YXRpb24uXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IExJR0hURkFMTE9GRl9MSU5FQVIgPSAwO1xuXG4vKipcbiAqIEludmVyc2Ugc3F1YXJlZCBkaXN0YW5jZSBmYWxsb2ZmIG1vZGVsIGZvciBsaWdodCBhdHRlbnVhdGlvbi5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgTElHSFRGQUxMT0ZGX0lOVkVSU0VTUVVBUkVEID0gMTtcblxuLyoqXG4gKiBSZW5kZXIgZGVwdGggKGNvbG9yLXBhY2tlZCBvbiBXZWJHTCAxLjApLCBjYW4gYmUgdXNlZCBmb3IgUENGIDN4MyBzYW1wbGluZy5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgU0hBRE9XX1BDRjMgPSAwO1xuZXhwb3J0IGNvbnN0IFNIQURPV19ERVBUSCA9IDA7IC8vIGFsaWFzIGZvciBTSEFET1dfUENGMyBmb3IgYmFja3dhcmRzIGNvbXBhdGliaWxpdHlcblxuLyoqXG4gKiBSZW5kZXIgcGFja2VkIHZhcmlhbmNlIHNoYWRvdyBtYXAuIEFsbCBzaGFkb3cgcmVjZWl2ZXJzIG11c3QgYWxzbyBjYXN0IHNoYWRvd3MgZm9yIHRoaXMgbW9kZSB0b1xuICogd29yayBjb3JyZWN0bHkuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IFNIQURPV19WU004ID0gMTtcblxuLyoqXG4gKiBSZW5kZXIgMTYtYml0IGV4cG9uZW50aWFsIHZhcmlhbmNlIHNoYWRvdyBtYXAuIFJlcXVpcmVzIE9FU190ZXh0dXJlX2hhbGZfZmxvYXQgZXh0ZW5zaW9uLiBGYWxsc1xuICogYmFjayB0byB7QGxpbmsgU0hBRE9XX1ZTTTh9LCBpZiBub3Qgc3VwcG9ydGVkLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBTSEFET1dfVlNNMTYgPSAyO1xuXG4vKipcbiAqIFJlbmRlciAzMi1iaXQgZXhwb25lbnRpYWwgdmFyaWFuY2Ugc2hhZG93IG1hcC4gUmVxdWlyZXMgT0VTX3RleHR1cmVfZmxvYXQgZXh0ZW5zaW9uLiBGYWxscyBiYWNrXG4gKiB0byB7QGxpbmsgU0hBRE9XX1ZTTTE2fSwgaWYgbm90IHN1cHBvcnRlZC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgU0hBRE9XX1ZTTTMyID0gMztcblxuLyoqXG4gKiBSZW5kZXIgZGVwdGggYnVmZmVyIG9ubHksIGNhbiBiZSB1c2VkIGZvciBoYXJkd2FyZS1hY2NlbGVyYXRlZCBQQ0YgNXg1IHNhbXBsaW5nLiBSZXF1aXJlc1xuICogV2ViR0wgMi4gRmFsbHMgYmFjayB0byB7QGxpbmsgU0hBRE9XX1BDRjN9IG9uIFdlYkdMIDEuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IFNIQURPV19QQ0Y1ID0gNDtcblxuLyoqXG4gKiBSZW5kZXIgZGVwdGggKGNvbG9yLXBhY2tlZCBvbiBXZWJHTCAxLjApLCBjYW4gYmUgdXNlZCBmb3IgUENGIDF4MSBzYW1wbGluZy5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgU0hBRE9XX1BDRjEgPSA1O1xuXG4vLyBub24tcHVibGljOiBudW1iZXIgb2Ygc3VwcG9ydGVkIGRlcHRoIHNoYWRvdyBtb2Rlc1xuZXhwb3J0IGNvbnN0IFNIQURPV19DT1VOVCA9IDY7XG5cbi8qKlxuICogbWFwIG9mIGVuZ2luZSBTSEFET1dfXyoqKiB0byBhIHN0cmluZyByZXByZXNlbnRhdGlvblxuICpcbiAqIEB0eXBlIHtvYmplY3R9XG4gKiBAaWdub3JlXG4gKi9cbmV4cG9ydCBjb25zdCBzaGFkb3dUeXBlVG9TdHJpbmcgPSB7fTtcbnNoYWRvd1R5cGVUb1N0cmluZ1tTSEFET1dfUENGM10gPSAnUENGMyc7XG5zaGFkb3dUeXBlVG9TdHJpbmdbU0hBRE9XX1ZTTThdID0gJ1ZTTTgnO1xuc2hhZG93VHlwZVRvU3RyaW5nW1NIQURPV19WU00xNl0gPSAnVlNNMTYnO1xuc2hhZG93VHlwZVRvU3RyaW5nW1NIQURPV19WU00zMl0gPSAnVlNNMzInO1xuc2hhZG93VHlwZVRvU3RyaW5nW1NIQURPV19QQ0Y1XSA9ICdQQ0Y1JztcbnNoYWRvd1R5cGVUb1N0cmluZ1tTSEFET1dfUENGMV0gPSAnUENGMSc7XG5cbi8qKlxuICogQm94IGZpbHRlci5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgQkxVUl9CT1ggPSAwO1xuXG4vKipcbiAqIEdhdXNzaWFuIGZpbHRlci4gTWF5IGxvb2sgc21vb3RoZXIgdGhhbiBib3gsIGJ1dCByZXF1aXJlcyBtb3JlIHNhbXBsZXMuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IEJMVVJfR0FVU1NJQU4gPSAxO1xuXG4vKipcbiAqIE5vIHNvcnRpbmcsIHBhcnRpY2xlcyBhcmUgZHJhd24gaW4gYXJiaXRyYXJ5IG9yZGVyLiBDYW4gYmUgc2ltdWxhdGVkIG9uIEdQVS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgUEFSVElDTEVTT1JUX05PTkUgPSAwO1xuXG4vKipcbiAqIFNvcnRpbmcgYmFzZWQgb24gZGlzdGFuY2UgdG8gdGhlIGNhbWVyYS4gQ1BVIG9ubHkuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IFBBUlRJQ0xFU09SVF9ESVNUQU5DRSA9IDE7XG5cbi8qKlxuICogTmV3ZXIgcGFydGljbGVzIGFyZSBkcmF3biBmaXJzdC4gQ1BVIG9ubHkuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IFBBUlRJQ0xFU09SVF9ORVdFUl9GSVJTVCA9IDI7XG5cbi8qKlxuICogT2xkZXIgcGFydGljbGVzIGFyZSBkcmF3biBmaXJzdC4gQ1BVIG9ubHkuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IFBBUlRJQ0xFU09SVF9PTERFUl9GSVJTVCA9IDM7XG5cbmV4cG9ydCBjb25zdCBQQVJUSUNMRU1PREVfR1BVID0gMDtcbmV4cG9ydCBjb25zdCBQQVJUSUNMRU1PREVfQ1BVID0gMTtcblxuLyoqXG4gKiBCb3ggc2hhcGUgcGFyYW1ldGVyaXplZCBieSBlbWl0dGVyRXh0ZW50cy4gSW5pdGlhbCB2ZWxvY2l0eSBpcyBkaXJlY3RlZCB0b3dhcmRzIGxvY2FsIFogYXhpcy5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgRU1JVFRFUlNIQVBFX0JPWCA9IDA7XG5cbi8qKlxuICogU3BoZXJlIHNoYXBlIHBhcmFtZXRlcml6ZWQgYnkgZW1pdHRlclJhZGl1cy4gSW5pdGlhbCB2ZWxvY2l0eSBpcyBkaXJlY3RlZCBvdXR3YXJkcyBmcm9tIHRoZVxuICogY2VudGVyLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBFTUlUVEVSU0hBUEVfU1BIRVJFID0gMTtcblxuLyoqXG4gKiBQYXJ0aWNsZXMgYXJlIGZhY2luZyBjYW1lcmEuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IFBBUlRJQ0xFT1JJRU5UQVRJT05fU0NSRUVOID0gMDtcblxuLyoqXG4gKiBVc2VyIGRlZmluZXMgd29ybGQgc3BhY2Ugbm9ybWFsIChwYXJ0aWNsZU5vcm1hbCkgdG8gc2V0IHBsYW5lcyBvcmllbnRhdGlvbi5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgUEFSVElDTEVPUklFTlRBVElPTl9XT1JMRCA9IDE7XG5cbi8qKlxuICogU2ltaWxhciB0byBwcmV2aW91cywgYnV0IHRoZSBub3JtYWwgaXMgYWZmZWN0ZWQgYnkgZW1pdHRlcihlbnRpdHkpIHRyYW5zZm9ybWF0aW9uLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBQQVJUSUNMRU9SSUVOVEFUSU9OX0VNSVRURVIgPSAyO1xuXG4vKipcbiAqIEEgcGVyc3BlY3RpdmUgY2FtZXJhIHByb2plY3Rpb24gd2hlcmUgdGhlIGZydXN0dW0gc2hhcGUgaXMgZXNzZW50aWFsbHkgcHlyYW1pZGFsLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBQUk9KRUNUSU9OX1BFUlNQRUNUSVZFID0gMDtcblxuLyoqXG4gKiBBbiBvcnRob2dyYXBoaWMgY2FtZXJhIHByb2plY3Rpb24gd2hlcmUgdGhlIGZydXN0dW0gc2hhcGUgaXMgZXNzZW50aWFsbHkgYSBjdWJvaWQuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IFBST0pFQ1RJT05fT1JUSE9HUkFQSElDID0gMTtcblxuLyoqXG4gKiBSZW5kZXIgbWVzaCBpbnN0YW5jZSBhcyBzb2xpZCBnZW9tZXRyeS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgUkVOREVSU1RZTEVfU09MSUQgPSAwO1xuXG4vKipcbiAqIFJlbmRlciBtZXNoIGluc3RhbmNlIGFzIHdpcmVmcmFtZS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgUkVOREVSU1RZTEVfV0lSRUZSQU1FID0gMTtcblxuLyoqXG4gKiBSZW5kZXIgbWVzaCBpbnN0YW5jZSBhcyBwb2ludHMuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IFJFTkRFUlNUWUxFX1BPSU5UUyA9IDI7XG5cbi8qKlxuICogVGhlIGN1YmUgbWFwIGlzIHRyZWF0ZWQgYXMgaWYgaXQgaXMgaW5maW5pdGVseSBmYXIgYXdheS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgQ1VCRVBST0pfTk9ORSA9IDA7XG5cbi8qKlxuICogVGhlIGN1YmUgbWFwIGlzIGJveC1wcm9qZWN0ZWQgYmFzZWQgb24gYSB3b3JsZCBzcGFjZSBheGlzLWFsaWduZWQgYm91bmRpbmcgYm94LlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBDVUJFUFJPSl9CT1ggPSAxO1xuXG4vKipcbiAqIFBob25nIHdpdGhvdXQgZW5lcmd5IGNvbnNlcnZhdGlvbi4gWW91IHNob3VsZCBvbmx5IHVzZSBpdCBhcyBhIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5IHdpdGhcbiAqIG9sZGVyIHByb2plY3RzLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBTUEVDVUxBUl9QSE9ORyA9IDA7XG5cbi8qKlxuICogRW5lcmd5LWNvbnNlcnZpbmcgQmxpbm4tUGhvbmcuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IFNQRUNVTEFSX0JMSU5OID0gMTtcblxuLyoqXG4gKiBNdWx0aXBseSB0b2dldGhlciB0aGUgcHJpbWFyeSBhbmQgc2Vjb25kYXJ5IGNvbG9ycy5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5leHBvcnQgY29uc3QgREVUQUlMTU9ERV9NVUwgPSAnbXVsJztcblxuLyoqXG4gKiBBZGQgdG9nZXRoZXIgdGhlIHByaW1hcnkgYW5kIHNlY29uZGFyeSBjb2xvcnMuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuZXhwb3J0IGNvbnN0IERFVEFJTE1PREVfQUREID0gJ2FkZCc7XG5cbi8qKlxuICogU29mdGVyIHZlcnNpb24gb2Yge0BsaW5rIERFVEFJTE1PREVfQUREfS5cbiAqXG4gKiBAbmFtZSBERVRBSUxNT0RFX1NDUkVFTlxuICovXG5leHBvcnQgY29uc3QgREVUQUlMTU9ERV9TQ1JFRU4gPSAnc2NyZWVuJztcblxuLyoqXG4gKiBNdWx0aXBsaWVzIG9yIHNjcmVlbnMgdGhlIGNvbG9ycywgZGVwZW5kaW5nIG9uIHRoZSBwcmltYXJ5IGNvbG9yLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbmV4cG9ydCBjb25zdCBERVRBSUxNT0RFX09WRVJMQVkgPSAnb3ZlcmxheSc7XG5cbi8qKlxuICogU2VsZWN0IHdoaWNoZXZlciBvZiB0aGUgcHJpbWFyeSBhbmQgc2Vjb25kYXJ5IGNvbG9ycyBpcyBkYXJrZXIsIGNvbXBvbmVudC13aXNlLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbmV4cG9ydCBjb25zdCBERVRBSUxNT0RFX01JTiA9ICdtaW4nO1xuXG4vKipcbiAqIFNlbGVjdCB3aGljaGV2ZXIgb2YgdGhlIHByaW1hcnkgYW5kIHNlY29uZGFyeSBjb2xvcnMgaXMgbGlnaHRlciwgY29tcG9uZW50LXdpc2UuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuZXhwb3J0IGNvbnN0IERFVEFJTE1PREVfTUFYID0gJ21heCc7XG5cbi8qKlxuICogTm8gZ2FtbWEgY29ycmVjdGlvbi5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgR0FNTUFfTk9ORSA9IDA7XG5cbi8qKlxuICogQXBwbHkgc1JHQiBnYW1tYSBjb3JyZWN0aW9uLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBHQU1NQV9TUkdCID0gMTtcblxuLyoqXG4gKiBBcHBseSBzUkdCIChmYXN0KSBnYW1tYSBjb3JyZWN0aW9uLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAZGVwcmVjYXRlZFxuICogQGlnbm9yZVxuICovXG5leHBvcnQgY29uc3QgR0FNTUFfU1JHQkZBU1QgPSAyOyAvLyBkZXByZWNhdGVkXG5cbi8qKlxuICogQXBwbHkgc1JHQiAoSERSKSBnYW1tYSBjb3JyZWN0aW9uLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBHQU1NQV9TUkdCSERSID0gMztcblxuLyoqXG4gKiBMaW5lYXIgdG9uZW1hcHBpbmcuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IFRPTkVNQVBfTElORUFSID0gMDtcblxuLyoqXG4gKiBGaWxtaWMgdG9uZW1hcHBpbmcgY3VydmUuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IFRPTkVNQVBfRklMTUlDID0gMTtcblxuLyoqXG4gKiBIZWpsIGZpbG1pYyB0b25lbWFwcGluZyBjdXJ2ZS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgVE9ORU1BUF9IRUpMID0gMjtcblxuLyoqXG4gKiBBQ0VTIGZpbG1pYyB0b25lbWFwcGluZyBjdXJ2ZS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgVE9ORU1BUF9BQ0VTID0gMztcblxuLyoqXG4gKiBBQ0VTIHYyIGZpbG1pYyB0b25lbWFwcGluZyBjdXJ2ZS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgVE9ORU1BUF9BQ0VTMiA9IDQ7XG5cbi8qKlxuICogTm8gc3BlY3VsYXIgb2NjbHVzaW9uLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBTUEVDT0NDX05PTkUgPSAwO1xuXG4vKipcbiAqIFVzZSBBTyBkaXJlY3RseSB0byBvY2NsdWRlIHNwZWN1bGFyLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBTUEVDT0NDX0FPID0gMTtcblxuLyoqXG4gKiBNb2RpZnkgQU8gYmFzZWQgb24gbWF0ZXJpYWwgZ2xvc3NpbmVzcy92aWV3IGFuZ2xlIHRvIG9jY2x1ZGUgc3BlY3VsYXIuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IFNQRUNPQ0NfR0xPU1NERVBFTkRFTlQgPSAyO1xuXG4vLyAxNiBiaXRzIGZvciBzaGFkZXIgZGVmc1xuZXhwb3J0IGNvbnN0IFNIQURFUkRFRl9OT1NIQURPVyA9IDE7XG5leHBvcnQgY29uc3QgU0hBREVSREVGX1NLSU4gPSAyO1xuZXhwb3J0IGNvbnN0IFNIQURFUkRFRl9VVjAgPSA0O1xuZXhwb3J0IGNvbnN0IFNIQURFUkRFRl9VVjEgPSA4O1xuZXhwb3J0IGNvbnN0IFNIQURFUkRFRl9WQ09MT1IgPSAxNjtcbmV4cG9ydCBjb25zdCBTSEFERVJERUZfSU5TVEFOQ0lORyA9IDMyO1xuZXhwb3J0IGNvbnN0IFNIQURFUkRFRl9MTSA9IDY0O1xuZXhwb3J0IGNvbnN0IFNIQURFUkRFRl9ESVJMTSA9IDEyODtcbmV4cG9ydCBjb25zdCBTSEFERVJERUZfU0NSRUVOU1BBQ0UgPSAyNTY7XG5leHBvcnQgY29uc3QgU0hBREVSREVGX1RBTkdFTlRTID0gNTEyO1xuZXhwb3J0IGNvbnN0IFNIQURFUkRFRl9NT1JQSF9QT1NJVElPTiA9IDEwMjQ7XG5leHBvcnQgY29uc3QgU0hBREVSREVGX01PUlBIX05PUk1BTCA9IDIwNDg7XG5leHBvcnQgY29uc3QgU0hBREVSREVGX01PUlBIX1RFWFRVUkVfQkFTRUQgPSA0MDk2O1xuZXhwb3J0IGNvbnN0IFNIQURFUkRFRl9MTUFNQklFTlQgPSA4MTkyOyAvLyBsaWdodG1hcHMgY29udGFpbiBhbWJpZW50XG5cbmV4cG9ydCBjb25zdCBMSU5FQkFUQ0hfV09STEQgPSAwO1xuZXhwb3J0IGNvbnN0IExJTkVCQVRDSF9PVkVSTEFZID0gMTtcbmV4cG9ydCBjb25zdCBMSU5FQkFUQ0hfR0laTU8gPSAyO1xuXG4vKipcbiAqIFRoZSBzaGFkb3cgbWFwIGlzIG5vdCB0byBiZSB1cGRhdGVkLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBTSEFET1dVUERBVEVfTk9ORSA9IDA7XG5cbi8qKlxuICogVGhlIHNoYWRvdyBtYXAgaXMgcmVnZW5lcmF0ZWQgdGhpcyBmcmFtZSBhbmQgbm90IG9uIHN1YnNlcXVlbnQgZnJhbWVzLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBTSEFET1dVUERBVEVfVEhJU0ZSQU1FID0gMTtcblxuLyoqXG4gKiBUaGUgc2hhZG93IG1hcCBpcyByZWdlbmVyYXRlZCBldmVyeSBmcmFtZS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgU0hBRE9XVVBEQVRFX1JFQUxUSU1FID0gMjtcblxuZXhwb3J0IGNvbnN0IFNPUlRLRVlfRk9SV0FSRCA9IDA7XG5leHBvcnQgY29uc3QgU09SVEtFWV9ERVBUSCA9IDE7XG5cbi8vIGZsYWdzIHVzZWQgb24gdGhlIG1hc2sgcHJvcGVydHkgb2YgdGhlIExpZ2h0LCBhbmQgYWxzbyBvbiBtYXNrIHByb3BlcnR5IG9mIHRoZSBNZXNoSW5zdGFuY2VcbmV4cG9ydCBjb25zdCBNQVNLX0FGRkVDVF9EWU5BTUlDID0gMTtcbmV4cG9ydCBjb25zdCBNQVNLX0FGRkVDVF9MSUdIVE1BUFBFRCA9IDI7XG5leHBvcnQgY29uc3QgTUFTS19CQUtFID0gNDtcblxuLyoqXG4gKiBSZW5kZXIgc2hhZGVkIG1hdGVyaWFscyB3aXRoIGdhbW1hIGNvcnJlY3Rpb24gYW5kIHRvbmVtYXBwaW5nLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBTSEFERVJfRk9SV0FSRCA9IDA7XG5cbi8qKlxuICogUmVuZGVyIHNoYWRlZCBtYXRlcmlhbHMgd2l0aG91dCBnYW1tYSBjb3JyZWN0aW9uIGFuZCB0b25lbWFwcGluZy5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgU0hBREVSX0ZPUldBUkRIRFIgPSAxO1xuXG4vKipcbiAqIFJlbmRlciBSR0JBLWVuY29kZWQgZGVwdGggdmFsdWUuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IFNIQURFUl9ERVBUSCA9IDI7XG5cbi8vIHNoYWRlciBwYXNzIHVzZWQgYnkgdGhlIFBpY2tlciBjbGFzcyB0byByZW5kZXIgbWVzaCBJRFxuZXhwb3J0IGNvbnN0IFNIQURFUl9QSUNLID0gMztcblxuLy8gc2hhZG93IHBhc3MgdXNlZCBieSB0aGUgc2hhZG93IHJlbmRlcmluZyBjb2RlXG5leHBvcnQgY29uc3QgU0hBREVSX1NIQURPVyA9IDQ7XG5cbi8qKlxuICogU2hhZGVyIHRoYXQgcGVyZm9ybXMgZm9yd2FyZCByZW5kZXJpbmcuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuZXhwb3J0IGNvbnN0IFNIQURFUlBBU1NfRk9SV0FSRCA9ICdmb3J3YXJkJztcblxuLyoqXG4gKiBTaGFkZXIgdXNlZCBmb3IgZGVidWcgcmVuZGVyaW5nIG9mIGFsYmVkby5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5leHBvcnQgY29uc3QgU0hBREVSUEFTU19BTEJFRE8gPSAnZGVidWdfYWxiZWRvJztcblxuLyoqXG4gKiBTaGFkZXIgdXNlZCBmb3IgZGVidWcgcmVuZGVyaW5nIG9mIHdvcmxkIG5vcm1hbC5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5leHBvcnQgY29uc3QgU0hBREVSUEFTU19XT1JMRE5PUk1BTCA9ICdkZWJ1Z193b3JsZF9ub3JtYWwnO1xuXG4vKipcbiAqIFNoYWRlciB1c2VkIGZvciBkZWJ1ZyByZW5kZXJpbmcgb2Ygb3BhY2l0eS5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5leHBvcnQgY29uc3QgU0hBREVSUEFTU19PUEFDSVRZID0gJ2RlYnVnX29wYWNpdHknO1xuXG4vKipcbiAqIFNoYWRlciB1c2VkIGZvciBkZWJ1ZyByZW5kZXJpbmcgb2Ygc3BlY3VsYXJpdHkuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuZXhwb3J0IGNvbnN0IFNIQURFUlBBU1NfU1BFQ1VMQVJJVFkgPSAnZGVidWdfc3BlY3VsYXJpdHknO1xuXG4vKipcbiAqIFNoYWRlciB1c2VkIGZvciBkZWJ1ZyByZW5kZXJpbmcgb2YgZ2xvc3MuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuZXhwb3J0IGNvbnN0IFNIQURFUlBBU1NfR0xPU1MgPSAnZGVidWdfZ2xvc3MnO1xuXG4vKipcbiAqIFNoYWRlciB1c2VkIGZvciBkZWJ1ZyByZW5kZXJpbmcgb2YgbWV0YWxuZXNzLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbmV4cG9ydCBjb25zdCBTSEFERVJQQVNTX01FVEFMTkVTUyA9ICdkZWJ1Z19tZXRhbG5lc3MnO1xuXG4vKipcbiAqIFNoYWRlciB1c2VkIGZvciBkZWJ1ZyByZW5kZXJpbmcgb2YgYW8uXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuZXhwb3J0IGNvbnN0IFNIQURFUlBBU1NfQU8gPSAnZGVidWdfYW8nO1xuXG4vKipcbiAqIFNoYWRlciB1c2VkIGZvciBkZWJ1ZyByZW5kZXJpbmcgb2YgZW1pc3Npb24uXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuZXhwb3J0IGNvbnN0IFNIQURFUlBBU1NfRU1JU1NJT04gPSAnZGVidWdfZW1pc3Npb24nO1xuXG4vKipcbiAqIFNoYWRlciB1c2VkIGZvciBkZWJ1ZyByZW5kZXJpbmcgb2YgbGlnaHRpbmcuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuZXhwb3J0IGNvbnN0IFNIQURFUlBBU1NfTElHSFRJTkcgPSAnZGVidWdfbGlnaHRpbmcnO1xuXG4vKipcbiAqIFNoYWRlciB1c2VkIGZvciBkZWJ1ZyByZW5kZXJpbmcgb2YgVVYwIHRleHR1cmUgY29vcmRpbmF0ZXMuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuZXhwb3J0IGNvbnN0IFNIQURFUlBBU1NfVVYwID0gJ2RlYnVnX3V2MCc7XG5cbi8qKlxuICogVGhpcyBtb2RlIHJlbmRlcnMgYSBzcHJpdGUgYXMgYSBzaW1wbGUgcXVhZC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgU1BSSVRFX1JFTkRFUk1PREVfU0lNUExFID0gMDtcblxuLyoqXG4gKiBUaGlzIG1vZGUgcmVuZGVycyBhIHNwcml0ZSB1c2luZyA5LXNsaWNpbmcgaW4gJ3NsaWNlZCcgbW9kZS4gU2xpY2VkIG1vZGUgc3RyZXRjaGVzIHRoZSB0b3AgYW5kXG4gKiBib3R0b20gcmVnaW9ucyBvZiB0aGUgc3ByaXRlIGhvcml6b250YWxseSwgdGhlIGxlZnQgYW5kIHJpZ2h0IHJlZ2lvbnMgdmVydGljYWxseSBhbmQgdGhlIG1pZGRsZVxuICogcmVnaW9uIGJvdGggaG9yaXpvbnRhbGx5IGFuZCB2ZXJ0aWNhbGx5LlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBTUFJJVEVfUkVOREVSTU9ERV9TTElDRUQgPSAxO1xuXG4vKipcbiAqIFRoaXMgbW9kZSByZW5kZXJzIGEgc3ByaXRlIHVzaW5nIDktc2xpY2luZyBpbiAndGlsZWQnIG1vZGUuIFRpbGVkIG1vZGUgdGlsZXMgdGhlIHRvcCBhbmQgYm90dG9tXG4gKiByZWdpb25zIG9mIHRoZSBzcHJpdGUgaG9yaXpvbnRhbGx5LCB0aGUgbGVmdCBhbmQgcmlnaHQgcmVnaW9ucyB2ZXJ0aWNhbGx5IGFuZCB0aGUgbWlkZGxlIHJlZ2lvblxuICogYm90aCBob3Jpem9udGFsbHkgYW5kIHZlcnRpY2FsbHkuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IFNQUklURV9SRU5ERVJNT0RFX1RJTEVEID0gMjtcblxuLyoqXG4gKiBTaW5nbGUgY29sb3IgbGlnaHRtYXAuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IEJBS0VfQ09MT1IgPSAwO1xuXG4vKipcbiAqIFNpbmdsZSBjb2xvciBsaWdodG1hcCArIGRvbWluYW50IGxpZ2h0IGRpcmVjdGlvbiAodXNlZCBmb3IgYnVtcC9zcGVjdWxhcikuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IEJBS0VfQ09MT1JESVIgPSAxO1xuXG4vKipcbiAqIENlbnRlciBvZiB2aWV3LlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBWSUVXX0NFTlRFUiA9IDA7XG5cbi8qKlxuICogTGVmdCBvZiB2aWV3LiBPbmx5IHVzZWQgaW4gc3RlcmVvIHJlbmRlcmluZy5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgVklFV19MRUZUID0gMTtcblxuLyoqXG4gKiBSaWdodCBvZiB2aWV3LiBPbmx5IHVzZWQgaW4gc3RlcmVvIHJlbmRlcmluZy5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgVklFV19SSUdIVCA9IDI7XG5cbi8qKlxuICogTm8gc29ydGluZyBpcyBhcHBsaWVkLiBNZXNoIGluc3RhbmNlcyBhcmUgcmVuZGVyZWQgaW4gdGhlIHNhbWUgb3JkZXIgdGhleSB3ZXJlIGFkZGVkIHRvIGEgbGF5ZXIuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IFNPUlRNT0RFX05PTkUgPSAwO1xuXG4vKipcbiAqIE1lc2ggaW5zdGFuY2VzIGFyZSBzb3J0ZWQgYmFzZWQgb24ge0BsaW5rIE1lc2hJbnN0YW5jZSNkcmF3T3JkZXJ9LlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBTT1JUTU9ERV9NQU5VQUwgPSAxO1xuXG4vKipcbiAqIE1lc2ggaW5zdGFuY2VzIGFyZSBzb3J0ZWQgdG8gbWluaW1pemUgc3dpdGNoaW5nIGJldHdlZW4gbWF0ZXJpYWxzIGFuZCBtZXNoZXMgdG8gaW1wcm92ZVxuICogcmVuZGVyaW5nIHBlcmZvcm1hbmNlLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBTT1JUTU9ERV9NQVRFUklBTE1FU0ggPSAyO1xuXG4vKipcbiAqIE1lc2ggaW5zdGFuY2VzIGFyZSBzb3J0ZWQgYmFjayB0byBmcm9udC4gVGhpcyBpcyB0aGUgd2F5IHRvIHByb3Blcmx5IHJlbmRlciBtYW55XG4gKiBzZW1pLXRyYW5zcGFyZW50IG9iamVjdHMgb24gZGlmZmVyZW50IGRlcHRoLCBvbmUgaXMgYmxlbmRlZCBvbiB0b3Agb2YgYW5vdGhlci5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgU09SVE1PREVfQkFDSzJGUk9OVCA9IDM7XG5cbi8qKlxuICogTWVzaCBpbnN0YW5jZXMgYXJlIHNvcnRlZCBmcm9udCB0byBiYWNrLiBEZXBlbmRpbmcgb24gR1BVIGFuZCB0aGUgc2NlbmUsIHRoaXMgb3B0aW9uIG1heSBnaXZlXG4gKiBiZXR0ZXIgcGVyZm9ybWFuY2UgdGhhbiB7QGxpbmsgU09SVE1PREVfTUFURVJJQUxNRVNIfSBkdWUgdG8gcmVkdWNlZCBvdmVyZHJhdy5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgU09SVE1PREVfRlJPTlQyQkFDSyA9IDQ7XG5cbi8qKlxuICogUHJvdmlkZSBjdXN0b20gZnVuY3Rpb25zIGZvciBzb3J0aW5nIGRyYXdjYWxscyBhbmQgY2FsY3VsYXRpbmcgZGlzdGFuY2UuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBpZ25vcmVcbiAqL1xuZXhwb3J0IGNvbnN0IFNPUlRNT0RFX0NVU1RPTSA9IDU7XG5cbmV4cG9ydCBjb25zdCBDT01QVVBEQVRFRF9JTlNUQU5DRVMgPSAxO1xuZXhwb3J0IGNvbnN0IENPTVBVUERBVEVEX0xJR0hUUyA9IDI7XG5leHBvcnQgY29uc3QgQ09NUFVQREFURURfQ0FNRVJBUyA9IDQ7XG5leHBvcnQgY29uc3QgQ09NUFVQREFURURfQkxFTkQgPSA4O1xuXG4vKipcbiAqIEF1dG9tYXRpY2FsbHkgc2V0IGFzcGVjdCByYXRpbyB0byBjdXJyZW50IHJlbmRlciB0YXJnZXQncyB3aWR0aCBkaXZpZGVkIGJ5IGhlaWdodC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgQVNQRUNUX0FVVE8gPSAwO1xuXG4vKipcbiAqIFVzZSB0aGUgbWFudWFsIGFzcGVjdCByYXRpbyB2YWx1ZS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgQVNQRUNUX01BTlVBTCA9IDE7XG5cbi8qKlxuICogSG9yaXpvbnRhbCBvcmllbnRhdGlvbi5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgT1JJRU5UQVRJT05fSE9SSVpPTlRBTCA9IDA7XG5cbi8qKlxuICogVmVydGljYWwgb3JpZW50YXRpb24uXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IE9SSUVOVEFUSU9OX1ZFUlRJQ0FMID0gMTtcbiJdLCJuYW1lcyI6WyJCTEVORF9TVUJUUkFDVElWRSIsIkJMRU5EX0FERElUSVZFIiwiQkxFTkRfTk9STUFMIiwiQkxFTkRfTk9ORSIsIkJMRU5EX1BSRU1VTFRJUExJRUQiLCJCTEVORF9NVUxUSVBMSUNBVElWRSIsIkJMRU5EX0FERElUSVZFQUxQSEEiLCJCTEVORF9NVUxUSVBMSUNBVElWRTJYIiwiQkxFTkRfU0NSRUVOIiwiQkxFTkRfTUlOIiwiQkxFTkRfTUFYIiwiRk9HX05PTkUiLCJGT0dfTElORUFSIiwiRk9HX0VYUCIsIkZPR19FWFAyIiwiRlJFU05FTF9OT05FIiwiRlJFU05FTF9TQ0hMSUNLIiwiTEFZRVJfSFVEIiwiTEFZRVJfR0laTU8iLCJMQVlFUl9GWCIsIkxBWUVSX1dPUkxEIiwiTEFZRVJJRF9XT1JMRCIsIkxBWUVSSURfREVQVEgiLCJMQVlFUklEX1NLWUJPWCIsIkxBWUVSSURfSU1NRURJQVRFIiwiTEFZRVJJRF9VSSIsIkxJR0hUVFlQRV9ESVJFQ1RJT05BTCIsIkxJR0hUVFlQRV9PTU5JIiwiTElHSFRUWVBFX1BPSU5UIiwiTElHSFRUWVBFX1NQT1QiLCJMSUdIVFRZUEVfQ09VTlQiLCJMSUdIVFNIQVBFX1BVTkNUVUFMIiwiTElHSFRTSEFQRV9SRUNUIiwiTElHSFRTSEFQRV9ESVNLIiwiTElHSFRTSEFQRV9TUEhFUkUiLCJMSUdIVEZBTExPRkZfTElORUFSIiwiTElHSFRGQUxMT0ZGX0lOVkVSU0VTUVVBUkVEIiwiU0hBRE9XX1BDRjMiLCJTSEFET1dfREVQVEgiLCJTSEFET1dfVlNNOCIsIlNIQURPV19WU00xNiIsIlNIQURPV19WU00zMiIsIlNIQURPV19QQ0Y1IiwiU0hBRE9XX1BDRjEiLCJTSEFET1dfQ09VTlQiLCJzaGFkb3dUeXBlVG9TdHJpbmciLCJCTFVSX0JPWCIsIkJMVVJfR0FVU1NJQU4iLCJQQVJUSUNMRVNPUlRfTk9ORSIsIlBBUlRJQ0xFU09SVF9ESVNUQU5DRSIsIlBBUlRJQ0xFU09SVF9ORVdFUl9GSVJTVCIsIlBBUlRJQ0xFU09SVF9PTERFUl9GSVJTVCIsIlBBUlRJQ0xFTU9ERV9HUFUiLCJQQVJUSUNMRU1PREVfQ1BVIiwiRU1JVFRFUlNIQVBFX0JPWCIsIkVNSVRURVJTSEFQRV9TUEhFUkUiLCJQQVJUSUNMRU9SSUVOVEFUSU9OX1NDUkVFTiIsIlBBUlRJQ0xFT1JJRU5UQVRJT05fV09STEQiLCJQQVJUSUNMRU9SSUVOVEFUSU9OX0VNSVRURVIiLCJQUk9KRUNUSU9OX1BFUlNQRUNUSVZFIiwiUFJPSkVDVElPTl9PUlRIT0dSQVBISUMiLCJSRU5ERVJTVFlMRV9TT0xJRCIsIlJFTkRFUlNUWUxFX1dJUkVGUkFNRSIsIlJFTkRFUlNUWUxFX1BPSU5UUyIsIkNVQkVQUk9KX05PTkUiLCJDVUJFUFJPSl9CT1giLCJTUEVDVUxBUl9QSE9ORyIsIlNQRUNVTEFSX0JMSU5OIiwiREVUQUlMTU9ERV9NVUwiLCJERVRBSUxNT0RFX0FERCIsIkRFVEFJTE1PREVfU0NSRUVOIiwiREVUQUlMTU9ERV9PVkVSTEFZIiwiREVUQUlMTU9ERV9NSU4iLCJERVRBSUxNT0RFX01BWCIsIkdBTU1BX05PTkUiLCJHQU1NQV9TUkdCIiwiR0FNTUFfU1JHQkZBU1QiLCJHQU1NQV9TUkdCSERSIiwiVE9ORU1BUF9MSU5FQVIiLCJUT05FTUFQX0ZJTE1JQyIsIlRPTkVNQVBfSEVKTCIsIlRPTkVNQVBfQUNFUyIsIlRPTkVNQVBfQUNFUzIiLCJTUEVDT0NDX05PTkUiLCJTUEVDT0NDX0FPIiwiU1BFQ09DQ19HTE9TU0RFUEVOREVOVCIsIlNIQURFUkRFRl9OT1NIQURPVyIsIlNIQURFUkRFRl9TS0lOIiwiU0hBREVSREVGX1VWMCIsIlNIQURFUkRFRl9VVjEiLCJTSEFERVJERUZfVkNPTE9SIiwiU0hBREVSREVGX0lOU1RBTkNJTkciLCJTSEFERVJERUZfTE0iLCJTSEFERVJERUZfRElSTE0iLCJTSEFERVJERUZfU0NSRUVOU1BBQ0UiLCJTSEFERVJERUZfVEFOR0VOVFMiLCJTSEFERVJERUZfTU9SUEhfUE9TSVRJT04iLCJTSEFERVJERUZfTU9SUEhfTk9STUFMIiwiU0hBREVSREVGX01PUlBIX1RFWFRVUkVfQkFTRUQiLCJTSEFERVJERUZfTE1BTUJJRU5UIiwiTElORUJBVENIX1dPUkxEIiwiTElORUJBVENIX09WRVJMQVkiLCJMSU5FQkFUQ0hfR0laTU8iLCJTSEFET1dVUERBVEVfTk9ORSIsIlNIQURPV1VQREFURV9USElTRlJBTUUiLCJTSEFET1dVUERBVEVfUkVBTFRJTUUiLCJTT1JUS0VZX0ZPUldBUkQiLCJTT1JUS0VZX0RFUFRIIiwiTUFTS19BRkZFQ1RfRFlOQU1JQyIsIk1BU0tfQUZGRUNUX0xJR0hUTUFQUEVEIiwiTUFTS19CQUtFIiwiU0hBREVSX0ZPUldBUkQiLCJTSEFERVJfRk9SV0FSREhEUiIsIlNIQURFUl9ERVBUSCIsIlNIQURFUl9QSUNLIiwiU0hBREVSX1NIQURPVyIsIlNIQURFUlBBU1NfRk9SV0FSRCIsIlNIQURFUlBBU1NfQUxCRURPIiwiU0hBREVSUEFTU19XT1JMRE5PUk1BTCIsIlNIQURFUlBBU1NfT1BBQ0lUWSIsIlNIQURFUlBBU1NfU1BFQ1VMQVJJVFkiLCJTSEFERVJQQVNTX0dMT1NTIiwiU0hBREVSUEFTU19NRVRBTE5FU1MiLCJTSEFERVJQQVNTX0FPIiwiU0hBREVSUEFTU19FTUlTU0lPTiIsIlNIQURFUlBBU1NfTElHSFRJTkciLCJTSEFERVJQQVNTX1VWMCIsIlNQUklURV9SRU5ERVJNT0RFX1NJTVBMRSIsIlNQUklURV9SRU5ERVJNT0RFX1NMSUNFRCIsIlNQUklURV9SRU5ERVJNT0RFX1RJTEVEIiwiQkFLRV9DT0xPUiIsIkJBS0VfQ09MT1JESVIiLCJWSUVXX0NFTlRFUiIsIlZJRVdfTEVGVCIsIlZJRVdfUklHSFQiLCJTT1JUTU9ERV9OT05FIiwiU09SVE1PREVfTUFOVUFMIiwiU09SVE1PREVfTUFURVJJQUxNRVNIIiwiU09SVE1PREVfQkFDSzJGUk9OVCIsIlNPUlRNT0RFX0ZST05UMkJBQ0siLCJTT1JUTU9ERV9DVVNUT00iLCJDT01QVVBEQVRFRF9JTlNUQU5DRVMiLCJDT01QVVBEQVRFRF9MSUdIVFMiLCJDT01QVVBEQVRFRF9DQU1FUkFTIiwiQ09NUFVQREFURURfQkxFTkQiLCJBU1BFQ1RfQVVUTyIsIkFTUEVDVF9NQU5VQUwiLCJPUklFTlRBVElPTl9IT1JJWk9OVEFMIiwiT1JJRU5UQVRJT05fVkVSVElDQUwiXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1BLGlCQUFpQixHQUFHLEVBQUM7O0FBRWxDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLGNBQWMsR0FBRyxFQUFDOztBQUUvQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLFlBQVksR0FBRyxFQUFDOztBQUU3QjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsVUFBVSxHQUFHLEVBQUM7O0FBRTNCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLG1CQUFtQixHQUFHLEVBQUM7O0FBRXBDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLG9CQUFvQixHQUFHLEVBQUM7O0FBRXJDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxtQkFBbUIsR0FBRyxFQUFDOztBQUVwQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsc0JBQXNCLEdBQUcsRUFBQzs7QUFFdkM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLFlBQVksR0FBRyxFQUFDOztBQUU3QjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsU0FBUyxHQUFHLEVBQUM7O0FBRTFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxTQUFTLEdBQUcsR0FBRTs7QUFFM0I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLFFBQVEsR0FBRyxPQUFNOztBQUU5QjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsVUFBVSxHQUFHLFNBQVE7O0FBRWxDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxPQUFPLEdBQUcsTUFBSzs7QUFFNUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLFFBQVEsR0FBRyxPQUFNOztBQUU5QjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsWUFBWSxHQUFHLEVBQUM7O0FBRTdCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxlQUFlLEdBQUcsRUFBQzs7QUFFaEM7QUFDTyxNQUFNQyxTQUFTLEdBQUcsRUFBQztBQUNuQixNQUFNQyxXQUFXLEdBQUcsRUFBQztBQUNyQixNQUFNQyxRQUFRLEdBQUcsRUFBQztBQUN6QjtBQUNPLE1BQU1DLFdBQVcsR0FBRyxHQUFFOztBQUU3QjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxhQUFhLEdBQUcsRUFBQzs7QUFFOUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLGFBQWEsR0FBRyxFQUFDOztBQUU5QjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsY0FBYyxHQUFHLEVBQUM7O0FBRS9CO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxpQkFBaUIsR0FBRyxFQUFDOztBQUVsQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsVUFBVSxHQUFHLEVBQUM7O0FBRTNCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxxQkFBcUIsR0FBRyxFQUFDOztBQUV0QztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsY0FBYyxHQUFHLEVBQUM7O0FBRS9CO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLGVBQWUsR0FBR0QsZUFBYzs7QUFFN0M7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1FLGNBQWMsR0FBRyxFQUFDOztBQUUvQjtBQUNPLE1BQU1DLGVBQWUsR0FBRyxFQUFDOztBQUVoQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsbUJBQW1CLEdBQUcsRUFBQzs7QUFFcEM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLGVBQWUsR0FBRyxFQUFDOztBQUVoQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsZUFBZSxHQUFHLEVBQUM7O0FBRWhDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxpQkFBaUIsR0FBRyxFQUFDOztBQUVsQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsbUJBQW1CLEdBQUcsRUFBQzs7QUFFcEM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLDJCQUEyQixHQUFHLEVBQUM7O0FBRTVDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxXQUFXLEdBQUcsRUFBQztBQUNmQyxNQUFBQSxZQUFZLEdBQUcsRUFBRTs7QUFFOUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsV0FBVyxHQUFHLEVBQUM7O0FBRTVCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLFlBQVksR0FBRyxFQUFDOztBQUU3QjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxZQUFZLEdBQUcsRUFBQzs7QUFFN0I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsV0FBVyxHQUFHLEVBQUM7O0FBRTVCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxXQUFXLEdBQUcsRUFBQzs7QUFFNUI7QUFDTyxNQUFNQyxZQUFZLEdBQUcsRUFBQzs7QUFFN0I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ2FDLE1BQUFBLGtCQUFrQixHQUFHLEdBQUU7QUFDcENBLGtCQUFrQixDQUFDUixXQUFXLENBQUMsR0FBRyxNQUFNLENBQUE7QUFDeENRLGtCQUFrQixDQUFDTixXQUFXLENBQUMsR0FBRyxNQUFNLENBQUE7QUFDeENNLGtCQUFrQixDQUFDTCxZQUFZLENBQUMsR0FBRyxPQUFPLENBQUE7QUFDMUNLLGtCQUFrQixDQUFDSixZQUFZLENBQUMsR0FBRyxPQUFPLENBQUE7QUFDMUNJLGtCQUFrQixDQUFDSCxXQUFXLENBQUMsR0FBRyxNQUFNLENBQUE7QUFDeENHLGtCQUFrQixDQUFDRixXQUFXLENBQUMsR0FBRyxNQUFNLENBQUE7O0FBRXhDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNRyxRQUFRLEdBQUcsRUFBQzs7QUFFekI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLGFBQWEsR0FBRyxFQUFDOztBQUU5QjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsaUJBQWlCLEdBQUcsRUFBQzs7QUFFbEM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLHFCQUFxQixHQUFHLEVBQUM7O0FBRXRDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyx3QkFBd0IsR0FBRyxFQUFDOztBQUV6QztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsd0JBQXdCLEdBQUcsRUFBQztBQUVsQyxNQUFNQyxnQkFBZ0IsR0FBRyxFQUFDO0FBQzFCLE1BQU1DLGdCQUFnQixHQUFHLEVBQUM7O0FBRWpDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxnQkFBZ0IsR0FBRyxFQUFDOztBQUVqQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxtQkFBbUIsR0FBRyxFQUFDOztBQUVwQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsMEJBQTBCLEdBQUcsRUFBQzs7QUFFM0M7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLHlCQUF5QixHQUFHLEVBQUM7O0FBRTFDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQywyQkFBMkIsR0FBRyxFQUFDOztBQUU1QztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsc0JBQXNCLEdBQUcsRUFBQzs7QUFFdkM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLHVCQUF1QixHQUFHLEVBQUM7O0FBRXhDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxpQkFBaUIsR0FBRyxFQUFDOztBQUVsQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMscUJBQXFCLEdBQUcsRUFBQzs7QUFFdEM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLGtCQUFrQixHQUFHLEVBQUM7O0FBRW5DO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxhQUFhLEdBQUcsRUFBQzs7QUFFOUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLFlBQVksR0FBRyxFQUFDOztBQUU3QjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxjQUFjLEdBQUcsRUFBQzs7QUFFL0I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLGNBQWMsR0FBRyxFQUFDOztBQUUvQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsY0FBYyxHQUFHLE1BQUs7O0FBRW5DO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxjQUFjLEdBQUcsTUFBSzs7QUFFbkM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLGlCQUFpQixHQUFHLFNBQVE7O0FBRXpDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxrQkFBa0IsR0FBRyxVQUFTOztBQUUzQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsY0FBYyxHQUFHLE1BQUs7O0FBRW5DO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxjQUFjLEdBQUcsTUFBSzs7QUFFbkM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLFVBQVUsR0FBRyxFQUFDOztBQUUzQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsVUFBVSxHQUFHLEVBQUM7O0FBRTNCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ2FDLE1BQUFBLGNBQWMsR0FBRyxFQUFFOztBQUVoQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsYUFBYSxHQUFHLEVBQUM7O0FBRTlCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxjQUFjLEdBQUcsRUFBQzs7QUFFL0I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLGNBQWMsR0FBRyxFQUFDOztBQUUvQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsWUFBWSxHQUFHLEVBQUM7O0FBRTdCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxZQUFZLEdBQUcsRUFBQzs7QUFFN0I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLGFBQWEsR0FBRyxFQUFDOztBQUU5QjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsWUFBWSxHQUFHLEVBQUM7O0FBRTdCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxVQUFVLEdBQUcsRUFBQzs7QUFFM0I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLHNCQUFzQixHQUFHLEVBQUM7O0FBRXZDO0FBQ08sTUFBTUMsa0JBQWtCLEdBQUcsRUFBQztBQUM1QixNQUFNQyxjQUFjLEdBQUcsRUFBQztBQUN4QixNQUFNQyxhQUFhLEdBQUcsRUFBQztBQUN2QixNQUFNQyxhQUFhLEdBQUcsRUFBQztBQUN2QixNQUFNQyxnQkFBZ0IsR0FBRyxHQUFFO0FBQzNCLE1BQU1DLG9CQUFvQixHQUFHLEdBQUU7QUFDL0IsTUFBTUMsWUFBWSxHQUFHLEdBQUU7QUFDdkIsTUFBTUMsZUFBZSxHQUFHLElBQUc7QUFDM0IsTUFBTUMscUJBQXFCLEdBQUcsSUFBRztBQUNqQyxNQUFNQyxrQkFBa0IsR0FBRyxJQUFHO0FBQzlCLE1BQU1DLHdCQUF3QixHQUFHLEtBQUk7QUFDckMsTUFBTUMsc0JBQXNCLEdBQUcsS0FBSTtBQUNuQyxNQUFNQyw2QkFBNkIsR0FBRyxLQUFJO0FBQ3BDQyxNQUFBQSxtQkFBbUIsR0FBRyxLQUFLOztBQUVqQyxNQUFNQyxlQUFlLEdBQUcsRUFBQztBQUN6QixNQUFNQyxpQkFBaUIsR0FBRyxFQUFDO0FBQzNCLE1BQU1DLGVBQWUsR0FBRyxFQUFDOztBQUVoQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsaUJBQWlCLEdBQUcsRUFBQzs7QUFFbEM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLHNCQUFzQixHQUFHLEVBQUM7O0FBRXZDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxxQkFBcUIsR0FBRyxFQUFDO0FBRS9CLE1BQU1DLGVBQWUsR0FBRyxFQUFDO0FBQ3pCLE1BQU1DLGFBQWEsR0FBRyxFQUFDOztBQUU5QjtBQUNPLE1BQU1DLG1CQUFtQixHQUFHLEVBQUM7QUFDN0IsTUFBTUMsdUJBQXVCLEdBQUcsRUFBQztBQUNqQyxNQUFNQyxTQUFTLEdBQUcsRUFBQzs7QUFFMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLGNBQWMsR0FBRyxFQUFDOztBQUUvQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsaUJBQWlCLEdBQUcsRUFBQzs7QUFFbEM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLFlBQVksR0FBRyxFQUFDOztBQUU3QjtBQUNPLE1BQU1DLFdBQVcsR0FBRyxFQUFDOztBQUU1QjtBQUNPLE1BQU1DLGFBQWEsR0FBRyxFQUFDOztBQUU5QjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsa0JBQWtCLEdBQUcsVUFBUzs7QUFFM0M7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLGlCQUFpQixHQUFHLGVBQWM7O0FBRS9DO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxzQkFBc0IsR0FBRyxxQkFBb0I7O0FBRTFEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxrQkFBa0IsR0FBRyxnQkFBZTs7QUFFakQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLHNCQUFzQixHQUFHLG9CQUFtQjs7QUFFekQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLGdCQUFnQixHQUFHLGNBQWE7O0FBRTdDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxvQkFBb0IsR0FBRyxrQkFBaUI7O0FBRXJEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxhQUFhLEdBQUcsV0FBVTs7QUFFdkM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLG1CQUFtQixHQUFHLGlCQUFnQjs7QUFFbkQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLG1CQUFtQixHQUFHLGlCQUFnQjs7QUFFbkQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLGNBQWMsR0FBRyxZQUFXOztBQUV6QztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsd0JBQXdCLEdBQUcsRUFBQzs7QUFFekM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyx3QkFBd0IsR0FBRyxFQUFDOztBQUV6QztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLHVCQUF1QixHQUFHLEVBQUM7O0FBRXhDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxVQUFVLEdBQUcsRUFBQzs7QUFFM0I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLGFBQWEsR0FBRyxFQUFDOztBQUU5QjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsV0FBVyxHQUFHLEVBQUM7O0FBRTVCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxTQUFTLEdBQUcsRUFBQzs7QUFFMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLFVBQVUsR0FBRyxFQUFDOztBQUUzQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsYUFBYSxHQUFHLEVBQUM7O0FBRTlCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxlQUFlLEdBQUcsRUFBQzs7QUFFaEM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMscUJBQXFCLEdBQUcsRUFBQzs7QUFFdEM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsbUJBQW1CLEdBQUcsRUFBQzs7QUFFcEM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsbUJBQW1CLEdBQUcsRUFBQzs7QUFFcEM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsZUFBZSxHQUFHLEVBQUM7QUFFekIsTUFBTUMscUJBQXFCLEdBQUcsRUFBQztBQUMvQixNQUFNQyxrQkFBa0IsR0FBRyxFQUFDO0FBQzVCLE1BQU1DLG1CQUFtQixHQUFHLEVBQUM7QUFDN0IsTUFBTUMsaUJBQWlCLEdBQUcsRUFBQzs7QUFFbEM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLFdBQVcsR0FBRyxFQUFDOztBQUU1QjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsYUFBYSxHQUFHLEVBQUM7O0FBRTlCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxzQkFBc0IsR0FBRyxFQUFDOztBQUV2QztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsb0JBQW9CLEdBQUc7Ozs7In0=
