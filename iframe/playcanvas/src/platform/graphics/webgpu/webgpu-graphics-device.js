import { path } from '../../../core/path.js';
import { DEVICETYPE_WEBGPU, PIXELFORMAT_RGBA32F, PIXELFORMAT_RGBA8, PIXELFORMAT_BGRA8, BUFFERUSAGE_READ, BUFFERUSAGE_COPY_DST } from '../constants.js';
import { GraphicsDevice } from '../graphics-device.js';
import { RenderTarget } from '../render-target.js';
import { StencilParameters } from '../stencil-parameters.js';
import { WebgpuBindGroup } from './webgpu-bind-group.js';
import { WebgpuBindGroupFormat } from './webgpu-bind-group-format.js';
import { WebgpuIndexBuffer } from './webgpu-index-buffer.js';
import { WebgpuRenderPipeline } from './webgpu-render-pipeline.js';
import { WebgpuComputePipeline } from './webgpu-compute-pipeline.js';
import { WebgpuRenderTarget } from './webgpu-render-target.js';
import { WebgpuShader } from './webgpu-shader.js';
import { WebgpuTexture } from './webgpu-texture.js';
import { WebgpuUniformBuffer } from './webgpu-uniform-buffer.js';
import { WebgpuVertexBuffer } from './webgpu-vertex-buffer.js';
import { WebgpuClearRenderer } from './webgpu-clear-renderer.js';
import { WebgpuMipmapRenderer } from './webgpu-mipmap-renderer.js';
import { WebgpuDynamicBuffers } from './webgpu-dynamic-buffers.js';
import { WebgpuGpuProfiler } from './webgpu-gpu-profiler.js';
import { WebgpuResolver } from './webgpu-resolver.js';
import { WebgpuCompute } from './webgpu-compute.js';
import { WebgpuBuffer } from './webgpu-buffer.js';

