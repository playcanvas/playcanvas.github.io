import { Shader } from '../../platform/graphics/shader.js';
import { ShaderUtils } from '../../platform/graphics/shader-utils.js';
import { shaderChunks } from './chunks/chunks.js';
import { getProgramLibrary } from './get-program-library.js';
import '../../core/debug.js';

function createShader(device, vsName, fsName, useTransformFeedback = false) {
	return new Shader(device, ShaderUtils.createDefinition(device, {
		name: `${vsName}_${fsName}`,
		vertexCode: shaderChunks[vsName],
		fragmentCode: shaderChunks[fsName],
		useTransformFeedback: useTransformFeedback
	}));
}
function createShaderFromCode(device, vsCode, fsCode, uniqueName, attributes, useTransformFeedback = false) {
	const programLibrary = getProgramLibrary(device);
	let shader = programLibrary.getCachedShader(uniqueName);
	if (!shader) {
		shader = new Shader(device, ShaderUtils.createDefinition(device, {
			name: uniqueName,
			vertexCode: vsCode,
			fragmentCode: fsCode,
			attributes: attributes,
			useTransformFeedback: useTransformFeedback
		}));
		programLibrary.setCachedShader(uniqueName, shader);
	}
	return shader;
}
function processShader(shader, processingOptions) {
	var _shaderDefinition$nam;
	const shaderDefinition = shader.definition;
	const name = (_shaderDefinition$nam = shaderDefinition.name) != null ? _shaderDefinition$nam : 'shader';
	const key = `${name}-id-${shader.id}`;
	const materialGenerator = {
		generateKey: function (options) {
			return key;
		},
		createShaderDefinition: function (device, options) {
			return shaderDefinition;
		}
	};
	const libraryModuleName = 'shader';
	const library = getProgramLibrary(shader.device);
	library.register(libraryModuleName, materialGenerator);
	const variant = library.getProgram(libraryModuleName, {}, processingOptions);
	library.unregister(libraryModuleName);
	return variant;
}
shaderChunks.createShader = createShader;
shaderChunks.createShaderFromCode = createShaderFromCode;

export { createShader, createShaderFromCode, processShader };
