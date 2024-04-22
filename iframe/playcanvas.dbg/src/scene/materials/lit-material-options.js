import { LitShaderOptions } from '../shader-lib/programs/lit-shader-options.js';

class LitMaterialOptions {
  constructor() {
    // array of booleans indicating which UV channels are used by the material
    this.usedUvs = void 0;
    // custom shader chunk to be added to the shader
    this.shaderChunk = void 0;
    // lit options
    this.litOptions = new LitShaderOptions();
  }
}

export { LitMaterialOptions };
