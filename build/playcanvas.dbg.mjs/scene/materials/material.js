/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../core/debug.js';
import { BLENDMODE_ONE, BLENDMODE_ZERO, BLENDEQUATION_ADD, CULLFACE_BACK, FUNC_LESSEQUAL, BLENDEQUATION_MAX, BLENDEQUATION_MIN, BLENDMODE_DST_COLOR, BLENDMODE_ONE_MINUS_DST_COLOR, BLENDMODE_SRC_COLOR, BLENDMODE_SRC_ALPHA, BLENDMODE_ONE_MINUS_SRC_ALPHA } from '../../platform/graphics/constants.js';
import { ShaderProcessorOptions } from '../../platform/graphics/shader-processor-options.js';
import { BLEND_MAX, BLEND_MIN, BLEND_MULTIPLICATIVE, BLEND_SCREEN, BLEND_MULTIPLICATIVE2X, BLEND_ADDITIVEALPHA, BLEND_ADDITIVE, BLEND_PREMULTIPLIED, BLEND_NORMAL, BLEND_NONE } from '../constants.js';
import { processShader } from '../shader-lib/utils.js';
import { getDefaultMaterial } from './default-material.js';

let id = 0;

/**
 * A material determines how a particular mesh instance is rendered. It specifies the shader and
 * render state that is set before the mesh instance is submitted to the graphics device.
 */
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
    this.blend = false;
    this.blendSrc = BLENDMODE_ONE;
    this.blendDst = BLENDMODE_ZERO;
    this.blendEquation = BLENDEQUATION_ADD;
    this.separateAlphaBlend = false;
    this.blendSrcAlpha = BLENDMODE_ONE;
    this.blendDstAlpha = BLENDMODE_ZERO;
    this.blendAlphaEquation = BLENDEQUATION_ADD;
    this.cull = CULLFACE_BACK;
    this.depthTest = true;
    this.depthFunc = FUNC_LESSEQUAL;
    this.depthWrite = true;
    this.stencilFront = null;
    this.stencilBack = null;
    this.depthBias = 0;
    this.slopeDepthBias = 0;
    this.redWrite = true;
    this.greenWrite = true;
    this.blueWrite = true;
    this.alphaWrite = true;
    this._shaderVersion = 0;
    this._scene = null;
    this._dirtyBlend = false;
    this.dirty = true;
  }
  /**
   * The shader used by this material to render mesh instances (default is null).
   *
   * @type {import('../../platform/graphics/shader.js').Shader|null}
   */
  set shader(shader) {
    this._shader = shader;
  }
  get shader() {
    return this._shader;
  }

  // returns boolean depending on material being transparent
  get transparent() {
    return this.blend;
  }

  /**
   * Controls how primitives are blended when being written to the currently active render
   * target. Can be:
   *
   * - {@link BLEND_SUBTRACTIVE}: Subtract the color of the source fragment from the destination
   * fragment and write the result to the frame buffer.
   * - {@link BLEND_ADDITIVE}: Add the color of the source fragment to the destination fragment
   * and write the result to the frame buffer.
   * - {@link BLEND_NORMAL}: Enable simple translucency for materials such as glass. This is
   * equivalent to enabling a source blend mode of {@link BLENDMODE_SRC_ALPHA} and a destination
   * blend mode of {@link BLENDMODE_ONE_MINUS_SRC_ALPHA}.
   * - {@link BLEND_NONE}: Disable blending.
   * - {@link BLEND_PREMULTIPLIED}: Similar to {@link BLEND_NORMAL} expect the source fragment is
   * assumed to have already been multiplied by the source alpha value.
   * - {@link BLEND_MULTIPLICATIVE}: Multiply the color of the source fragment by the color of the
   * destination fragment and write the result to the frame buffer.
   * - {@link BLEND_ADDITIVEALPHA}: Same as {@link BLEND_ADDITIVE} except the source RGB is
   * multiplied by the source alpha.
   * - {@link BLEND_MULTIPLICATIVE2X}: Multiplies colors and doubles the result.
   * - {@link BLEND_SCREEN}: Softer version of additive.
   * - {@link BLEND_MIN}: Minimum color. Check app.graphicsDevice.extBlendMinmax for support.
   * - {@link BLEND_MAX}: Maximum color. Check app.graphicsDevice.extBlendMinmax for support.
   *
   * Defaults to {@link BLEND_NONE}.
   */
  set blendType(type) {
    let blend = true;
    switch (type) {
      case BLEND_NONE:
        blend = false;
        this.blendSrc = BLENDMODE_ONE;
        this.blendDst = BLENDMODE_ZERO;
        this.blendEquation = BLENDEQUATION_ADD;
        break;
      case BLEND_NORMAL:
        this.blendSrc = BLENDMODE_SRC_ALPHA;
        this.blendDst = BLENDMODE_ONE_MINUS_SRC_ALPHA;
        this.blendEquation = BLENDEQUATION_ADD;
        break;
      case BLEND_PREMULTIPLIED:
        this.blendSrc = BLENDMODE_ONE;
        this.blendDst = BLENDMODE_ONE_MINUS_SRC_ALPHA;
        this.blendEquation = BLENDEQUATION_ADD;
        break;
      case BLEND_ADDITIVE:
        this.blendSrc = BLENDMODE_ONE;
        this.blendDst = BLENDMODE_ONE;
        this.blendEquation = BLENDEQUATION_ADD;
        break;
      case BLEND_ADDITIVEALPHA:
        this.blendSrc = BLENDMODE_SRC_ALPHA;
        this.blendDst = BLENDMODE_ONE;
        this.blendEquation = BLENDEQUATION_ADD;
        break;
      case BLEND_MULTIPLICATIVE2X:
        this.blendSrc = BLENDMODE_DST_COLOR;
        this.blendDst = BLENDMODE_SRC_COLOR;
        this.blendEquation = BLENDEQUATION_ADD;
        break;
      case BLEND_SCREEN:
        this.blendSrc = BLENDMODE_ONE_MINUS_DST_COLOR;
        this.blendDst = BLENDMODE_ONE;
        this.blendEquation = BLENDEQUATION_ADD;
        break;
      case BLEND_MULTIPLICATIVE:
        this.blendSrc = BLENDMODE_DST_COLOR;
        this.blendDst = BLENDMODE_ZERO;
        this.blendEquation = BLENDEQUATION_ADD;
        break;
      case BLEND_MIN:
        this.blendSrc = BLENDMODE_ONE;
        this.blendDst = BLENDMODE_ONE;
        this.blendEquation = BLENDEQUATION_MIN;
        break;
      case BLEND_MAX:
        this.blendSrc = BLENDMODE_ONE;
        this.blendDst = BLENDMODE_ONE;
        this.blendEquation = BLENDEQUATION_MAX;
        break;
    }
    if (this.blend !== blend) {
      this.blend = blend;
      if (this._scene) {
        this._scene.layers._dirtyBlend = true;
      } else {
        this._dirtyBlend = true;
      }
    }
    this._updateMeshInstanceKeys();
  }
  get blendType() {
    if (!this.blend) {
      return BLEND_NONE;
    }
    if (this.blendSrc === BLENDMODE_SRC_ALPHA && this.blendDst === BLENDMODE_ONE_MINUS_SRC_ALPHA && this.blendEquation === BLENDEQUATION_ADD) {
      return BLEND_NORMAL;
    }
    if (this.blendSrc === BLENDMODE_ONE && this.blendDst === BLENDMODE_ONE && this.blendEquation === BLENDEQUATION_ADD) {
      return BLEND_ADDITIVE;
    }
    if (this.blendSrc === BLENDMODE_SRC_ALPHA && this.blendDst === BLENDMODE_ONE && this.blendEquation === BLENDEQUATION_ADD) {
      return BLEND_ADDITIVEALPHA;
    }
    if (this.blendSrc === BLENDMODE_DST_COLOR && this.blendDst === BLENDMODE_SRC_COLOR && this.blendEquation === BLENDEQUATION_ADD) {
      return BLEND_MULTIPLICATIVE2X;
    }
    if (this.blendSrc === BLENDMODE_ONE_MINUS_DST_COLOR && this.blendDst === BLENDMODE_ONE && this.blendEquation === BLENDEQUATION_ADD) {
      return BLEND_SCREEN;
    }
    if (this.blendSrc === BLENDMODE_ONE && this.blendDst === BLENDMODE_ONE && this.blendEquation === BLENDEQUATION_MIN) {
      return BLEND_MIN;
    }
    if (this.blendSrc === BLENDMODE_ONE && this.blendDst === BLENDMODE_ONE && this.blendEquation === BLENDEQUATION_MAX) {
      return BLEND_MAX;
    }
    if (this.blendSrc === BLENDMODE_DST_COLOR && this.blendDst === BLENDMODE_ZERO && this.blendEquation === BLENDEQUATION_ADD) {
      return BLEND_MULTIPLICATIVE;
    }
    if (this.blendSrc === BLENDMODE_ONE && this.blendDst === BLENDMODE_ONE_MINUS_SRC_ALPHA && this.blendEquation === BLENDEQUATION_ADD) {
      return BLEND_PREMULTIPLIED;
    }
    return BLEND_NORMAL;
  }

  /**
   * Copy a material.
   *
   * @param {Material} source - The material to copy.
   * @returns {Material} The destination material.
   */
  copy(source) {
    this.name = source.name;
    this._shader = source._shader;

    // Render states
    this.alphaTest = source.alphaTest;
    this.alphaToCoverage = source.alphaToCoverage;
    this.blend = source.blend;
    this.blendSrc = source.blendSrc;
    this.blendDst = source.blendDst;
    this.blendEquation = source.blendEquation;
    this.separateAlphaBlend = source.separateAlphaBlend;
    this.blendSrcAlpha = source.blendSrcAlpha;
    this.blendDstAlpha = source.blendDstAlpha;
    this.blendAlphaEquation = source.blendAlphaEquation;
    this.cull = source.cull;
    this.depthTest = source.depthTest;
    this.depthFunc = source.depthFunc;
    this.depthWrite = source.depthWrite;
    this.depthBias = source.depthBias;
    this.slopeDepthBias = source.slopeDepthBias;
    if (source.stencilFront) this.stencilFront = source.stencilFront.clone();
    if (source.stencilBack) {
      if (source.stencilFront === source.stencilBack) {
        this.stencilBack = this.stencilFront;
      } else {
        this.stencilBack = source.stencilBack.clone();
      }
    }
    this.redWrite = source.redWrite;
    this.greenWrite = source.greenWrite;
    this.blueWrite = source.blueWrite;
    this.alphaWrite = source.alphaWrite;
    return this;
  }

  /**
   * Clone a material.
   *
   * @returns {this} A newly cloned material.
   */
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
  getShaderVariant(device, scene, objDefs, staticLightList, pass, sortedLights, viewUniformFormat, viewBindGroupFormat) {
    // generate shader variant - its the same shader, but with different processing options
    const processingOptions = new ShaderProcessorOptions(viewUniformFormat, viewBindGroupFormat);
    return processShader(this._shader, processingOptions);
  }

  /**
   * Applies any changes made to the material's properties.
   */
  update() {
    this.dirty = true;
    if (this._shader) this._shader.failed = false;
  }

  // Parameter management
  clearParameters() {
    this.parameters = {};
  }
  getParameters() {
    return this.parameters;
  }
  clearVariants() {
    // clear variants on the material
    this.variants = {};

    // but also clear them from all materials that reference them
    const meshInstances = this.meshInstances;
    const count = meshInstances.length;
    for (let i = 0; i < count; i++) {
      meshInstances[i].clearShaders();
    }
  }

  /**
   * Retrieves the specified shader parameter from a material.
   *
   * @param {string} name - The name of the parameter to query.
   * @returns {object} The named parameter.
   */
  getParameter(name) {
    return this.parameters[name];
  }

  /**
   * Sets a shader parameter on a material.
   *
   * @param {string} name - The name of the parameter to set.
   * @param {number|number[]|Float32Array|import('../../platform/graphics/texture.js').Texture} data -
   * The value for the specified parameter.
   */
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

  /**
   * Deletes a shader parameter on a material.
   *
   * @param {string} name - The name of the parameter to delete.
   */
  deleteParameter(name) {
    if (this.parameters[name]) {
      delete this.parameters[name];
    }
  }

  // used to apply parameters from this material into scope of uniforms, called internally by forward-renderer
  // optional list of parameter names to be set can be specified, otherwise all parameters are set
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

  /**
   * Removes this material from the scene and possibly frees up memory from its shaders (if there
   * are no other materials using it).
   */
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
      } else {
        Debug.warn('pc.Material: MeshInstance.mesh is null, default material cannot be assigned to the MeshInstance');
      }
    }
    this.meshInstances.length = 0;
  }

  /**
   * Registers mesh instance as referencing the material.
   *
   * @param {import('../mesh-instance.js').MeshInstance} meshInstance - The mesh instance to
   * de-register.
   * @ignore
   */
  addMeshInstanceRef(meshInstance) {
    this.meshInstances.push(meshInstance);
  }

  /**
   * De-registers mesh instance as referencing the material.
   *
   * @param {import('../mesh-instance.js').MeshInstance} meshInstance - The mesh instance to
   * de-register.
   * @ignore
   */
  removeMeshInstanceRef(meshInstance) {
    const meshInstances = this.meshInstances;
    const i = meshInstances.indexOf(meshInstance);
    if (i !== -1) {
      meshInstances.splice(i, 1);
    }
  }
}

