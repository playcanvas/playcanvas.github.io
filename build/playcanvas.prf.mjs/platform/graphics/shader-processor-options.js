/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { BINDGROUP_VIEW } from './constants.js';

class ShaderProcessorOptions {
	constructor(viewUniformFormat, viewBindGroupFormat, vertexFormat) {
		this.uniformFormats = [];
		this.bindGroupFormats = [];
		this.vertexFormat = void 0;
		this.uniformFormats[BINDGROUP_VIEW] = viewUniformFormat;
		this.bindGroupFormats[BINDGROUP_VIEW] = viewBindGroupFormat;
		this.vertexFormat = vertexFormat;
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
	getVertexElement(semantic) {
		var _this$vertexFormat;
		return (_this$vertexFormat = this.vertexFormat) == null ? void 0 : _this$vertexFormat.elements.find(element => element.name === semantic);
	}
	generateKey() {
		var _this$vertexFormat2;
		return JSON.stringify(this.uniformFormats) + JSON.stringify(this.bindGroupFormats) + ((_this$vertexFormat2 = this.vertexFormat) == null ? void 0 : _this$vertexFormat2.renderingHashString);
	}
}

export { ShaderProcessorOptions };
