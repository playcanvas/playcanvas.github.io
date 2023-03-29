/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import '../../core/tracing.js';
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
		definition.vshader = Preprocessor.run(definition.vshader);
		definition.fshader = Preprocessor.run(definition.fshader);
		this.init();
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
