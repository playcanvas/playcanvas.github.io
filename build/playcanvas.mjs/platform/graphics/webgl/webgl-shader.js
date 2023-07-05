import '../../../core/debug.js';
import '../../../core/time.js';
import { WebglShaderInput } from './webgl-shader-input.js';
import { semanticToLocation } from '../constants.js';
import { DeviceCache } from '../device-cache.js';

const _vertexShaderBuiltins = ['gl_VertexID', 'gl_InstanceID', 'gl_DrawID', 'gl_BaseVertex', 'gl_BaseInstance'];
class CompiledShaderCache {
	constructor() {
		this.map = new Map();
	}
	destroy(device) {
		this.map.forEach(shader => {
			device.gl.deleteShader(shader);
		});
	}
	loseContext(device) {
		this.map.clear();
	}
}
class ShaderBatchCache {
	constructor() {
		this.shaders = [];
	}
	loseContext(device) {
		this.shaders = [];
	}
}
const _vertexShaderCache = new DeviceCache();
const _fragmentShaderCache = new DeviceCache();
const _shaderBatchCache = new DeviceCache();
class WebglShader {
	constructor(shader) {
		this.compileDuration = 0;
		this.init();
		this.compile(shader.device, shader);
		WebglShader.getBatchShaders(shader.device).push(shader);
		shader.device.shaders.push(shader);
	}
	destroy(shader) {
		if (this.glProgram) {
			shader.device.gl.deleteProgram(this.glProgram);
			this.glProgram = null;
		}
	}
	init() {
		this.uniforms = [];
		this.samplers = [];
		this.attributes = [];
		this.glProgram = null;
		this.glVertexShader = null;
		this.glFragmentShader = null;
	}
	static getBatchShaders(device) {
		const batchCache = _shaderBatchCache.get(device, () => {
			return new ShaderBatchCache();
		});
		return batchCache.shaders;
	}
	static endShaderBatch(device) {
		const shaders = WebglShader.getBatchShaders(device);
		shaders.forEach(shader => shader.impl.link(device, shader));
		shaders.length = 0;
	}
	loseContext() {
		this.init();
	}
	restoreContext(device, shader) {
		this.compile(device, shader);
	}
	compile(device, shader) {
		const definition = shader.definition;
		this.glVertexShader = this._compileShaderSource(device, definition.vshader, true);
		this.glFragmentShader = this._compileShaderSource(device, definition.fshader, false);
	}
	link(device, shader) {
		if (this.glProgram) return;
		const gl = device.gl;
		const glProgram = gl.createProgram();
		this.glProgram = glProgram;
		gl.attachShader(glProgram, this.glVertexShader);
		gl.attachShader(glProgram, this.glFragmentShader);
		const definition = shader.definition;
		const attrs = definition.attributes;
		if (device.webgl2 && definition.useTransformFeedback) {
			const outNames = [];
			for (const attr in attrs) {
				if (attrs.hasOwnProperty(attr)) {
					outNames.push("out_" + attr);
				}
			}
			gl.transformFeedbackVaryings(glProgram, outNames, gl.INTERLEAVED_ATTRIBS);
		}
		for (const attr in attrs) {
			if (attrs.hasOwnProperty(attr)) {
				const semantic = attrs[attr];
				const loc = semanticToLocation[semantic];
				gl.bindAttribLocation(glProgram, loc, attr);
			}
		}
		gl.linkProgram(glProgram);
	}
	_compileShaderSource(device, src, isVertexShader) {
		const gl = device.gl;
		const shaderDeviceCache = isVertexShader ? _vertexShaderCache : _fragmentShaderCache;
		const shaderCache = shaderDeviceCache.get(device, () => {
			return new CompiledShaderCache();
		});
		let glShader = shaderCache.map.get(src);
		if (!glShader) {
			glShader = gl.createShader(isVertexShader ? gl.VERTEX_SHADER : gl.FRAGMENT_SHADER);
			gl.shaderSource(glShader, src);
			gl.compileShader(glShader);
			shaderCache.map.set(src, glShader);
		}
		return glShader;
	}
	finalize(device, shader) {
		if (!this.glProgram) this.link(device, shader);
		const gl = device.gl;
		const glProgram = this.glProgram;
		const definition = shader.definition;
		const linkStatus = gl.getProgramParameter(glProgram, gl.LINK_STATUS);
		if (!linkStatus) {
			if (!this._isCompiled(device, shader, this.glVertexShader, definition.vshader, "vertex")) return false;
			if (!this._isCompiled(device, shader, this.glFragmentShader, definition.fshader, "fragment")) return false;
			const message = "Failed to link shader program. Error: " + gl.getProgramInfoLog(glProgram);
			console.error(message);
			return false;
		}
		let i = 0;
		const numAttributes = gl.getProgramParameter(glProgram, gl.ACTIVE_ATTRIBUTES);
		while (i < numAttributes) {
			const info = gl.getActiveAttrib(glProgram, i++);
			const location = gl.getAttribLocation(glProgram, info.name);
			if (_vertexShaderBuiltins.indexOf(info.name) !== -1) continue;
			if (definition.attributes[info.name] === undefined) {
				console.error(`Vertex shader attribute "${info.name}" is not mapped to a semantic in shader definition, shader [${shader.label}]`, shader);
				shader.failed = true;
			}
			const shaderInput = new WebglShaderInput(device, definition.attributes[info.name], device.pcUniformType[info.type], location);
			this.attributes.push(shaderInput);
		}
		i = 0;
		const numUniforms = gl.getProgramParameter(glProgram, gl.ACTIVE_UNIFORMS);
		while (i < numUniforms) {
			const info = gl.getActiveUniform(glProgram, i++);
			const location = gl.getUniformLocation(glProgram, info.name);
			const shaderInput = new WebglShaderInput(device, info.name, device.pcUniformType[info.type], location);
			if (info.type === gl.SAMPLER_2D || info.type === gl.SAMPLER_CUBE || device.webgl2 && (info.type === gl.SAMPLER_2D_SHADOW || info.type === gl.SAMPLER_CUBE_SHADOW || info.type === gl.SAMPLER_3D)) {
				this.samplers.push(shaderInput);
			} else {
				this.uniforms.push(shaderInput);
			}
		}
		shader.ready = true;
		return true;
	}
	_isCompiled(device, shader, glShader, source, shaderType) {
		const gl = device.gl;
		if (!gl.getShaderParameter(glShader, gl.COMPILE_STATUS)) {
			const infoLog = gl.getShaderInfoLog(glShader);
			const [code, error] = this._processError(source, infoLog);
			const message = `Failed to compile ${shaderType} shader:\n\n${infoLog}\n${code}`;
			console.error(message);
			return false;
		}
		return true;
	}
	_processError(src, infoLog) {
		const error = {};
		let code = '';
		if (src) {
			const lines = src.split('\n');
			let from = 0;
			let to = lines.length;
			if (infoLog && infoLog.startsWith('ERROR:')) {
				const match = infoLog.match(/^ERROR:\s([0-9]+):([0-9]+):\s*(.+)/);
				if (match) {
					error.message = match[3];
					error.line = parseInt(match[2], 10);
					from = Math.max(0, error.line - 6);
					to = Math.min(lines.length, error.line + 5);
				}
			}
			for (let i = from; i < to; i++) {
				code += i + 1 + ":\t" + lines[i] + '\n';
			}
			error.source = src;
		}
		return [code, error];
	}
}

export { WebglShader };
