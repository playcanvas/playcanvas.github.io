import { Debug } from '../core/debug.js';
import { BLENDEQUATION_ADD, BLENDMODE_ONE } from '../platform/graphics/constants.js';
import { drawQuadWithShader } from './graphics/quad-render-utils.js';
import { RenderTarget } from '../platform/graphics/render-target.js';
import { DebugGraphics } from '../platform/graphics/debug-graphics.js';
import { createShaderFromCode } from './shader-lib/utils.js';
import { BlendState } from '../platform/graphics/blend-state.js';

// vertex shader used to add morph targets from textures into render target
const textureMorphVertexShader = `
    attribute vec2 vertex_position;
    varying vec2 uv0;
    void main(void) {
        gl_Position = vec4(vertex_position, 0.5, 1.0);
        uv0 = vertex_position.xy * 0.5 + 0.5;
    }
    `;
const blendStateAdditive = new BlendState(true, BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_ONE);

/**
 * An instance of {@link Morph}. Contains weights to assign to every {@link MorphTarget}, manages
 * selection of active morph targets.
 */
class MorphInstance {
  /**
   * Create a new MorphInstance instance.
   *
   * @param {import('./morph.js').Morph} morph - The {@link Morph} to instance.
   */
  constructor(morph) {
    /**
     * The morph with its targets, which is being instanced.
     *
     * @type {import('./morph.js').Morph}
     */
    this.morph = morph;
    morph.incRefCount();
    this.device = morph.device;

    // weights
    this._weights = [];
    this._weightMap = new Map();
    for (let v = 0; v < morph._targets.length; v++) {
      const target = morph._targets[v];
      if (target.name) {
        this._weightMap.set(target.name, v);
      }
      this.setWeight(v, target.defaultWeight);
    }

    // temporary array of targets with non-zero weight
    this._activeTargets = [];
    if (morph.useTextureMorph) {
      // shader cache
      this.shaderCache = {};

      // max number of morph targets rendered at a time (each uses single texture slot)
      this.maxSubmitCount = this.device.maxTextures;

      // array for max number of weights
      this._shaderMorphWeights = new Float32Array(this.maxSubmitCount);

      // create render targets to morph targets into
      const createRT = (name, textureVar) => {
        // render to appropriate, RGBA formats, we cannot render to RGB float / half float format in WEbGL
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

      // texture params
      this._textureParams = new Float32Array([morph.morphTextureWidth, morph.morphTextureHeight, 1 / morph.morphTextureWidth, 1 / morph.morphTextureHeight]);

      // resolve possible texture names
      for (let i = 0; i < this.maxSubmitCount; i++) {
        this['morphBlendTex' + i] = this.device.scope.resolve('morphBlendTex' + i);
      }
      this.morphFactor = this.device.scope.resolve('morphFactor[0]');

      // true indicates render target textures are full of zeros to avoid rendering to them when all weights are zero
      this.zeroTextures = false;
    } else {
      // vertex attribute based morphing

      // max number of morph targets rendered at a time
      this.maxSubmitCount = 8;

      // weights of active vertex buffers in format used by rendering
      this._shaderMorphWeights = new Float32Array(this.maxSubmitCount); // whole array
      this._shaderMorphWeightsA = new Float32Array(this._shaderMorphWeights.buffer, 0, 4); // first 4 elements
      this._shaderMorphWeightsB = new Float32Array(this._shaderMorphWeights.buffer, 4 * 4, 4); // second 4 elements

      // pre-allocate array of active vertex buffers used by rendering
      this._activeVertexBuffers = new Array(this.maxSubmitCount);
    }
  }

  /**
   * Frees video memory allocated by this object.
   */
  destroy() {
    // don't destroy shader as it's in the cache and can be used by other materials
    this.shader = null;
    const morph = this.morph;
    if (morph) {
      // decrease ref count
      this.morph = null;
      morph.decRefCount();

      // destroy morph
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

  /**
   * Clones a MorphInstance. The returned clone uses the same {@link Morph} and weights are set
   * to defaults.
   *
   * @returns {MorphInstance} A clone of the specified MorphInstance.
   */
  clone() {
    return new MorphInstance(this.morph);
  }
  _getWeightIndex(key) {
    if (typeof key === 'string') {
      const index = this._weightMap.get(key);
      if (index === undefined) {
        Debug.error(`Cannot find morph target with name: ${key}.`);
      }
      return index;
    }
    return key;
  }

  /**
   * Gets current weight of the specified morph target.
   *
   * @param {string|number} key - An identifier for the morph target. Either the weight index or
   * the weight name.
   * @returns {number} Weight.
   */
  getWeight(key) {
    const index = this._getWeightIndex(key);
    return this._weights[index];
  }

  /**
   * Sets weight of the specified morph target.
   *
   * @param {string|number} key - An identifier for the morph target. Either the weight index or
   * the weight name.
   * @param {number} weight - Weight.
   */
  setWeight(key, weight) {
    const index = this._getWeightIndex(key);
    Debug.assert(index >= 0 && index < this.morph._targets.length);
    this._weights[index] = weight;
    this._dirty = true;
  }

  /**
   * Generate fragment shader to blend a number of textures using specified weights.
   *
   * @param {number} numTextures - Number of textures to blend.
   * @returns {string} Fragment shader.
   * @private
   */
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

  /**
   * Create complete shader for texture based morphing.
   *
   * @param {number} count - Number of textures to blend.
   * @returns {import('../platform/graphics/shader.js').Shader} Shader.
   * @private
   */
  _getShader(count) {
    let shader = this.shaderCache[count];

    // if shader is not in cache, generate one
    if (!shader) {
      const fs = this._getFragmentShader(count);
      shader = createShaderFromCode(this.device, textureMorphVertexShader, fs, 'textureMorph' + count);
      this.shaderCache[count] = shader;
    }
    return shader;
  }
  _updateTextureRenderTarget(renderTarget, srcTextureName) {
    const device = this.device;

    // blend currently set up textures to render target
    const submitBatch = (usedCount, blending) => {
      // factors
      this.morphFactor.setValue(this._shaderMorphWeights);

      // alpha blending - first pass gets none, following passes are additive
      device.setBlendState(blending ? blendStateAdditive : BlendState.DEFAULT);

      // render quad with shader for required number of textures
      const shader = this._getShader(usedCount);
      drawQuadWithShader(device, renderTarget, shader);
    };

    // set up parameters for active blend targets
    let usedCount = 0;
    let blending = false;
    const count = this._activeTargets.length;
    for (let i = 0; i < count; i++) {
      const activeTarget = this._activeTargets[i];
      const tex = activeTarget.target[srcTextureName];
      if (tex) {
        // texture
        this['morphBlendTex' + usedCount].setValue(tex);

        // weight
        this._shaderMorphWeights[usedCount] = activeTarget.weight;

        // submit if batch is full
        usedCount++;
        if (usedCount >= this.maxSubmitCount) {
          submitBatch(usedCount, blending);
          usedCount = 0;
          blending = true;
        }
      }
    }

    // leftover batch, or just to clear texture
    if (usedCount > 0 || count === 0 && !this.zeroTextures) {
      submitBatch(usedCount, blending);
    }
  }
  _updateTextureMorph() {
    const device = this.device;
    DebugGraphics.pushGpuMarker(device, 'MorphUpdate');

    // update textures if active targets, or no active targets and textures need to be cleared
    if (this._activeTargets.length > 0 || !this.zeroTextures) {
      // blend morph targets into render targets
      if (this.rtPositions) this._updateTextureRenderTarget(this.rtPositions, 'texturePositions');
      if (this.rtNormals) this._updateTextureRenderTarget(this.rtNormals, 'textureNormals');

      // textures were cleared if no active targets
      this.zeroTextures = this._activeTargets.length === 0;
    }
    DebugGraphics.popGpuMarker(device);
  }
  _updateVertexMorph() {
    // prepare 8 slots for rendering. these are supported combinations: PPPPPPPP, NNNNNNNN, PPPPNNNN
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

  /**
   * Selects active morph targets and prepares morph for rendering. Called automatically by
   * renderer.
   */
  update() {
    this._dirty = false;
    const targets = this.morph._targets;

    // collect active targets, reuse objects in _activeTargets array to avoid allocations
    let activeCount = 0;
    const epsilon = 0.00001;
    for (let i = 0; i < targets.length; i++) {
      const absWeight = Math.abs(this.getWeight(i));
      if (absWeight > epsilon) {
        // create new object if needed
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

    // if there's more active targets then rendering supports
    const maxActiveTargets = this.morph.maxActiveTargets;
    if (this._activeTargets.length > maxActiveTargets) {
      // sort them by absWeight
      this._activeTargets.sort(function (l, r) {
        return l.absWeight < r.absWeight ? 1 : r.absWeight < l.absWeight ? -1 : 0;
      });

      // remove excess
      this._activeTargets.length = maxActiveTargets;
    }

    // prepare for rendering
    if (this.morph.useTextureMorph) {
      this._updateTextureMorph();
    } else {
      this._updateVertexMorph();
    }
  }
}

export { MorphInstance };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9ycGgtaW5zdGFuY2UuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9zY2VuZS9tb3JwaC1pbnN0YW5jZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uL2NvcmUvZGVidWcuanMnO1xuXG5pbXBvcnQgeyBCTEVOREVRVUFUSU9OX0FERCwgQkxFTkRNT0RFX09ORSB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBkcmF3UXVhZFdpdGhTaGFkZXIgfSBmcm9tICcuL2dyYXBoaWNzL3F1YWQtcmVuZGVyLXV0aWxzLmpzJztcbmltcG9ydCB7IFJlbmRlclRhcmdldCB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3JlbmRlci10YXJnZXQuanMnO1xuaW1wb3J0IHsgRGVidWdHcmFwaGljcyB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2RlYnVnLWdyYXBoaWNzLmpzJztcblxuaW1wb3J0IHsgY3JlYXRlU2hhZGVyRnJvbUNvZGUgfSBmcm9tICcuL3NoYWRlci1saWIvdXRpbHMuanMnO1xuaW1wb3J0IHsgQmxlbmRTdGF0ZSB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2JsZW5kLXN0YXRlLmpzJztcblxuLy8gdmVydGV4IHNoYWRlciB1c2VkIHRvIGFkZCBtb3JwaCB0YXJnZXRzIGZyb20gdGV4dHVyZXMgaW50byByZW5kZXIgdGFyZ2V0XG5jb25zdCB0ZXh0dXJlTW9ycGhWZXJ0ZXhTaGFkZXIgPSBgXG4gICAgYXR0cmlidXRlIHZlYzIgdmVydGV4X3Bvc2l0aW9uO1xuICAgIHZhcnlpbmcgdmVjMiB1djA7XG4gICAgdm9pZCBtYWluKHZvaWQpIHtcbiAgICAgICAgZ2xfUG9zaXRpb24gPSB2ZWM0KHZlcnRleF9wb3NpdGlvbiwgMC41LCAxLjApO1xuICAgICAgICB1djAgPSB2ZXJ0ZXhfcG9zaXRpb24ueHkgKiAwLjUgKyAwLjU7XG4gICAgfVxuICAgIGA7XG5cbmNvbnN0IGJsZW5kU3RhdGVBZGRpdGl2ZSA9IG5ldyBCbGVuZFN0YXRlKHRydWUsIEJMRU5ERVFVQVRJT05fQURELCBCTEVORE1PREVfT05FLCBCTEVORE1PREVfT05FKTtcblxuLyoqXG4gKiBBbiBpbnN0YW5jZSBvZiB7QGxpbmsgTW9ycGh9LiBDb250YWlucyB3ZWlnaHRzIHRvIGFzc2lnbiB0byBldmVyeSB7QGxpbmsgTW9ycGhUYXJnZXR9LCBtYW5hZ2VzXG4gKiBzZWxlY3Rpb24gb2YgYWN0aXZlIG1vcnBoIHRhcmdldHMuXG4gKi9cbmNsYXNzIE1vcnBoSW5zdGFuY2Uge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBNb3JwaEluc3RhbmNlIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vbW9ycGguanMnKS5Nb3JwaH0gbW9ycGggLSBUaGUge0BsaW5rIE1vcnBofSB0byBpbnN0YW5jZS5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3Rvcihtb3JwaCkge1xuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIG1vcnBoIHdpdGggaXRzIHRhcmdldHMsIHdoaWNoIGlzIGJlaW5nIGluc3RhbmNlZC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2ltcG9ydCgnLi9tb3JwaC5qcycpLk1vcnBofVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5tb3JwaCA9IG1vcnBoO1xuICAgICAgICBtb3JwaC5pbmNSZWZDb3VudCgpO1xuICAgICAgICB0aGlzLmRldmljZSA9IG1vcnBoLmRldmljZTtcblxuICAgICAgICAvLyB3ZWlnaHRzXG4gICAgICAgIHRoaXMuX3dlaWdodHMgPSBbXTtcbiAgICAgICAgdGhpcy5fd2VpZ2h0TWFwID0gbmV3IE1hcCgpO1xuICAgICAgICBmb3IgKGxldCB2ID0gMDsgdiA8IG1vcnBoLl90YXJnZXRzLmxlbmd0aDsgdisrKSB7XG4gICAgICAgICAgICBjb25zdCB0YXJnZXQgPSBtb3JwaC5fdGFyZ2V0c1t2XTtcbiAgICAgICAgICAgIGlmICh0YXJnZXQubmFtZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3dlaWdodE1hcC5zZXQodGFyZ2V0Lm5hbWUsIHYpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5zZXRXZWlnaHQodiwgdGFyZ2V0LmRlZmF1bHRXZWlnaHQpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gdGVtcG9yYXJ5IGFycmF5IG9mIHRhcmdldHMgd2l0aCBub24temVybyB3ZWlnaHRcbiAgICAgICAgdGhpcy5fYWN0aXZlVGFyZ2V0cyA9IFtdO1xuXG4gICAgICAgIGlmIChtb3JwaC51c2VUZXh0dXJlTW9ycGgpIHtcblxuICAgICAgICAgICAgLy8gc2hhZGVyIGNhY2hlXG4gICAgICAgICAgICB0aGlzLnNoYWRlckNhY2hlID0ge307XG5cbiAgICAgICAgICAgIC8vIG1heCBudW1iZXIgb2YgbW9ycGggdGFyZ2V0cyByZW5kZXJlZCBhdCBhIHRpbWUgKGVhY2ggdXNlcyBzaW5nbGUgdGV4dHVyZSBzbG90KVxuICAgICAgICAgICAgdGhpcy5tYXhTdWJtaXRDb3VudCA9IHRoaXMuZGV2aWNlLm1heFRleHR1cmVzO1xuXG4gICAgICAgICAgICAvLyBhcnJheSBmb3IgbWF4IG51bWJlciBvZiB3ZWlnaHRzXG4gICAgICAgICAgICB0aGlzLl9zaGFkZXJNb3JwaFdlaWdodHMgPSBuZXcgRmxvYXQzMkFycmF5KHRoaXMubWF4U3VibWl0Q291bnQpO1xuXG4gICAgICAgICAgICAvLyBjcmVhdGUgcmVuZGVyIHRhcmdldHMgdG8gbW9ycGggdGFyZ2V0cyBpbnRvXG4gICAgICAgICAgICBjb25zdCBjcmVhdGVSVCA9IChuYW1lLCB0ZXh0dXJlVmFyKSA9PiB7XG5cbiAgICAgICAgICAgICAgICAvLyByZW5kZXIgdG8gYXBwcm9wcmlhdGUsIFJHQkEgZm9ybWF0cywgd2UgY2Fubm90IHJlbmRlciB0byBSR0IgZmxvYXQgLyBoYWxmIGZsb2F0IGZvcm1hdCBpbiBXRWJHTFxuICAgICAgICAgICAgICAgIHRoaXNbdGV4dHVyZVZhcl0gPSBtb3JwaC5fY3JlYXRlVGV4dHVyZShuYW1lLCBtb3JwaC5fcmVuZGVyVGV4dHVyZUZvcm1hdCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBSZW5kZXJUYXJnZXQoe1xuICAgICAgICAgICAgICAgICAgICBjb2xvckJ1ZmZlcjogdGhpc1t0ZXh0dXJlVmFyXSxcbiAgICAgICAgICAgICAgICAgICAgZGVwdGg6IGZhbHNlXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBpZiAobW9ycGgubW9ycGhQb3NpdGlvbnMpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnJ0UG9zaXRpb25zID0gY3JlYXRlUlQoJ01vcnBoUlRQb3MnLCAndGV4dHVyZVBvc2l0aW9ucycpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAobW9ycGgubW9ycGhOb3JtYWxzKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5ydE5vcm1hbHMgPSBjcmVhdGVSVCgnTW9ycGhSVE5ybScsICd0ZXh0dXJlTm9ybWFscycpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyB0ZXh0dXJlIHBhcmFtc1xuICAgICAgICAgICAgdGhpcy5fdGV4dHVyZVBhcmFtcyA9IG5ldyBGbG9hdDMyQXJyYXkoW21vcnBoLm1vcnBoVGV4dHVyZVdpZHRoLCBtb3JwaC5tb3JwaFRleHR1cmVIZWlnaHQsXG4gICAgICAgICAgICAgICAgMSAvIG1vcnBoLm1vcnBoVGV4dHVyZVdpZHRoLCAxIC8gbW9ycGgubW9ycGhUZXh0dXJlSGVpZ2h0XSk7XG5cbiAgICAgICAgICAgIC8vIHJlc29sdmUgcG9zc2libGUgdGV4dHVyZSBuYW1lc1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLm1heFN1Ym1pdENvdW50OyBpKyspIHtcbiAgICAgICAgICAgICAgICB0aGlzWydtb3JwaEJsZW5kVGV4JyArIGldID0gdGhpcy5kZXZpY2Uuc2NvcGUucmVzb2x2ZSgnbW9ycGhCbGVuZFRleCcgKyBpKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5tb3JwaEZhY3RvciA9IHRoaXMuZGV2aWNlLnNjb3BlLnJlc29sdmUoJ21vcnBoRmFjdG9yWzBdJyk7XG5cbiAgICAgICAgICAgIC8vIHRydWUgaW5kaWNhdGVzIHJlbmRlciB0YXJnZXQgdGV4dHVyZXMgYXJlIGZ1bGwgb2YgemVyb3MgdG8gYXZvaWQgcmVuZGVyaW5nIHRvIHRoZW0gd2hlbiBhbGwgd2VpZ2h0cyBhcmUgemVyb1xuICAgICAgICAgICAgdGhpcy56ZXJvVGV4dHVyZXMgPSBmYWxzZTtcblxuICAgICAgICB9IGVsc2UgeyAgICAvLyB2ZXJ0ZXggYXR0cmlidXRlIGJhc2VkIG1vcnBoaW5nXG5cbiAgICAgICAgICAgIC8vIG1heCBudW1iZXIgb2YgbW9ycGggdGFyZ2V0cyByZW5kZXJlZCBhdCBhIHRpbWVcbiAgICAgICAgICAgIHRoaXMubWF4U3VibWl0Q291bnQgPSA4O1xuXG4gICAgICAgICAgICAvLyB3ZWlnaHRzIG9mIGFjdGl2ZSB2ZXJ0ZXggYnVmZmVycyBpbiBmb3JtYXQgdXNlZCBieSByZW5kZXJpbmdcbiAgICAgICAgICAgIHRoaXMuX3NoYWRlck1vcnBoV2VpZ2h0cyA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy5tYXhTdWJtaXRDb3VudCk7ICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gd2hvbGUgYXJyYXlcbiAgICAgICAgICAgIHRoaXMuX3NoYWRlck1vcnBoV2VpZ2h0c0EgPSBuZXcgRmxvYXQzMkFycmF5KHRoaXMuX3NoYWRlck1vcnBoV2VpZ2h0cy5idWZmZXIsIDAsIDQpOyAgICAgICAgLy8gZmlyc3QgNCBlbGVtZW50c1xuICAgICAgICAgICAgdGhpcy5fc2hhZGVyTW9ycGhXZWlnaHRzQiA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy5fc2hhZGVyTW9ycGhXZWlnaHRzLmJ1ZmZlciwgNCAqIDQsIDQpOyAgICAvLyBzZWNvbmQgNCBlbGVtZW50c1xuXG4gICAgICAgICAgICAvLyBwcmUtYWxsb2NhdGUgYXJyYXkgb2YgYWN0aXZlIHZlcnRleCBidWZmZXJzIHVzZWQgYnkgcmVuZGVyaW5nXG4gICAgICAgICAgICB0aGlzLl9hY3RpdmVWZXJ0ZXhCdWZmZXJzID0gbmV3IEFycmF5KHRoaXMubWF4U3VibWl0Q291bnQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRnJlZXMgdmlkZW8gbWVtb3J5IGFsbG9jYXRlZCBieSB0aGlzIG9iamVjdC5cbiAgICAgKi9cbiAgICBkZXN0cm95KCkge1xuXG4gICAgICAgIC8vIGRvbid0IGRlc3Ryb3kgc2hhZGVyIGFzIGl0J3MgaW4gdGhlIGNhY2hlIGFuZCBjYW4gYmUgdXNlZCBieSBvdGhlciBtYXRlcmlhbHNcbiAgICAgICAgdGhpcy5zaGFkZXIgPSBudWxsO1xuXG4gICAgICAgIGNvbnN0IG1vcnBoID0gdGhpcy5tb3JwaDtcbiAgICAgICAgaWYgKG1vcnBoKSB7XG5cbiAgICAgICAgICAgIC8vIGRlY3JlYXNlIHJlZiBjb3VudFxuICAgICAgICAgICAgdGhpcy5tb3JwaCA9IG51bGw7XG4gICAgICAgICAgICBtb3JwaC5kZWNSZWZDb3VudCgpO1xuXG4gICAgICAgICAgICAvLyBkZXN0cm95IG1vcnBoXG4gICAgICAgICAgICBpZiAobW9ycGgucmVmQ291bnQgPCAxKSB7XG4gICAgICAgICAgICAgICAgbW9ycGguZGVzdHJveSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMucnRQb3NpdGlvbnMpIHtcbiAgICAgICAgICAgIHRoaXMucnRQb3NpdGlvbnMuZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy5ydFBvc2l0aW9ucyA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy50ZXh0dXJlUG9zaXRpb25zKSB7XG4gICAgICAgICAgICB0aGlzLnRleHR1cmVQb3NpdGlvbnMuZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy50ZXh0dXJlUG9zaXRpb25zID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnJ0Tm9ybWFscykge1xuICAgICAgICAgICAgdGhpcy5ydE5vcm1hbHMuZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy5ydE5vcm1hbHMgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMudGV4dHVyZU5vcm1hbHMpIHtcbiAgICAgICAgICAgIHRoaXMudGV4dHVyZU5vcm1hbHMuZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy50ZXh0dXJlTm9ybWFscyA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDbG9uZXMgYSBNb3JwaEluc3RhbmNlLiBUaGUgcmV0dXJuZWQgY2xvbmUgdXNlcyB0aGUgc2FtZSB7QGxpbmsgTW9ycGh9IGFuZCB3ZWlnaHRzIGFyZSBzZXRcbiAgICAgKiB0byBkZWZhdWx0cy5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtNb3JwaEluc3RhbmNlfSBBIGNsb25lIG9mIHRoZSBzcGVjaWZpZWQgTW9ycGhJbnN0YW5jZS5cbiAgICAgKi9cbiAgICBjbG9uZSgpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBNb3JwaEluc3RhbmNlKHRoaXMubW9ycGgpO1xuICAgIH1cblxuICAgIF9nZXRXZWlnaHRJbmRleChrZXkpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBrZXkgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMuX3dlaWdodE1hcC5nZXQoa2V5KTtcbiAgICAgICAgICAgIGlmIChpbmRleCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgRGVidWcuZXJyb3IoYENhbm5vdCBmaW5kIG1vcnBoIHRhcmdldCB3aXRoIG5hbWU6ICR7a2V5fS5gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBpbmRleDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4ga2V5O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldHMgY3VycmVudCB3ZWlnaHQgb2YgdGhlIHNwZWNpZmllZCBtb3JwaCB0YXJnZXQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ3xudW1iZXJ9IGtleSAtIEFuIGlkZW50aWZpZXIgZm9yIHRoZSBtb3JwaCB0YXJnZXQuIEVpdGhlciB0aGUgd2VpZ2h0IGluZGV4IG9yXG4gICAgICogdGhlIHdlaWdodCBuYW1lLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFdlaWdodC5cbiAgICAgKi9cbiAgICBnZXRXZWlnaHQoa2V5KSB7XG4gICAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5fZ2V0V2VpZ2h0SW5kZXgoa2V5KTtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3dlaWdodHNbaW5kZXhdO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgd2VpZ2h0IG9mIHRoZSBzcGVjaWZpZWQgbW9ycGggdGFyZ2V0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd8bnVtYmVyfSBrZXkgLSBBbiBpZGVudGlmaWVyIGZvciB0aGUgbW9ycGggdGFyZ2V0LiBFaXRoZXIgdGhlIHdlaWdodCBpbmRleCBvclxuICAgICAqIHRoZSB3ZWlnaHQgbmFtZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gd2VpZ2h0IC0gV2VpZ2h0LlxuICAgICAqL1xuICAgIHNldFdlaWdodChrZXksIHdlaWdodCkge1xuICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMuX2dldFdlaWdodEluZGV4KGtleSk7XG4gICAgICAgIERlYnVnLmFzc2VydChpbmRleCA+PSAwICYmIGluZGV4IDwgdGhpcy5tb3JwaC5fdGFyZ2V0cy5sZW5ndGgpO1xuICAgICAgICB0aGlzLl93ZWlnaHRzW2luZGV4XSA9IHdlaWdodDtcbiAgICAgICAgdGhpcy5fZGlydHkgPSB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdlbmVyYXRlIGZyYWdtZW50IHNoYWRlciB0byBibGVuZCBhIG51bWJlciBvZiB0ZXh0dXJlcyB1c2luZyBzcGVjaWZpZWQgd2VpZ2h0cy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBudW1UZXh0dXJlcyAtIE51bWJlciBvZiB0ZXh0dXJlcyB0byBibGVuZC5cbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfSBGcmFnbWVudCBzaGFkZXIuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZ2V0RnJhZ21lbnRTaGFkZXIobnVtVGV4dHVyZXMpIHtcblxuICAgICAgICBsZXQgZnJhZ21lbnRTaGFkZXIgPSAnJztcblxuICAgICAgICBpZiAobnVtVGV4dHVyZXMgPiAwKSB7XG4gICAgICAgICAgICBmcmFnbWVudFNoYWRlciArPSAndmFyeWluZyB2ZWMyIHV2MDtcXG4nICtcbiAgICAgICAgICAgICAgICAndW5pZm9ybSBoaWdocCBmbG9hdCBtb3JwaEZhY3RvclsnICsgbnVtVGV4dHVyZXMgKyAnXTtcXG4nO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1UZXh0dXJlczsgaSsrKSB7XG4gICAgICAgICAgICBmcmFnbWVudFNoYWRlciArPSAndW5pZm9ybSBoaWdocCBzYW1wbGVyMkQgbW9ycGhCbGVuZFRleCcgKyBpICsgJztcXG4nO1xuICAgICAgICB9XG5cbiAgICAgICAgZnJhZ21lbnRTaGFkZXIgKz0gJ3ZvaWQgbWFpbiAodm9pZCkge1xcbicgK1xuICAgICAgICAgICAgJyAgICBoaWdocCB2ZWM0IGNvbG9yID0gdmVjNCgwLCAwLCAwLCAxKTtcXG4nO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtVGV4dHVyZXM7IGkrKykge1xuICAgICAgICAgICAgZnJhZ21lbnRTaGFkZXIgKz0gJyAgICBjb2xvci54eXogKz0gbW9ycGhGYWN0b3JbJyArIGkgKyAnXSAqIHRleHR1cmUyRChtb3JwaEJsZW5kVGV4JyArIGkgKyAnLCB1djApLnh5ejtcXG4nO1xuICAgICAgICB9XG5cbiAgICAgICAgZnJhZ21lbnRTaGFkZXIgKz0gJyAgICBnbF9GcmFnQ29sb3IgPSBjb2xvcjtcXG4nICtcbiAgICAgICAgICAgICd9XFxuJztcblxuICAgICAgICByZXR1cm4gZnJhZ21lbnRTaGFkZXI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGNvbXBsZXRlIHNoYWRlciBmb3IgdGV4dHVyZSBiYXNlZCBtb3JwaGluZy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBjb3VudCAtIE51bWJlciBvZiB0ZXh0dXJlcyB0byBibGVuZC5cbiAgICAgKiBAcmV0dXJucyB7aW1wb3J0KCcuLi9wbGF0Zm9ybS9ncmFwaGljcy9zaGFkZXIuanMnKS5TaGFkZXJ9IFNoYWRlci5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9nZXRTaGFkZXIoY291bnQpIHtcblxuICAgICAgICBsZXQgc2hhZGVyID0gdGhpcy5zaGFkZXJDYWNoZVtjb3VudF07XG5cbiAgICAgICAgLy8gaWYgc2hhZGVyIGlzIG5vdCBpbiBjYWNoZSwgZ2VuZXJhdGUgb25lXG4gICAgICAgIGlmICghc2hhZGVyKSB7XG4gICAgICAgICAgICBjb25zdCBmcyA9IHRoaXMuX2dldEZyYWdtZW50U2hhZGVyKGNvdW50KTtcbiAgICAgICAgICAgIHNoYWRlciA9IGNyZWF0ZVNoYWRlckZyb21Db2RlKHRoaXMuZGV2aWNlLCB0ZXh0dXJlTW9ycGhWZXJ0ZXhTaGFkZXIsIGZzLCAndGV4dHVyZU1vcnBoJyArIGNvdW50KTtcbiAgICAgICAgICAgIHRoaXMuc2hhZGVyQ2FjaGVbY291bnRdID0gc2hhZGVyO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHNoYWRlcjtcbiAgICB9XG5cbiAgICBfdXBkYXRlVGV4dHVyZVJlbmRlclRhcmdldChyZW5kZXJUYXJnZXQsIHNyY1RleHR1cmVOYW1lKSB7XG5cbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG5cbiAgICAgICAgLy8gYmxlbmQgY3VycmVudGx5IHNldCB1cCB0ZXh0dXJlcyB0byByZW5kZXIgdGFyZ2V0XG4gICAgICAgIGNvbnN0IHN1Ym1pdEJhdGNoID0gKHVzZWRDb3VudCwgYmxlbmRpbmcpID0+IHtcblxuICAgICAgICAgICAgLy8gZmFjdG9yc1xuICAgICAgICAgICAgdGhpcy5tb3JwaEZhY3Rvci5zZXRWYWx1ZSh0aGlzLl9zaGFkZXJNb3JwaFdlaWdodHMpO1xuXG4gICAgICAgICAgICAvLyBhbHBoYSBibGVuZGluZyAtIGZpcnN0IHBhc3MgZ2V0cyBub25lLCBmb2xsb3dpbmcgcGFzc2VzIGFyZSBhZGRpdGl2ZVxuICAgICAgICAgICAgZGV2aWNlLnNldEJsZW5kU3RhdGUoYmxlbmRpbmcgPyBibGVuZFN0YXRlQWRkaXRpdmUgOiBCbGVuZFN0YXRlLkRFRkFVTFQpO1xuXG4gICAgICAgICAgICAvLyByZW5kZXIgcXVhZCB3aXRoIHNoYWRlciBmb3IgcmVxdWlyZWQgbnVtYmVyIG9mIHRleHR1cmVzXG4gICAgICAgICAgICBjb25zdCBzaGFkZXIgPSB0aGlzLl9nZXRTaGFkZXIodXNlZENvdW50KTtcbiAgICAgICAgICAgIGRyYXdRdWFkV2l0aFNoYWRlcihkZXZpY2UsIHJlbmRlclRhcmdldCwgc2hhZGVyKTtcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBzZXQgdXAgcGFyYW1ldGVycyBmb3IgYWN0aXZlIGJsZW5kIHRhcmdldHNcbiAgICAgICAgbGV0IHVzZWRDb3VudCA9IDA7XG4gICAgICAgIGxldCBibGVuZGluZyA9IGZhbHNlO1xuICAgICAgICBjb25zdCBjb3VudCA9IHRoaXMuX2FjdGl2ZVRhcmdldHMubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNvdW50OyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGFjdGl2ZVRhcmdldCA9IHRoaXMuX2FjdGl2ZVRhcmdldHNbaV07XG4gICAgICAgICAgICBjb25zdCB0ZXggPSBhY3RpdmVUYXJnZXQudGFyZ2V0W3NyY1RleHR1cmVOYW1lXTtcbiAgICAgICAgICAgIGlmICh0ZXgpIHtcblxuICAgICAgICAgICAgICAgIC8vIHRleHR1cmVcbiAgICAgICAgICAgICAgICB0aGlzWydtb3JwaEJsZW5kVGV4JyArIHVzZWRDb3VudF0uc2V0VmFsdWUodGV4KTtcblxuICAgICAgICAgICAgICAgIC8vIHdlaWdodFxuICAgICAgICAgICAgICAgIHRoaXMuX3NoYWRlck1vcnBoV2VpZ2h0c1t1c2VkQ291bnRdID0gYWN0aXZlVGFyZ2V0LndlaWdodDtcblxuICAgICAgICAgICAgICAgIC8vIHN1Ym1pdCBpZiBiYXRjaCBpcyBmdWxsXG4gICAgICAgICAgICAgICAgdXNlZENvdW50Kys7XG4gICAgICAgICAgICAgICAgaWYgKHVzZWRDb3VudCA+PSB0aGlzLm1heFN1Ym1pdENvdW50KSB7XG5cbiAgICAgICAgICAgICAgICAgICAgc3VibWl0QmF0Y2godXNlZENvdW50LCBibGVuZGluZyk7XG4gICAgICAgICAgICAgICAgICAgIHVzZWRDb3VudCA9IDA7XG4gICAgICAgICAgICAgICAgICAgIGJsZW5kaW5nID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBsZWZ0b3ZlciBiYXRjaCwgb3IganVzdCB0byBjbGVhciB0ZXh0dXJlXG4gICAgICAgIGlmICh1c2VkQ291bnQgPiAwIHx8IChjb3VudCA9PT0gMCAmJiAhdGhpcy56ZXJvVGV4dHVyZXMpKSB7XG4gICAgICAgICAgICBzdWJtaXRCYXRjaCh1c2VkQ291bnQsIGJsZW5kaW5nKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF91cGRhdGVUZXh0dXJlTW9ycGgoKSB7XG5cbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKGRldmljZSwgJ01vcnBoVXBkYXRlJyk7XG5cbiAgICAgICAgLy8gdXBkYXRlIHRleHR1cmVzIGlmIGFjdGl2ZSB0YXJnZXRzLCBvciBubyBhY3RpdmUgdGFyZ2V0cyBhbmQgdGV4dHVyZXMgbmVlZCB0byBiZSBjbGVhcmVkXG4gICAgICAgIGlmICh0aGlzLl9hY3RpdmVUYXJnZXRzLmxlbmd0aCA+IDAgfHwgIXRoaXMuemVyb1RleHR1cmVzKSB7XG5cbiAgICAgICAgICAgIC8vIGJsZW5kIG1vcnBoIHRhcmdldHMgaW50byByZW5kZXIgdGFyZ2V0c1xuICAgICAgICAgICAgaWYgKHRoaXMucnRQb3NpdGlvbnMpXG4gICAgICAgICAgICAgICAgdGhpcy5fdXBkYXRlVGV4dHVyZVJlbmRlclRhcmdldCh0aGlzLnJ0UG9zaXRpb25zLCAndGV4dHVyZVBvc2l0aW9ucycpO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5ydE5vcm1hbHMpXG4gICAgICAgICAgICAgICAgdGhpcy5fdXBkYXRlVGV4dHVyZVJlbmRlclRhcmdldCh0aGlzLnJ0Tm9ybWFscywgJ3RleHR1cmVOb3JtYWxzJyk7XG5cbiAgICAgICAgICAgIC8vIHRleHR1cmVzIHdlcmUgY2xlYXJlZCBpZiBubyBhY3RpdmUgdGFyZ2V0c1xuICAgICAgICAgICAgdGhpcy56ZXJvVGV4dHVyZXMgPSB0aGlzLl9hY3RpdmVUYXJnZXRzLmxlbmd0aCA9PT0gMDtcbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKGRldmljZSk7XG4gICAgfVxuXG4gICAgX3VwZGF0ZVZlcnRleE1vcnBoKCkge1xuXG4gICAgICAgIC8vIHByZXBhcmUgOCBzbG90cyBmb3IgcmVuZGVyaW5nLiB0aGVzZSBhcmUgc3VwcG9ydGVkIGNvbWJpbmF0aW9uczogUFBQUFBQUFAsIE5OTk5OTk5OLCBQUFBQTk5OTlxuICAgICAgICBjb25zdCBjb3VudCA9IHRoaXMubWF4U3VibWl0Q291bnQ7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY291bnQ7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5fc2hhZGVyTW9ycGhXZWlnaHRzW2ldID0gMDtcbiAgICAgICAgICAgIHRoaXMuX2FjdGl2ZVZlcnRleEJ1ZmZlcnNbaV0gPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHBvc0luZGV4ID0gMDtcbiAgICAgICAgbGV0IG5ybUluZGV4ID0gdGhpcy5tb3JwaC5tb3JwaFBvc2l0aW9ucyA/IDQgOiAwO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2FjdGl2ZVRhcmdldHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHRhcmdldCA9IHRoaXMuX2FjdGl2ZVRhcmdldHNbaV0udGFyZ2V0O1xuXG4gICAgICAgICAgICBpZiAodGFyZ2V0Ll92ZXJ0ZXhCdWZmZXJQb3NpdGlvbnMpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9hY3RpdmVWZXJ0ZXhCdWZmZXJzW3Bvc0luZGV4XSA9IHRhcmdldC5fdmVydGV4QnVmZmVyUG9zaXRpb25zO1xuICAgICAgICAgICAgICAgIHRoaXMuX3NoYWRlck1vcnBoV2VpZ2h0c1twb3NJbmRleF0gPSB0aGlzLl9hY3RpdmVUYXJnZXRzW2ldLndlaWdodDtcbiAgICAgICAgICAgICAgICBwb3NJbmRleCsrO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGFyZ2V0Ll92ZXJ0ZXhCdWZmZXJOb3JtYWxzKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fYWN0aXZlVmVydGV4QnVmZmVyc1tucm1JbmRleF0gPSB0YXJnZXQuX3ZlcnRleEJ1ZmZlck5vcm1hbHM7XG4gICAgICAgICAgICAgICAgdGhpcy5fc2hhZGVyTW9ycGhXZWlnaHRzW25ybUluZGV4XSA9IHRoaXMuX2FjdGl2ZVRhcmdldHNbaV0ud2VpZ2h0O1xuICAgICAgICAgICAgICAgIG5ybUluZGV4Kys7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZWxlY3RzIGFjdGl2ZSBtb3JwaCB0YXJnZXRzIGFuZCBwcmVwYXJlcyBtb3JwaCBmb3IgcmVuZGVyaW5nLiBDYWxsZWQgYXV0b21hdGljYWxseSBieVxuICAgICAqIHJlbmRlcmVyLlxuICAgICAqL1xuICAgIHVwZGF0ZSgpIHtcblxuICAgICAgICB0aGlzLl9kaXJ0eSA9IGZhbHNlO1xuICAgICAgICBjb25zdCB0YXJnZXRzID0gdGhpcy5tb3JwaC5fdGFyZ2V0cztcblxuICAgICAgICAvLyBjb2xsZWN0IGFjdGl2ZSB0YXJnZXRzLCByZXVzZSBvYmplY3RzIGluIF9hY3RpdmVUYXJnZXRzIGFycmF5IHRvIGF2b2lkIGFsbG9jYXRpb25zXG4gICAgICAgIGxldCBhY3RpdmVDb3VudCA9IDA7XG4gICAgICAgIGNvbnN0IGVwc2lsb24gPSAwLjAwMDAxO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRhcmdldHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGFic1dlaWdodCA9IE1hdGguYWJzKHRoaXMuZ2V0V2VpZ2h0KGkpKTtcbiAgICAgICAgICAgIGlmIChhYnNXZWlnaHQgPiBlcHNpbG9uKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBjcmVhdGUgbmV3IG9iamVjdCBpZiBuZWVkZWRcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fYWN0aXZlVGFyZ2V0cy5sZW5ndGggPD0gYWN0aXZlQ291bnQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fYWN0aXZlVGFyZ2V0c1thY3RpdmVDb3VudF0gPSB7fTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCBhY3RpdmVUYXJnZXQgPSB0aGlzLl9hY3RpdmVUYXJnZXRzW2FjdGl2ZUNvdW50KytdO1xuICAgICAgICAgICAgICAgIGFjdGl2ZVRhcmdldC5hYnNXZWlnaHQgPSBhYnNXZWlnaHQ7XG4gICAgICAgICAgICAgICAgYWN0aXZlVGFyZ2V0LndlaWdodCA9IHRoaXMuZ2V0V2VpZ2h0KGkpO1xuICAgICAgICAgICAgICAgIGFjdGl2ZVRhcmdldC50YXJnZXQgPSB0YXJnZXRzW2ldO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2FjdGl2ZVRhcmdldHMubGVuZ3RoID0gYWN0aXZlQ291bnQ7XG5cbiAgICAgICAgLy8gaWYgdGhlcmUncyBtb3JlIGFjdGl2ZSB0YXJnZXRzIHRoZW4gcmVuZGVyaW5nIHN1cHBvcnRzXG4gICAgICAgIGNvbnN0IG1heEFjdGl2ZVRhcmdldHMgPSB0aGlzLm1vcnBoLm1heEFjdGl2ZVRhcmdldHM7XG4gICAgICAgIGlmICh0aGlzLl9hY3RpdmVUYXJnZXRzLmxlbmd0aCA+IG1heEFjdGl2ZVRhcmdldHMpIHtcblxuICAgICAgICAgICAgLy8gc29ydCB0aGVtIGJ5IGFic1dlaWdodFxuICAgICAgICAgICAgdGhpcy5fYWN0aXZlVGFyZ2V0cy5zb3J0KGZ1bmN0aW9uIChsLCByKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIChsLmFic1dlaWdodCA8IHIuYWJzV2VpZ2h0KSA/IDEgOiAoci5hYnNXZWlnaHQgPCBsLmFic1dlaWdodCA/IC0xIDogMCk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgLy8gcmVtb3ZlIGV4Y2Vzc1xuICAgICAgICAgICAgdGhpcy5fYWN0aXZlVGFyZ2V0cy5sZW5ndGggPSBtYXhBY3RpdmVUYXJnZXRzO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcHJlcGFyZSBmb3IgcmVuZGVyaW5nXG4gICAgICAgIGlmICh0aGlzLm1vcnBoLnVzZVRleHR1cmVNb3JwaCkge1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlVGV4dHVyZU1vcnBoKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVWZXJ0ZXhNb3JwaCgpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgeyBNb3JwaEluc3RhbmNlIH07XG4iXSwibmFtZXMiOlsidGV4dHVyZU1vcnBoVmVydGV4U2hhZGVyIiwiYmxlbmRTdGF0ZUFkZGl0aXZlIiwiQmxlbmRTdGF0ZSIsIkJMRU5ERVFVQVRJT05fQUREIiwiQkxFTkRNT0RFX09ORSIsIk1vcnBoSW5zdGFuY2UiLCJjb25zdHJ1Y3RvciIsIm1vcnBoIiwiaW5jUmVmQ291bnQiLCJkZXZpY2UiLCJfd2VpZ2h0cyIsIl93ZWlnaHRNYXAiLCJNYXAiLCJ2IiwiX3RhcmdldHMiLCJsZW5ndGgiLCJ0YXJnZXQiLCJuYW1lIiwic2V0Iiwic2V0V2VpZ2h0IiwiZGVmYXVsdFdlaWdodCIsIl9hY3RpdmVUYXJnZXRzIiwidXNlVGV4dHVyZU1vcnBoIiwic2hhZGVyQ2FjaGUiLCJtYXhTdWJtaXRDb3VudCIsIm1heFRleHR1cmVzIiwiX3NoYWRlck1vcnBoV2VpZ2h0cyIsIkZsb2F0MzJBcnJheSIsImNyZWF0ZVJUIiwidGV4dHVyZVZhciIsIl9jcmVhdGVUZXh0dXJlIiwiX3JlbmRlclRleHR1cmVGb3JtYXQiLCJSZW5kZXJUYXJnZXQiLCJjb2xvckJ1ZmZlciIsImRlcHRoIiwibW9ycGhQb3NpdGlvbnMiLCJydFBvc2l0aW9ucyIsIm1vcnBoTm9ybWFscyIsInJ0Tm9ybWFscyIsIl90ZXh0dXJlUGFyYW1zIiwibW9ycGhUZXh0dXJlV2lkdGgiLCJtb3JwaFRleHR1cmVIZWlnaHQiLCJpIiwic2NvcGUiLCJyZXNvbHZlIiwibW9ycGhGYWN0b3IiLCJ6ZXJvVGV4dHVyZXMiLCJfc2hhZGVyTW9ycGhXZWlnaHRzQSIsImJ1ZmZlciIsIl9zaGFkZXJNb3JwaFdlaWdodHNCIiwiX2FjdGl2ZVZlcnRleEJ1ZmZlcnMiLCJBcnJheSIsImRlc3Ryb3kiLCJzaGFkZXIiLCJkZWNSZWZDb3VudCIsInJlZkNvdW50IiwidGV4dHVyZVBvc2l0aW9ucyIsInRleHR1cmVOb3JtYWxzIiwiY2xvbmUiLCJfZ2V0V2VpZ2h0SW5kZXgiLCJrZXkiLCJpbmRleCIsImdldCIsInVuZGVmaW5lZCIsIkRlYnVnIiwiZXJyb3IiLCJnZXRXZWlnaHQiLCJ3ZWlnaHQiLCJhc3NlcnQiLCJfZGlydHkiLCJfZ2V0RnJhZ21lbnRTaGFkZXIiLCJudW1UZXh0dXJlcyIsImZyYWdtZW50U2hhZGVyIiwiX2dldFNoYWRlciIsImNvdW50IiwiZnMiLCJjcmVhdGVTaGFkZXJGcm9tQ29kZSIsIl91cGRhdGVUZXh0dXJlUmVuZGVyVGFyZ2V0IiwicmVuZGVyVGFyZ2V0Iiwic3JjVGV4dHVyZU5hbWUiLCJzdWJtaXRCYXRjaCIsInVzZWRDb3VudCIsImJsZW5kaW5nIiwic2V0VmFsdWUiLCJzZXRCbGVuZFN0YXRlIiwiREVGQVVMVCIsImRyYXdRdWFkV2l0aFNoYWRlciIsImFjdGl2ZVRhcmdldCIsInRleCIsIl91cGRhdGVUZXh0dXJlTW9ycGgiLCJEZWJ1Z0dyYXBoaWNzIiwicHVzaEdwdU1hcmtlciIsInBvcEdwdU1hcmtlciIsIl91cGRhdGVWZXJ0ZXhNb3JwaCIsInBvc0luZGV4IiwibnJtSW5kZXgiLCJfdmVydGV4QnVmZmVyUG9zaXRpb25zIiwiX3ZlcnRleEJ1ZmZlck5vcm1hbHMiLCJ1cGRhdGUiLCJ0YXJnZXRzIiwiYWN0aXZlQ291bnQiLCJlcHNpbG9uIiwiYWJzV2VpZ2h0IiwiTWF0aCIsImFicyIsIm1heEFjdGl2ZVRhcmdldHMiLCJzb3J0IiwibCIsInIiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBVUE7QUFDQSxNQUFNQSx3QkFBd0IsR0FBSSxDQUFBO0FBQ2xDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUssQ0FBQSxDQUFBO0FBRUwsTUFBTUMsa0JBQWtCLEdBQUcsSUFBSUMsVUFBVSxDQUFDLElBQUksRUFBRUMsaUJBQWlCLEVBQUVDLGFBQWEsRUFBRUEsYUFBYSxDQUFDLENBQUE7O0FBRWhHO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUMsYUFBYSxDQUFDO0FBQ2hCO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7RUFDSUMsV0FBV0EsQ0FBQ0MsS0FBSyxFQUFFO0FBQ2Y7QUFDUjtBQUNBO0FBQ0E7QUFDQTtJQUNRLElBQUksQ0FBQ0EsS0FBSyxHQUFHQSxLQUFLLENBQUE7SUFDbEJBLEtBQUssQ0FBQ0MsV0FBVyxFQUFFLENBQUE7QUFDbkIsSUFBQSxJQUFJLENBQUNDLE1BQU0sR0FBR0YsS0FBSyxDQUFDRSxNQUFNLENBQUE7O0FBRTFCO0lBQ0EsSUFBSSxDQUFDQyxRQUFRLEdBQUcsRUFBRSxDQUFBO0FBQ2xCLElBQUEsSUFBSSxDQUFDQyxVQUFVLEdBQUcsSUFBSUMsR0FBRyxFQUFFLENBQUE7QUFDM0IsSUFBQSxLQUFLLElBQUlDLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR04sS0FBSyxDQUFDTyxRQUFRLENBQUNDLE1BQU0sRUFBRUYsQ0FBQyxFQUFFLEVBQUU7QUFDNUMsTUFBQSxNQUFNRyxNQUFNLEdBQUdULEtBQUssQ0FBQ08sUUFBUSxDQUFDRCxDQUFDLENBQUMsQ0FBQTtNQUNoQyxJQUFJRyxNQUFNLENBQUNDLElBQUksRUFBRTtRQUNiLElBQUksQ0FBQ04sVUFBVSxDQUFDTyxHQUFHLENBQUNGLE1BQU0sQ0FBQ0MsSUFBSSxFQUFFSixDQUFDLENBQUMsQ0FBQTtBQUN2QyxPQUFBO01BQ0EsSUFBSSxDQUFDTSxTQUFTLENBQUNOLENBQUMsRUFBRUcsTUFBTSxDQUFDSSxhQUFhLENBQUMsQ0FBQTtBQUMzQyxLQUFBOztBQUVBO0lBQ0EsSUFBSSxDQUFDQyxjQUFjLEdBQUcsRUFBRSxDQUFBO0lBRXhCLElBQUlkLEtBQUssQ0FBQ2UsZUFBZSxFQUFFO0FBRXZCO0FBQ0EsTUFBQSxJQUFJLENBQUNDLFdBQVcsR0FBRyxFQUFFLENBQUE7O0FBRXJCO0FBQ0EsTUFBQSxJQUFJLENBQUNDLGNBQWMsR0FBRyxJQUFJLENBQUNmLE1BQU0sQ0FBQ2dCLFdBQVcsQ0FBQTs7QUFFN0M7TUFDQSxJQUFJLENBQUNDLG1CQUFtQixHQUFHLElBQUlDLFlBQVksQ0FBQyxJQUFJLENBQUNILGNBQWMsQ0FBQyxDQUFBOztBQUVoRTtBQUNBLE1BQUEsTUFBTUksUUFBUSxHQUFHQSxDQUFDWCxJQUFJLEVBQUVZLFVBQVUsS0FBSztBQUVuQztBQUNBLFFBQUEsSUFBSSxDQUFDQSxVQUFVLENBQUMsR0FBR3RCLEtBQUssQ0FBQ3VCLGNBQWMsQ0FBQ2IsSUFBSSxFQUFFVixLQUFLLENBQUN3QixvQkFBb0IsQ0FBQyxDQUFBO1FBQ3pFLE9BQU8sSUFBSUMsWUFBWSxDQUFDO0FBQ3BCQyxVQUFBQSxXQUFXLEVBQUUsSUFBSSxDQUFDSixVQUFVLENBQUM7QUFDN0JLLFVBQUFBLEtBQUssRUFBRSxLQUFBO0FBQ1gsU0FBQyxDQUFDLENBQUE7T0FDTCxDQUFBO01BRUQsSUFBSTNCLEtBQUssQ0FBQzRCLGNBQWMsRUFBRTtRQUN0QixJQUFJLENBQUNDLFdBQVcsR0FBR1IsUUFBUSxDQUFDLFlBQVksRUFBRSxrQkFBa0IsQ0FBQyxDQUFBO0FBQ2pFLE9BQUE7TUFFQSxJQUFJckIsS0FBSyxDQUFDOEIsWUFBWSxFQUFFO1FBQ3BCLElBQUksQ0FBQ0MsU0FBUyxHQUFHVixRQUFRLENBQUMsWUFBWSxFQUFFLGdCQUFnQixDQUFDLENBQUE7QUFDN0QsT0FBQTs7QUFFQTtNQUNBLElBQUksQ0FBQ1csY0FBYyxHQUFHLElBQUlaLFlBQVksQ0FBQyxDQUFDcEIsS0FBSyxDQUFDaUMsaUJBQWlCLEVBQUVqQyxLQUFLLENBQUNrQyxrQkFBa0IsRUFDckYsQ0FBQyxHQUFHbEMsS0FBSyxDQUFDaUMsaUJBQWlCLEVBQUUsQ0FBQyxHQUFHakMsS0FBSyxDQUFDa0Msa0JBQWtCLENBQUMsQ0FBQyxDQUFBOztBQUUvRDtBQUNBLE1BQUEsS0FBSyxJQUFJQyxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUcsSUFBSSxDQUFDbEIsY0FBYyxFQUFFa0IsQ0FBQyxFQUFFLEVBQUU7QUFDMUMsUUFBQSxJQUFJLENBQUMsZUFBZSxHQUFHQSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUNqQyxNQUFNLENBQUNrQyxLQUFLLENBQUNDLE9BQU8sQ0FBQyxlQUFlLEdBQUdGLENBQUMsQ0FBQyxDQUFBO0FBQzlFLE9BQUE7QUFFQSxNQUFBLElBQUksQ0FBQ0csV0FBVyxHQUFHLElBQUksQ0FBQ3BDLE1BQU0sQ0FBQ2tDLEtBQUssQ0FBQ0MsT0FBTyxDQUFDLGdCQUFnQixDQUFDLENBQUE7O0FBRTlEO01BQ0EsSUFBSSxDQUFDRSxZQUFZLEdBQUcsS0FBSyxDQUFBO0FBRTdCLEtBQUMsTUFBTTtBQUFLOztBQUVSO01BQ0EsSUFBSSxDQUFDdEIsY0FBYyxHQUFHLENBQUMsQ0FBQTs7QUFFdkI7TUFDQSxJQUFJLENBQUNFLG1CQUFtQixHQUFHLElBQUlDLFlBQVksQ0FBQyxJQUFJLENBQUNILGNBQWMsQ0FBQyxDQUFDO0FBQ2pFLE1BQUEsSUFBSSxDQUFDdUIsb0JBQW9CLEdBQUcsSUFBSXBCLFlBQVksQ0FBQyxJQUFJLENBQUNELG1CQUFtQixDQUFDc0IsTUFBTSxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUNwRixNQUFBLElBQUksQ0FBQ0Msb0JBQW9CLEdBQUcsSUFBSXRCLFlBQVksQ0FBQyxJQUFJLENBQUNELG1CQUFtQixDQUFDc0IsTUFBTSxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7O0FBRXhGO01BQ0EsSUFBSSxDQUFDRSxvQkFBb0IsR0FBRyxJQUFJQyxLQUFLLENBQUMsSUFBSSxDQUFDM0IsY0FBYyxDQUFDLENBQUE7QUFDOUQsS0FBQTtBQUNKLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0k0QixFQUFBQSxPQUFPQSxHQUFHO0FBRU47SUFDQSxJQUFJLENBQUNDLE1BQU0sR0FBRyxJQUFJLENBQUE7QUFFbEIsSUFBQSxNQUFNOUMsS0FBSyxHQUFHLElBQUksQ0FBQ0EsS0FBSyxDQUFBO0FBQ3hCLElBQUEsSUFBSUEsS0FBSyxFQUFFO0FBRVA7TUFDQSxJQUFJLENBQUNBLEtBQUssR0FBRyxJQUFJLENBQUE7TUFDakJBLEtBQUssQ0FBQytDLFdBQVcsRUFBRSxDQUFBOztBQUVuQjtBQUNBLE1BQUEsSUFBSS9DLEtBQUssQ0FBQ2dELFFBQVEsR0FBRyxDQUFDLEVBQUU7UUFDcEJoRCxLQUFLLENBQUM2QyxPQUFPLEVBQUUsQ0FBQTtBQUNuQixPQUFBO0FBQ0osS0FBQTtJQUVBLElBQUksSUFBSSxDQUFDaEIsV0FBVyxFQUFFO0FBQ2xCLE1BQUEsSUFBSSxDQUFDQSxXQUFXLENBQUNnQixPQUFPLEVBQUUsQ0FBQTtNQUMxQixJQUFJLENBQUNoQixXQUFXLEdBQUcsSUFBSSxDQUFBO0FBQzNCLEtBQUE7SUFFQSxJQUFJLElBQUksQ0FBQ29CLGdCQUFnQixFQUFFO0FBQ3ZCLE1BQUEsSUFBSSxDQUFDQSxnQkFBZ0IsQ0FBQ0osT0FBTyxFQUFFLENBQUE7TUFDL0IsSUFBSSxDQUFDSSxnQkFBZ0IsR0FBRyxJQUFJLENBQUE7QUFDaEMsS0FBQTtJQUVBLElBQUksSUFBSSxDQUFDbEIsU0FBUyxFQUFFO0FBQ2hCLE1BQUEsSUFBSSxDQUFDQSxTQUFTLENBQUNjLE9BQU8sRUFBRSxDQUFBO01BQ3hCLElBQUksQ0FBQ2QsU0FBUyxHQUFHLElBQUksQ0FBQTtBQUN6QixLQUFBO0lBRUEsSUFBSSxJQUFJLENBQUNtQixjQUFjLEVBQUU7QUFDckIsTUFBQSxJQUFJLENBQUNBLGNBQWMsQ0FBQ0wsT0FBTyxFQUFFLENBQUE7TUFDN0IsSUFBSSxDQUFDSyxjQUFjLEdBQUcsSUFBSSxDQUFBO0FBQzlCLEtBQUE7QUFDSixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJQyxFQUFBQSxLQUFLQSxHQUFHO0FBQ0osSUFBQSxPQUFPLElBQUlyRCxhQUFhLENBQUMsSUFBSSxDQUFDRSxLQUFLLENBQUMsQ0FBQTtBQUN4QyxHQUFBO0VBRUFvRCxlQUFlQSxDQUFDQyxHQUFHLEVBQUU7QUFDakIsSUFBQSxJQUFJLE9BQU9BLEdBQUcsS0FBSyxRQUFRLEVBQUU7TUFDekIsTUFBTUMsS0FBSyxHQUFHLElBQUksQ0FBQ2xELFVBQVUsQ0FBQ21ELEdBQUcsQ0FBQ0YsR0FBRyxDQUFDLENBQUE7TUFDdEMsSUFBSUMsS0FBSyxLQUFLRSxTQUFTLEVBQUU7QUFDckJDLFFBQUFBLEtBQUssQ0FBQ0MsS0FBSyxDQUFFLENBQXNDTCxvQ0FBQUEsRUFBQUEsR0FBSSxHQUFFLENBQUMsQ0FBQTtBQUM5RCxPQUFBO0FBQ0EsTUFBQSxPQUFPQyxLQUFLLENBQUE7QUFDaEIsS0FBQTtBQUNBLElBQUEsT0FBT0QsR0FBRyxDQUFBO0FBQ2QsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJTSxTQUFTQSxDQUFDTixHQUFHLEVBQUU7QUFDWCxJQUFBLE1BQU1DLEtBQUssR0FBRyxJQUFJLENBQUNGLGVBQWUsQ0FBQ0MsR0FBRyxDQUFDLENBQUE7QUFDdkMsSUFBQSxPQUFPLElBQUksQ0FBQ2xELFFBQVEsQ0FBQ21ELEtBQUssQ0FBQyxDQUFBO0FBQy9CLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSTFDLEVBQUFBLFNBQVNBLENBQUN5QyxHQUFHLEVBQUVPLE1BQU0sRUFBRTtBQUNuQixJQUFBLE1BQU1OLEtBQUssR0FBRyxJQUFJLENBQUNGLGVBQWUsQ0FBQ0MsR0FBRyxDQUFDLENBQUE7QUFDdkNJLElBQUFBLEtBQUssQ0FBQ0ksTUFBTSxDQUFDUCxLQUFLLElBQUksQ0FBQyxJQUFJQSxLQUFLLEdBQUcsSUFBSSxDQUFDdEQsS0FBSyxDQUFDTyxRQUFRLENBQUNDLE1BQU0sQ0FBQyxDQUFBO0FBQzlELElBQUEsSUFBSSxDQUFDTCxRQUFRLENBQUNtRCxLQUFLLENBQUMsR0FBR00sTUFBTSxDQUFBO0lBQzdCLElBQUksQ0FBQ0UsTUFBTSxHQUFHLElBQUksQ0FBQTtBQUN0QixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0lDLGtCQUFrQkEsQ0FBQ0MsV0FBVyxFQUFFO0lBRTVCLElBQUlDLGNBQWMsR0FBRyxFQUFFLENBQUE7SUFFdkIsSUFBSUQsV0FBVyxHQUFHLENBQUMsRUFBRTtBQUNqQkMsTUFBQUEsY0FBYyxJQUFJLHFCQUFxQixHQUNuQyxrQ0FBa0MsR0FBR0QsV0FBVyxHQUFHLE1BQU0sQ0FBQTtBQUNqRSxLQUFBO0lBRUEsS0FBSyxJQUFJN0IsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHNkIsV0FBVyxFQUFFN0IsQ0FBQyxFQUFFLEVBQUU7QUFDbEM4QixNQUFBQSxjQUFjLElBQUksdUNBQXVDLEdBQUc5QixDQUFDLEdBQUcsS0FBSyxDQUFBO0FBQ3pFLEtBQUE7SUFFQThCLGNBQWMsSUFBSSxzQkFBc0IsR0FDcEMsNENBQTRDLENBQUE7SUFFaEQsS0FBSyxJQUFJOUIsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHNkIsV0FBVyxFQUFFN0IsQ0FBQyxFQUFFLEVBQUU7TUFDbEM4QixjQUFjLElBQUksK0JBQStCLEdBQUc5QixDQUFDLEdBQUcsNkJBQTZCLEdBQUdBLENBQUMsR0FBRyxlQUFlLENBQUE7QUFDL0csS0FBQTtJQUVBOEIsY0FBYyxJQUFJLDZCQUE2QixHQUMzQyxLQUFLLENBQUE7QUFFVCxJQUFBLE9BQU9BLGNBQWMsQ0FBQTtBQUN6QixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0lDLFVBQVVBLENBQUNDLEtBQUssRUFBRTtBQUVkLElBQUEsSUFBSXJCLE1BQU0sR0FBRyxJQUFJLENBQUM5QixXQUFXLENBQUNtRCxLQUFLLENBQUMsQ0FBQTs7QUFFcEM7SUFDQSxJQUFJLENBQUNyQixNQUFNLEVBQUU7QUFDVCxNQUFBLE1BQU1zQixFQUFFLEdBQUcsSUFBSSxDQUFDTCxrQkFBa0IsQ0FBQ0ksS0FBSyxDQUFDLENBQUE7QUFDekNyQixNQUFBQSxNQUFNLEdBQUd1QixvQkFBb0IsQ0FBQyxJQUFJLENBQUNuRSxNQUFNLEVBQUVULHdCQUF3QixFQUFFMkUsRUFBRSxFQUFFLGNBQWMsR0FBR0QsS0FBSyxDQUFDLENBQUE7QUFDaEcsTUFBQSxJQUFJLENBQUNuRCxXQUFXLENBQUNtRCxLQUFLLENBQUMsR0FBR3JCLE1BQU0sQ0FBQTtBQUNwQyxLQUFBO0FBRUEsSUFBQSxPQUFPQSxNQUFNLENBQUE7QUFDakIsR0FBQTtBQUVBd0IsRUFBQUEsMEJBQTBCQSxDQUFDQyxZQUFZLEVBQUVDLGNBQWMsRUFBRTtBQUVyRCxJQUFBLE1BQU10RSxNQUFNLEdBQUcsSUFBSSxDQUFDQSxNQUFNLENBQUE7O0FBRTFCO0FBQ0EsSUFBQSxNQUFNdUUsV0FBVyxHQUFHQSxDQUFDQyxTQUFTLEVBQUVDLFFBQVEsS0FBSztBQUV6QztNQUNBLElBQUksQ0FBQ3JDLFdBQVcsQ0FBQ3NDLFFBQVEsQ0FBQyxJQUFJLENBQUN6RCxtQkFBbUIsQ0FBQyxDQUFBOztBQUVuRDtNQUNBakIsTUFBTSxDQUFDMkUsYUFBYSxDQUFDRixRQUFRLEdBQUdqRixrQkFBa0IsR0FBR0MsVUFBVSxDQUFDbUYsT0FBTyxDQUFDLENBQUE7O0FBRXhFO0FBQ0EsTUFBQSxNQUFNaEMsTUFBTSxHQUFHLElBQUksQ0FBQ29CLFVBQVUsQ0FBQ1EsU0FBUyxDQUFDLENBQUE7QUFDekNLLE1BQUFBLGtCQUFrQixDQUFDN0UsTUFBTSxFQUFFcUUsWUFBWSxFQUFFekIsTUFBTSxDQUFDLENBQUE7S0FDbkQsQ0FBQTs7QUFFRDtJQUNBLElBQUk0QixTQUFTLEdBQUcsQ0FBQyxDQUFBO0lBQ2pCLElBQUlDLFFBQVEsR0FBRyxLQUFLLENBQUE7QUFDcEIsSUFBQSxNQUFNUixLQUFLLEdBQUcsSUFBSSxDQUFDckQsY0FBYyxDQUFDTixNQUFNLENBQUE7SUFDeEMsS0FBSyxJQUFJMkIsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHZ0MsS0FBSyxFQUFFaEMsQ0FBQyxFQUFFLEVBQUU7QUFDNUIsTUFBQSxNQUFNNkMsWUFBWSxHQUFHLElBQUksQ0FBQ2xFLGNBQWMsQ0FBQ3FCLENBQUMsQ0FBQyxDQUFBO0FBQzNDLE1BQUEsTUFBTThDLEdBQUcsR0FBR0QsWUFBWSxDQUFDdkUsTUFBTSxDQUFDK0QsY0FBYyxDQUFDLENBQUE7QUFDL0MsTUFBQSxJQUFJUyxHQUFHLEVBQUU7QUFFTDtRQUNBLElBQUksQ0FBQyxlQUFlLEdBQUdQLFNBQVMsQ0FBQyxDQUFDRSxRQUFRLENBQUNLLEdBQUcsQ0FBQyxDQUFBOztBQUUvQztRQUNBLElBQUksQ0FBQzlELG1CQUFtQixDQUFDdUQsU0FBUyxDQUFDLEdBQUdNLFlBQVksQ0FBQ3BCLE1BQU0sQ0FBQTs7QUFFekQ7QUFDQWMsUUFBQUEsU0FBUyxFQUFFLENBQUE7QUFDWCxRQUFBLElBQUlBLFNBQVMsSUFBSSxJQUFJLENBQUN6RCxjQUFjLEVBQUU7QUFFbEN3RCxVQUFBQSxXQUFXLENBQUNDLFNBQVMsRUFBRUMsUUFBUSxDQUFDLENBQUE7QUFDaENELFVBQUFBLFNBQVMsR0FBRyxDQUFDLENBQUE7QUFDYkMsVUFBQUEsUUFBUSxHQUFHLElBQUksQ0FBQTtBQUNuQixTQUFBO0FBQ0osT0FBQTtBQUNKLEtBQUE7O0FBRUE7QUFDQSxJQUFBLElBQUlELFNBQVMsR0FBRyxDQUFDLElBQUtQLEtBQUssS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM1QixZQUFhLEVBQUU7QUFDdERrQyxNQUFBQSxXQUFXLENBQUNDLFNBQVMsRUFBRUMsUUFBUSxDQUFDLENBQUE7QUFDcEMsS0FBQTtBQUNKLEdBQUE7QUFFQU8sRUFBQUEsbUJBQW1CQSxHQUFHO0FBRWxCLElBQUEsTUFBTWhGLE1BQU0sR0FBRyxJQUFJLENBQUNBLE1BQU0sQ0FBQTtBQUUxQmlGLElBQUFBLGFBQWEsQ0FBQ0MsYUFBYSxDQUFDbEYsTUFBTSxFQUFFLGFBQWEsQ0FBQyxDQUFBOztBQUVsRDtBQUNBLElBQUEsSUFBSSxJQUFJLENBQUNZLGNBQWMsQ0FBQ04sTUFBTSxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQytCLFlBQVksRUFBRTtBQUV0RDtBQUNBLE1BQUEsSUFBSSxJQUFJLENBQUNWLFdBQVcsRUFDaEIsSUFBSSxDQUFDeUMsMEJBQTBCLENBQUMsSUFBSSxDQUFDekMsV0FBVyxFQUFFLGtCQUFrQixDQUFDLENBQUE7QUFFekUsTUFBQSxJQUFJLElBQUksQ0FBQ0UsU0FBUyxFQUNkLElBQUksQ0FBQ3VDLDBCQUEwQixDQUFDLElBQUksQ0FBQ3ZDLFNBQVMsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFBOztBQUVyRTtNQUNBLElBQUksQ0FBQ1EsWUFBWSxHQUFHLElBQUksQ0FBQ3pCLGNBQWMsQ0FBQ04sTUFBTSxLQUFLLENBQUMsQ0FBQTtBQUN4RCxLQUFBO0FBRUEyRSxJQUFBQSxhQUFhLENBQUNFLFlBQVksQ0FBQ25GLE1BQU0sQ0FBQyxDQUFBO0FBQ3RDLEdBQUE7QUFFQW9GLEVBQUFBLGtCQUFrQkEsR0FBRztBQUVqQjtBQUNBLElBQUEsTUFBTW5CLEtBQUssR0FBRyxJQUFJLENBQUNsRCxjQUFjLENBQUE7SUFDakMsS0FBSyxJQUFJa0IsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHZ0MsS0FBSyxFQUFFaEMsQ0FBQyxFQUFFLEVBQUU7QUFDNUIsTUFBQSxJQUFJLENBQUNoQixtQkFBbUIsQ0FBQ2dCLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQTtBQUMvQixNQUFBLElBQUksQ0FBQ1Esb0JBQW9CLENBQUNSLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQTtBQUN2QyxLQUFBO0lBRUEsSUFBSW9ELFFBQVEsR0FBRyxDQUFDLENBQUE7SUFDaEIsSUFBSUMsUUFBUSxHQUFHLElBQUksQ0FBQ3hGLEtBQUssQ0FBQzRCLGNBQWMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFBO0FBQ2hELElBQUEsS0FBSyxJQUFJTyxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUcsSUFBSSxDQUFDckIsY0FBYyxDQUFDTixNQUFNLEVBQUUyQixDQUFDLEVBQUUsRUFBRTtNQUNqRCxNQUFNMUIsTUFBTSxHQUFHLElBQUksQ0FBQ0ssY0FBYyxDQUFDcUIsQ0FBQyxDQUFDLENBQUMxQixNQUFNLENBQUE7TUFFNUMsSUFBSUEsTUFBTSxDQUFDZ0Ysc0JBQXNCLEVBQUU7UUFDL0IsSUFBSSxDQUFDOUMsb0JBQW9CLENBQUM0QyxRQUFRLENBQUMsR0FBRzlFLE1BQU0sQ0FBQ2dGLHNCQUFzQixDQUFBO0FBQ25FLFFBQUEsSUFBSSxDQUFDdEUsbUJBQW1CLENBQUNvRSxRQUFRLENBQUMsR0FBRyxJQUFJLENBQUN6RSxjQUFjLENBQUNxQixDQUFDLENBQUMsQ0FBQ3lCLE1BQU0sQ0FBQTtBQUNsRTJCLFFBQUFBLFFBQVEsRUFBRSxDQUFBO0FBQ2QsT0FBQTtNQUVBLElBQUk5RSxNQUFNLENBQUNpRixvQkFBb0IsRUFBRTtRQUM3QixJQUFJLENBQUMvQyxvQkFBb0IsQ0FBQzZDLFFBQVEsQ0FBQyxHQUFHL0UsTUFBTSxDQUFDaUYsb0JBQW9CLENBQUE7QUFDakUsUUFBQSxJQUFJLENBQUN2RSxtQkFBbUIsQ0FBQ3FFLFFBQVEsQ0FBQyxHQUFHLElBQUksQ0FBQzFFLGNBQWMsQ0FBQ3FCLENBQUMsQ0FBQyxDQUFDeUIsTUFBTSxDQUFBO0FBQ2xFNEIsUUFBQUEsUUFBUSxFQUFFLENBQUE7QUFDZCxPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDSUcsRUFBQUEsTUFBTUEsR0FBRztJQUVMLElBQUksQ0FBQzdCLE1BQU0sR0FBRyxLQUFLLENBQUE7QUFDbkIsSUFBQSxNQUFNOEIsT0FBTyxHQUFHLElBQUksQ0FBQzVGLEtBQUssQ0FBQ08sUUFBUSxDQUFBOztBQUVuQztJQUNBLElBQUlzRixXQUFXLEdBQUcsQ0FBQyxDQUFBO0lBQ25CLE1BQU1DLE9BQU8sR0FBRyxPQUFPLENBQUE7QUFDdkIsSUFBQSxLQUFLLElBQUkzRCxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUd5RCxPQUFPLENBQUNwRixNQUFNLEVBQUUyQixDQUFDLEVBQUUsRUFBRTtBQUNyQyxNQUFBLE1BQU00RCxTQUFTLEdBQUdDLElBQUksQ0FBQ0MsR0FBRyxDQUFDLElBQUksQ0FBQ3RDLFNBQVMsQ0FBQ3hCLENBQUMsQ0FBQyxDQUFDLENBQUE7TUFDN0MsSUFBSTRELFNBQVMsR0FBR0QsT0FBTyxFQUFFO0FBRXJCO0FBQ0EsUUFBQSxJQUFJLElBQUksQ0FBQ2hGLGNBQWMsQ0FBQ04sTUFBTSxJQUFJcUYsV0FBVyxFQUFFO0FBQzNDLFVBQUEsSUFBSSxDQUFDL0UsY0FBYyxDQUFDK0UsV0FBVyxDQUFDLEdBQUcsRUFBRSxDQUFBO0FBQ3pDLFNBQUE7UUFFQSxNQUFNYixZQUFZLEdBQUcsSUFBSSxDQUFDbEUsY0FBYyxDQUFDK0UsV0FBVyxFQUFFLENBQUMsQ0FBQTtRQUN2RGIsWUFBWSxDQUFDZSxTQUFTLEdBQUdBLFNBQVMsQ0FBQTtRQUNsQ2YsWUFBWSxDQUFDcEIsTUFBTSxHQUFHLElBQUksQ0FBQ0QsU0FBUyxDQUFDeEIsQ0FBQyxDQUFDLENBQUE7QUFDdkM2QyxRQUFBQSxZQUFZLENBQUN2RSxNQUFNLEdBQUdtRixPQUFPLENBQUN6RCxDQUFDLENBQUMsQ0FBQTtBQUNwQyxPQUFBO0FBQ0osS0FBQTtBQUNBLElBQUEsSUFBSSxDQUFDckIsY0FBYyxDQUFDTixNQUFNLEdBQUdxRixXQUFXLENBQUE7O0FBRXhDO0FBQ0EsSUFBQSxNQUFNSyxnQkFBZ0IsR0FBRyxJQUFJLENBQUNsRyxLQUFLLENBQUNrRyxnQkFBZ0IsQ0FBQTtBQUNwRCxJQUFBLElBQUksSUFBSSxDQUFDcEYsY0FBYyxDQUFDTixNQUFNLEdBQUcwRixnQkFBZ0IsRUFBRTtBQUUvQztNQUNBLElBQUksQ0FBQ3BGLGNBQWMsQ0FBQ3FGLElBQUksQ0FBQyxVQUFVQyxDQUFDLEVBQUVDLENBQUMsRUFBRTtRQUNyQyxPQUFRRCxDQUFDLENBQUNMLFNBQVMsR0FBR00sQ0FBQyxDQUFDTixTQUFTLEdBQUksQ0FBQyxHQUFJTSxDQUFDLENBQUNOLFNBQVMsR0FBR0ssQ0FBQyxDQUFDTCxTQUFTLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBRSxDQUFBO0FBQ2pGLE9BQUMsQ0FBQyxDQUFBOztBQUVGO0FBQ0EsTUFBQSxJQUFJLENBQUNqRixjQUFjLENBQUNOLE1BQU0sR0FBRzBGLGdCQUFnQixDQUFBO0FBQ2pELEtBQUE7O0FBRUE7QUFDQSxJQUFBLElBQUksSUFBSSxDQUFDbEcsS0FBSyxDQUFDZSxlQUFlLEVBQUU7TUFDNUIsSUFBSSxDQUFDbUUsbUJBQW1CLEVBQUUsQ0FBQTtBQUM5QixLQUFDLE1BQU07TUFDSCxJQUFJLENBQUNJLGtCQUFrQixFQUFFLENBQUE7QUFDN0IsS0FBQTtBQUNKLEdBQUE7QUFDSjs7OzsifQ==
