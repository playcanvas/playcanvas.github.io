/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import '../../core/tracing.js';
import { TEXTUREDIMENSION_2D, SAMPLETYPE_FLOAT, TEXTUREDIMENSION_CUBE, TEXTUREDIMENSION_3D } from './constants.js';

let id = 0;
const textureDimensionInfo = {
	[TEXTUREDIMENSION_2D]: 'texture2D',
	[TEXTUREDIMENSION_CUBE]: 'textureCube',
	[TEXTUREDIMENSION_3D]: 'texture3D'
};
class BindBufferFormat {
	constructor(name, visibility) {
		this.name = name;
		this.visibility = visibility;
	}
}
class BindTextureFormat {
	constructor(name, visibility, textureDimension = TEXTUREDIMENSION_2D, sampleType = SAMPLETYPE_FLOAT) {
		this.scopeId = void 0;
		this.name = name;
		this.visibility = visibility;
		this.textureDimension = textureDimension;
		this.sampleType = sampleType;
	}
}
class BindGroupFormat {
	constructor(graphicsDevice, bufferFormats = [], textureFormats = []) {
		this.id = id++;
		this.device = graphicsDevice;
		this.bufferFormats = bufferFormats;
		this.bufferFormatsMap = new Map();
		bufferFormats.forEach((bf, i) => this.bufferFormatsMap.set(bf.name, i));
		this.textureFormats = textureFormats;
		const scope = graphicsDevice.scope;
		this.textureFormatsMap = new Map();
		textureFormats.forEach((tf, i) => {
			this.textureFormatsMap.set(tf.name, i);
			tf.scopeId = scope.resolve(tf.name);
		});
		this.impl = graphicsDevice.createBindGroupFormatImpl(this);
	}
	destroy() {
		this.impl.destroy();
	}
	getTexture(name) {
		const index = this.textureFormatsMap.get(name);
		if (index !== undefined) {
			return this.textureFormats[index];
		}
		return null;
	}
	getShaderDeclarationTextures(bindGroup) {
		let code = '';
		let bindIndex = this.bufferFormats.length;
		this.textureFormats.forEach(format => {
			const textureType = textureDimensionInfo[format.textureDimension];
			code += `layout(set = ${bindGroup}, binding = ${bindIndex++}) uniform ${textureType} ${format.name};\n` + `layout(set = ${bindGroup}, binding = ${bindIndex++}) uniform sampler ${format.name}_sampler;\n`;
		});
		return code;
	}
	loseContext() {}
}

export { BindBufferFormat, BindGroupFormat, BindTextureFormat };
