import { platform } from '../../core/platform.js';
import { Preprocessor } from '../../core/preprocessor.js';

let id = 0;
class Shader {
  constructor(graphicsDevice, definition) {
    this.meshUniformBufferFormat = void 0;
    this.meshBindGroupFormat = void 0;
    this.id = id++;
    this.device = graphicsDevice;
    this.definition = definition;
    this.name = definition.name || 'Untitled';
    this.init();
    if (definition.cshader) ; else {
      definition.vshader = Preprocessor.run(definition.vshader, definition.vincludes);
      const stripUnusedColorAttachments = graphicsDevice.isWebGL2 && (platform.name === 'osx' || platform.name === 'ios');
      definition.fshader = Preprocessor.run(definition.fshader, definition.fincludes, stripUnusedColorAttachments);
    }
    this.impl = graphicsDevice.createShaderImpl(this);
  }
  init() {
    this.ready = false;
    this.failed = false;
  }
  get label() {
    return `Shader Id ${this.id} ${this.name}`;
  }
  destroy() {
    this.device.onDestroyShader(this);
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
