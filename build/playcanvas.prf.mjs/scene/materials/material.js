import '../../core/debug.js';
import { CULLFACE_BACK, BLENDMODE_ONE, BLENDEQUATION_REVERSE_SUBTRACT, BLENDMODE_ZERO, BLENDEQUATION_ADD, BLENDMODE_SRC_ALPHA, BLENDMODE_ONE_MINUS_SRC_ALPHA, BLENDMODE_DST_COLOR, BLENDMODE_SRC_COLOR, BLENDMODE_ONE_MINUS_DST_COLOR, BLENDEQUATION_MIN, BLENDEQUATION_MAX } from '../../platform/graphics/constants.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import { DepthState } from '../../platform/graphics/depth-state.js';
import { ShaderProcessorOptions } from '../../platform/graphics/shader-processor-options.js';
import { BLEND_NONE, BLEND_NORMAL, BLEND_SUBTRACTIVE, BLEND_PREMULTIPLIED, BLEND_ADDITIVE, BLEND_ADDITIVEALPHA, BLEND_MULTIPLICATIVE2X, BLEND_SCREEN, BLEND_MULTIPLICATIVE, BLEND_MIN, BLEND_MAX } from '../constants.js';
import { processShader } from '../shader-lib/utils.js';
import { getDefaultMaterial } from './default-material.js';

