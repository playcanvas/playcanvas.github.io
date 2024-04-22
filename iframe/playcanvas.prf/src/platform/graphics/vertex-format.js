import { hashCode } from '../../core/hash.js';
import { math } from '../../core/math/math.js';
import { StringIds } from '../../core/string-ids.js';
import { typedArrayTypesByteSize, SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD1, SEMANTIC_COLOR, SEMANTIC_TANGENT, SEMANTIC_ATTR12, TYPE_FLOAT32, SEMANTIC_ATTR13, SEMANTIC_ATTR14, SEMANTIC_ATTR15 } from './constants.js';
import { DeviceCache } from './device-cache.js';

const stringIds = new StringIds();
const webgpuValidElementSizes = [2, 4, 8, 12, 16];
const deviceCache = new DeviceCache();
class VertexFormat {
  constructor(graphicsDevice, description, vertexCount) {
    this.device = graphicsDevice;
    this._elements = [];
    this.hasUv0 = false;
    this.hasUv1 = false;
    this.hasColor = false;
    this.hasTangents = false;
    this.verticesByteSize = 0;
    this.vertexCount = vertexCount;
    this.interleaved = vertexCount === undefined;
    this.instancing = false;
    this.size = description.reduce((total, desc) => {
      return total + Math.ceil(desc.components * typedArrayTypesByteSize[desc.type] / 4) * 4;
    }, 0);
    let offset = 0,
      elementSize;
    for (let i = 0, len = description.length; i < len; i++) {
      var _elementDesc$asInt, _elementDesc$normaliz;
      const elementDesc = description[i];
      elementSize = elementDesc.components * typedArrayTypesByteSize[elementDesc.type];
      if (vertexCount) {
        offset = math.roundUp(offset, elementSize);
      }
      const asInt = (_elementDesc$asInt = elementDesc.asInt) != null ? _elementDesc$asInt : false;
      const normalize = asInt ? false : (_elementDesc$normaliz = elementDesc.normalize) != null ? _elementDesc$normaliz : false;
      const element = {
        name: elementDesc.semantic,
        offset: vertexCount ? offset : elementDesc.hasOwnProperty('offset') ? elementDesc.offset : offset,
        stride: vertexCount ? elementSize : elementDesc.hasOwnProperty('stride') ? elementDesc.stride : this.size,
        dataType: elementDesc.type,
        numComponents: elementDesc.components,
        normalize: normalize,
        size: elementSize,
        asInt: asInt
      };
      this._elements.push(element);
      if (vertexCount) {
        offset += elementSize * vertexCount;
      } else {
        offset += Math.ceil(elementSize / 4) * 4;
      }
      if (elementDesc.semantic === SEMANTIC_TEXCOORD0) {
        this.hasUv0 = true;
      } else if (elementDesc.semantic === SEMANTIC_TEXCOORD1) {
        this.hasUv1 = true;
      } else if (elementDesc.semantic === SEMANTIC_COLOR) {
        this.hasColor = true;
      } else if (elementDesc.semantic === SEMANTIC_TANGENT) {
        this.hasTangents = true;
      }
    }
    if (vertexCount) {
      this.verticesByteSize = offset;
    }
    this._evaluateHash();
  }
  get elements() {
    return this._elements;
  }
  static getDefaultInstancingFormat(graphicsDevice) {
    return deviceCache.get(graphicsDevice, () => {
      return new VertexFormat(graphicsDevice, [{
        semantic: SEMANTIC_ATTR12,
        components: 4,
        type: TYPE_FLOAT32
      }, {
        semantic: SEMANTIC_ATTR13,
        components: 4,
        type: TYPE_FLOAT32
      }, {
        semantic: SEMANTIC_ATTR14,
        components: 4,
        type: TYPE_FLOAT32
      }, {
        semantic: SEMANTIC_ATTR15,
        components: 4,
        type: TYPE_FLOAT32
      }]);
    });
  }
  static isElementValid(graphicsDevice, elementDesc) {
    const elementSize = elementDesc.components * typedArrayTypesByteSize[elementDesc.type];
    if (graphicsDevice.isWebGPU && !webgpuValidElementSizes.includes(elementSize)) return false;
    return true;
  }
  update() {
    this._evaluateHash();
  }
  _evaluateHash() {
    const stringElementsBatch = [];
    const stringElementsRender = [];
    const len = this._elements.length;
    for (let i = 0; i < len; i++) {
      const {
        name,
        dataType,
        numComponents,
        normalize,
        offset,
        stride,
        size,
        asInt
      } = this._elements[i];
      const stringElementBatch = name + dataType + numComponents + normalize + asInt;
      stringElementsBatch.push(stringElementBatch);
      const stringElementRender = stringElementBatch + offset + stride + size;
      stringElementsRender.push(stringElementRender);
    }
    stringElementsBatch.sort();
    const batchingString = stringElementsBatch.join();
    this.batchingHash = hashCode(batchingString);
    this.shaderProcessingHashString = batchingString;
    this.renderingHashString = stringElementsRender.join('_');
    this.renderingHash = stringIds.get(this.renderingHashString);
  }
}

export { VertexFormat };
