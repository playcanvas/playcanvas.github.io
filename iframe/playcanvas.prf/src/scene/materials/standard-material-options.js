import { LitShaderOptions } from '../shader-lib/programs/lit-shader-options.js';

class StandardMaterialOptions {
  constructor() {
    this.forceUv1 = false;
    this.ambientTint = false;
    this.diffuseTint = false;
    this.specularTint = false;
    this.metalnessTint = false;
    this.glossTint = false;
    this.emissiveTint = false;
    this.opacityTint = false;
    this.emissiveEncoding = 'linear';
    this.lightMapEncoding = 'linear';
    this.packedNormal = false;
    this.glossInvert = false;
    this.sheenGlossInvert = false;
    this.clearCoatGlossInvert = false;
    this.litOptions = new LitShaderOptions();
  }
  get pass() {
    return this.litOptions.pass;
  }
}

export { StandardMaterialOptions };
