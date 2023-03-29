/**
 * @license
 * PlayCanvas Engine v1.57.0 revision 18b016876 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import '../core/tracing.js';
import { Preprocessor } from '../core/preprocessor.js';

let id = 0;

class Shader {
  constructor(graphicsDevice, definition) {
    this.meshUniformBufferFormat = void 0;
    this.meshBindGroupFormat = void 0;
    this.id = id++;
    this.device = graphicsDevice;
    this.definition = definition;
    this.name = definition.name || 'Untitled';
    definition.vshader = Preprocessor.run(definition.vshader);
    definition.fshader = Preprocessor.run(definition.fshader);
    this.init();
    this.impl = graphicsDevice.createShaderImpl(this);
  }

  init() {
    this.ready = false;
    this.failed = false;
  }

  destroy() {
    this.impl.destroy(this);
  }

  loseContext() {
    this.init();
    this.impl.loseContext();
  }

  restoreContext() {
    this.impl.restoreContext(this.device, this);
  }

}

export { Shader };
