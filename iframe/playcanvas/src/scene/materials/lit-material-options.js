import { LitShaderOptions } from '../shader-lib/programs/lit-shader-options.js';

class LitMaterialOptions {
  constructor() {
    this.usedUvs = void 0;
    this.shaderChunk = void 0;
    this.litOptions = new LitShaderOptions();
  }
}

export { LitMaterialOptions };
