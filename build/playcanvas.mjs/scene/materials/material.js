import '../../core/tracing.js';
import { BLENDMODE_ONE, BLENDMODE_ZERO, BLENDEQUATION_ADD, CULLFACE_BACK, FUNC_LESSEQUAL, BLENDEQUATION_MAX, BLENDEQUATION_MIN, BLENDMODE_DST_COLOR, BLENDMODE_ONE_MINUS_DST_COLOR, BLENDMODE_SRC_COLOR, BLENDMODE_SRC_ALPHA, BLENDMODE_ONE_MINUS_SRC_ALPHA } from '../../platform/graphics/constants.js';
import { ShaderProcessorOptions } from '../../platform/graphics/shader-processor-options.js';
import { BLEND_MAX, BLEND_MIN, BLEND_MULTIPLICATIVE, BLEND_SCREEN, BLEND_MULTIPLICATIVE2X, BLEND_ADDITIVEALPHA, BLEND_ADDITIVE, BLEND_PREMULTIPLIED, BLEND_NORMAL, BLEND_NONE } from '../constants.js';
import { getProgramLibrary } from '../shader-lib/get-program-library.js';
import { getDefaultMaterial } from './default-material.js';

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
  set shader(shader) {
    this._shader = shader;
  }
  get shader() {
    return this._shader;
  }

  get transparent() {
    return this.blend;
  }
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

  copy(source) {
    this.name = source.name;
    this._shader = source._shader;

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
    const key = `shader-id-${this._shader.id}`;
    const shaderDefinition = this._shader.definition;
    const materialGenerator = {
      generateKey: function (options) {
        return key;
      },
      createShaderDefinition: function (device, options) {
        return shaderDefinition;
      }
    };

    const libraryModuleName = 'shader';
    const library = getProgramLibrary(device);
    library.register(libraryModuleName, materialGenerator);

    const processingOptions = new ShaderProcessorOptions(viewUniformFormat, viewBindGroupFormat);
    const variant = library.getProgram(libraryModuleName, {}, processingOptions);

    library.unregister(libraryModuleName);
    return variant;
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
