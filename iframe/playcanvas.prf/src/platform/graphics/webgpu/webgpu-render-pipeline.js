import { hash32Fnv1a } from '../../../core/hash.js';
import { array } from '../../../core/array-utils.js';
import { WebgpuVertexBufferLayout } from './webgpu-vertex-buffer-layout.js';
import { WebgpuPipeline } from './webgpu-pipeline.js';

const _primitiveTopology = ['point-list', 'line-list', undefined, 'line-strip', 'triangle-list', 'triangle-strip', undefined];
const _blendOperation = ['add', 'subtract', 'reverse-subtract', 'min', 'max'];
const _blendFactor = ['zero', 'one', 'src', 'one-minus-src', 'dst', 'one-minus-dst', 'src-alpha', 'src-alpha-saturated', 'one-minus-src-alpha', 'dst-alpha', 'one-minus-dst-alpha', 'constant', 'one-minus-constant'];
const _compareFunction = ['never', 'less', 'equal', 'less-equal', 'greater', 'not-equal', 'greater-equal', 'always'];
const _cullModes = ['none', 'back', 'front'];
const _stencilOps = ['keep', 'zero', 'replace', 'increment-clamp', 'increment-wrap', 'decrement-clamp', 'decrement-wrap', 'invert'];
class CacheEntry {
  constructor() {
    this.pipeline = void 0;
    this.hashes = void 0;
  }
}
class WebgpuRenderPipeline extends WebgpuPipeline {
  constructor(device) {
    super(device);
    this.lookupHashes = new Uint32Array(13);
    this.vertexBufferLayout = new WebgpuVertexBufferLayout();
    this.cache = new Map();
  }
  get(primitive, vertexFormat0, vertexFormat1, shader, renderTarget, bindGroupFormats, blendState, depthState, cullMode, stencilEnabled, stencilFront, stencilBack) {
    var _vertexFormat0$render, _vertexFormat1$render, _bindGroupFormats$0$k, _bindGroupFormats$, _bindGroupFormats$1$k, _bindGroupFormats$2, _bindGroupFormats$2$k, _bindGroupFormats$3;
    const lookupHashes = this.lookupHashes;
    lookupHashes[0] = primitive.type;
    lookupHashes[1] = shader.id;
    lookupHashes[2] = cullMode;
    lookupHashes[3] = depthState.key;
    lookupHashes[4] = blendState.key;
    lookupHashes[5] = (_vertexFormat0$render = vertexFormat0 == null ? void 0 : vertexFormat0.renderingHash) != null ? _vertexFormat0$render : 0;
    lookupHashes[6] = (_vertexFormat1$render = vertexFormat1 == null ? void 0 : vertexFormat1.renderingHash) != null ? _vertexFormat1$render : 0;
    lookupHashes[7] = renderTarget.impl.key;
    lookupHashes[8] = (_bindGroupFormats$0$k = (_bindGroupFormats$ = bindGroupFormats[0]) == null ? void 0 : _bindGroupFormats$.key) != null ? _bindGroupFormats$0$k : 0;
    lookupHashes[9] = (_bindGroupFormats$1$k = (_bindGroupFormats$2 = bindGroupFormats[1]) == null ? void 0 : _bindGroupFormats$2.key) != null ? _bindGroupFormats$1$k : 0;
    lookupHashes[10] = (_bindGroupFormats$2$k = (_bindGroupFormats$3 = bindGroupFormats[2]) == null ? void 0 : _bindGroupFormats$3.key) != null ? _bindGroupFormats$2$k : 0;
    lookupHashes[11] = stencilEnabled ? stencilFront.key : 0;
    lookupHashes[12] = stencilEnabled ? stencilBack.key : 0;
    const hash = hash32Fnv1a(lookupHashes);
    let cacheEntries = this.cache.get(hash);
    if (cacheEntries) {
      for (let i = 0; i < cacheEntries.length; i++) {
        const entry = cacheEntries[i];
        if (array.equals(entry.hashes, lookupHashes)) {
          return entry.pipeline;
        }
      }
    }
    const primitiveTopology = _primitiveTopology[primitive.type];
    const pipelineLayout = this.getPipelineLayout(bindGroupFormats);
    const vertexBufferLayout = this.vertexBufferLayout.get(vertexFormat0, vertexFormat1);
    const cacheEntry = new CacheEntry();
    cacheEntry.hashes = new Uint32Array(lookupHashes);
    cacheEntry.pipeline = this.create(primitiveTopology, shader, renderTarget, pipelineLayout, blendState, depthState, vertexBufferLayout, cullMode, stencilEnabled, stencilFront, stencilBack);
    if (cacheEntries) {
      cacheEntries.push(cacheEntry);
    } else {
      cacheEntries = [cacheEntry];
    }
    this.cache.set(hash, cacheEntries);
    return cacheEntry.pipeline;
  }
  getBlend(blendState) {
    let blend;
    if (blendState.blend) {
      blend = {
        color: {
          operation: _blendOperation[blendState.colorOp],
          srcFactor: _blendFactor[blendState.colorSrcFactor],
          dstFactor: _blendFactor[blendState.colorDstFactor]
        },
        alpha: {
          operation: _blendOperation[blendState.alphaOp],
          srcFactor: _blendFactor[blendState.alphaSrcFactor],
          dstFactor: _blendFactor[blendState.alphaDstFactor]
        }
      };
    }
    return blend;
  }
  getDepthStencil(depthState, renderTarget, stencilEnabled, stencilFront, stencilBack) {
    let depthStencil;
    const {
      depth,
      stencil
    } = renderTarget;
    if (depth || stencil) {
      depthStencil = {
        format: renderTarget.impl.depthFormat
      };
      if (depth) {
        depthStencil.depthWriteEnabled = depthState.write;
        depthStencil.depthCompare = _compareFunction[depthState.func];
        depthStencil.depthBias = depthState.depthBias;
        depthStencil.depthBiasSlopeScale = depthState.depthBiasSlope;
      } else {
        depthStencil.depthWriteEnabled = false;
        depthStencil.depthCompare = 'always';
      }
      if (stencil && stencilEnabled) {
        depthStencil.stencilReadMas = stencilFront.readMask;
        depthStencil.stencilWriteMask = stencilFront.writeMask;
        depthStencil.stencilFront = {
          compare: _compareFunction[stencilFront.func],
          failOp: _stencilOps[stencilFront.fail],
          passOp: _stencilOps[stencilFront.zpass],
          depthFailOp: _stencilOps[stencilFront.zfail]
        };
        depthStencil.stencilBack = {
          compare: _compareFunction[stencilBack.func],
          failOp: _stencilOps[stencilBack.fail],
          passOp: _stencilOps[stencilBack.zpass],
          depthFailOp: _stencilOps[stencilBack.zfail]
        };
      }
    }
    return depthStencil;
  }
  create(primitiveTopology, shader, renderTarget, pipelineLayout, blendState, depthState, vertexBufferLayout, cullMode, stencilEnabled, stencilFront, stencilBack) {
    const wgpu = this.device.wgpu;
    const webgpuShader = shader.impl;
    const descr = {
      vertex: {
        module: webgpuShader.getVertexShaderModule(),
        entryPoint: webgpuShader.vertexEntryPoint,
        buffers: vertexBufferLayout
      },
      primitive: {
        topology: primitiveTopology,
        frontFace: 'ccw',
        cullMode: _cullModes[cullMode]
      },
      depthStencil: this.getDepthStencil(depthState, renderTarget, stencilEnabled, stencilFront, stencilBack),
      multisample: {
        count: renderTarget.samples
      },
      layout: pipelineLayout
    };
    descr.fragment = {
      module: webgpuShader.getFragmentShaderModule(),
      entryPoint: webgpuShader.fragmentEntryPoint,
      targets: []
    };
    const colorAttachments = renderTarget.impl.colorAttachments;
    if (colorAttachments.length > 0) {
      let writeMask = 0;
      if (blendState.redWrite) writeMask |= GPUColorWrite.RED;
      if (blendState.greenWrite) writeMask |= GPUColorWrite.GREEN;
      if (blendState.blueWrite) writeMask |= GPUColorWrite.BLUE;
      if (blendState.alphaWrite) writeMask |= GPUColorWrite.ALPHA;
      const blend = this.getBlend(blendState);
      colorAttachments.forEach(attachment => {
        descr.fragment.targets.push({
          format: attachment.format,
          writeMask: writeMask,
          blend: blend
        });
      });
    }
    const pipeline = wgpu.createRenderPipeline(descr);
    return pipeline;
  }
}

export { WebgpuRenderPipeline };
