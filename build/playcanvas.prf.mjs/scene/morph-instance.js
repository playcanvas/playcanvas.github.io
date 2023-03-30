/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import '../core/tracing.js';
import { BLENDEQUATION_ADD, BLENDMODE_ONE } from '../platform/graphics/constants.js';
import { drawQuadWithShader } from './graphics/quad-render-utils.js';
import { RenderTarget } from '../platform/graphics/render-target.js';
import { createShaderFromCode } from './shader-lib/utils.js';
import { BlendState } from '../platform/graphics/blend-state.js';

const textureMorphVertexShader = `
		attribute vec2 vertex_position;
		varying vec2 uv0;
		void main(void) {
				gl_Position = vec4(vertex_position, 0.5, 1.0);
				uv0 = vertex_position.xy * 0.5 + 0.5;
		}
		`;
const blendStateAdditive = new BlendState(true, BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_ONE);
class MorphInstance {
	constructor(morph) {
		this.morph = morph;
		morph.incRefCount();
		this.device = morph.device;
		this._weights = [];
		this._weightMap = new Map();
		for (let v = 0; v < morph._targets.length; v++) {
			const target = morph._targets[v];
			if (target.name) {
				this._weightMap.set(target.name, v);
			}
			this.setWeight(v, target.defaultWeight);
		}
		this._activeTargets = [];
		if (morph.useTextureMorph) {
			this.shaderCache = {};
			this.maxSubmitCount = this.device.maxTextures;
			this._shaderMorphWeights = new Float32Array(this.maxSubmitCount);
			const createRT = (name, textureVar) => {
				this[textureVar] = morph._createTexture(name, morph._renderTextureFormat);
				return new RenderTarget({
					colorBuffer: this[textureVar],
					depth: false
				});
			};
			if (morph.morphPositions) {
				this.rtPositions = createRT('MorphRTPos', 'texturePositions');
			}
			if (morph.morphNormals) {
				this.rtNormals = createRT('MorphRTNrm', 'textureNormals');
			}
			this._textureParams = new Float32Array([morph.morphTextureWidth, morph.morphTextureHeight, 1 / morph.morphTextureWidth, 1 / morph.morphTextureHeight]);
			for (let i = 0; i < this.maxSubmitCount; i++) {
				this['morphBlendTex' + i] = this.device.scope.resolve('morphBlendTex' + i);
			}
			this.morphFactor = this.device.scope.resolve('morphFactor[0]');
			this.zeroTextures = false;
		} else {
			this.maxSubmitCount = 8;
			this._shaderMorphWeights = new Float32Array(this.maxSubmitCount);
			this._shaderMorphWeightsA = new Float32Array(this._shaderMorphWeights.buffer, 0, 4);
			this._shaderMorphWeightsB = new Float32Array(this._shaderMorphWeights.buffer, 4 * 4, 4);
			this._activeVertexBuffers = new Array(this.maxSubmitCount);
		}
	}
	destroy() {
		this.shader = null;
		const morph = this.morph;
		if (morph) {
			this.morph = null;
			morph.decRefCount();
			if (morph.refCount < 1) {
				morph.destroy();
			}
		}
		if (this.rtPositions) {
			this.rtPositions.destroy();
			this.rtPositions = null;
		}
		if (this.texturePositions) {
			this.texturePositions.destroy();
			this.texturePositions = null;
		}
		if (this.rtNormals) {
			this.rtNormals.destroy();
			this.rtNormals = null;
		}
		if (this.textureNormals) {
			this.textureNormals.destroy();
			this.textureNormals = null;
		}
	}
	clone() {
		return new MorphInstance(this.morph);
	}
	_getWeightIndex(key) {
		if (typeof key === 'string') {
			const index = this._weightMap.get(key);
			return index;
		}
		return key;
	}
	getWeight(key) {
		const index = this._getWeightIndex(key);
		return this._weights[index];
	}
	setWeight(key, weight) {
		const index = this._getWeightIndex(key);
		this._weights[index] = weight;
		this._dirty = true;
	}
	_getFragmentShader(numTextures) {
		let fragmentShader = '';
		if (numTextures > 0) {
			fragmentShader += 'varying vec2 uv0;\n' + 'uniform highp float morphFactor[' + numTextures + '];\n';
		}
		for (let i = 0; i < numTextures; i++) {
			fragmentShader += 'uniform highp sampler2D morphBlendTex' + i + ';\n';
		}
		fragmentShader += 'void main (void) {\n' + '    highp vec4 color = vec4(0, 0, 0, 1);\n';
		for (let i = 0; i < numTextures; i++) {
			fragmentShader += '    color.xyz += morphFactor[' + i + '] * texture2D(morphBlendTex' + i + ', uv0).xyz;\n';
		}
		fragmentShader += '    gl_FragColor = color;\n' + '}\n';
		return fragmentShader;
	}
	_getShader(count) {
		let shader = this.shaderCache[count];
		if (!shader) {
			const fs = this._getFragmentShader(count);
			shader = createShaderFromCode(this.device, textureMorphVertexShader, fs, 'textureMorph' + count);
			this.shaderCache[count] = shader;
		}
		return shader;
	}
	_updateTextureRenderTarget(renderTarget, srcTextureName) {
		const device = this.device;
		const submitBatch = (usedCount, blending) => {
			this.morphFactor.setValue(this._shaderMorphWeights);
			device.setBlendState(blending ? blendStateAdditive : BlendState.DEFAULT);
			const shader = this._getShader(usedCount);
			drawQuadWithShader(device, renderTarget, shader);
		};
		let usedCount = 0;
		let blending = false;
		const count = this._activeTargets.length;
		for (let i = 0; i < count; i++) {
			const activeTarget = this._activeTargets[i];
			const tex = activeTarget.target[srcTextureName];
			if (tex) {
				this['morphBlendTex' + usedCount].setValue(tex);
				this._shaderMorphWeights[usedCount] = activeTarget.weight;
				usedCount++;
				if (usedCount >= this.maxSubmitCount) {
					submitBatch(usedCount, blending);
					usedCount = 0;
					blending = true;
				}
			}
		}
		if (usedCount > 0 || count === 0 && !this.zeroTextures) {
			submitBatch(usedCount, blending);
		}
	}
	_updateTextureMorph() {
		this.device;
		if (this._activeTargets.length > 0 || !this.zeroTextures) {
			if (this.rtPositions) this._updateTextureRenderTarget(this.rtPositions, 'texturePositions');
			if (this.rtNormals) this._updateTextureRenderTarget(this.rtNormals, 'textureNormals');
			this.zeroTextures = this._activeTargets.length === 0;
		}
	}
	_updateVertexMorph() {
		const count = this.maxSubmitCount;
		for (let i = 0; i < count; i++) {
			this._shaderMorphWeights[i] = 0;
			this._activeVertexBuffers[i] = null;
		}
		let posIndex = 0;
		let nrmIndex = this.morph.morphPositions ? 4 : 0;
		for (let i = 0; i < this._activeTargets.length; i++) {
			const target = this._activeTargets[i].target;
			if (target._vertexBufferPositions) {
				this._activeVertexBuffers[posIndex] = target._vertexBufferPositions;
				this._shaderMorphWeights[posIndex] = this._activeTargets[i].weight;
				posIndex++;
			}
			if (target._vertexBufferNormals) {
				this._activeVertexBuffers[nrmIndex] = target._vertexBufferNormals;
				this._shaderMorphWeights[nrmIndex] = this._activeTargets[i].weight;
				nrmIndex++;
			}
		}
	}
	update() {
		this._dirty = false;
		const targets = this.morph._targets;
		let activeCount = 0;
		const epsilon = 0.00001;
		for (let i = 0; i < targets.length; i++) {
			const absWeight = Math.abs(this.getWeight(i));
			if (absWeight > epsilon) {
				if (this._activeTargets.length <= activeCount) {
					this._activeTargets[activeCount] = {};
				}
				const activeTarget = this._activeTargets[activeCount++];
				activeTarget.absWeight = absWeight;
				activeTarget.weight = this.getWeight(i);
				activeTarget.target = targets[i];
			}
		}
		this._activeTargets.length = activeCount;
		const maxActiveTargets = this.morph.maxActiveTargets;
		if (this._activeTargets.length > maxActiveTargets) {
			this._activeTargets.sort(function (l, r) {
				return l.absWeight < r.absWeight ? 1 : r.absWeight < l.absWeight ? -1 : 0;
			});
			this._activeTargets.length = maxActiveTargets;
		}
		if (this.morph.useTextureMorph) {
			this._updateTextureMorph();
		} else {
			this._updateVertexMorph();
		}
	}
}

export { MorphInstance };
