import { BLEND_NONE, DITHER_NONE, FOG_NONE, GAMMA_NONE } from '../../constants.js';

/**
 * The lit shader options determines how the lit-shader gets generated. It specifies a set of
 * parameters which triggers different fragment and vertex shader generation in the backend.
 *
 * @category Graphics
 */
class LitShaderOptions {
  constructor() {
    this.hasTangents = false;
    /**
     * Object containing custom shader chunks that will replace default ones.
     *
     * @type {Object<string, string>}
     */
    this.chunks = {};
    // one of the SHADER_ constants
    this.pass = 0;
    /**
     * Enable alpha testing. See {@link Material#alphaTest}.
     *
     * @type {boolean}
     */
    this.alphaTest = false;
    /**
     * The value of {@link Material#blendType}.
     *
     * @type {number}
     */
    this.blendType = BLEND_NONE;
    this.separateAmbient = false;
    this.screenSpace = false;
    this.skin = false;
    /**
     * If hardware instancing compatible shader should be generated. Transform is read from
     * per-instance {@link VertexBuffer} instead of shader's uniforms.
     *
     * @type {boolean}
     */
    this.useInstancing = false;
    /**
     * If morphing code should be generated to morph positions.
     *
     * @type {boolean}
     */
    this.useMorphPosition = false;
    /**
     * If morphing code should be generated to morph normals.
     *
     * @type {boolean}
     */
    this.useMorphNormal = false;
    this.useMorphTextureBased = false;
    this.nineSlicedMode = 0;
    this.clusteredLightingEnabled = true;
    this.clusteredLightingCookiesEnabled = false;
    this.clusteredLightingShadowsEnabled = false;
    this.clusteredLightingShadowType = 0;
    this.clusteredLightingAreaLightsEnabled = false;
    this.vertexColors = false;
    this.lightMapEnabled = false;
    this.dirLightMapEnabled = false;
    this.useHeights = false;
    this.useNormals = false;
    this.useClearCoatNormals = false;
    this.useAo = false;
    this.diffuseMapEnabled = false;
    this.useAmbientTint = false;
    /**
     * Replaced the whole fragment shader with this string.
     *
     * @type {string}
     */
    this.customFragmentShader = null;
    this.pixelSnap = false;
    /**
     * The value of {@link StandardMaterial#shadingModel}.
     *
     * @type {number}
     */
    this.shadingModel = 0;
    /**
     * If ambient spherical harmonics are used. Ambient SH replace prefiltered cubemap ambient on
     * certain platforms (mostly Android) for performance reasons.
     *
     * @type {boolean}
     */
    this.ambientSH = false;
    /**
     * Use slightly cheaper normal mapping code (skip tangent space normalization). Can look buggy
     * sometimes.
     *
     * @type {boolean}
     */
    this.fastTbn = false;
    /**
     * The value of {@link StandardMaterial#twoSidedLighting}.
     *
     * @type {boolean}
     */
    this.twoSidedLighting = false;
    /**
     * The value of {@link StandardMaterial#occludeDirect}.
     *
     * @type {boolean}
     */
    this.occludeDirect = false;
    /**
     * The value of {@link StandardMaterial#occludeSpecular}.
     *
     * @type {number}
     */
    this.occludeSpecular = 0;
    /**
     * Defines if {@link StandardMaterial#occludeSpecularIntensity} constant should affect specular
     * occlusion.
     *
     * @type {boolean}
     */
    this.occludeSpecularFloat = false;
    this.useMsdf = false;
    this.msdfTextAttribute = false;
    /**
     * Enable alpha to coverage. See {@link Material#alphaToCoverage}.
     *
     * @type {boolean}
     */
    this.alphaToCoverage = false;
    /**
     * Enable specular fade. See {@link StandardMaterial#opacityFadesSpecular}.
     *
     * @type {boolean}
     */
    this.opacityFadesSpecular = false;
    /**
     * Enable opacity dithering. See {@link StandardMaterial#opacityDither}.
     *
     * @type {string}
     */
    this.opacityDither = DITHER_NONE;
    /**
     * Enable opacity shadow dithering. See {@link StandardMaterial#opacityShadowDither}.
     *
     * @type {string}
     */
    this.opacityShadowDither = DITHER_NONE;
    /**
     * The value of {@link StandardMaterial#cubeMapProjection}.
     *
     * @type {number}
     */
    this.cubeMapProjection = 0;
    /**
     * The value of {@link StandardMaterial#conserveEnergy}.
     *
     * @type {boolean}
     */
    this.conserveEnergy = false;
    /**
     * If any specular or reflections are needed at all.
     *
     * @type {boolean}
     */
    this.useSpecular = false;
    this.useSpecularityFactor = false;
    this.enableGGXSpecular = false;
    /**
     * The value of {@link StandardMaterial#fresnelModel}.
     *
     * @type {number}
     */
    this.fresnelModel = 0;
    /**
     * If refraction is used.
     *
     * @type {boolean}
     */
    this.useRefraction = false;
    this.useClearCoat = false;
    this.useSheen = false;
    this.useIridescence = false;
    /**
     * The value of {@link StandardMaterial#useMetalness}.
     *
     * @type {boolean}
     */
    this.useMetalness = false;
    this.useDynamicRefraction = false;
    this.dispersion = false;
    /**
     * The type of fog being applied in the shader. See {@link Scene#fog} for the list of possible
     * values.
     *
     * @type {string}
     */
    this.fog = FOG_NONE;
    /**
     * The type of gamma correction being applied in the shader. See {@link Scene#gammaCorrection}
     * for the list of possible values.
     *
     * @type {number}
     */
    this.gamma = GAMMA_NONE;
    /**
     * The type of tone mapping being applied in the shader. See {@link Scene#toneMapping} for the
     * list of possible values.
     *
     * @type {number}
     */
    this.toneMap = -1;
    /**
     * If cubemaps require seam fixing (see the `fixCubemapSeams` property of the options object
     * passed to the {@link Texture} constructor).
     *
     * @type {boolean}
     */
    this.fixSeams = false;
    /**
     * One of "envAtlasHQ", "envAtlas", "cubeMap", "sphereMap".
     *
     * @type {string}
     */
    this.reflectionSource = null;
    this.reflectionEncoding = null;
    this.reflectionCubemapEncoding = null;
    /**
     * One of "ambientSH", "envAtlas", "constant".
     *
     * @type {string}
     */
    this.ambientSource = 'constant';
    this.ambientEncoding = null;
    // TODO: add a test for if non skybox cubemaps have rotation (when this is supported) - for now
    // assume no non-skybox cubemap rotation
    /**
     * Skybox intensity factor.
     *
     * @type {number}
     */
    this.skyboxIntensity = 1.0;
    /**
     * If cube map rotation is enabled.
     *
     * @type {boolean}
     */
    this.useCubeMapRotation = false;
    this.lightMapWithoutAmbient = false;
    this.lights = [];
    this.noShadow = false;
    this.lightMaskDynamic = 0x0;
    /**
     * Object containing a map of user defined vertex attributes to attached shader semantics.
     *
     * @type {Object<string, string>}
     */
    this.userAttributes = {};
  }
}

export { LitShaderOptions };