class WebgpuGraphicsDevice extends GraphicsDevice {
  constructor(canvas, options = {}) {
    var _options$alpha, _options$antialias;
    super(canvas, options);
    this.renderPipeline = new WebgpuRenderPipeline(this);
    this.computePipeline = new WebgpuComputePipeline(this);
    this.clearRenderer = void 0;
    this.mipmapRenderer = void 0;
    this.pipeline = void 0;
    this.bindGroupFormats = [];
    this.commandEncoder = null;
    this.commandBuffers = [];
    this.limits = void 0;
    options = this.initOptions;
    options.alpha = (_options$alpha = options.alpha) != null ? _options$alpha : true;
    this.backBufferAntialias = (_options$antialias = options.antialias) != null ? _options$antialias : false;
    this.isWebGPU = true;
    this._deviceType = DEVICETYPE_WEBGPU;
  }
  destroy() {
    this.clearRenderer.destroy();
    this.clearRenderer = null;
    this.mipmapRenderer.destroy();
    this.mipmapRenderer = null;
    this.resolver.destroy();
    this.resolver = null;
    super.destroy();
  }
  initDeviceCaps() {
    var _this$wgpu;
    this.disableParticleSystem = true;
    const limits = (_this$wgpu = this.wgpu) == null ? void 0 : _this$wgpu.limits;
    this.limits = limits;
    this.precision = 'highp';
    this.maxPrecision = 'highp';
    this.maxSamples = 4;
    this.maxTextures = 16;
    this.maxTextureSize = limits.maxTextureDimension2D;
    this.maxCubeMapSize = limits.maxTextureDimension2D;
    this.maxVolumeSize = limits.maxTextureDimension3D;
    this.maxColorAttachments = limits.maxColorAttachments;
    this.maxPixelRatio = 1;
    this.maxAnisotropy = 16;
    this.fragmentUniformsCount = limits.maxUniformBufferBindingSize / 16;
    this.vertexUniformsCount = limits.maxUniformBufferBindingSize / 16;
    this.supportsInstancing = true;
    this.supportsUniformBuffers = true;
    this.supportsVolumeTextures = true;
    this.supportsBoneTextures = true;
    this.supportsMorphTargetTexturesCore = true;
    this.supportsAreaLights = true;
    this.supportsDepthShadow = true;
    this.supportsGpuParticles = false;
    this.supportsMrt = true;
    this.supportsCompute = true;
    this.extUintElement = true;
    this.extTextureFloat = true;
    this.textureFloatRenderable = true;
    this.textureHalfFloatFilterable = true;
    this.extTextureHalfFloat = true;
    this.textureHalfFloatRenderable = true;
    this.textureHalfFloatUpdatable = true;
    this.boneLimit = 1024;
    this.supportsImageBitmap = true;
    this.extStandardDerivatives = true;
    this.extBlendMinmax = true;
    this.areaLightLutFormat = this.textureFloatFilterable ? PIXELFORMAT_RGBA32F : PIXELFORMAT_RGBA8;
    this.supportsTextureFetch = true;
    this.samples = this.backBufferAntialias ? 4 : 1;
    const wgslFeatures = navigator.gpu.wgslLanguageFeatures;
    this.supportsStorageTextureRead = wgslFeatures.has('readonly_and_readwrite_storage_textures');
  }
  async initWebGpu(glslangUrl, twgslUrl) {
    var _this$gpuAdapter, _this$wgpu$lost;
    if (!window.navigator.gpu) {
      throw new Error('Unable to retrieve GPU. Ensure you are using a browser that supports WebGPU rendering.');
    }
    const buildUrl = srcPath => {
      if (!path.isRelativePath(srcPath)) {
        return srcPath;
      }
      const url = new URL(window.location.href);
      url.pathname = srcPath;
      url.search = '';
      return url.toString();
    };
    const results = await Promise.all([import(/* @vite-ignore */`${buildUrl(twgslUrl)}`).then(module => twgsl(twgslUrl.replace('.js', '.wasm'))), import(/* @vite-ignore */`${buildUrl(glslangUrl)}`).then(module => module.default())]);
    this.twgsl = results[0];
    this.glslang = results[1];
    const adapterOptions = {
      powerPreference: this.initOptions.powerPreference !== 'default' ? this.initOptions.powerPreference : undefined
    };
    this.gpuAdapter = await window.navigator.gpu.requestAdapter(adapterOptions);
    const requiredFeatures = [];
    const requireFeature = feature => {
      const supported = this.gpuAdapter.features.has(feature);
      if (supported) {
        requiredFeatures.push(feature);
      }
      return supported;
    };
    this.textureFloatFilterable = requireFeature('float32-filterable');
    this.extCompressedTextureS3TC = requireFeature('texture-compression-bc');
    this.extCompressedTextureETC = requireFeature('texture-compression-etc2');
    this.extCompressedTextureASTC = requireFeature('texture-compression-astc');
    this.supportsTimestampQuery = requireFeature('timestamp-query');
    this.textureRG11B10Renderable = requireFeature('rg11b10ufloat-renderable');
    const adapterLimits = (_this$gpuAdapter = this.gpuAdapter) == null ? void 0 : _this$gpuAdapter.limits;
    const requiredLimits = {};
    if (adapterLimits) {
      for (const limitName in adapterLimits) {
        if (limitName === "minSubgroupSize" || limitName === "maxSubgroupSize") {
          continue;
        }
        requiredLimits[limitName] = adapterLimits[limitName];
      }
    }
    const deviceDescr = {
      requiredFeatures,
      requiredLimits,
      defaultQueue: {
        label: 'Default Queue'
      }
    };
    this.wgpu = await this.gpuAdapter.requestDevice(deviceDescr);
    (_this$wgpu$lost = this.wgpu.lost) == null || _this$wgpu$lost.then(info => {
      if (info.reason !== 'destroyed') ;
    });
    this.initDeviceCaps();
    this.gpuContext = this.canvas.getContext('webgpu');
    const preferredCanvasFormat = navigator.gpu.getPreferredCanvasFormat();
    this.backBufferFormat = preferredCanvasFormat === 'rgba8unorm' ? PIXELFORMAT_RGBA8 : PIXELFORMAT_BGRA8;
    this.canvasConfig = {
      device: this.wgpu,
      colorSpace: 'srgb',
      alphaMode: this.initOptions.alpha ? 'premultiplied' : 'opaque',
      format: preferredCanvasFormat,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
      viewFormats: []
    };
    this.gpuContext.configure(this.canvasConfig);
    this.createBackbuffer();
    this.clearRenderer = new WebgpuClearRenderer(this);
    this.mipmapRenderer = new WebgpuMipmapRenderer(this);
    this.resolver = new WebgpuResolver(this);
    this.postInit();
    return this;
  }
  postInit() {
    super.postInit();
    this.initializeRenderState();
    this.setupPassEncoderDefaults();
    this.gpuProfiler = new WebgpuGpuProfiler(this);
    this.dynamicBuffers = new WebgpuDynamicBuffers(this, 1024 * 1024, this.limits.minUniformBufferOffsetAlignment);
  }
  createBackbuffer() {
    this.supportsStencil = this.initOptions.stencil;
    this.backBuffer = new RenderTarget({
      name: 'WebgpuFramebuffer',
      graphicsDevice: this,
      depth: this.initOptions.depth,
      stencil: this.supportsStencil,
      samples: this.samples
    });
  }
  frameStart() {
    super.frameStart();
    this.gpuProfiler.frameStart();
    this.submit();
    const outColorBuffer = this.gpuContext.getCurrentTexture();
    if (this.backBufferSize.x !== outColorBuffer.width || this.backBufferSize.y !== outColorBuffer.height) {
      this.backBufferSize.set(outColorBuffer.width, outColorBuffer.height);
      this.backBuffer.destroy();
      this.backBuffer = null;
      this.createBackbuffer();
    }
    const rt = this.backBuffer;
    const wrt = rt.impl;
    wrt.setColorAttachment(0, undefined, outColorBuffer.format);
    this.initRenderTarget(rt);
    wrt.assignColorTexture(outColorBuffer);
  }
  frameEnd() {
    super.frameEnd();
    this.gpuProfiler.frameEnd();
    this.submit();
    if (!this.contextLost) {
      this.gpuProfiler.request();
    }
  }
  createBufferImpl(usageFlags) {
    return new WebgpuBuffer(usageFlags);
  }
  createUniformBufferImpl(uniformBuffer) {
    return new WebgpuUniformBuffer(uniformBuffer);
  }
  createVertexBufferImpl(vertexBuffer, format, options) {
    return new WebgpuVertexBuffer(vertexBuffer, format, options);
  }
  createIndexBufferImpl(indexBuffer, options) {
    return new WebgpuIndexBuffer(indexBuffer, options);
  }
  createShaderImpl(shader) {
    return new WebgpuShader(shader);
  }
  createTextureImpl(texture) {
    return new WebgpuTexture(texture);
  }
  createRenderTargetImpl(renderTarget) {
    return new WebgpuRenderTarget(renderTarget);
  }
  createBindGroupFormatImpl(bindGroupFormat) {
    return new WebgpuBindGroupFormat(bindGroupFormat);
  }
  createBindGroupImpl(bindGroup) {
    return new WebgpuBindGroup();
  }
  createComputeImpl(compute) {
    return new WebgpuCompute(compute);
  }
  setBindGroup(index, bindGroup) {
    if (this.passEncoder) {
      this.passEncoder.setBindGroup(index, bindGroup.impl.bindGroup, bindGroup.uniformBufferOffsets);
      this.bindGroupFormats[index] = bindGroup.format.impl;
    }
  }
  submitVertexBuffer(vertexBuffer, slot) {
    const elements = vertexBuffer.format.elements;
    const elementCount = elements.length;
    const vbBuffer = vertexBuffer.impl.buffer;
    for (let i = 0; i < elementCount; i++) {
      this.passEncoder.setVertexBuffer(slot + i, vbBuffer, elements[i].offset);
    }
    return elementCount;
  }
  draw(primitive, numInstances = 1, keepBuffers) {
    if (this.shader.ready && !this.shader.failed) {
      const passEncoder = this.passEncoder;
      const vb0 = this.vertexBuffers[0];
      const vb1 = this.vertexBuffers[1];
      this.vertexBuffers.length = 0;
      if (vb0) {
        const vbSlot = this.submitVertexBuffer(vb0, 0);
        if (vb1) {
          this.submitVertexBuffer(vb1, vbSlot);
        }
      }
      const pipeline = this.renderPipeline.get(primitive, vb0 == null ? void 0 : vb0.format, vb1 == null ? void 0 : vb1.format, this.shader, this.renderTarget, this.bindGroupFormats, this.blendState, this.depthState, this.cullMode, this.stencilEnabled, this.stencilFront, this.stencilBack);
      if (this.pipeline !== pipeline) {
        this.pipeline = pipeline;
        passEncoder.setPipeline(pipeline);
      }
      const ib = this.indexBuffer;
      if (ib) {
        this.indexBuffer = null;
        passEncoder.setIndexBuffer(ib.impl.buffer, ib.impl.format);
        passEncoder.drawIndexed(primitive.count, numInstances, primitive.base, 0, 0);
      } else {
        passEncoder.draw(primitive.count, numInstances, primitive.base, 0);
      }
    }
  }
  setShader(shader, asyncCompile = false) {
    if (shader !== this.shader) {
      this.shader = shader;
    }
  }
  setBlendState(blendState) {
    this.blendState.copy(blendState);
  }
  setDepthState(depthState) {
    this.depthState.copy(depthState);
  }
  setStencilState(stencilFront, stencilBack) {
    if (stencilFront || stencilBack) {
      this.stencilEnabled = true;
      this.stencilFront.copy(stencilFront != null ? stencilFront : StencilParameters.DEFAULT);
      this.stencilBack.copy(stencilBack != null ? stencilBack : StencilParameters.DEFAULT);
      const ref = this.stencilFront.ref;
      if (this.stencilRef !== ref) {
        this.stencilRef = ref;
        this.passEncoder.setStencilReference(ref);
      }
    } else {
      this.stencilEnabled = false;
    }
  }
  setBlendColor(r, g, b, a) {
    const c = this.blendColor;
    if (r !== c.r || g !== c.g || b !== c.b || a !== c.a) {
      c.set(r, g, b, a);
      this.passEncoder.setBlendConstant(c);
    }
  }
  setCullMode(cullMode) {
    this.cullMode = cullMode;
  }
  setAlphaToCoverage(state) {}
  initializeContextCaches() {
    super.initializeContextCaches();
  }
  setupPassEncoderDefaults() {
    this.pipeline = null;
    this.stencilRef = 0;
    this.blendColor.set(0, 0, 0, 0);
  }
  _uploadDirtyTextures() {
    this.textures.forEach(texture => {
      if (texture._needsUpload || texture._needsMipmaps) {
        texture.upload();
      }
    });
  }
  startRenderPass(renderPass) {
    this._uploadDirtyTextures();
    const rt = renderPass.renderTarget || this.backBuffer;
    this.renderTarget = rt;
    const wrt = rt.impl;
    this.commandEncoder = this.wgpu.createCommandEncoder();
    if (rt !== this.backBuffer) {
      this.initRenderTarget(rt);
    }
    wrt.setupForRenderPass(renderPass);
    const renderPassDesc = wrt.renderPassDescriptor;
    if (this.gpuProfiler._enabled) {
      if (this.gpuProfiler.timestampQueriesSet) {
        const slot = this.gpuProfiler.getSlot(renderPass.name);
        renderPassDesc.timestampWrites = {
          querySet: this.gpuProfiler.timestampQueriesSet.querySet,
          beginningOfPassWriteIndex: slot * 2,
          endOfPassWriteIndex: slot * 2 + 1
        };
      }
    }
    this.passEncoder = this.commandEncoder.beginRenderPass(renderPassDesc);
    this.setupPassEncoderDefaults();
    const {
      width,
      height
    } = rt;
    this.setViewport(0, 0, width, height);
    this.setScissor(0, 0, width, height);
    this.insideRenderPass = true;
  }
  endRenderPass(renderPass) {
    this.passEncoder.end();
    this.passEncoder = null;
    this.insideRenderPass = false;
    this.bindGroupFormats.length = 0;
    for (let i = 0; i < renderPass.colorArrayOps.length; i++) {
      const colorOps = renderPass.colorArrayOps[i];
      if (colorOps.mipmaps) {
        this.mipmapRenderer.generate(renderPass.renderTarget._colorBuffers[i].impl);
      }
    }
    const cb = this.commandEncoder.finish();
    this.addCommandBuffer(cb);
    this.commandEncoder = null;
  }
  startComputePass() {
    this.commandEncoder = this.wgpu.createCommandEncoder();
    this.pipeline = null;
    this.passEncoder = this.commandEncoder.beginComputePass();
    this.insideRenderPass = true;
  }
  endComputePass() {
    this.passEncoder.end();
    this.passEncoder = null;
    this.insideRenderPass = false;
    this.bindGroupFormats.length = 0;
    const cb = this.commandEncoder.finish();
    this.addCommandBuffer(cb);
    this.commandEncoder = null;
  }
  computeDispatch(computes) {
    this.startComputePass();
    for (let i = 0; i < computes.length; i++) {
      const compute = computes[i];
      compute.applyParameters();
      compute.impl.updateBindGroup();
    }
    for (let i = 0; i < computes.length; i++) {
      const compute = computes[i];
      compute.impl.dispatch(compute.countX, compute.countY, compute.countZ);
    }
    this.endComputePass();
  }
  addCommandBuffer(commandBuffer, front = false) {
    if (front) {
      this.commandBuffers.unshift(commandBuffer);
    } else {
      this.commandBuffers.push(commandBuffer);
    }
  }
  submit() {
    if (this.commandBuffers.length > 0) {
      this.dynamicBuffers.submit();
      this.wgpu.queue.submit(this.commandBuffers);
      this.commandBuffers.length = 0;
      this.dynamicBuffers.onCommandBuffersSubmitted();
    }
  }
  clear(options) {
    if (options.flags) {
      this.clearRenderer.clear(this, this.renderTarget, options, this.defaultClearOptions);
    }
  }
  setViewport(x, y, w, h) {
    if (this.passEncoder) {
      if (!this.renderTarget.flipY) {
        y = this.renderTarget.height - y - h;
      }
      this.vx = x;
      this.vy = y;
      this.vw = w;
      this.vh = h;
      this.passEncoder.setViewport(x, y, w, h, 0, 1);
    }
  }
  setScissor(x, y, w, h) {
    if (this.passEncoder) {
      if (!this.renderTarget.flipY) {
        y = this.renderTarget.height - y - h;
      }
      this.sx = x;
      this.sy = y;
      this.sw = w;
      this.sh = h;
      this.passEncoder.setScissorRect(x, y, w, h);
    }
  }
  clearStorageBuffer(storageBuffer, offset = 0, size = storageBuffer.byteSize) {
    var _this$commandEncoder;
    const commandEncoder = (_this$commandEncoder = this.commandEncoder) != null ? _this$commandEncoder : this.wgpu.createCommandEncoder();
    commandEncoder.clearBuffer(storageBuffer.buffer, offset, size);
    if (!this.commandEncoder) {
      const cb = commandEncoder.finish();
      this.addCommandBuffer(cb);
    }
  }
  readStorageBuffer(storageBuffer, offset = 0, size = storageBuffer.byteSize - offset, data = null, immediate = false) {
    var _this$commandEncoder2;
    const stagingBuffer = this.createBufferImpl(BUFFERUSAGE_READ | BUFFERUSAGE_COPY_DST);
    stagingBuffer.allocate(this, size);
    const destBuffer = stagingBuffer.buffer;
    const commandEncoder = (_this$commandEncoder2 = this.commandEncoder) != null ? _this$commandEncoder2 : this.wgpu.createCommandEncoder();
    commandEncoder.copyBufferToBuffer(storageBuffer.buffer, offset, destBuffer, 0, size);
    if (!this.commandEncoder) {
      const cb = commandEncoder.finish();
      this.addCommandBuffer(cb);
    }
    return new Promise((resolve, reject) => {
      const read = () => {
        destBuffer == null || destBuffer.mapAsync(GPUMapMode.READ).then(() => {
          var _data;
          (_data = data) != null ? _data : data = new Uint8Array(size);
          const copySrc = destBuffer.getMappedRange(0, size);
          const srcType = data.constructor;
          data.set(new srcType(copySrc));
          destBuffer.unmap();
          stagingBuffer.destroy(this);
          resolve(data);
        });
      };
      if (immediate) {
        this.submit();
        read();
      } else {
        setTimeout(() => {
          read();
        });
      }
    });
  }
  writeStorageBuffer(storageBuffer, bufferOffset = 0, data, dataOffset = 0, size) {
    this.wgpu.queue.writeBuffer(storageBuffer.buffer, bufferOffset, data, dataOffset, size);
  }
  copyRenderTarget(source, dest, color, depth) {
    var _this$commandEncoder3;
    const copySize = {
      width: source ? source.width : dest.width,
      height: source ? source.height : dest.height,
      depthOrArrayLayers: 1
    };
    const commandEncoder = (_this$commandEncoder3 = this.commandEncoder) != null ? _this$commandEncoder3 : this.wgpu.createCommandEncoder();
    if (color) {
      const copySrc = {
        texture: source ? source.colorBuffer.impl.gpuTexture : this.renderTarget.impl.assignedColorTexture,
        mipLevel: 0
      };
      const copyDst = {
        texture: dest ? dest.colorBuffer.impl.gpuTexture : this.renderTarget.impl.assignedColorTexture,
        mipLevel: 0
      };
      commandEncoder.copyTextureToTexture(copySrc, copyDst, copySize);
    }
    if (depth) {
      const sourceRT = source ? source : this.renderTarget;
      const sourceTexture = sourceRT.impl.depthTexture;
      if (source.samples > 1) {
        const destTexture = dest.colorBuffer.impl.gpuTexture;
        this.resolver.resolveDepth(commandEncoder, sourceTexture, destTexture);
      } else {
        const destTexture = dest ? dest.depthBuffer.impl.gpuTexture : this.renderTarget.impl.depthTexture;
        const copySrc = {
          texture: sourceTexture,
          mipLevel: 0
        };
        const copyDst = {
          texture: destTexture,
          mipLevel: 0
        };
        commandEncoder.copyTextureToTexture(copySrc, copyDst, copySize);
      }
    }
    if (!this.commandEncoder) {
      const cb = commandEncoder.finish();
      this.addCommandBuffer(cb);
    }
    return true;
  }
}

export { WebgpuGraphicsDevice };
