/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { LitOptions } from './lit-options.js';

class StandardMaterialOptions {
  constructor() {
    this.chunks = [];
    this._pass = 0;
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
    this.litOptions = new LitOptions();
  }
  set pass(p) {
    this._pass = p;
    this.litOptions._pass = p;
  }
  get pass() {
    return this._pass;
  }
}

export { StandardMaterialOptions };