const blendModes = [];
blendModes[BLEND_SUBTRACTIVE] = {
	src: BLENDMODE_ONE,
	dst: BLENDMODE_ONE,
	op: BLENDEQUATION_REVERSE_SUBTRACT
};
blendModes[BLEND_NONE] = {
	src: BLENDMODE_ONE,
	dst: BLENDMODE_ZERO,
	op: BLENDEQUATION_ADD
};
blendModes[BLEND_NORMAL] = {
	src: BLENDMODE_SRC_ALPHA,
	dst: BLENDMODE_ONE_MINUS_SRC_ALPHA,
	op: BLENDEQUATION_ADD
};
blendModes[BLEND_PREMULTIPLIED] = {
	src: BLENDMODE_ONE,
	dst: BLENDMODE_ONE_MINUS_SRC_ALPHA,
	op: BLENDEQUATION_ADD
};
blendModes[BLEND_ADDITIVE] = {
	src: BLENDMODE_ONE,
	dst: BLENDMODE_ONE,
	op: BLENDEQUATION_ADD
};
blendModes[BLEND_ADDITIVEALPHA] = {
	src: BLENDMODE_SRC_ALPHA,
	dst: BLENDMODE_ONE,
	op: BLENDEQUATION_ADD
};
blendModes[BLEND_MULTIPLICATIVE2X] = {
	src: BLENDMODE_DST_COLOR,
	dst: BLENDMODE_SRC_COLOR,
	op: BLENDEQUATION_ADD
};
blendModes[BLEND_SCREEN] = {
	src: BLENDMODE_ONE_MINUS_DST_COLOR,
	dst: BLENDMODE_ONE,
	op: BLENDEQUATION_ADD
};
blendModes[BLEND_MULTIPLICATIVE] = {
	src: BLENDMODE_DST_COLOR,
	dst: BLENDMODE_ZERO,
	op: BLENDEQUATION_ADD
};
blendModes[BLEND_MIN] = {
	src: BLENDMODE_ONE,
	dst: BLENDMODE_ONE,
	op: BLENDEQUATION_MIN
};
blendModes[BLEND_MAX] = {
	src: BLENDMODE_ONE,
	dst: BLENDMODE_ONE,
	op: BLENDEQUATION_MAX
};
let id = 0;
class Material {
	constructor() {
		this._shader = null;
		this.meshInstances = [];
		this.name = 'Untitled';
		this.id = id++;
		this.variants = {};
		this.parameters = {};
		this.alphaTest = 0;
		this.alphaToCoverage = false;
		this._blendState = new BlendState();
		this._depthState = new DepthState();
		this.cull = CULLFACE_BACK;
		this.stencilFront = null;
		this.stencilBack = null;
		this.depthBias = 0;
		this.slopeDepthBias = 0;
		this._shaderVersion = 0;
		this._scene = null;
		this._dirtyBlend = false;
		this.dirty = true;
	}
	set redWrite(value) {
		this._blendState.redWrite = value;
	}
	get redWrite() {
		return this._blendState.redWrite;
	}
	set greenWrite(value) {
		this._blendState.greenWrite = value;
	}
	get greenWrite() {
		return this._blendState.greenWrite;
	}
	set blueWrite(value) {
		this._blendState.blueWrite = value;
	}
	get blueWrite() {
		return this._blendState.blueWrite;
	}
	set alphaWrite(value) {
		this._blendState.alphaWrite = value;
	}
	get alphaWrite() {
		return this._blendState.alphaWrite;
	}
	set shader(shader) {
		this._shader = shader;
	}
	get shader() {
		return this._shader;
	}
	get transparent() {
		return this._blendState.blend;
	}
	_markBlendDirty() {
		if (this._scene) {
			this._scene.layers._dirtyBlend = true;
		} else {
			this._dirtyBlend = true;
		}
	}
	set blendState(value) {
		if (this._blendState.blend !== value.blend) {
			this._markBlendDirty();
		}
		this._blendState.copy(value);
	}
	get blendState() {
		return this._blendState;
	}
	set blendType(type) {
		const blendMode = blendModes[type];
		this._blendState.setColorBlend(blendMode.op, blendMode.src, blendMode.dst);
		this._blendState.setAlphaBlend(blendMode.op, blendMode.src, blendMode.dst);
		const blend = type !== BLEND_NONE;
		if (this._blendState.blend !== blend) {
			this._blendState.blend = blend;
			this._markBlendDirty();
		}
		this._updateMeshInstanceKeys();
	}
	get blendType() {
		if (!this.transparent) {
			return BLEND_NONE;
		}
		const {
			colorOp,
			colorSrcFactor,
			colorDstFactor,
			alphaOp,
			alphaSrcFactor,
			alphaDstFactor
		} = this._blendState;
		for (let i = 0; i < blendModes.length; i++) {
			const blendMode = blendModes[i];
			if (blendMode.src === colorSrcFactor && blendMode.dst === colorDstFactor && blendMode.op === colorOp && blendMode.src === alphaSrcFactor && blendMode.dst === alphaDstFactor && blendMode.op === alphaOp) {
				return i;
			}
		}
		return BLEND_NORMAL;
	}
	set depthState(value) {
		this._depthState.copy(value);
	}
	get depthState() {
		return this._depthState;
	}
	set depthTest(value) {
		this._depthState.test = value;
	}
	get depthTest() {
		return this._depthState.test;
	}
	set depthFunc(value) {
		this._depthState.func = value;
	}
	get depthFunc() {
		return this._depthState.func;
	}
	set depthWrite(value) {
		this._depthState.write = value;
	}
	get depthWrite() {
		return this._depthState.write;
	}
	copy(source) {
		var _source$stencilFront;
		this.name = source.name;
		this._shader = source._shader;
		this.alphaTest = source.alphaTest;
		this.alphaToCoverage = source.alphaToCoverage;
		this._blendState.copy(source._blendState);
		this._depthState.copy(source._depthState);
		this.cull = source.cull;
		this.depthBias = source.depthBias;
		this.slopeDepthBias = source.slopeDepthBias;
		this.stencilFront = (_source$stencilFront = source.stencilFront) == null ? void 0 : _source$stencilFront.clone();
		if (source.stencilBack) {
			this.stencilBack = source.stencilFront === source.stencilBack ? this.stencilFront : source.stencilBack.clone();
		}
		return this;
	}
	clone() {
		const clone = new this.constructor();
		return clone.copy(this);
	}
	_updateMeshInstanceKeys() {
		const meshInstances = this.meshInstances;
		for (let i = 0; i < meshInstances.length; i++) {
			meshInstances[i].updateKey();
		}
	}
	updateUniforms(device, scene) {}
	getShaderVariant(device, scene, objDefs, staticLightList, pass, sortedLights, viewUniformFormat, viewBindGroupFormat, vertexFormat) {
		const processingOptions = new ShaderProcessorOptions(viewUniformFormat, viewBindGroupFormat, vertexFormat);
		return processShader(this._shader, processingOptions);
	}
	update() {
		this.dirty = true;
		if (this._shader) this._shader.failed = false;
	}
	clearParameters() {
		this.parameters = {};
	}
	getParameters() {
		return this.parameters;
	}
	clearVariants() {
		this.variants = {};
		const meshInstances = this.meshInstances;
		const count = meshInstances.length;
		for (let i = 0; i < count; i++) {
			meshInstances[i].clearShaders();
		}
	}
	getParameter(name) {
		return this.parameters[name];
	}
	setParameter(name, data) {
		if (data === undefined && typeof name === 'object') {
			const uniformObject = name;
			if (uniformObject.length) {
				for (let i = 0; i < uniformObject.length; i++) {
					this.setParameter(uniformObject[i]);
				}
				return;
			}
			name = uniformObject.name;
			data = uniformObject.value;
		}
		const param = this.parameters[name];
		if (param) {
			param.data = data;
		} else {
			this.parameters[name] = {
				scopeId: null,
				data: data
			};
		}
	}
	deleteParameter(name) {
		if (this.parameters[name]) {
			delete this.parameters[name];
		}
	}
	setParameters(device, names) {
		const parameters = this.parameters;
		if (names === undefined) names = parameters;
		for (const paramName in names) {
			const parameter = parameters[paramName];
			if (parameter) {
				if (!parameter.scopeId) {
					parameter.scopeId = device.scope.resolve(paramName);
				}
				parameter.scopeId.setValue(parameter.data);
			}
		}
	}
	destroy() {
		this.variants = {};
		this._shader = null;
		for (let i = 0; i < this.meshInstances.length; i++) {
			const meshInstance = this.meshInstances[i];
			meshInstance.clearShaders();
			meshInstance._material = null;
			if (meshInstance.mesh) {
				const defaultMaterial = getDefaultMaterial(meshInstance.mesh.device);
				if (this !== defaultMaterial) {
					meshInstance.material = defaultMaterial;
				}
			}
		}
		this.meshInstances.length = 0;
	}
	addMeshInstanceRef(meshInstance) {
		this.meshInstances.push(meshInstance);
	}
	removeMeshInstanceRef(meshInstance) {
		const meshInstances = this.meshInstances;
		const i = meshInstances.indexOf(meshInstance);
		if (i !== -1) {
			meshInstances.splice(i, 1);
		}
	}
}

export { Material };
