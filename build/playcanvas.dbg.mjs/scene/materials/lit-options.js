import { Debug } from '../../core/debug.js';
import { BLEND_NONE, FOG_NONE, GAMMA_NONE } from '../constants.js';

/**
 * The lit options determines how the lit-shader gets generated. It specifies a set of
 * parameters which triggers different fragment and vertex shader generation in the backend.
 */
class LitOptions {
  constructor() {
    this.hasTangents = false;
    /**
     * Object containing custom shader chunks that will replace default ones.
     *
     * @type {Object<string, string>}
     */
    this.chunks = {};
    this._pass = 0;
    this._isForwardPass = false;
    /**
     * Enable alpha testing. See {@link Material#alphaTest}.
     *
     * @type {boolean}
     */
    this.alphaTest = false;
    /**
     * Override fragment shader numeric precision. Can be "lowp", "mediump", "highp" or null to use
     * default.
     *
     * @type {string}
     */
    this.forceFragmentPrecision = null;
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
    this.useLightMapVertexColors = false;
    this.dirLightMapEnabled = false;
    this.heightMapEnabled = false;
    this.normalMapEnabled = false;
    this.clearCoatNormalMapEnabled = false;
    this.aoMapEnabled = false;
    this.useAoVertexColors = false;
    this.diffuseMapEnabled = false;
    this.useAmbientTint = false;
    /**
     * Replaced the whole fragment shader with this string.
     *
     * @type {string}
     */
    this.customFragmentShader = null;
    this.pixelSnap = false;
    this.useClearCoatNormalMap = false;
    this.useDiffuseMap = false;
    this.useAoMap = false;
    this.detailModes = 0;
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
    this.msdfTextAttribute = 0;
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
     * The value of {@link StandardMaterial#cubeMapProjection}.
     *
     * @type {number}
     */
    this.cubeMapProjection = 0;
    /**
     * The value of {@link StandardMaterial#occludeDirect}.
     *
     * @type {boolean}
     */
    this.occludeDirect = false;
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
    this.useSpecularColor = false;
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
  }
  set pass(p) {
    Debug.warn(`pc.LitOptions#pass should be set by its parent pc.StandardMaterialOptions, setting it directly has no effect.`);
  }
  get pass() {
    return this._pass;
  }
  set isForwardPass(p) {
    Debug.warn(`pc.LitOptions#isForwardPass should be set by its parent pc.StandardMaterialOptions, setting it directly has no effect.`);
  }
  get isForwardPass() {
    return this._isForwardPass;
  }
}

export { LitOptions };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGl0LW9wdGlvbnMuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9zY2VuZS9tYXRlcmlhbHMvbGl0LW9wdGlvbnMuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7XG4gICAgQkxFTkRfTk9ORSwgRk9HX05PTkUsIEdBTU1BX05PTkVcbn0gZnJvbSAnLi4vY29uc3RhbnRzLmpzJztcblxuLyoqXG4gKiBUaGUgbGl0IG9wdGlvbnMgZGV0ZXJtaW5lcyBob3cgdGhlIGxpdC1zaGFkZXIgZ2V0cyBnZW5lcmF0ZWQuIEl0IHNwZWNpZmllcyBhIHNldCBvZlxuICogcGFyYW1ldGVycyB3aGljaCB0cmlnZ2VycyBkaWZmZXJlbnQgZnJhZ21lbnQgYW5kIHZlcnRleCBzaGFkZXIgZ2VuZXJhdGlvbiBpbiB0aGUgYmFja2VuZC5cbiAqL1xuY2xhc3MgTGl0T3B0aW9ucyB7XG4gICAgaGFzVGFuZ2VudHMgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIE9iamVjdCBjb250YWluaW5nIGN1c3RvbSBzaGFkZXIgY2h1bmtzIHRoYXQgd2lsbCByZXBsYWNlIGRlZmF1bHQgb25lcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtPYmplY3Q8c3RyaW5nLCBzdHJpbmc+fVxuICAgICAqL1xuICAgIGNodW5rcyA9IHt9O1xuXG4gICAgX3Bhc3MgPSAwO1xuXG4gICAgX2lzRm9yd2FyZFBhc3MgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIEVuYWJsZSBhbHBoYSB0ZXN0aW5nLiBTZWUge0BsaW5rIE1hdGVyaWFsI2FscGhhVGVzdH0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBhbHBoYVRlc3QgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIE92ZXJyaWRlIGZyYWdtZW50IHNoYWRlciBudW1lcmljIHByZWNpc2lvbi4gQ2FuIGJlIFwibG93cFwiLCBcIm1lZGl1bXBcIiwgXCJoaWdocFwiIG9yIG51bGwgdG8gdXNlXG4gICAgICogZGVmYXVsdC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgZm9yY2VGcmFnbWVudFByZWNpc2lvbiA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdmFsdWUgb2Yge0BsaW5rIE1hdGVyaWFsI2JsZW5kVHlwZX0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGJsZW5kVHlwZSA9IEJMRU5EX05PTkU7XG5cbiAgICBzZXBhcmF0ZUFtYmllbnQgPSBmYWxzZTtcblxuICAgIHNjcmVlblNwYWNlID0gZmFsc2U7XG5cbiAgICBza2luID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBJZiBoYXJkd2FyZSBpbnN0YW5jaW5nIGNvbXBhdGlibGUgc2hhZGVyIHNob3VsZCBiZSBnZW5lcmF0ZWQuIFRyYW5zZm9ybSBpcyByZWFkIGZyb21cbiAgICAgKiBwZXItaW5zdGFuY2Uge0BsaW5rIFZlcnRleEJ1ZmZlcn0gaW5zdGVhZCBvZiBzaGFkZXIncyB1bmlmb3Jtcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHVzZUluc3RhbmNpbmcgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIElmIG1vcnBoaW5nIGNvZGUgc2hvdWxkIGJlIGdlbmVyYXRlZCB0byBtb3JwaCBwb3NpdGlvbnMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICB1c2VNb3JwaFBvc2l0aW9uID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBJZiBtb3JwaGluZyBjb2RlIHNob3VsZCBiZSBnZW5lcmF0ZWQgdG8gbW9ycGggbm9ybWFscy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHVzZU1vcnBoTm9ybWFsID0gZmFsc2U7XG5cbiAgICB1c2VNb3JwaFRleHR1cmVCYXNlZCA9IGZhbHNlO1xuXG4gICAgbmluZVNsaWNlZE1vZGUgPSAwO1xuXG4gICAgY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkID0gdHJ1ZTtcblxuICAgIGNsdXN0ZXJlZExpZ2h0aW5nQ29va2llc0VuYWJsZWQgPSBmYWxzZTtcblxuICAgIGNsdXN0ZXJlZExpZ2h0aW5nU2hhZG93c0VuYWJsZWQgPSBmYWxzZTtcblxuICAgIGNsdXN0ZXJlZExpZ2h0aW5nU2hhZG93VHlwZSA9IDA7XG5cbiAgICBjbHVzdGVyZWRMaWdodGluZ0FyZWFMaWdodHNFbmFibGVkID0gZmFsc2U7XG5cbiAgICB2ZXJ0ZXhDb2xvcnMgPSBmYWxzZTtcblxuICAgIGxpZ2h0TWFwRW5hYmxlZCA9IGZhbHNlO1xuXG4gICAgdXNlTGlnaHRNYXBWZXJ0ZXhDb2xvcnMgPSBmYWxzZTtcblxuICAgIGRpckxpZ2h0TWFwRW5hYmxlZCA9IGZhbHNlO1xuXG4gICAgaGVpZ2h0TWFwRW5hYmxlZCA9IGZhbHNlO1xuXG4gICAgbm9ybWFsTWFwRW5hYmxlZCA9IGZhbHNlO1xuXG4gICAgY2xlYXJDb2F0Tm9ybWFsTWFwRW5hYmxlZCA9IGZhbHNlO1xuXG4gICAgYW9NYXBFbmFibGVkID0gZmFsc2U7XG5cbiAgICB1c2VBb1ZlcnRleENvbG9ycyA9IGZhbHNlO1xuXG4gICAgZGlmZnVzZU1hcEVuYWJsZWQgPSBmYWxzZTtcblxuICAgIHVzZUFtYmllbnRUaW50ID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBSZXBsYWNlZCB0aGUgd2hvbGUgZnJhZ21lbnQgc2hhZGVyIHdpdGggdGhpcyBzdHJpbmcuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIGN1c3RvbUZyYWdtZW50U2hhZGVyID0gbnVsbDtcblxuICAgIHBpeGVsU25hcCA9IGZhbHNlO1xuXG4gICAgdXNlQ2xlYXJDb2F0Tm9ybWFsTWFwID0gZmFsc2U7XG5cbiAgICB1c2VEaWZmdXNlTWFwID0gZmFsc2U7XG5cbiAgICB1c2VBb01hcCA9IGZhbHNlO1xuXG4gICAgZGV0YWlsTW9kZXMgPSAwO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHZhbHVlIG9mIHtAbGluayBTdGFuZGFyZE1hdGVyaWFsI3NoYWRpbmdNb2RlbH0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNoYWRpbmdNb2RlbCA9IDA7XG5cbiAgICAvKipcbiAgICAgKiBJZiBhbWJpZW50IHNwaGVyaWNhbCBoYXJtb25pY3MgYXJlIHVzZWQuIEFtYmllbnQgU0ggcmVwbGFjZSBwcmVmaWx0ZXJlZCBjdWJlbWFwIGFtYmllbnQgb25cbiAgICAgKiBjZXJ0YWluIHBsYXRmb3JtcyAobW9zdGx5IEFuZHJvaWQpIGZvciBwZXJmb3JtYW5jZSByZWFzb25zLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgYW1iaWVudFNIID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBVc2Ugc2xpZ2h0bHkgY2hlYXBlciBub3JtYWwgbWFwcGluZyBjb2RlIChza2lwIHRhbmdlbnQgc3BhY2Ugbm9ybWFsaXphdGlvbikuIENhbiBsb29rIGJ1Z2d5XG4gICAgICogc29tZXRpbWVzLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZmFzdFRibiA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHZhbHVlIG9mIHtAbGluayBTdGFuZGFyZE1hdGVyaWFsI3R3b1NpZGVkTGlnaHRpbmd9LlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgdHdvU2lkZWRMaWdodGluZyA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHZhbHVlIG9mIHtAbGluayBTdGFuZGFyZE1hdGVyaWFsI29jY2x1ZGVTcGVjdWxhcn0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIG9jY2x1ZGVTcGVjdWxhciA9IDA7XG5cbiAgICAvKipcbiAgICAgKiBEZWZpbmVzIGlmIHtAbGluayBTdGFuZGFyZE1hdGVyaWFsI29jY2x1ZGVTcGVjdWxhckludGVuc2l0eX0gY29uc3RhbnQgc2hvdWxkIGFmZmVjdCBzcGVjdWxhclxuICAgICAqIG9jY2x1c2lvbi5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIG9jY2x1ZGVTcGVjdWxhckZsb2F0ID0gZmFsc2U7XG5cbiAgICB1c2VNc2RmID0gZmFsc2U7XG5cbiAgICBtc2RmVGV4dEF0dHJpYnV0ZSA9IDA7XG5cbiAgICAvKipcbiAgICAgKiBFbmFibGUgYWxwaGEgdG8gY292ZXJhZ2UuIFNlZSB7QGxpbmsgTWF0ZXJpYWwjYWxwaGFUb0NvdmVyYWdlfS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGFscGhhVG9Db3ZlcmFnZSA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogRW5hYmxlIHNwZWN1bGFyIGZhZGUuIFNlZSB7QGxpbmsgU3RhbmRhcmRNYXRlcmlhbCNvcGFjaXR5RmFkZXNTcGVjdWxhcn0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBvcGFjaXR5RmFkZXNTcGVjdWxhciA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHZhbHVlIG9mIHtAbGluayBTdGFuZGFyZE1hdGVyaWFsI2N1YmVNYXBQcm9qZWN0aW9ufS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgY3ViZU1hcFByb2plY3Rpb24gPSAwO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHZhbHVlIG9mIHtAbGluayBTdGFuZGFyZE1hdGVyaWFsI29jY2x1ZGVEaXJlY3R9LlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgb2NjbHVkZURpcmVjdCA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHZhbHVlIG9mIHtAbGluayBTdGFuZGFyZE1hdGVyaWFsI2NvbnNlcnZlRW5lcmd5fS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGNvbnNlcnZlRW5lcmd5ID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBJZiBhbnkgc3BlY3VsYXIgb3IgcmVmbGVjdGlvbnMgYXJlIG5lZWRlZCBhdCBhbGwuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICB1c2VTcGVjdWxhciA9IGZhbHNlO1xuXG4gICAgdXNlU3BlY3VsYXJpdHlGYWN0b3IgPSBmYWxzZTtcblxuICAgIHVzZVNwZWN1bGFyQ29sb3IgPSBmYWxzZTtcblxuICAgIGVuYWJsZUdHWFNwZWN1bGFyID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdmFsdWUgb2Yge0BsaW5rIFN0YW5kYXJkTWF0ZXJpYWwjZnJlc25lbE1vZGVsfS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgZnJlc25lbE1vZGVsID0gMDtcblxuICAgIC8qKlxuICAgICAqIElmIHJlZnJhY3Rpb24gaXMgdXNlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHVzZVJlZnJhY3Rpb24gPSBmYWxzZTtcblxuICAgIHVzZUNsZWFyQ29hdCA9IGZhbHNlO1xuXG4gICAgdXNlU2hlZW4gPSBmYWxzZTtcblxuICAgIHVzZUlyaWRlc2NlbmNlID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdmFsdWUgb2Yge0BsaW5rIFN0YW5kYXJkTWF0ZXJpYWwjdXNlTWV0YWxuZXNzfS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHVzZU1ldGFsbmVzcyA9IGZhbHNlO1xuXG4gICAgdXNlRHluYW1pY1JlZnJhY3Rpb24gPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIFRoZSB0eXBlIG9mIGZvZyBiZWluZyBhcHBsaWVkIGluIHRoZSBzaGFkZXIuIFNlZSB7QGxpbmsgU2NlbmUjZm9nfSBmb3IgdGhlIGxpc3Qgb2YgcG9zc2libGVcbiAgICAgKiB2YWx1ZXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIGZvZyA9IEZPR19OT05FO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHR5cGUgb2YgZ2FtbWEgY29ycmVjdGlvbiBiZWluZyBhcHBsaWVkIGluIHRoZSBzaGFkZXIuIFNlZSB7QGxpbmsgU2NlbmUjZ2FtbWFDb3JyZWN0aW9ufVxuICAgICAqIGZvciB0aGUgbGlzdCBvZiBwb3NzaWJsZSB2YWx1ZXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGdhbW1hID0gR0FNTUFfTk9ORTtcblxuICAgIC8qKlxuICAgICAqIFRoZSB0eXBlIG9mIHRvbmUgbWFwcGluZyBiZWluZyBhcHBsaWVkIGluIHRoZSBzaGFkZXIuIFNlZSB7QGxpbmsgU2NlbmUjdG9uZU1hcHBpbmd9IGZvciB0aGVcbiAgICAgKiBsaXN0IG9mIHBvc3NpYmxlIHZhbHVlcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgdG9uZU1hcCA9IC0xO1xuXG4gICAgLyoqXG4gICAgICogSWYgY3ViZW1hcHMgcmVxdWlyZSBzZWFtIGZpeGluZyAoc2VlIHRoZSBgZml4Q3ViZW1hcFNlYW1zYCBwcm9wZXJ0eSBvZiB0aGUgb3B0aW9ucyBvYmplY3RcbiAgICAgKiBwYXNzZWQgdG8gdGhlIHtAbGluayBUZXh0dXJlfSBjb25zdHJ1Y3RvcikuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBmaXhTZWFtcyA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogT25lIG9mIFwiZW52QXRsYXNIUVwiLCBcImVudkF0bGFzXCIsIFwiY3ViZU1hcFwiLCBcInNwaGVyZU1hcFwiLlxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKi9cbiAgICByZWZsZWN0aW9uU291cmNlID0gbnVsbDtcblxuICAgIHJlZmxlY3Rpb25FbmNvZGluZyA9IG51bGw7XG5cbiAgICByZWZsZWN0aW9uQ3ViZW1hcEVuY29kaW5nID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIE9uZSBvZiBcImFtYmllbnRTSFwiLCBcImVudkF0bGFzXCIsIFwiY29uc3RhbnRcIi5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgYW1iaWVudFNvdXJjZSA9ICdjb25zdGFudCc7XG5cbiAgICBhbWJpZW50RW5jb2RpbmcgPSBudWxsO1xuXG4gICAgLy8gVE9ETzogYWRkIGEgdGVzdCBmb3IgaWYgbm9uIHNreWJveCBjdWJlbWFwcyBoYXZlIHJvdGF0aW9uICh3aGVuIHRoaXMgaXMgc3VwcG9ydGVkKSAtIGZvciBub3dcbiAgICAvLyBhc3N1bWUgbm8gbm9uLXNreWJveCBjdWJlbWFwIHJvdGF0aW9uXG4gICAgLyoqXG4gICAgICogU2t5Ym94IGludGVuc2l0eSBmYWN0b3IuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNreWJveEludGVuc2l0eSA9IDEuMDtcblxuICAgIC8qKlxuICAgICAqIElmIGN1YmUgbWFwIHJvdGF0aW9uIGlzIGVuYWJsZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICB1c2VDdWJlTWFwUm90YXRpb24gPSBmYWxzZTtcblxuICAgIGxpZ2h0TWFwV2l0aG91dEFtYmllbnQgPSBmYWxzZTtcblxuICAgIGxpZ2h0cyA9IFtdO1xuXG4gICAgbm9TaGFkb3cgPSBmYWxzZTtcblxuICAgIGxpZ2h0TWFza0R5bmFtaWMgPSAweDA7XG5cbiAgICBzZXQgcGFzcyhwKSB7XG4gICAgICAgIERlYnVnLndhcm4oYHBjLkxpdE9wdGlvbnMjcGFzcyBzaG91bGQgYmUgc2V0IGJ5IGl0cyBwYXJlbnQgcGMuU3RhbmRhcmRNYXRlcmlhbE9wdGlvbnMsIHNldHRpbmcgaXQgZGlyZWN0bHkgaGFzIG5vIGVmZmVjdC5gKTtcbiAgICB9XG5cbiAgICBnZXQgcGFzcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3Bhc3M7XG4gICAgfVxuXG4gICAgc2V0IGlzRm9yd2FyZFBhc3MocCkge1xuICAgICAgICBEZWJ1Zy53YXJuKGBwYy5MaXRPcHRpb25zI2lzRm9yd2FyZFBhc3Mgc2hvdWxkIGJlIHNldCBieSBpdHMgcGFyZW50IHBjLlN0YW5kYXJkTWF0ZXJpYWxPcHRpb25zLCBzZXR0aW5nIGl0IGRpcmVjdGx5IGhhcyBubyBlZmZlY3QuYCk7XG4gICAgfVxuXG4gICAgZ2V0IGlzRm9yd2FyZFBhc3MoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9pc0ZvcndhcmRQYXNzO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgTGl0T3B0aW9ucyB9O1xuIl0sIm5hbWVzIjpbIkxpdE9wdGlvbnMiLCJjb25zdHJ1Y3RvciIsImhhc1RhbmdlbnRzIiwiY2h1bmtzIiwiX3Bhc3MiLCJfaXNGb3J3YXJkUGFzcyIsImFscGhhVGVzdCIsImZvcmNlRnJhZ21lbnRQcmVjaXNpb24iLCJibGVuZFR5cGUiLCJCTEVORF9OT05FIiwic2VwYXJhdGVBbWJpZW50Iiwic2NyZWVuU3BhY2UiLCJza2luIiwidXNlSW5zdGFuY2luZyIsInVzZU1vcnBoUG9zaXRpb24iLCJ1c2VNb3JwaE5vcm1hbCIsInVzZU1vcnBoVGV4dHVyZUJhc2VkIiwibmluZVNsaWNlZE1vZGUiLCJjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQiLCJjbHVzdGVyZWRMaWdodGluZ0Nvb2tpZXNFbmFibGVkIiwiY2x1c3RlcmVkTGlnaHRpbmdTaGFkb3dzRW5hYmxlZCIsImNsdXN0ZXJlZExpZ2h0aW5nU2hhZG93VHlwZSIsImNsdXN0ZXJlZExpZ2h0aW5nQXJlYUxpZ2h0c0VuYWJsZWQiLCJ2ZXJ0ZXhDb2xvcnMiLCJsaWdodE1hcEVuYWJsZWQiLCJ1c2VMaWdodE1hcFZlcnRleENvbG9ycyIsImRpckxpZ2h0TWFwRW5hYmxlZCIsImhlaWdodE1hcEVuYWJsZWQiLCJub3JtYWxNYXBFbmFibGVkIiwiY2xlYXJDb2F0Tm9ybWFsTWFwRW5hYmxlZCIsImFvTWFwRW5hYmxlZCIsInVzZUFvVmVydGV4Q29sb3JzIiwiZGlmZnVzZU1hcEVuYWJsZWQiLCJ1c2VBbWJpZW50VGludCIsImN1c3RvbUZyYWdtZW50U2hhZGVyIiwicGl4ZWxTbmFwIiwidXNlQ2xlYXJDb2F0Tm9ybWFsTWFwIiwidXNlRGlmZnVzZU1hcCIsInVzZUFvTWFwIiwiZGV0YWlsTW9kZXMiLCJzaGFkaW5nTW9kZWwiLCJhbWJpZW50U0giLCJmYXN0VGJuIiwidHdvU2lkZWRMaWdodGluZyIsIm9jY2x1ZGVTcGVjdWxhciIsIm9jY2x1ZGVTcGVjdWxhckZsb2F0IiwidXNlTXNkZiIsIm1zZGZUZXh0QXR0cmlidXRlIiwiYWxwaGFUb0NvdmVyYWdlIiwib3BhY2l0eUZhZGVzU3BlY3VsYXIiLCJjdWJlTWFwUHJvamVjdGlvbiIsIm9jY2x1ZGVEaXJlY3QiLCJjb25zZXJ2ZUVuZXJneSIsInVzZVNwZWN1bGFyIiwidXNlU3BlY3VsYXJpdHlGYWN0b3IiLCJ1c2VTcGVjdWxhckNvbG9yIiwiZW5hYmxlR0dYU3BlY3VsYXIiLCJmcmVzbmVsTW9kZWwiLCJ1c2VSZWZyYWN0aW9uIiwidXNlQ2xlYXJDb2F0IiwidXNlU2hlZW4iLCJ1c2VJcmlkZXNjZW5jZSIsInVzZU1ldGFsbmVzcyIsInVzZUR5bmFtaWNSZWZyYWN0aW9uIiwiZm9nIiwiRk9HX05PTkUiLCJnYW1tYSIsIkdBTU1BX05PTkUiLCJ0b25lTWFwIiwiZml4U2VhbXMiLCJyZWZsZWN0aW9uU291cmNlIiwicmVmbGVjdGlvbkVuY29kaW5nIiwicmVmbGVjdGlvbkN1YmVtYXBFbmNvZGluZyIsImFtYmllbnRTb3VyY2UiLCJhbWJpZW50RW5jb2RpbmciLCJza3lib3hJbnRlbnNpdHkiLCJ1c2VDdWJlTWFwUm90YXRpb24iLCJsaWdodE1hcFdpdGhvdXRBbWJpZW50IiwibGlnaHRzIiwibm9TaGFkb3ci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
