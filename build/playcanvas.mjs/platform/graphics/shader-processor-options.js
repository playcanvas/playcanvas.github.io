import { BINDGROUP_VIEW } from './constants.js';

class ShaderProcessorOptions {
	constructor(viewUniformFormat, viewBindGroupFormat) {
		this.uniformFormats = [];
		this.bindGroupFormats = [];
		this.uniformFormats[BINDGROUP_VIEW] = viewUniformFormat;
		this.bindGroupFormats[BINDGROUP_VIEW] = viewBindGroupFormat;
	}
	hasUniform(name) {
		for (let i = 0; i < this.uniformFormats.length; i++) {
			const uniformFormat = this.uniformFormats[i];
			if (uniformFormat != null && uniformFormat.get(name)) {
				return true;
			}
		}
		return false;
	}
	hasTexture(name) {
		for (let i = 0; i < this.bindGroupFormats.length; i++) {
			const groupFormat = this.bindGroupFormats[i];
			if (groupFormat != null && groupFormat.getTexture(name)) {
				return true;
			}
		}
		return false;
	}
	generateKey() {
		return JSON.stringify(this);
	}
}

export { ShaderProcessorOptions };