export { Material };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWF0ZXJpYWwuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9zY2VuZS9tYXRlcmlhbHMvbWF0ZXJpYWwuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcblxuaW1wb3J0IHtcbiAgICBCTEVORE1PREVfWkVSTywgQkxFTkRNT0RFX09ORSwgQkxFTkRNT0RFX1NSQ19DT0xPUixcbiAgICBCTEVORE1PREVfRFNUX0NPTE9SLCBCTEVORE1PREVfT05FX01JTlVTX0RTVF9DT0xPUiwgQkxFTkRNT0RFX1NSQ19BTFBIQSxcbiAgICBCTEVORE1PREVfT05FX01JTlVTX1NSQ19BTFBIQSxcbiAgICBCTEVOREVRVUFUSU9OX0FERCxcbiAgICBCTEVOREVRVUFUSU9OX01JTiwgQkxFTkRFUVVBVElPTl9NQVgsXG4gICAgQ1VMTEZBQ0VfQkFDSyxcbiAgICBGVU5DX0xFU1NFUVVBTFxufSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgU2hhZGVyUHJvY2Vzc29yT3B0aW9ucyB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3NoYWRlci1wcm9jZXNzb3Itb3B0aW9ucy5qcyc7XG5cbmltcG9ydCB7XG4gICAgQkxFTkRfQURESVRJVkUsIEJMRU5EX05PUk1BTCwgQkxFTkRfTk9ORSwgQkxFTkRfUFJFTVVMVElQTElFRCxcbiAgICBCTEVORF9NVUxUSVBMSUNBVElWRSwgQkxFTkRfQURESVRJVkVBTFBIQSwgQkxFTkRfTVVMVElQTElDQVRJVkUyWCwgQkxFTkRfU0NSRUVOLFxuICAgIEJMRU5EX01JTiwgQkxFTkRfTUFYXG59IGZyb20gJy4uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBwcm9jZXNzU2hhZGVyIH0gZnJvbSAnLi4vc2hhZGVyLWxpYi91dGlscy5qcyc7XG5pbXBvcnQgeyBnZXREZWZhdWx0TWF0ZXJpYWwgfSBmcm9tICcuL2RlZmF1bHQtbWF0ZXJpYWwuanMnO1xuXG5sZXQgaWQgPSAwO1xuXG4vKipcbiAqIEEgbWF0ZXJpYWwgZGV0ZXJtaW5lcyBob3cgYSBwYXJ0aWN1bGFyIG1lc2ggaW5zdGFuY2UgaXMgcmVuZGVyZWQuIEl0IHNwZWNpZmllcyB0aGUgc2hhZGVyIGFuZFxuICogcmVuZGVyIHN0YXRlIHRoYXQgaXMgc2V0IGJlZm9yZSB0aGUgbWVzaCBpbnN0YW5jZSBpcyBzdWJtaXR0ZWQgdG8gdGhlIGdyYXBoaWNzIGRldmljZS5cbiAqL1xuY2xhc3MgTWF0ZXJpYWwge1xuICAgIC8qKlxuICAgICAqIEEgc2hhZGVyIHVzZWQgdG8gcmVuZGVyIHRoZSBtYXRlcmlhbC4gTm90ZSB0aGF0IHRoaXMgaXMgdXNlZCBvbmx5IGJ5IG1hdGVyaWFscyB3aGVyZSB0aGVcbiAgICAgKiB1c2VyIHNwZWNpZmllcyB0aGUgc2hhZGVyLiBNb3N0IG1hdGVyaWFsIHR5cGVzIGdlbmVyYXRlIG11bHRpcGxlIHNoYWRlciB2YXJpYW50cywgYW5kIGRvIG5vdFxuICAgICAqIHNldCB0aGlzLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3Mvc2hhZGVyLmpzJykuU2hhZGVyfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3NoYWRlciA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbWVzaCBpbnN0YW5jZXMgcmVmZXJlbmNpbmcgdGhpcyBtYXRlcmlhbFxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vbWVzaC1pbnN0YW5jZS5qcycpLk1lc2hJbnN0YW5jZVtdfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgbWVzaEluc3RhbmNlcyA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogVGhlIG5hbWUgb2YgdGhlIG1hdGVyaWFsLlxuICAgICAqL1xuICAgIG5hbWUgPSAnVW50aXRsZWQnO1xuXG4gICAgaWQgPSBpZCsrO1xuXG4gICAgdmFyaWFudHMgPSB7fTtcblxuICAgIHBhcmFtZXRlcnMgPSB7fTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBhbHBoYSB0ZXN0IHJlZmVyZW5jZSB2YWx1ZSB0byBjb250cm9sIHdoaWNoIGZyYWdtZW50cyBhcmUgd3JpdHRlbiB0byB0aGUgY3VycmVudGx5XG4gICAgICogYWN0aXZlIHJlbmRlciB0YXJnZXQgYmFzZWQgb24gYWxwaGEgdmFsdWUuIEFsbCBmcmFnbWVudHMgd2l0aCBhbiBhbHBoYSB2YWx1ZSBvZiBsZXNzIHRoYW5cbiAgICAgKiB0aGUgYWxwaGFUZXN0IHJlZmVyZW5jZSB2YWx1ZSB3aWxsIGJlIGRpc2NhcmRlZC4gYWxwaGFUZXN0IGRlZmF1bHRzIHRvIDAgKGFsbCBmcmFnbWVudHNcbiAgICAgKiBwYXNzKS5cbiAgICAgKi9cbiAgICBhbHBoYVRlc3QgPSAwO1xuXG4gICAgLyoqXG4gICAgICogRW5hYmxlcyBvciBkaXNhYmxlcyBhbHBoYSB0byBjb3ZlcmFnZSAoV2ViR0wyIG9ubHkpLiBXaGVuIGVuYWJsZWQsIGFuZCBpZiBoYXJkd2FyZVxuICAgICAqIGFudGktYWxpYXNpbmcgaXMgb24sIGxpbWl0ZWQgb3JkZXItaW5kZXBlbmRlbnQgdHJhbnNwYXJlbmN5IGNhbiBiZSBhY2hpZXZlZC4gUXVhbGl0eSBkZXBlbmRzXG4gICAgICogb24gdGhlIG51bWJlciBvZiBNU0FBIHNhbXBsZXMgb2YgdGhlIGN1cnJlbnQgcmVuZGVyIHRhcmdldC4gSXQgY2FuIG5pY2VseSBzb2Z0ZW4gZWRnZXMgb2ZcbiAgICAgKiBvdGhlcndpc2Ugc2hhcnAgYWxwaGEgY3V0b3V0cywgYnV0IGlzbid0IHJlY29tbWVuZGVkIGZvciBsYXJnZSBhcmVhIHNlbWktdHJhbnNwYXJlbnRcbiAgICAgKiBzdXJmYWNlcy4gTm90ZSwgdGhhdCB5b3UgZG9uJ3QgbmVlZCB0byBlbmFibGUgYmxlbmRpbmcgdG8gbWFrZSBhbHBoYSB0byBjb3ZlcmFnZSB3b3JrLiBJdFxuICAgICAqIHdpbGwgd29yayB3aXRob3V0IGl0LCBqdXN0IGxpa2UgYWxwaGFUZXN0LlxuICAgICAqL1xuICAgIGFscGhhVG9Db3ZlcmFnZSA9IGZhbHNlO1xuXG4gICAgYmxlbmQgPSBmYWxzZTtcblxuICAgIGJsZW5kU3JjID0gQkxFTkRNT0RFX09ORTtcblxuICAgIGJsZW5kRHN0ID0gQkxFTkRNT0RFX1pFUk87XG5cbiAgICBibGVuZEVxdWF0aW9uID0gQkxFTkRFUVVBVElPTl9BREQ7XG5cbiAgICBzZXBhcmF0ZUFscGhhQmxlbmQgPSBmYWxzZTtcblxuICAgIGJsZW5kU3JjQWxwaGEgPSBCTEVORE1PREVfT05FO1xuXG4gICAgYmxlbmREc3RBbHBoYSA9IEJMRU5ETU9ERV9aRVJPO1xuXG4gICAgYmxlbmRBbHBoYUVxdWF0aW9uID0gQkxFTkRFUVVBVElPTl9BREQ7XG5cbiAgICAvKipcbiAgICAgKiBDb250cm9scyBob3cgdHJpYW5nbGVzIGFyZSBjdWxsZWQgYmFzZWQgb24gdGhlaXIgZmFjZSBkaXJlY3Rpb24gd2l0aCByZXNwZWN0IHRvIHRoZVxuICAgICAqIHZpZXdwb2ludC4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgQ1VMTEZBQ0VfTk9ORX06IERvIG5vdCBjdWxsIHRyaWFuZ2xlcyBiYXNlZCBvbiBmYWNlIGRpcmVjdGlvbi5cbiAgICAgKiAtIHtAbGluayBDVUxMRkFDRV9CQUNLfTogQ3VsbCB0aGUgYmFjayBmYWNlcyBvZiB0cmlhbmdsZXMgKGRvIG5vdCByZW5kZXIgdHJpYW5nbGVzIGZhY2luZ1xuICAgICAqIGF3YXkgZnJvbSB0aGUgdmlldyBwb2ludCkuXG4gICAgICogLSB7QGxpbmsgQ1VMTEZBQ0VfRlJPTlR9OiBDdWxsIHRoZSBmcm9udCBmYWNlcyBvZiB0cmlhbmdsZXMgKGRvIG5vdCByZW5kZXIgdHJpYW5nbGVzIGZhY2luZ1xuICAgICAqIHRvd2FyZHMgdGhlIHZpZXcgcG9pbnQpLlxuICAgICAqIC0ge0BsaW5rIENVTExGQUNFX0ZST05UQU5EQkFDS306IEN1bGwgYm90aCBmcm9udCBhbmQgYmFjayBmYWNlcyAodHJpYW5nbGVzIHdpbGwgbm90IGJlXG4gICAgICogcmVuZGVyZWQpLlxuICAgICAqXG4gICAgICogRGVmYXVsdHMgdG8ge0BsaW5rIENVTExGQUNFX0JBQ0t9LlxuICAgICAqL1xuICAgIGN1bGwgPSBDVUxMRkFDRV9CQUNLO1xuXG4gICAgLyoqXG4gICAgICogSWYgdHJ1ZSwgZnJhZ21lbnRzIGdlbmVyYXRlZCBieSB0aGUgc2hhZGVyIG9mIHRoaXMgbWF0ZXJpYWwgYXJlIG9ubHkgd3JpdHRlbiB0byB0aGUgY3VycmVudFxuICAgICAqIHJlbmRlciB0YXJnZXQgaWYgdGhleSBwYXNzIHRoZSBkZXB0aCB0ZXN0LiBJZiBmYWxzZSwgZnJhZ21lbnRzIGdlbmVyYXRlZCBieSB0aGUgc2hhZGVyIG9mXG4gICAgICogdGhpcyBtYXRlcmlhbCBhcmUgd3JpdHRlbiB0byB0aGUgY3VycmVudCByZW5kZXIgdGFyZ2V0IHJlZ2FyZGxlc3Mgb2Ygd2hhdCBpcyBpbiB0aGUgZGVwdGhcbiAgICAgKiBidWZmZXIuIERlZmF1bHRzIHRvIHRydWUuXG4gICAgICovXG4gICAgZGVwdGhUZXN0ID0gdHJ1ZTtcblxuICAgIC8qKlxuICAgICAqIENvbnRyb2xzIGhvdyB0aGUgZGVwdGggb2YgbmV3IGZyYWdtZW50cyBpcyBjb21wYXJlZCBhZ2FpbnN0IHRoZSBjdXJyZW50IGRlcHRoIGNvbnRhaW5lZCBpblxuICAgICAqIHRoZSBkZXB0aCBidWZmZXIuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEZVTkNfTkVWRVJ9OiBkb24ndCBkcmF3XG4gICAgICogLSB7QGxpbmsgRlVOQ19MRVNTfTogZHJhdyBpZiBuZXcgZGVwdGggPCBkZXB0aCBidWZmZXJcbiAgICAgKiAtIHtAbGluayBGVU5DX0VRVUFMfTogZHJhdyBpZiBuZXcgZGVwdGggPT0gZGVwdGggYnVmZmVyXG4gICAgICogLSB7QGxpbmsgRlVOQ19MRVNTRVFVQUx9OiBkcmF3IGlmIG5ldyBkZXB0aCA8PSBkZXB0aCBidWZmZXJcbiAgICAgKiAtIHtAbGluayBGVU5DX0dSRUFURVJ9OiBkcmF3IGlmIG5ldyBkZXB0aCA+IGRlcHRoIGJ1ZmZlclxuICAgICAqIC0ge0BsaW5rIEZVTkNfTk9URVFVQUx9OiBkcmF3IGlmIG5ldyBkZXB0aCAhPSBkZXB0aCBidWZmZXJcbiAgICAgKiAtIHtAbGluayBGVU5DX0dSRUFURVJFUVVBTH06IGRyYXcgaWYgbmV3IGRlcHRoID49IGRlcHRoIGJ1ZmZlclxuICAgICAqIC0ge0BsaW5rIEZVTkNfQUxXQVlTfTogYWx3YXlzIGRyYXdcbiAgICAgKlxuICAgICAqIERlZmF1bHRzIHRvIHtAbGluayBGVU5DX0xFU1NFUVVBTH0uXG4gICAgICovXG4gICAgZGVwdGhGdW5jID0gRlVOQ19MRVNTRVFVQUw7XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlLCBmcmFnbWVudHMgZ2VuZXJhdGVkIGJ5IHRoZSBzaGFkZXIgb2YgdGhpcyBtYXRlcmlhbCB3cml0ZSBhIGRlcHRoIHZhbHVlIHRvIHRoZSBkZXB0aFxuICAgICAqIGJ1ZmZlciBvZiB0aGUgY3VycmVudGx5IGFjdGl2ZSByZW5kZXIgdGFyZ2V0LiBJZiBmYWxzZSwgbm8gZGVwdGggdmFsdWUgaXMgd3JpdHRlbi4gRGVmYXVsdHNcbiAgICAgKiB0byB0cnVlLlxuICAgICAqL1xuICAgIGRlcHRoV3JpdGUgPSB0cnVlO1xuXG4gICAgLyoqXG4gICAgICogU3RlbmNpbCBwYXJhbWV0ZXJzIGZvciBmcm9udCBmYWNlcyAoZGVmYXVsdCBpcyBudWxsKS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL3N0ZW5jaWwtcGFyYW1ldGVycy5qcycpLlN0ZW5jaWxQYXJhbWV0ZXJzfG51bGx9XG4gICAgICovXG4gICAgc3RlbmNpbEZyb250ID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIFN0ZW5jaWwgcGFyYW1ldGVycyBmb3IgYmFjayBmYWNlcyAoZGVmYXVsdCBpcyBudWxsKS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL3N0ZW5jaWwtcGFyYW1ldGVycy5qcycpLlN0ZW5jaWxQYXJhbWV0ZXJzfG51bGx9XG4gICAgICovXG4gICAgc3RlbmNpbEJhY2sgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogT2Zmc2V0cyB0aGUgb3V0cHV0IGRlcHRoIGJ1ZmZlciB2YWx1ZS4gVXNlZnVsIGZvciBkZWNhbHMgdG8gcHJldmVudCB6LWZpZ2h0aW5nLlxuICAgICAqL1xuICAgIGRlcHRoQmlhcyA9IDA7XG5cbiAgICAvKipcbiAgICAgKiBTYW1lIGFzIHtAbGluayBNYXRlcmlhbCNkZXB0aEJpYXN9LCBidXQgYWxzbyBkZXBlbmRzIG9uIHRoZSBzbG9wZSBvZiB0aGUgdHJpYW5nbGUgcmVsYXRpdmVcbiAgICAgKiB0byB0aGUgY2FtZXJhLlxuICAgICAqL1xuICAgIHNsb3BlRGVwdGhCaWFzID0gMDtcblxuICAgIC8qKlxuICAgICAqIElmIHRydWUsIHRoZSByZWQgY29tcG9uZW50IG9mIGZyYWdtZW50cyBnZW5lcmF0ZWQgYnkgdGhlIHNoYWRlciBvZiB0aGlzIG1hdGVyaWFsIGlzIHdyaXR0ZW5cbiAgICAgKiB0byB0aGUgY29sb3IgYnVmZmVyIG9mIHRoZSBjdXJyZW50bHkgYWN0aXZlIHJlbmRlciB0YXJnZXQuIElmIGZhbHNlLCB0aGUgcmVkIGNvbXBvbmVudCB3aWxsXG4gICAgICogbm90IGJlIHdyaXR0ZW4uIERlZmF1bHRzIHRvIHRydWUuXG4gICAgICovXG4gICAgcmVkV3JpdGUgPSB0cnVlO1xuXG4gICAgLyoqXG4gICAgICogSWYgdHJ1ZSwgdGhlIGdyZWVuIGNvbXBvbmVudCBvZiBmcmFnbWVudHMgZ2VuZXJhdGVkIGJ5IHRoZSBzaGFkZXIgb2YgdGhpcyBtYXRlcmlhbCBpc1xuICAgICAqIHdyaXR0ZW4gdG8gdGhlIGNvbG9yIGJ1ZmZlciBvZiB0aGUgY3VycmVudGx5IGFjdGl2ZSByZW5kZXIgdGFyZ2V0LiBJZiBmYWxzZSwgdGhlIGdyZWVuXG4gICAgICogY29tcG9uZW50IHdpbGwgbm90IGJlIHdyaXR0ZW4uIERlZmF1bHRzIHRvIHRydWUuXG4gICAgICovXG4gICAgZ3JlZW5Xcml0ZSA9IHRydWU7XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlLCB0aGUgYmx1ZSBjb21wb25lbnQgb2YgZnJhZ21lbnRzIGdlbmVyYXRlZCBieSB0aGUgc2hhZGVyIG9mIHRoaXMgbWF0ZXJpYWwgaXNcbiAgICAgKiB3cml0dGVuIHRvIHRoZSBjb2xvciBidWZmZXIgb2YgdGhlIGN1cnJlbnRseSBhY3RpdmUgcmVuZGVyIHRhcmdldC4gSWYgZmFsc2UsIHRoZSBibHVlXG4gICAgICogY29tcG9uZW50IHdpbGwgbm90IGJlIHdyaXR0ZW4uIERlZmF1bHRzIHRvIHRydWUuXG4gICAgICovXG4gICAgYmx1ZVdyaXRlID0gdHJ1ZTtcblxuICAgIC8qKlxuICAgICAqIElmIHRydWUsIHRoZSBhbHBoYSBjb21wb25lbnQgb2YgZnJhZ21lbnRzIGdlbmVyYXRlZCBieSB0aGUgc2hhZGVyIG9mIHRoaXMgbWF0ZXJpYWwgaXNcbiAgICAgKiB3cml0dGVuIHRvIHRoZSBjb2xvciBidWZmZXIgb2YgdGhlIGN1cnJlbnRseSBhY3RpdmUgcmVuZGVyIHRhcmdldC4gSWYgZmFsc2UsIHRoZSBhbHBoYVxuICAgICAqIGNvbXBvbmVudCB3aWxsIG5vdCBiZSB3cml0dGVuLiBEZWZhdWx0cyB0byB0cnVlLlxuICAgICAqL1xuICAgIGFscGhhV3JpdGUgPSB0cnVlO1xuXG4gICAgX3NoYWRlclZlcnNpb24gPSAwO1xuXG4gICAgX3NjZW5lID0gbnVsbDtcblxuICAgIF9kaXJ0eUJsZW5kID0gZmFsc2U7XG5cbiAgICBkaXJ0eSA9IHRydWU7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgc2hhZGVyIHVzZWQgYnkgdGhpcyBtYXRlcmlhbCB0byByZW5kZXIgbWVzaCBpbnN0YW5jZXMgKGRlZmF1bHQgaXMgbnVsbCkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9zaGFkZXIuanMnKS5TaGFkZXJ8bnVsbH1cbiAgICAgKi9cbiAgICBzZXQgc2hhZGVyKHNoYWRlcikge1xuICAgICAgICB0aGlzLl9zaGFkZXIgPSBzaGFkZXI7XG4gICAgfVxuXG4gICAgZ2V0IHNoYWRlcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NoYWRlcjtcbiAgICB9XG5cbiAgICAvLyByZXR1cm5zIGJvb2xlYW4gZGVwZW5kaW5nIG9uIG1hdGVyaWFsIGJlaW5nIHRyYW5zcGFyZW50XG4gICAgZ2V0IHRyYW5zcGFyZW50KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5ibGVuZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb250cm9scyBob3cgcHJpbWl0aXZlcyBhcmUgYmxlbmRlZCB3aGVuIGJlaW5nIHdyaXR0ZW4gdG8gdGhlIGN1cnJlbnRseSBhY3RpdmUgcmVuZGVyXG4gICAgICogdGFyZ2V0LiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBCTEVORF9TVUJUUkFDVElWRX06IFN1YnRyYWN0IHRoZSBjb2xvciBvZiB0aGUgc291cmNlIGZyYWdtZW50IGZyb20gdGhlIGRlc3RpbmF0aW9uXG4gICAgICogZnJhZ21lbnQgYW5kIHdyaXRlIHRoZSByZXN1bHQgdG8gdGhlIGZyYW1lIGJ1ZmZlci5cbiAgICAgKiAtIHtAbGluayBCTEVORF9BRERJVElWRX06IEFkZCB0aGUgY29sb3Igb2YgdGhlIHNvdXJjZSBmcmFnbWVudCB0byB0aGUgZGVzdGluYXRpb24gZnJhZ21lbnRcbiAgICAgKiBhbmQgd3JpdGUgdGhlIHJlc3VsdCB0byB0aGUgZnJhbWUgYnVmZmVyLlxuICAgICAqIC0ge0BsaW5rIEJMRU5EX05PUk1BTH06IEVuYWJsZSBzaW1wbGUgdHJhbnNsdWNlbmN5IGZvciBtYXRlcmlhbHMgc3VjaCBhcyBnbGFzcy4gVGhpcyBpc1xuICAgICAqIGVxdWl2YWxlbnQgdG8gZW5hYmxpbmcgYSBzb3VyY2UgYmxlbmQgbW9kZSBvZiB7QGxpbmsgQkxFTkRNT0RFX1NSQ19BTFBIQX0gYW5kIGEgZGVzdGluYXRpb25cbiAgICAgKiBibGVuZCBtb2RlIG9mIHtAbGluayBCTEVORE1PREVfT05FX01JTlVTX1NSQ19BTFBIQX0uXG4gICAgICogLSB7QGxpbmsgQkxFTkRfTk9ORX06IERpc2FibGUgYmxlbmRpbmcuXG4gICAgICogLSB7QGxpbmsgQkxFTkRfUFJFTVVMVElQTElFRH06IFNpbWlsYXIgdG8ge0BsaW5rIEJMRU5EX05PUk1BTH0gZXhwZWN0IHRoZSBzb3VyY2UgZnJhZ21lbnQgaXNcbiAgICAgKiBhc3N1bWVkIHRvIGhhdmUgYWxyZWFkeSBiZWVuIG11bHRpcGxpZWQgYnkgdGhlIHNvdXJjZSBhbHBoYSB2YWx1ZS5cbiAgICAgKiAtIHtAbGluayBCTEVORF9NVUxUSVBMSUNBVElWRX06IE11bHRpcGx5IHRoZSBjb2xvciBvZiB0aGUgc291cmNlIGZyYWdtZW50IGJ5IHRoZSBjb2xvciBvZiB0aGVcbiAgICAgKiBkZXN0aW5hdGlvbiBmcmFnbWVudCBhbmQgd3JpdGUgdGhlIHJlc3VsdCB0byB0aGUgZnJhbWUgYnVmZmVyLlxuICAgICAqIC0ge0BsaW5rIEJMRU5EX0FERElUSVZFQUxQSEF9OiBTYW1lIGFzIHtAbGluayBCTEVORF9BRERJVElWRX0gZXhjZXB0IHRoZSBzb3VyY2UgUkdCIGlzXG4gICAgICogbXVsdGlwbGllZCBieSB0aGUgc291cmNlIGFscGhhLlxuICAgICAqIC0ge0BsaW5rIEJMRU5EX01VTFRJUExJQ0FUSVZFMlh9OiBNdWx0aXBsaWVzIGNvbG9ycyBhbmQgZG91YmxlcyB0aGUgcmVzdWx0LlxuICAgICAqIC0ge0BsaW5rIEJMRU5EX1NDUkVFTn06IFNvZnRlciB2ZXJzaW9uIG9mIGFkZGl0aXZlLlxuICAgICAqIC0ge0BsaW5rIEJMRU5EX01JTn06IE1pbmltdW0gY29sb3IuIENoZWNrIGFwcC5ncmFwaGljc0RldmljZS5leHRCbGVuZE1pbm1heCBmb3Igc3VwcG9ydC5cbiAgICAgKiAtIHtAbGluayBCTEVORF9NQVh9OiBNYXhpbXVtIGNvbG9yLiBDaGVjayBhcHAuZ3JhcGhpY3NEZXZpY2UuZXh0QmxlbmRNaW5tYXggZm9yIHN1cHBvcnQuXG4gICAgICpcbiAgICAgKiBEZWZhdWx0cyB0byB7QGxpbmsgQkxFTkRfTk9ORX0uXG4gICAgICovXG4gICAgc2V0IGJsZW5kVHlwZSh0eXBlKSB7XG4gICAgICAgIGxldCBibGVuZCA9IHRydWU7XG4gICAgICAgIHN3aXRjaCAodHlwZSkge1xuICAgICAgICAgICAgY2FzZSBCTEVORF9OT05FOlxuICAgICAgICAgICAgICAgIGJsZW5kID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgdGhpcy5ibGVuZFNyYyA9IEJMRU5ETU9ERV9PTkU7XG4gICAgICAgICAgICAgICAgdGhpcy5ibGVuZERzdCA9IEJMRU5ETU9ERV9aRVJPO1xuICAgICAgICAgICAgICAgIHRoaXMuYmxlbmRFcXVhdGlvbiA9IEJMRU5ERVFVQVRJT05fQUREO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBCTEVORF9OT1JNQUw6XG4gICAgICAgICAgICAgICAgdGhpcy5ibGVuZFNyYyA9IEJMRU5ETU9ERV9TUkNfQUxQSEE7XG4gICAgICAgICAgICAgICAgdGhpcy5ibGVuZERzdCA9IEJMRU5ETU9ERV9PTkVfTUlOVVNfU1JDX0FMUEhBO1xuICAgICAgICAgICAgICAgIHRoaXMuYmxlbmRFcXVhdGlvbiA9IEJMRU5ERVFVQVRJT05fQUREO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBCTEVORF9QUkVNVUxUSVBMSUVEOlxuICAgICAgICAgICAgICAgIHRoaXMuYmxlbmRTcmMgPSBCTEVORE1PREVfT05FO1xuICAgICAgICAgICAgICAgIHRoaXMuYmxlbmREc3QgPSBCTEVORE1PREVfT05FX01JTlVTX1NSQ19BTFBIQTtcbiAgICAgICAgICAgICAgICB0aGlzLmJsZW5kRXF1YXRpb24gPSBCTEVOREVRVUFUSU9OX0FERDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgQkxFTkRfQURESVRJVkU6XG4gICAgICAgICAgICAgICAgdGhpcy5ibGVuZFNyYyA9IEJMRU5ETU9ERV9PTkU7XG4gICAgICAgICAgICAgICAgdGhpcy5ibGVuZERzdCA9IEJMRU5ETU9ERV9PTkU7XG4gICAgICAgICAgICAgICAgdGhpcy5ibGVuZEVxdWF0aW9uID0gQkxFTkRFUVVBVElPTl9BREQ7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIEJMRU5EX0FERElUSVZFQUxQSEE6XG4gICAgICAgICAgICAgICAgdGhpcy5ibGVuZFNyYyA9IEJMRU5ETU9ERV9TUkNfQUxQSEE7XG4gICAgICAgICAgICAgICAgdGhpcy5ibGVuZERzdCA9IEJMRU5ETU9ERV9PTkU7XG4gICAgICAgICAgICAgICAgdGhpcy5ibGVuZEVxdWF0aW9uID0gQkxFTkRFUVVBVElPTl9BREQ7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIEJMRU5EX01VTFRJUExJQ0FUSVZFMlg6XG4gICAgICAgICAgICAgICAgdGhpcy5ibGVuZFNyYyA9IEJMRU5ETU9ERV9EU1RfQ09MT1I7XG4gICAgICAgICAgICAgICAgdGhpcy5ibGVuZERzdCA9IEJMRU5ETU9ERV9TUkNfQ09MT1I7XG4gICAgICAgICAgICAgICAgdGhpcy5ibGVuZEVxdWF0aW9uID0gQkxFTkRFUVVBVElPTl9BREQ7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIEJMRU5EX1NDUkVFTjpcbiAgICAgICAgICAgICAgICB0aGlzLmJsZW5kU3JjID0gQkxFTkRNT0RFX09ORV9NSU5VU19EU1RfQ09MT1I7XG4gICAgICAgICAgICAgICAgdGhpcy5ibGVuZERzdCA9IEJMRU5ETU9ERV9PTkU7XG4gICAgICAgICAgICAgICAgdGhpcy5ibGVuZEVxdWF0aW9uID0gQkxFTkRFUVVBVElPTl9BREQ7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIEJMRU5EX01VTFRJUExJQ0FUSVZFOlxuICAgICAgICAgICAgICAgIHRoaXMuYmxlbmRTcmMgPSBCTEVORE1PREVfRFNUX0NPTE9SO1xuICAgICAgICAgICAgICAgIHRoaXMuYmxlbmREc3QgPSBCTEVORE1PREVfWkVSTztcbiAgICAgICAgICAgICAgICB0aGlzLmJsZW5kRXF1YXRpb24gPSBCTEVOREVRVUFUSU9OX0FERDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgQkxFTkRfTUlOOlxuICAgICAgICAgICAgICAgIHRoaXMuYmxlbmRTcmMgPSBCTEVORE1PREVfT05FO1xuICAgICAgICAgICAgICAgIHRoaXMuYmxlbmREc3QgPSBCTEVORE1PREVfT05FO1xuICAgICAgICAgICAgICAgIHRoaXMuYmxlbmRFcXVhdGlvbiA9IEJMRU5ERVFVQVRJT05fTUlOO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBCTEVORF9NQVg6XG4gICAgICAgICAgICAgICAgdGhpcy5ibGVuZFNyYyA9IEJMRU5ETU9ERV9PTkU7XG4gICAgICAgICAgICAgICAgdGhpcy5ibGVuZERzdCA9IEJMRU5ETU9ERV9PTkU7XG4gICAgICAgICAgICAgICAgdGhpcy5ibGVuZEVxdWF0aW9uID0gQkxFTkRFUVVBVElPTl9NQVg7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuYmxlbmQgIT09IGJsZW5kKSB7XG4gICAgICAgICAgICB0aGlzLmJsZW5kID0gYmxlbmQ7XG4gICAgICAgICAgICBpZiAodGhpcy5fc2NlbmUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9zY2VuZS5sYXllcnMuX2RpcnR5QmxlbmQgPSB0cnVlO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9kaXJ0eUJsZW5kID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB0aGlzLl91cGRhdGVNZXNoSW5zdGFuY2VLZXlzKCk7XG4gICAgfVxuXG4gICAgZ2V0IGJsZW5kVHlwZSgpIHtcbiAgICAgICAgaWYgKCF0aGlzLmJsZW5kKSB7XG4gICAgICAgICAgICByZXR1cm4gQkxFTkRfTk9ORTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICgodGhpcy5ibGVuZFNyYyA9PT0gQkxFTkRNT0RFX1NSQ19BTFBIQSkgJiYgKHRoaXMuYmxlbmREc3QgPT09IEJMRU5ETU9ERV9PTkVfTUlOVVNfU1JDX0FMUEhBKSAmJlxuICAgICAgICAgICAgKHRoaXMuYmxlbmRFcXVhdGlvbiA9PT0gQkxFTkRFUVVBVElPTl9BREQpKSB7XG4gICAgICAgICAgICByZXR1cm4gQkxFTkRfTk9STUFMO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCh0aGlzLmJsZW5kU3JjID09PSBCTEVORE1PREVfT05FKSAmJiAodGhpcy5ibGVuZERzdCA9PT0gQkxFTkRNT0RFX09ORSkgJiZcbiAgICAgICAgICAgICh0aGlzLmJsZW5kRXF1YXRpb24gPT09IEJMRU5ERVFVQVRJT05fQUREKSkge1xuICAgICAgICAgICAgcmV0dXJuIEJMRU5EX0FERElUSVZFO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCh0aGlzLmJsZW5kU3JjID09PSBCTEVORE1PREVfU1JDX0FMUEhBKSAmJiAodGhpcy5ibGVuZERzdCA9PT0gQkxFTkRNT0RFX09ORSkgJiZcbiAgICAgICAgICAgICh0aGlzLmJsZW5kRXF1YXRpb24gPT09IEJMRU5ERVFVQVRJT05fQUREKSkge1xuICAgICAgICAgICAgcmV0dXJuIEJMRU5EX0FERElUSVZFQUxQSEE7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoKHRoaXMuYmxlbmRTcmMgPT09IEJMRU5ETU9ERV9EU1RfQ09MT1IpICYmICh0aGlzLmJsZW5kRHN0ID09PSBCTEVORE1PREVfU1JDX0NPTE9SKSAmJlxuICAgICAgICAgICAgKHRoaXMuYmxlbmRFcXVhdGlvbiA9PT0gQkxFTkRFUVVBVElPTl9BREQpKSB7XG4gICAgICAgICAgICByZXR1cm4gQkxFTkRfTVVMVElQTElDQVRJVkUyWDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICgodGhpcy5ibGVuZFNyYyA9PT0gQkxFTkRNT0RFX09ORV9NSU5VU19EU1RfQ09MT1IpICYmICh0aGlzLmJsZW5kRHN0ID09PSBCTEVORE1PREVfT05FKSAmJlxuICAgICAgICAgICAgKHRoaXMuYmxlbmRFcXVhdGlvbiA9PT0gQkxFTkRFUVVBVElPTl9BREQpKSB7XG4gICAgICAgICAgICByZXR1cm4gQkxFTkRfU0NSRUVOO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCh0aGlzLmJsZW5kU3JjID09PSBCTEVORE1PREVfT05FKSAmJiAodGhpcy5ibGVuZERzdCA9PT0gQkxFTkRNT0RFX09ORSkgJiZcbiAgICAgICAgICAgICh0aGlzLmJsZW5kRXF1YXRpb24gPT09IEJMRU5ERVFVQVRJT05fTUlOKSkge1xuICAgICAgICAgICAgcmV0dXJuIEJMRU5EX01JTjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICgodGhpcy5ibGVuZFNyYyA9PT0gQkxFTkRNT0RFX09ORSkgJiYgKHRoaXMuYmxlbmREc3QgPT09IEJMRU5ETU9ERV9PTkUpICYmXG4gICAgICAgICAgICAodGhpcy5ibGVuZEVxdWF0aW9uID09PSBCTEVOREVRVUFUSU9OX01BWCkpIHtcbiAgICAgICAgICAgIHJldHVybiBCTEVORF9NQVg7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoKHRoaXMuYmxlbmRTcmMgPT09IEJMRU5ETU9ERV9EU1RfQ09MT1IpICYmICh0aGlzLmJsZW5kRHN0ID09PSBCTEVORE1PREVfWkVSTykgJiZcbiAgICAgICAgICAgICh0aGlzLmJsZW5kRXF1YXRpb24gPT09IEJMRU5ERVFVQVRJT05fQUREKSkge1xuICAgICAgICAgICAgcmV0dXJuIEJMRU5EX01VTFRJUExJQ0FUSVZFO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCh0aGlzLmJsZW5kU3JjID09PSBCTEVORE1PREVfT05FKSAmJiAodGhpcy5ibGVuZERzdCA9PT0gQkxFTkRNT0RFX09ORV9NSU5VU19TUkNfQUxQSEEpICYmXG4gICAgICAgICAgICAodGhpcy5ibGVuZEVxdWF0aW9uID09PSBCTEVOREVRVUFUSU9OX0FERCkpIHtcbiAgICAgICAgICAgIHJldHVybiBCTEVORF9QUkVNVUxUSVBMSUVEO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIEJMRU5EX05PUk1BTDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb3B5IGEgbWF0ZXJpYWwuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge01hdGVyaWFsfSBzb3VyY2UgLSBUaGUgbWF0ZXJpYWwgdG8gY29weS5cbiAgICAgKiBAcmV0dXJucyB7TWF0ZXJpYWx9IFRoZSBkZXN0aW5hdGlvbiBtYXRlcmlhbC5cbiAgICAgKi9cbiAgICBjb3B5KHNvdXJjZSkge1xuICAgICAgICB0aGlzLm5hbWUgPSBzb3VyY2UubmFtZTtcbiAgICAgICAgdGhpcy5fc2hhZGVyID0gc291cmNlLl9zaGFkZXI7XG5cbiAgICAgICAgLy8gUmVuZGVyIHN0YXRlc1xuICAgICAgICB0aGlzLmFscGhhVGVzdCA9IHNvdXJjZS5hbHBoYVRlc3Q7XG4gICAgICAgIHRoaXMuYWxwaGFUb0NvdmVyYWdlID0gc291cmNlLmFscGhhVG9Db3ZlcmFnZTtcblxuICAgICAgICB0aGlzLmJsZW5kID0gc291cmNlLmJsZW5kO1xuICAgICAgICB0aGlzLmJsZW5kU3JjID0gc291cmNlLmJsZW5kU3JjO1xuICAgICAgICB0aGlzLmJsZW5kRHN0ID0gc291cmNlLmJsZW5kRHN0O1xuICAgICAgICB0aGlzLmJsZW5kRXF1YXRpb24gPSBzb3VyY2UuYmxlbmRFcXVhdGlvbjtcblxuICAgICAgICB0aGlzLnNlcGFyYXRlQWxwaGFCbGVuZCA9IHNvdXJjZS5zZXBhcmF0ZUFscGhhQmxlbmQ7XG4gICAgICAgIHRoaXMuYmxlbmRTcmNBbHBoYSA9IHNvdXJjZS5ibGVuZFNyY0FscGhhO1xuICAgICAgICB0aGlzLmJsZW5kRHN0QWxwaGEgPSBzb3VyY2UuYmxlbmREc3RBbHBoYTtcbiAgICAgICAgdGhpcy5ibGVuZEFscGhhRXF1YXRpb24gPSBzb3VyY2UuYmxlbmRBbHBoYUVxdWF0aW9uO1xuXG4gICAgICAgIHRoaXMuY3VsbCA9IHNvdXJjZS5jdWxsO1xuXG4gICAgICAgIHRoaXMuZGVwdGhUZXN0ID0gc291cmNlLmRlcHRoVGVzdDtcbiAgICAgICAgdGhpcy5kZXB0aEZ1bmMgPSBzb3VyY2UuZGVwdGhGdW5jO1xuICAgICAgICB0aGlzLmRlcHRoV3JpdGUgPSBzb3VyY2UuZGVwdGhXcml0ZTtcbiAgICAgICAgdGhpcy5kZXB0aEJpYXMgPSBzb3VyY2UuZGVwdGhCaWFzO1xuICAgICAgICB0aGlzLnNsb3BlRGVwdGhCaWFzID0gc291cmNlLnNsb3BlRGVwdGhCaWFzO1xuICAgICAgICBpZiAoc291cmNlLnN0ZW5jaWxGcm9udCkgdGhpcy5zdGVuY2lsRnJvbnQgPSBzb3VyY2Uuc3RlbmNpbEZyb250LmNsb25lKCk7XG4gICAgICAgIGlmIChzb3VyY2Uuc3RlbmNpbEJhY2spIHtcbiAgICAgICAgICAgIGlmIChzb3VyY2Uuc3RlbmNpbEZyb250ID09PSBzb3VyY2Uuc3RlbmNpbEJhY2spIHtcbiAgICAgICAgICAgICAgICB0aGlzLnN0ZW5jaWxCYWNrID0gdGhpcy5zdGVuY2lsRnJvbnQ7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuc3RlbmNpbEJhY2sgPSBzb3VyY2Uuc3RlbmNpbEJhY2suY2xvbmUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMucmVkV3JpdGUgPSBzb3VyY2UucmVkV3JpdGU7XG4gICAgICAgIHRoaXMuZ3JlZW5Xcml0ZSA9IHNvdXJjZS5ncmVlbldyaXRlO1xuICAgICAgICB0aGlzLmJsdWVXcml0ZSA9IHNvdXJjZS5ibHVlV3JpdGU7XG4gICAgICAgIHRoaXMuYWxwaGFXcml0ZSA9IHNvdXJjZS5hbHBoYVdyaXRlO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENsb25lIGEgbWF0ZXJpYWwuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7dGhpc30gQSBuZXdseSBjbG9uZWQgbWF0ZXJpYWwuXG4gICAgICovXG4gICAgY2xvbmUoKSB7XG4gICAgICAgIGNvbnN0IGNsb25lID0gbmV3IHRoaXMuY29uc3RydWN0b3IoKTtcbiAgICAgICAgcmV0dXJuIGNsb25lLmNvcHkodGhpcyk7XG4gICAgfVxuXG4gICAgX3VwZGF0ZU1lc2hJbnN0YW5jZUtleXMoKSB7XG4gICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZXMgPSB0aGlzLm1lc2hJbnN0YW5jZXM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWVzaEluc3RhbmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgbWVzaEluc3RhbmNlc1tpXS51cGRhdGVLZXkoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVwZGF0ZVVuaWZvcm1zKGRldmljZSwgc2NlbmUpIHtcbiAgICB9XG5cbiAgICBnZXRTaGFkZXJWYXJpYW50KGRldmljZSwgc2NlbmUsIG9iakRlZnMsIHN0YXRpY0xpZ2h0TGlzdCwgcGFzcywgc29ydGVkTGlnaHRzLCB2aWV3VW5pZm9ybUZvcm1hdCwgdmlld0JpbmRHcm91cEZvcm1hdCkge1xuXG4gICAgICAgIC8vIGdlbmVyYXRlIHNoYWRlciB2YXJpYW50IC0gaXRzIHRoZSBzYW1lIHNoYWRlciwgYnV0IHdpdGggZGlmZmVyZW50IHByb2Nlc3Npbmcgb3B0aW9uc1xuICAgICAgICBjb25zdCBwcm9jZXNzaW5nT3B0aW9ucyA9IG5ldyBTaGFkZXJQcm9jZXNzb3JPcHRpb25zKHZpZXdVbmlmb3JtRm9ybWF0LCB2aWV3QmluZEdyb3VwRm9ybWF0KTtcbiAgICAgICAgcmV0dXJuIHByb2Nlc3NTaGFkZXIodGhpcy5fc2hhZGVyLCBwcm9jZXNzaW5nT3B0aW9ucyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQXBwbGllcyBhbnkgY2hhbmdlcyBtYWRlIHRvIHRoZSBtYXRlcmlhbCdzIHByb3BlcnRpZXMuXG4gICAgICovXG4gICAgdXBkYXRlKCkge1xuICAgICAgICB0aGlzLmRpcnR5ID0gdHJ1ZTtcbiAgICAgICAgaWYgKHRoaXMuX3NoYWRlcikgdGhpcy5fc2hhZGVyLmZhaWxlZCA9IGZhbHNlO1xuICAgIH1cblxuICAgIC8vIFBhcmFtZXRlciBtYW5hZ2VtZW50XG4gICAgY2xlYXJQYXJhbWV0ZXJzKCkge1xuICAgICAgICB0aGlzLnBhcmFtZXRlcnMgPSB7fTtcbiAgICB9XG5cbiAgICBnZXRQYXJhbWV0ZXJzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5wYXJhbWV0ZXJzO1xuICAgIH1cblxuICAgIGNsZWFyVmFyaWFudHMoKSB7XG5cbiAgICAgICAgLy8gY2xlYXIgdmFyaWFudHMgb24gdGhlIG1hdGVyaWFsXG4gICAgICAgIHRoaXMudmFyaWFudHMgPSB7fTtcblxuICAgICAgICAvLyBidXQgYWxzbyBjbGVhciB0aGVtIGZyb20gYWxsIG1hdGVyaWFscyB0aGF0IHJlZmVyZW5jZSB0aGVtXG4gICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZXMgPSB0aGlzLm1lc2hJbnN0YW5jZXM7XG4gICAgICAgIGNvbnN0IGNvdW50ID0gbWVzaEluc3RhbmNlcy5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY291bnQ7IGkrKykge1xuICAgICAgICAgICAgbWVzaEluc3RhbmNlc1tpXS5jbGVhclNoYWRlcnMoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHJpZXZlcyB0aGUgc3BlY2lmaWVkIHNoYWRlciBwYXJhbWV0ZXIgZnJvbSBhIG1hdGVyaWFsLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgcGFyYW1ldGVyIHRvIHF1ZXJ5LlxuICAgICAqIEByZXR1cm5zIHtvYmplY3R9IFRoZSBuYW1lZCBwYXJhbWV0ZXIuXG4gICAgICovXG4gICAgZ2V0UGFyYW1ldGVyKG5hbWUpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucGFyYW1ldGVyc1tuYW1lXTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIGEgc2hhZGVyIHBhcmFtZXRlciBvbiBhIG1hdGVyaWFsLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgcGFyYW1ldGVyIHRvIHNldC5cbiAgICAgKiBAcGFyYW0ge251bWJlcnxudW1iZXJbXXxGbG9hdDMyQXJyYXl8aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJykuVGV4dHVyZX0gZGF0YSAtXG4gICAgICogVGhlIHZhbHVlIGZvciB0aGUgc3BlY2lmaWVkIHBhcmFtZXRlci5cbiAgICAgKi9cbiAgICBzZXRQYXJhbWV0ZXIobmFtZSwgZGF0YSkge1xuXG4gICAgICAgIGlmIChkYXRhID09PSB1bmRlZmluZWQgJiYgdHlwZW9mIG5hbWUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICBjb25zdCB1bmlmb3JtT2JqZWN0ID0gbmFtZTtcbiAgICAgICAgICAgIGlmICh1bmlmb3JtT2JqZWN0Lmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdW5pZm9ybU9iamVjdC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnNldFBhcmFtZXRlcih1bmlmb3JtT2JqZWN0W2ldKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbmFtZSA9IHVuaWZvcm1PYmplY3QubmFtZTtcbiAgICAgICAgICAgIGRhdGEgPSB1bmlmb3JtT2JqZWN0LnZhbHVlO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcGFyYW0gPSB0aGlzLnBhcmFtZXRlcnNbbmFtZV07XG4gICAgICAgIGlmIChwYXJhbSkge1xuICAgICAgICAgICAgcGFyYW0uZGF0YSA9IGRhdGE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnBhcmFtZXRlcnNbbmFtZV0gPSB7XG4gICAgICAgICAgICAgICAgc2NvcGVJZDogbnVsbCxcbiAgICAgICAgICAgICAgICBkYXRhOiBkYXRhXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRGVsZXRlcyBhIHNoYWRlciBwYXJhbWV0ZXIgb24gYSBtYXRlcmlhbC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIHBhcmFtZXRlciB0byBkZWxldGUuXG4gICAgICovXG4gICAgZGVsZXRlUGFyYW1ldGVyKG5hbWUpIHtcbiAgICAgICAgaWYgKHRoaXMucGFyYW1ldGVyc1tuYW1lXSkge1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMucGFyYW1ldGVyc1tuYW1lXTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHVzZWQgdG8gYXBwbHkgcGFyYW1ldGVycyBmcm9tIHRoaXMgbWF0ZXJpYWwgaW50byBzY29wZSBvZiB1bmlmb3JtcywgY2FsbGVkIGludGVybmFsbHkgYnkgZm9yd2FyZC1yZW5kZXJlclxuICAgIC8vIG9wdGlvbmFsIGxpc3Qgb2YgcGFyYW1ldGVyIG5hbWVzIHRvIGJlIHNldCBjYW4gYmUgc3BlY2lmaWVkLCBvdGhlcndpc2UgYWxsIHBhcmFtZXRlcnMgYXJlIHNldFxuICAgIHNldFBhcmFtZXRlcnMoZGV2aWNlLCBuYW1lcykge1xuICAgICAgICBjb25zdCBwYXJhbWV0ZXJzID0gdGhpcy5wYXJhbWV0ZXJzO1xuICAgICAgICBpZiAobmFtZXMgPT09IHVuZGVmaW5lZCkgbmFtZXMgPSBwYXJhbWV0ZXJzO1xuICAgICAgICBmb3IgKGNvbnN0IHBhcmFtTmFtZSBpbiBuYW1lcykge1xuICAgICAgICAgICAgY29uc3QgcGFyYW1ldGVyID0gcGFyYW1ldGVyc1twYXJhbU5hbWVdO1xuICAgICAgICAgICAgaWYgKHBhcmFtZXRlcikge1xuICAgICAgICAgICAgICAgIGlmICghcGFyYW1ldGVyLnNjb3BlSWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcGFyYW1ldGVyLnNjb3BlSWQgPSBkZXZpY2Uuc2NvcGUucmVzb2x2ZShwYXJhbU5hbWUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBwYXJhbWV0ZXIuc2NvcGVJZC5zZXRWYWx1ZShwYXJhbWV0ZXIuZGF0YSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIHRoaXMgbWF0ZXJpYWwgZnJvbSB0aGUgc2NlbmUgYW5kIHBvc3NpYmx5IGZyZWVzIHVwIG1lbW9yeSBmcm9tIGl0cyBzaGFkZXJzIChpZiB0aGVyZVxuICAgICAqIGFyZSBubyBvdGhlciBtYXRlcmlhbHMgdXNpbmcgaXQpLlxuICAgICAqL1xuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIHRoaXMudmFyaWFudHMgPSB7fTtcbiAgICAgICAgdGhpcy5fc2hhZGVyID0gbnVsbDtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMubWVzaEluc3RhbmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbWVzaEluc3RhbmNlID0gdGhpcy5tZXNoSW5zdGFuY2VzW2ldO1xuICAgICAgICAgICAgbWVzaEluc3RhbmNlLmNsZWFyU2hhZGVycygpO1xuICAgICAgICAgICAgbWVzaEluc3RhbmNlLl9tYXRlcmlhbCA9IG51bGw7XG5cbiAgICAgICAgICAgIGlmIChtZXNoSW5zdGFuY2UubWVzaCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGRlZmF1bHRNYXRlcmlhbCA9IGdldERlZmF1bHRNYXRlcmlhbChtZXNoSW5zdGFuY2UubWVzaC5kZXZpY2UpO1xuICAgICAgICAgICAgICAgIGlmICh0aGlzICE9PSBkZWZhdWx0TWF0ZXJpYWwpIHtcbiAgICAgICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlLm1hdGVyaWFsID0gZGVmYXVsdE1hdGVyaWFsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgRGVidWcud2FybigncGMuTWF0ZXJpYWw6IE1lc2hJbnN0YW5jZS5tZXNoIGlzIG51bGwsIGRlZmF1bHQgbWF0ZXJpYWwgY2Fubm90IGJlIGFzc2lnbmVkIHRvIHRoZSBNZXNoSW5zdGFuY2UnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlcy5sZW5ndGggPSAwO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlZ2lzdGVycyBtZXNoIGluc3RhbmNlIGFzIHJlZmVyZW5jaW5nIHRoZSBtYXRlcmlhbC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9tZXNoLWluc3RhbmNlLmpzJykuTWVzaEluc3RhbmNlfSBtZXNoSW5zdGFuY2UgLSBUaGUgbWVzaCBpbnN0YW5jZSB0b1xuICAgICAqIGRlLXJlZ2lzdGVyLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBhZGRNZXNoSW5zdGFuY2VSZWYobWVzaEluc3RhbmNlKSB7XG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlcy5wdXNoKG1lc2hJbnN0YW5jZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRGUtcmVnaXN0ZXJzIG1lc2ggaW5zdGFuY2UgYXMgcmVmZXJlbmNpbmcgdGhlIG1hdGVyaWFsLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL21lc2gtaW5zdGFuY2UuanMnKS5NZXNoSW5zdGFuY2V9IG1lc2hJbnN0YW5jZSAtIFRoZSBtZXNoIGluc3RhbmNlIHRvXG4gICAgICogZGUtcmVnaXN0ZXIuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHJlbW92ZU1lc2hJbnN0YW5jZVJlZihtZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgY29uc3QgbWVzaEluc3RhbmNlcyA9IHRoaXMubWVzaEluc3RhbmNlcztcbiAgICAgICAgY29uc3QgaSA9IG1lc2hJbnN0YW5jZXMuaW5kZXhPZihtZXNoSW5zdGFuY2UpO1xuICAgICAgICBpZiAoaSAhPT0gLTEpIHtcbiAgICAgICAgICAgIG1lc2hJbnN0YW5jZXMuc3BsaWNlKGksIDEpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgeyBNYXRlcmlhbCB9O1xuIl0sIm5hbWVzIjpbImlkIiwiTWF0ZXJpYWwiLCJfc2hhZGVyIiwibWVzaEluc3RhbmNlcyIsIm5hbWUiLCJ2YXJpYW50cyIsInBhcmFtZXRlcnMiLCJhbHBoYVRlc3QiLCJhbHBoYVRvQ292ZXJhZ2UiLCJibGVuZCIsImJsZW5kU3JjIiwiQkxFTkRNT0RFX09ORSIsImJsZW5kRHN0IiwiQkxFTkRNT0RFX1pFUk8iLCJibGVuZEVxdWF0aW9uIiwiQkxFTkRFUVVBVElPTl9BREQiLCJzZXBhcmF0ZUFscGhhQmxlbmQiLCJibGVuZFNyY0FscGhhIiwiYmxlbmREc3RBbHBoYSIsImJsZW5kQWxwaGFFcXVhdGlvbiIsImN1bGwiLCJDVUxMRkFDRV9CQUNLIiwiZGVwdGhUZXN0IiwiZGVwdGhGdW5jIiwiRlVOQ19MRVNTRVFVQUwiLCJkZXB0aFdyaXRlIiwic3RlbmNpbEZyb250Iiwic3RlbmNpbEJhY2siLCJkZXB0aEJpYXMiLCJzbG9wZURlcHRoQmlhcyIsInJlZFdyaXRlIiwiZ3JlZW5Xcml0ZSIsImJsdWVXcml0ZSIsImFscGhhV3JpdGUiLCJfc2hhZGVyVmVyc2lvbiIsIl9zY2VuZSIsIl9kaXJ0eUJsZW5kIiwiZGlydHkiLCJzaGFkZXIiLCJ0cmFuc3BhcmVudCIsImJsZW5kVHlwZSIsInR5cGUiLCJCTEVORF9OT05FIiwiQkxFTkRfTk9STUFMIiwiQkxFTkRNT0RFX1NSQ19BTFBIQSIsIkJMRU5ETU9ERV9PTkVfTUlOVVNfU1JDX0FMUEhBIiwiQkxFTkRfUFJFTVVMVElQTElFRCIsIkJMRU5EX0FERElUSVZFIiwiQkxFTkRfQURESVRJVkVBTFBIQSIsIkJMRU5EX01VTFRJUExJQ0FUSVZFMlgiLCJCTEVORE1PREVfRFNUX0NPTE9SIiwiQkxFTkRNT0RFX1NSQ19DT0xPUiIsIkJMRU5EX1NDUkVFTiIsIkJMRU5ETU9ERV9PTkVfTUlOVVNfRFNUX0NPTE9SIiwiQkxFTkRfTVVMVElQTElDQVRJVkUiLCJCTEVORF9NSU4iLCJCTEVOREVRVUFUSU9OX01JTiIsIkJMRU5EX01BWCIsIkJMRU5ERVFVQVRJT05fTUFYIiwibGF5ZXJzIiwiX3VwZGF0ZU1lc2hJbnN0YW5jZUtleXMiLCJjb3B5Iiwic291cmNlIiwiY2xvbmUiLCJjb25zdHJ1Y3RvciIsImkiLCJsZW5ndGgiLCJ1cGRhdGVLZXkiLCJ1cGRhdGVVbmlmb3JtcyIsImRldmljZSIsInNjZW5lIiwiZ2V0U2hhZGVyVmFyaWFudCIsIm9iakRlZnMiLCJzdGF0aWNMaWdodExpc3QiLCJwYXNzIiwic29ydGVkTGlnaHRzIiwidmlld1VuaWZvcm1Gb3JtYXQiLCJ2aWV3QmluZEdyb3VwRm9ybWF0IiwicHJvY2Vzc2luZ09wdGlvbnMiLCJTaGFkZXJQcm9jZXNzb3JPcHRpb25zIiwicHJvY2Vzc1NoYWRlciIsInVwZGF0ZSIsImZhaWxlZCIsImNsZWFyUGFyYW1ldGVycyIsImdldFBhcmFtZXRlcnMiLCJjbGVhclZhcmlhbnRzIiwiY291bnQiLCJjbGVhclNoYWRlcnMiLCJnZXRQYXJhbWV0ZXIiLCJzZXRQYXJhbWV0ZXIiLCJkYXRhIiwidW5kZWZpbmVkIiwidW5pZm9ybU9iamVjdCIsInZhbHVlIiwicGFyYW0iLCJzY29wZUlkIiwiZGVsZXRlUGFyYW1ldGVyIiwic2V0UGFyYW1ldGVycyIsIm5hbWVzIiwicGFyYW1OYW1lIiwicGFyYW1ldGVyIiwic2NvcGUiLCJyZXNvbHZlIiwic2V0VmFsdWUiLCJkZXN0cm95IiwibWVzaEluc3RhbmNlIiwiX21hdGVyaWFsIiwibWVzaCIsImRlZmF1bHRNYXRlcmlhbCIsImdldERlZmF1bHRNYXRlcmlhbCIsIm1hdGVyaWFsIiwiRGVidWciLCJ3YXJuIiwiYWRkTWVzaEluc3RhbmNlUmVmIiwicHVzaCIsInJl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
