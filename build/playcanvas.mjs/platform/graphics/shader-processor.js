import '../../core/tracing.js';
import { uniformTypeToName, UNIFORM_BUFFER_DEFAULT_SLOT_NAME, SHADERSTAGE_VERTEX, SHADERSTAGE_FRAGMENT, BINDGROUP_MESH, semanticToLocation, TYPE_FLOAT32, TEXTUREDIMENSION_2D, TEXTUREDIMENSION_3D, TEXTUREDIMENSION_CUBE, TEXTUREDIMENSION_2D_ARRAY, SAMPLETYPE_FLOAT, SAMPLETYPE_UNFILTERABLE_FLOAT, SAMPLETYPE_DEPTH, TYPE_INT8, TYPE_INT16, TYPE_INT32 } from './constants.js';
import { UniformFormat, UniformBufferFormat } from './uniform-buffer-format.js';
import { BindBufferFormat, BindTextureFormat, BindGroupFormat } from './bind-group-format.js';

const KEYWORD = /[ \t]*(\battribute\b|\bvarying\b|\buniform\b)/g;
const KEYWORD_LINE = /(\battribute\b|\bvarying\b|\bout\b|\buniform\b)[ \t]*([^;]+)([;]+)/g;
const MARKER = '@@@';
const ARRAY_IDENTIFIER = /([\w-]+)\[(.*?)\]/;
const precisionQualifiers = new Set(['highp', 'mediump', 'lowp']);
const shadowSamplers = new Set(['sampler2DShadow', 'samplerCubeShadow']);
const textureDimensions = {
	sampler2D: TEXTUREDIMENSION_2D,
	sampler3D: TEXTUREDIMENSION_3D,
	samplerCube: TEXTUREDIMENSION_CUBE,
	samplerCubeShadow: TEXTUREDIMENSION_CUBE,
	sampler2DShadow: TEXTUREDIMENSION_2D,
	sampler2DArray: TEXTUREDIMENSION_2D_ARRAY,
	sampler2DArrayShadow: TEXTUREDIMENSION_2D_ARRAY
};
class UniformLine {
	constructor(line, shader) {
		this.line = line;
		const words = line.trim().split(/\s+/);
		if (precisionQualifiers.has(words[0])) {
			this.precision = words.shift();
		}
		this.type = words.shift();
		if (line.includes(',')) ;
		if (line.includes('[')) {
			const rest = words.join(' ');
			const match = ARRAY_IDENTIFIER.exec(rest);
			this.name = match[1];
			this.arraySize = Number(match[2]);
			if (isNaN(this.arraySize)) {
				shader.failed = true;
			}
		} else {
			this.name = words.shift();
			this.arraySize = 0;
		}
		this.isSampler = this.type.indexOf('sampler') !== -1;
	}
}
class ShaderProcessor {
	static run(device, shaderDefinition, shader) {
		const varyingMap = new Map();
		const vertexExtracted = ShaderProcessor.extract(shaderDefinition.vshader);
		const fragmentExtracted = ShaderProcessor.extract(shaderDefinition.fshader);
		const attributesBlock = ShaderProcessor.processAttributes(vertexExtracted.attributes, shaderDefinition.attributes, shaderDefinition.processingOptions);
		const vertexVaryingsBlock = ShaderProcessor.processVaryings(vertexExtracted.varyings, varyingMap, true);
		const fragmentVaryingsBlock = ShaderProcessor.processVaryings(fragmentExtracted.varyings, varyingMap, false);
		const outBlock = ShaderProcessor.processOuts(fragmentExtracted.outs);
		const concatUniforms = vertexExtracted.uniforms.concat(fragmentExtracted.uniforms);
		const uniforms = Array.from(new Set(concatUniforms));
		const parsedUniforms = uniforms.map(line => new UniformLine(line, shader));
		const uniformsData = ShaderProcessor.processUniforms(device, parsedUniforms, shaderDefinition.processingOptions, shader);
		const vBlock = attributesBlock + '\n' + vertexVaryingsBlock + '\n' + uniformsData.code;
		const vshader = vertexExtracted.src.replace(MARKER, vBlock);
		const fBlock = fragmentVaryingsBlock + '\n' + outBlock + '\n' + uniformsData.code;
		const fshader = fragmentExtracted.src.replace(MARKER, fBlock);
		return {
			vshader: vshader,
			fshader: fshader,
			meshUniformBufferFormat: uniformsData.meshUniformBufferFormat,
			meshBindGroupFormat: uniformsData.meshBindGroupFormat
		};
	}
	static extract(src) {
		const attributes = [];
		const varyings = [];
		const outs = [];
		const uniforms = [];
		let replacement = `${MARKER}\n`;
		let match;
		while ((match = KEYWORD.exec(src)) !== null) {
			const keyword = match[1];
			switch (keyword) {
				case 'attribute':
				case 'varying':
				case 'uniform':
				case 'out':
					{
						KEYWORD_LINE.lastIndex = match.index;
						const lineMatch = KEYWORD_LINE.exec(src);
						if (keyword === 'attribute') {
							attributes.push(lineMatch[2]);
						} else if (keyword === 'varying') {
							varyings.push(lineMatch[2]);
						} else if (keyword === 'out') {
							outs.push(lineMatch[2]);
						} else if (keyword === 'uniform') {
							uniforms.push(lineMatch[2]);
						}
						src = ShaderProcessor.cutOut(src, match.index, KEYWORD_LINE.lastIndex, replacement);
						KEYWORD.lastIndex = match.index + replacement.length;
						replacement = '';
						break;
					}
			}
		}
		return {
			src,
			attributes,
			varyings,
			outs,
			uniforms
		};
	}
	static processUniforms(device, uniforms, processingOptions, shader) {
		const uniformLinesSamplers = [];
		const uniformLinesNonSamplers = [];
		uniforms.forEach(uniform => {
			if (uniform.isSampler) {
				uniformLinesSamplers.push(uniform);
			} else {
				uniformLinesNonSamplers.push(uniform);
			}
		});
		const meshUniforms = [];
		uniformLinesNonSamplers.forEach(uniform => {
			if (!processingOptions.hasUniform(uniform.name)) {
				const uniformType = uniformTypeToName.indexOf(uniform.type);
				const uniformFormat = new UniformFormat(uniform.name, uniformType, uniform.arraySize);
				meshUniforms.push(uniformFormat);
			}
		});
		const meshUniformBufferFormat = meshUniforms.length ? new UniformBufferFormat(device, meshUniforms) : null;
		const bufferFormats = [];
		if (meshUniformBufferFormat) {
			bufferFormats.push(new BindBufferFormat(UNIFORM_BUFFER_DEFAULT_SLOT_NAME, SHADERSTAGE_VERTEX | SHADERSTAGE_FRAGMENT));
		}
		const textureFormats = [];
		uniformLinesSamplers.forEach(uniform => {
			if (!processingOptions.hasTexture(uniform.name)) {
				let sampleType = SAMPLETYPE_FLOAT;
				if (uniform.precision === 'highp') sampleType = SAMPLETYPE_UNFILTERABLE_FLOAT;
				if (shadowSamplers.has(uniform.type)) sampleType = SAMPLETYPE_DEPTH;
				const dimension = textureDimensions[uniform.type];
				textureFormats.push(new BindTextureFormat(uniform.name, SHADERSTAGE_VERTEX | SHADERSTAGE_FRAGMENT, dimension, sampleType));
			}
		});
		const meshBindGroupFormat = new BindGroupFormat(device, bufferFormats, textureFormats);
		let code = '';
		processingOptions.uniformFormats.forEach((format, bindGroupIndex) => {
			if (format) {
				code += format.getShaderDeclaration(bindGroupIndex, 0);
			}
		});
		if (meshUniformBufferFormat) {
			code += meshUniformBufferFormat.getShaderDeclaration(BINDGROUP_MESH, 0);
		}
		processingOptions.bindGroupFormats.forEach((format, bindGroupIndex) => {
			if (format) {
				code += format.getShaderDeclarationTextures(bindGroupIndex);
			}
		});
		code += meshBindGroupFormat.getShaderDeclarationTextures(BINDGROUP_MESH);
		return {
			code,
			meshUniformBufferFormat,
			meshBindGroupFormat
		};
	}
	static processVaryings(varyingLines, varyingMap, isVertex) {
		let block = '';
		const op = isVertex ? 'out' : 'in';
		varyingLines.forEach((line, index) => {
			const words = ShaderProcessor.splitToWords(line);
			const type = words[0];
			const name = words[1];
			if (isVertex) {
				varyingMap.set(name, index);
			} else {
				index = varyingMap.get(name);
			}
			block += `layout(location = ${index}) ${op} ${type} ${name};\n`;
		});
		return block;
	}
	static processOuts(outsLines) {
		let block = '';
		outsLines.forEach((line, index) => {
			block += `layout(location = ${index}) out ${line};\n`;
		});
		return block;
	}
	static getTypeCount(type) {
		const lastChar = type.substring(type.length - 1);
		const num = parseInt(lastChar, 10);
		return isNaN(num) ? 1 : num;
	}
	static processAttributes(attributeLines, shaderDefinitionAttributes, processingOptions) {
		let block = '';
		const usedLocations = {};
		attributeLines.forEach(line => {
			const words = ShaderProcessor.splitToWords(line);
			let type = words[0];
			let name = words[1];
			if (shaderDefinitionAttributes.hasOwnProperty(name)) {
				const semantic = shaderDefinitionAttributes[name];
				const location = semanticToLocation[semantic];
				usedLocations[location] = semantic;
				let copyCode;
				const element = processingOptions.getVertexElement(semantic);
				if (element) {
					const dataType = element.dataType;
					if (dataType !== TYPE_FLOAT32) {
						const attribNumElements = ShaderProcessor.getTypeCount(type);
						const newName = `_private_${name}`;
						copyCode = `vec${attribNumElements} ${name} = vec${attribNumElements}(${newName});\n`;
						name = newName;
						const isSignedType = dataType === TYPE_INT8 || dataType === TYPE_INT16 || dataType === TYPE_INT32;
						if (attribNumElements === 1) {
							type = isSignedType ? 'int' : 'uint';
						} else {
							type = isSignedType ? `ivec${attribNumElements}` : `uvec${attribNumElements}`;
						}
					}
				}
				block += `layout(location = ${location}) in ${type} ${name};\n`;
				if (copyCode) {
					block += copyCode;
				}
			}
		});
		return block;
	}
	static splitToWords(line) {
		line = line.replace(/\s+/g, ' ').trim();
		return line.split(' ');
	}
	static cutOut(src, start, end, replacement) {
		return src.substring(0, start) + replacement + src.substring(end);
	}
}

export { ShaderProcessor };
