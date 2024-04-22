import { LitShaderOptions } from '../shader-lib/programs/lit-shader-options.js';

/**
 * The standard material options define a set of options used to control the shader frontend shader
 * generation, such as textures, tints and multipliers.
 *
 * @category Graphics
 */
class StandardMaterialOptions {
  constructor() {
    /**
     * If UV1 (second set of texture coordinates) is required in the shader. Will be declared as
     * "vUv1" and passed to the fragment shader.
     *
     * @type {boolean}
     */
    this.forceUv1 = false;
    /**
     * The value of {@link StandardMaterial#ambientTint}.
     *
     * @type {boolean}
     */
    this.ambientTint = false;
    /**
     * Defines if {@link StandardMaterial#diffuse} constant should affect diffuse color.
     *
     * @type {boolean}
     */
    this.diffuseTint = false;
    /**
     * Defines if {@link StandardMaterial#specular} constant should affect specular color.
     *
     * @type {boolean}
     */
    this.specularTint = false;
    /**
     * Defines if {@link StandardMaterial#metalness} constant should affect metalness value.
     *
     * @type {boolean}
     */
    this.metalnessTint = false;
    /**
     * Defines if {@link StandardMaterial#gloss} constant should affect glossiness value.
     *
     * @type {boolean}
     */
    this.glossTint = false;
    /**
     * Defines if {@link StandardMaterial#emissive} constant should affect emissive color.
     *
     * @type {boolean}
     */
    this.emissiveTint = false;
    /**
     * Defines if {@link StandardMaterial#opacity} constant should affect opacity value.
     *
     * @type {boolean}
     */
    this.opacityTint = false;
    this.emissiveEncoding = 'linear';
    this.lightMapEncoding = 'linear';
    /**
     * If normal map contains X in RGB, Y in Alpha, and Z must be reconstructed.
     *
     * @type {boolean}
     */
    this.packedNormal = false;
    /**
     * Invert the gloss channel.
     *
     * @type {boolean}
     */
    this.glossInvert = false;
    /**
     * Invert the sheen gloss channel.
     *
     * @type {boolean}
     */
    this.sheenGlossInvert = false;
    /**
     * Invert the clearcoat gloss channel.
     *
     * @type {boolean}
     */
    this.clearCoatGlossInvert = false;
    /**
     * Storage for the options for lit the shader and material.
     *
     * @type {LitShaderOptions}
     */
    this.litOptions = new LitShaderOptions();
  }
  // program-library assumes material options has a pass property
  get pass() {
    return this.litOptions.pass;
  }
}

export { StandardMaterialOptions };
