import { TRACEID_RENDER_QUEUE } from '../../../core/constants.js';
import { Debug, DebugHelper } from '../../../core/debug.js';
import { Vec2 } from '../../../core/math/vec2.js';
import { DEVICETYPE_WEBGPU, PIXELFORMAT_RGBA32F, PIXELFORMAT_RGBA8, PIXELFORMAT_BGRA8 } from '../constants.js';
import { GraphicsDevice } from '../graphics-device.js';
import { DebugGraphics } from '../debug-graphics.js';
import { RenderTarget } from '../render-target.js';
import { StencilParameters } from '../stencil-parameters.js';
import { WebgpuBindGroup } from './webgpu-bind-group.js';
import { WebgpuBindGroupFormat } from './webgpu-bind-group-format.js';
import { WebgpuIndexBuffer } from './webgpu-index-buffer.js';
import { WebgpuRenderPipeline } from './webgpu-render-pipeline.js';
import { WebgpuRenderTarget } from './webgpu-render-target.js';
import { WebgpuShader } from './webgpu-shader.js';
import { WebgpuTexture } from './webgpu-texture.js';
import { WebgpuUniformBuffer } from './webgpu-uniform-buffer.js';
import { WebgpuVertexBuffer } from './webgpu-vertex-buffer.js';
import { WebgpuClearRenderer } from './webgpu-clear-renderer.js';
import { WebgpuMipmapRenderer } from './webgpu-mipmap-renderer.js';
import { WebgpuDebug } from './webgpu-debug.js';
import { WebgpuDynamicBuffers } from './webgpu-dynamic-buffers.js';
import { WebgpuQuerySet } from './webgpu-query-set.js';

class WebgpuGraphicsDevice extends GraphicsDevice {
  constructor(canvas, options = {}) {
    super(canvas, options);
    /**
     * The render target representing the main framebuffer.
     *
     * @type {RenderTarget}
     */
    this.frameBuffer = void 0;
    /**
     * Object responsible for caching and creation of render pipelines.
     */
    this.renderPipeline = new WebgpuRenderPipeline(this);
    /**
     * Object responsible for clearing the rendering surface by rendering a quad.
     *
     * @type { WebgpuClearRenderer }
     */
    this.clearRenderer = void 0;
    /**
     * Object responsible for mipmap generation.
     *
     * @type { WebgpuMipmapRenderer }
     */
    this.mipmapRenderer = void 0;
    /**
     * Render pipeline currently set on the device.
     *
     * @type {GPURenderPipeline}
     * @private
     */
    this.pipeline = void 0;
    /**
     * An array of bind group formats, based on currently assigned bind groups
     *
     * @type {WebgpuBindGroupFormat[]}
     */
    this.bindGroupFormats = [];
    /**
     * Current command buffer encoder.
     *
     * @type {GPUCommandEncoder}
     * @private
     */
    this.commandEncoder = void 0;
    /**
     * Command buffers scheduled for execution on the GPU.
     *
     * @type {GPUCommandBuffer[]}
     * @private
     */
    this.commandBuffers = [];
    /**
     * @type {GPUSupportedLimits}
     * @private
     */
    this.limits = void 0;
    options = this.initOptions;
    this.isWebGPU = true;
    this._deviceType = DEVICETYPE_WEBGPU;

    // WebGPU currently only supports 1 and 4 samples
    this.samples = options.antialias ? 4 : 1;
    this.setupPassEncoderDefaults();
  }

  /**
   * Destroy the graphics device.
   */
  destroy() {
    var _this$timestampQuerie;
    super.destroy();
    (_this$timestampQuerie = this.timestampQueriesSet) == null ? void 0 : _this$timestampQuerie.destroy();
  }
  initDeviceCaps() {
    // temporarily disabled functionality which is not supported to avoid errors
    this.disableParticleSystem = true;
    const limits = this.gpuAdapter.limits;
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
    this.supportsInstancing = true;
    this.supportsUniformBuffers = true;
    this.supportsVolumeTextures = true;
    this.supportsBoneTextures = true;
    this.supportsMorphTargetTexturesCore = true;
    this.supportsAreaLights = true;
    this.supportsDepthShadow = true;
    this.supportsGpuParticles = false;
    this.supportsMrt = true;
    this.extUintElement = true;
    this.extTextureFloat = true;
    this.textureFloatRenderable = true;
    this.extTextureHalfFloat = true;
    this.textureHalfFloatRenderable = true;
    this.textureHalfFloatUpdatable = true;
    this.boneLimit = 1024;
    this.supportsImageBitmap = true;
    this.extStandardDerivatives = true;
    this.extBlendMinmax = true;
    this.areaLightLutFormat = this.floatFilterable ? PIXELFORMAT_RGBA32F : PIXELFORMAT_RGBA8;
    this.supportsTextureFetch = true;
  }
  async initWebGpu(glslangUrl, twgslUrl) {
    if (!window.navigator.gpu) {
      throw new Error('Unable to retrieve GPU. Ensure you are using a browser that supports WebGPU rendering.');
    }

    // temporary message to confirm Webgpu is being used
    Debug.log("WebgpuGraphicsDevice initialization ..");
    const loadScript = url => {
      return new Promise(function (resolve, reject) {
        const script = document.createElement('script');
        script.src = url;
        script.async = false;
        script.onload = function () {
          resolve(url);
        };
        script.onerror = function () {
          reject(new Error(`Failed to download script ${url}`));
        };
        document.body.appendChild(script);
      });
    };

    // TODO: add both loadScript calls and requestAdapter to promise list and wait for all.
    await loadScript(glslangUrl);
    await loadScript(twgslUrl);
    this.glslang = await glslang();
    const wasmPath = twgslUrl.replace('.js', '.wasm');
    this.twgsl = await twgsl(wasmPath);

    /** @type {GPURequestAdapterOptions} */
    const adapterOptions = {
      powerPreference: this.initOptions.powerPreference !== 'default' ? this.initOptions.powerPreference : undefined
    };

    /**
     * @type {GPUAdapter}
     * @private
     */
    this.gpuAdapter = await window.navigator.gpu.requestAdapter(adapterOptions);

    // optional features:
    //      "depth-clip-control",
    //      "depth32float-stencil8",
    //      "indirect-first-instance",
    //      "shader-f16",
    //      "rg11b10ufloat-renderable",
    //      "bgra8unorm-storage",
    //      "float32-filterable"

    // request optional features
    const requiredFeatures = [];
    const requireFeature = feature => {
      const supported = this.gpuAdapter.features.has(feature);
      if (supported) {
        requiredFeatures.push(feature);
      }
      Debug.log(`WEBGPU feature [${feature}]: ${supported}`);
      return supported;
    };
    this.floatFilterable = requireFeature('float32-filterable');
    this.extCompressedTextureS3TC = requireFeature('texture-compression-bc');
    this.extCompressedTextureETC = requireFeature('texture-compression-etc2');
    this.extCompressedTextureASTC = requireFeature('texture-compression-astc');
    this.supportsTimestampQuery = requireFeature('timestamp-query');

    /** @type {GPUDeviceDescriptor} */
    const deviceDescr = {
      requiredFeatures,
      // Note that we can request limits, but it does not seem to be supported at the moment
      requiredLimits: {},
      defaultQueue: {
        label: 'Default Queue'
      }
    };

    /**
     * @type {GPUDevice}
     * @private
     */
    this.wgpu = await this.gpuAdapter.requestDevice(deviceDescr);
    this.initDeviceCaps();

    // initially fill the window. This needs improvement.
    this.setResolution(window.innerWidth, window.innerHeight);
    this.gpuContext = this.canvas.getContext('webgpu');

    // pixel format of the framebuffer is the most efficient one on the system
    const preferredCanvasFormat = navigator.gpu.getPreferredCanvasFormat();
    this.framebufferFormat = preferredCanvasFormat === 'rgba8unorm' ? PIXELFORMAT_RGBA8 : PIXELFORMAT_BGRA8;

    /**
     * Configuration of the main colorframebuffer we obtain using getCurrentTexture
     *
     * @type {GPUCanvasConfiguration}
     * @private
     */
    this.canvasConfig = {
      device: this.wgpu,
      colorSpace: 'srgb',
      alphaMode: 'opaque',
      // could also be 'premultiplied'

      // use preferred format for optimal performance on mobile
      format: preferredCanvasFormat,
      // RENDER_ATTACHMENT is required, COPY_SRC allows scene grab to copy out from it
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
      // formats that views created from textures returned by getCurrentTexture may use
      viewFormats: []
    };
    this.gpuContext.configure(this.canvasConfig);
    this.createFramebuffer();
    this.clearRenderer = new WebgpuClearRenderer(this);
    this.mipmapRenderer = new WebgpuMipmapRenderer(this);
    this.postInit();
    return this;
  }
  postInit() {
    super.postInit();

    // gpu timing queries
    this.timestampQueriesSet = this.supportsTimestampQuery ? new WebgpuQuerySet(this, true, 512) : null;

    // init dynamic buffer using 1MB allocation
    this.dynamicBuffers = new WebgpuDynamicBuffers(this, 1024 * 1024, this.limits.minUniformBufferOffsetAlignment);
  }
  createFramebuffer() {
    this.supportsStencil = this.initOptions.stencil;
    this.frameBufferDimensions = new Vec2();
    this.frameBuffer = new RenderTarget({
      name: 'WebgpuFramebuffer',
      graphicsDevice: this,
      depth: this.initOptions.depth,
      stencil: this.supportsStencil,
      samples: this.samples
    });
  }
  resizeCanvas(width, height) {
    this._width = width;
    this._height = height;
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.fire(GraphicsDevice.EVENT_RESIZE, width, height);
    }
  }
  frameStart() {
    super.frameStart();

    // submit any commands collected before the frame rendering
    this.submit();
    WebgpuDebug.memory(this);
    WebgpuDebug.validate(this);

    // current frame color output buffer
    const outColorBuffer = this.gpuContext.getCurrentTexture();
    DebugHelper.setLabel(outColorBuffer, `${this.frameBuffer.name}`);

    // reallocate framebuffer if dimensions change, to match the output texture
    if (this.frameBufferDimensions.x !== outColorBuffer.width || this.frameBufferDimensions.y !== outColorBuffer.height) {
      this.frameBufferDimensions.set(outColorBuffer.width, outColorBuffer.height);
      this.frameBuffer.destroy();
      this.frameBuffer = null;
      this.createFramebuffer();
    }
    const rt = this.frameBuffer;
    const wrt = rt.impl;

    // assign the format, allowing following init call to use it to allocate matching multisampled buffer
    wrt.setColorAttachment(0, undefined, outColorBuffer.format);
    this.initRenderTarget(rt);

    // assign current frame's render texture
    wrt.assignColorTexture(outColorBuffer);
    WebgpuDebug.end(this);
    WebgpuDebug.end(this);
  }
  frameEnd() {
    var _this$timestampQuerie2, _this$timestampQuerie3;
    super.frameEnd();

    // schedule command buffer where timestamps are copied to CPU
    (_this$timestampQuerie2 = this.timestampQueriesSet) == null ? void 0 : _this$timestampQuerie2.resolve();

    // submit scheduled command buffers
    this.submit();

    // request results
    const renderVersion = this.renderVersion;
    (_this$timestampQuerie3 = this.timestampQueriesSet) == null ? void 0 : _this$timestampQuerie3.request(this.gpuProfiler.slotCount, renderVersion).then(results => {
      this.gpuProfiler.report(results.renderVersion, results.timings);
    });
    this.gpuProfiler.frameEnd(renderVersion);
  }
  createUniformBufferImpl(uniformBuffer) {
    return new WebgpuUniformBuffer(uniformBuffer);
  }
  createVertexBufferImpl(vertexBuffer, format) {
    return new WebgpuVertexBuffer(vertexBuffer, format);
  }
  createIndexBufferImpl(indexBuffer) {
    return new WebgpuIndexBuffer(indexBuffer);
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

  /**
   * @param {number} index - Index of the bind group slot
   * @param {import('../bind-group.js').BindGroup} bindGroup - Bind group to attach
   */
  setBindGroup(index, bindGroup) {
    // TODO: this condition should be removed, it's here to handle fake grab pass, which should be refactored instead
    if (this.passEncoder) {
      // set it on the device
      this.passEncoder.setBindGroup(index, bindGroup.impl.bindGroup, bindGroup.uniformBufferOffsets);

      // store the active formats, used by the pipeline creation
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
      WebgpuDebug.validate(this);
      const passEncoder = this.passEncoder;
      Debug.assert(passEncoder);

      // vertex buffers
      const vb0 = this.vertexBuffers[0];
      const vb1 = this.vertexBuffers[1];
      this.vertexBuffers.length = 0;
      if (vb0) {
        const vbSlot = this.submitVertexBuffer(vb0, 0);
        if (vb1) {
          this.submitVertexBuffer(vb1, vbSlot);
        }
      }

      // render pipeline
      const pipeline = this.renderPipeline.get(primitive, vb0 == null ? void 0 : vb0.format, vb1 == null ? void 0 : vb1.format, this.shader, this.renderTarget, this.bindGroupFormats, this.blendState, this.depthState, this.cullMode, this.stencilEnabled, this.stencilFront, this.stencilBack);
      Debug.assert(pipeline);
      if (this.pipeline !== pipeline) {
        this.pipeline = pipeline;
        passEncoder.setPipeline(pipeline);
      }

      // draw
      const ib = this.indexBuffer;
      if (ib) {
        this.indexBuffer = null;
        passEncoder.setIndexBuffer(ib.impl.buffer, ib.impl.format);
        passEncoder.drawIndexed(primitive.count, numInstances, 0, 0, 0);
      } else {
        passEncoder.draw(primitive.count, numInstances, 0, 0);
      }
      WebgpuDebug.end(this, {
        vb0,
        vb1,
        ib,
        primitive,
        numInstances,
        pipeline
      });
    }
  }
  setShader(shader) {
    this.shader = shader;

    // TODO: we should probably track other stats instead, like pipeline switches
    this._shaderSwitchesPerFrame++;
    return true;
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

      // ref value - based on stencil front
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
    // TODO: this should use passEncoder.setBlendConstant(color)
    // similar implementation to this.stencilRef
  }
  setCullMode(cullMode) {
    this.cullMode = cullMode;
  }
  setAlphaToCoverage(state) {}
  initializeContextCaches() {
    super.initializeContextCaches();
  }

  /**
   * Set up default values for the render pass encoder.
   */
  setupPassEncoderDefaults() {
    this.stencilRef = 0;
  }

  /**
   * Start a render pass.
   *
   * @param {import('../render-pass.js').RenderPass} renderPass - The render pass to start.
   * @ignore
   */
  startPass(renderPass) {
    WebgpuDebug.internal(this);
    WebgpuDebug.validate(this);
    const rt = renderPass.renderTarget || this.frameBuffer;
    Debug.assert(rt);
    this.renderTarget = rt;

    /** @type {WebgpuRenderTarget} */
    const wrt = rt.impl;

    // create a new encoder for each pass
    this.commandEncoder = this.wgpu.createCommandEncoder();
    DebugHelper.setLabel(this.commandEncoder, `${renderPass.name}-Encoder`);

    // framebuffer is initialized at the start of the frame
    if (rt !== this.frameBuffer) {
      this.initRenderTarget(rt);
    }

    // set up clear / store / load settings
    wrt.setupForRenderPass(renderPass);

    // clear cached encoder state
    this.pipeline = null;
    const renderPassDesc = wrt.renderPassDescriptor;

    // timestamp
    if (this.timestampQueriesSet) {
      const slot = this.gpuProfiler.getSlot(renderPass.name);
      renderPassDesc.timestampWrites = {
        querySet: this.timestampQueriesSet.querySet,
        beginningOfPassWriteIndex: slot * 2,
        endOfPassWriteIndex: slot * 2 + 1
      };
      //            this.commandEncoder.writeTimestamp(this.timestampQueriesSet.querySet, 0);
    }

    // start the pass
    this.passEncoder = this.commandEncoder.beginRenderPass(renderPassDesc);
    DebugHelper.setLabel(this.passEncoder, renderPass.name);
    this.setupPassEncoderDefaults();

    // the pass always clears full target
    // TODO: avoid this setting the actual viewport/scissor on webgpu as those are automatically reset to full
    // render target. We just need to update internal state, for the get functionality to return it.
    const {
      width,
      height
    } = rt;
    this.setViewport(0, 0, width, height);
    this.setScissor(0, 0, width, height);
    Debug.assert(!this.insideRenderPass, 'RenderPass cannot be started while inside another render pass.');
    this.insideRenderPass = true;
  }

  /**
   * End a render pass.
   *
   * @param {import('../render-pass.js').RenderPass} renderPass - The render pass to end.
   * @ignore
   */
  endPass(renderPass) {
    // end the render pass
    this.passEncoder.end();
    this.passEncoder = null;
    this.insideRenderPass = false;

    // each render pass can use different number of bind groups
    this.bindGroupFormats.length = 0;

    // generate mipmaps using the same command buffer encoder
    for (let i = 0; i < renderPass.colorArrayOps.length; i++) {
      const colorOps = renderPass.colorArrayOps[i];
      if (colorOps.mipmaps) {
        this.mipmapRenderer.generate(renderPass.renderTarget._colorBuffers[i].impl);
      }
    }

    // timestamp
    // if (this.timestampQueriesSet) {
    //     this.commandEncoder.writeTimestamp(this.timestampQueriesSet.querySet, 1);
    // }

    // schedule command buffer submission
    const cb = this.commandEncoder.finish();
    DebugHelper.setLabel(cb, `${renderPass.name}-CommandBuffer`);
    this.addCommandBuffer(cb);
    this.commandEncoder = null;
    WebgpuDebug.end(this, {
      renderPass
    });
    WebgpuDebug.end(this, {
      renderPass
    });
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
      // copy dynamic buffers data to the GPU (this schedules the copy CB to run before all other CBs)
      this.dynamicBuffers.submit();

      // trace all scheduled command buffers
      Debug.call(() => {
        if (this.commandBuffers.length > 0) {
          Debug.trace(TRACEID_RENDER_QUEUE, `SUBMIT (${this.commandBuffers.length})`);
          for (let i = 0; i < this.commandBuffers.length; i++) {
            Debug.trace(TRACEID_RENDER_QUEUE, `  CB: ${this.commandBuffers[i].label}`);
          }
        }
      });
      this.wgpu.queue.submit(this.commandBuffers);
      this.commandBuffers.length = 0;

      // notify dynamic buffers
      this.dynamicBuffers.onCommandBuffersSubmitted();
    }
  }
  clear(options) {
    if (options.flags) {
      this.clearRenderer.clear(this, this.renderTarget, options, this.defaultClearOptions);
    }
  }
  get width() {
    return this._width;
  }
  get height() {
    return this._height;
  }
  setDepthBias(on) {}
  setDepthBiasValues(constBias, slopeBias) {}
  setViewport(x, y, w, h) {
    // TODO: only execute when it changes. Also, the viewport of encoder  matches the rendering attachments,
    // so we can skip this if fullscreen
    // TODO: this condition should be removed, it's here to handle fake grab pass, which should be refactored instead
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
    // TODO: only execute when it changes. Also, the viewport of encoder  matches the rendering attachments,
    // so we can skip this if fullscreen
    // TODO: this condition should be removed, it's here to handle fake grab pass, which should be refactored instead
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

  /**
   * Copies source render target into destination render target. Mostly used by post-effects.
   *
   * @param {RenderTarget} [source] - The source render target. Defaults to frame buffer.
   * @param {RenderTarget} [dest] - The destination render target. Defaults to frame buffer.
   * @param {boolean} [color] - If true will copy the color buffer. Defaults to false.
   * @param {boolean} [depth] - If true will copy the depth buffer. Defaults to false.
   * @returns {boolean} True if the copy was successful, false otherwise.
   */
  copyRenderTarget(source, dest, color, depth) {
    var _this$commandEncoder;
    /** @type {GPUExtent3D} */
    const copySize = {
      width: source ? source.width : dest.width,
      height: source ? source.height : dest.height,
      depthOrArrayLayers: 1
    };

    // use existing or create new encoder if not in a render pass
    const commandEncoder = (_this$commandEncoder = this.commandEncoder) != null ? _this$commandEncoder : this.wgpu.createCommandEncoder();
    DebugHelper.setLabel(commandEncoder, 'CopyRenderTarget-Encoder');
    DebugGraphics.pushGpuMarker(this, 'COPY-RT');
    if (color) {
      // read from supplied render target, or from the framebuffer
      /** @type {GPUImageCopyTexture} */
      const copySrc = {
        texture: source ? source.colorBuffer.impl.gpuTexture : this.renderTarget.impl.assignedColorTexture,
        mipLevel: 0
      };

      // write to supplied render target, or to the framebuffer
      /** @type {GPUImageCopyTexture} */
      const copyDst = {
        texture: dest ? dest.colorBuffer.impl.gpuTexture : this.renderTarget.impl.assignedColorTexture,
        mipLevel: 0
      };
      Debug.assert(copySrc.texture !== null && copyDst.texture !== null);
      commandEncoder.copyTextureToTexture(copySrc, copyDst, copySize);
    }
    if (depth) {
      // read from supplied render target, or from the framebuffer
      const sourceRT = source ? source : this.renderTarget;

      // cannot copy depth from multisampled buffer. On WebGPU, it cannot be resolve at the end of the pass either,
      // and so we need to implement a custom depth resolve shader based copy
      // This is currently needed for uSceneDepthMap when the camera renders to multisampled render target
      Debug.assert(source.samples <= 1, `copyRenderTarget does not currently support copy of depth from multisampled texture ${sourceRT.name}`, sourceRT);

      /** @type {GPUImageCopyTexture} */
      const copySrc = {
        texture: sourceRT.impl.depthTexture,
        mipLevel: 0
      };

      // write to supplied render target, or to the framebuffer
      /** @type {GPUImageCopyTexture} */
      const copyDst = {
        texture: dest ? dest.depthBuffer.impl.gpuTexture : this.renderTarget.impl.depthTexture,
        mipLevel: 0
      };
      Debug.assert(copySrc.texture !== null && copyDst.texture !== null);
      commandEncoder.copyTextureToTexture(copySrc, copyDst, copySize);
    }
    DebugGraphics.popGpuMarker(this);

    // if we created the encoder
    if (!this.commandEncoder) {
      // copy operation runs next
      const cb = commandEncoder.finish();
      DebugHelper.setLabel(cb, 'CopyRenderTarget-CommandBuffer');
      this.addCommandBuffer(cb);
    }
    return true;
  }
  pushMarker(name) {
    var _this$passEncoder;
    (_this$passEncoder = this.passEncoder) == null ? void 0 : _this$passEncoder.pushDebugGroup(name);
  }
  popMarker() {
    var _this$passEncoder2;
    (_this$passEncoder2 = this.passEncoder) == null ? void 0 : _this$passEncoder2.popDebugGroup();
  }
}

export { WebgpuGraphicsDevice };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViZ3B1LWdyYXBoaWNzLWRldmljZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL3BsYXRmb3JtL2dyYXBoaWNzL3dlYmdwdS93ZWJncHUtZ3JhcGhpY3MtZGV2aWNlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFRSQUNFSURfUkVOREVSX1FVRVVFIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgRGVidWcsIERlYnVnSGVscGVyIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBWZWMyIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL3ZlYzIuanMnO1xuXG5pbXBvcnQge1xuICAgIFBJWEVMRk9STUFUX1JHQkEzMkYsIFBJWEVMRk9STUFUX1JHQkE4LCBQSVhFTEZPUk1BVF9CR1JBOCwgREVWSUNFVFlQRV9XRUJHUFVcbn0gZnJvbSAnLi4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IEdyYXBoaWNzRGV2aWNlIH0gZnJvbSAnLi4vZ3JhcGhpY3MtZGV2aWNlLmpzJztcbmltcG9ydCB7IERlYnVnR3JhcGhpY3MgfSBmcm9tICcuLi9kZWJ1Zy1ncmFwaGljcy5qcyc7XG5pbXBvcnQgeyBSZW5kZXJUYXJnZXQgfSBmcm9tICcuLi9yZW5kZXItdGFyZ2V0LmpzJztcbmltcG9ydCB7IFN0ZW5jaWxQYXJhbWV0ZXJzIH0gZnJvbSAnLi4vc3RlbmNpbC1wYXJhbWV0ZXJzLmpzJztcblxuaW1wb3J0IHsgV2ViZ3B1QmluZEdyb3VwIH0gZnJvbSAnLi93ZWJncHUtYmluZC1ncm91cC5qcyc7XG5pbXBvcnQgeyBXZWJncHVCaW5kR3JvdXBGb3JtYXQgfSBmcm9tICcuL3dlYmdwdS1iaW5kLWdyb3VwLWZvcm1hdC5qcyc7XG5pbXBvcnQgeyBXZWJncHVJbmRleEJ1ZmZlciB9IGZyb20gJy4vd2ViZ3B1LWluZGV4LWJ1ZmZlci5qcyc7XG5pbXBvcnQgeyBXZWJncHVSZW5kZXJQaXBlbGluZSB9IGZyb20gJy4vd2ViZ3B1LXJlbmRlci1waXBlbGluZS5qcyc7XG5pbXBvcnQgeyBXZWJncHVSZW5kZXJUYXJnZXQgfSBmcm9tICcuL3dlYmdwdS1yZW5kZXItdGFyZ2V0LmpzJztcbmltcG9ydCB7IFdlYmdwdVNoYWRlciB9IGZyb20gJy4vd2ViZ3B1LXNoYWRlci5qcyc7XG5pbXBvcnQgeyBXZWJncHVUZXh0dXJlIH0gZnJvbSAnLi93ZWJncHUtdGV4dHVyZS5qcyc7XG5pbXBvcnQgeyBXZWJncHVVbmlmb3JtQnVmZmVyIH0gZnJvbSAnLi93ZWJncHUtdW5pZm9ybS1idWZmZXIuanMnO1xuaW1wb3J0IHsgV2ViZ3B1VmVydGV4QnVmZmVyIH0gZnJvbSAnLi93ZWJncHUtdmVydGV4LWJ1ZmZlci5qcyc7XG5pbXBvcnQgeyBXZWJncHVDbGVhclJlbmRlcmVyIH0gZnJvbSAnLi93ZWJncHUtY2xlYXItcmVuZGVyZXIuanMnO1xuaW1wb3J0IHsgV2ViZ3B1TWlwbWFwUmVuZGVyZXIgfSBmcm9tICcuL3dlYmdwdS1taXBtYXAtcmVuZGVyZXIuanMnO1xuaW1wb3J0IHsgV2ViZ3B1RGVidWcgfSBmcm9tICcuL3dlYmdwdS1kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBXZWJncHVEeW5hbWljQnVmZmVycyB9IGZyb20gJy4vd2ViZ3B1LWR5bmFtaWMtYnVmZmVycy5qcyc7XG5pbXBvcnQgeyBXZWJncHVRdWVyeVNldCB9IGZyb20gJy4vd2ViZ3B1LXF1ZXJ5LXNldC5qcyc7XG5cbmNsYXNzIFdlYmdwdUdyYXBoaWNzRGV2aWNlIGV4dGVuZHMgR3JhcGhpY3NEZXZpY2Uge1xuICAgIC8qKlxuICAgICAqIFRoZSByZW5kZXIgdGFyZ2V0IHJlcHJlc2VudGluZyB0aGUgbWFpbiBmcmFtZWJ1ZmZlci5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtSZW5kZXJUYXJnZXR9XG4gICAgICovXG4gICAgZnJhbWVCdWZmZXI7XG5cbiAgICAvKipcbiAgICAgKiBPYmplY3QgcmVzcG9uc2libGUgZm9yIGNhY2hpbmcgYW5kIGNyZWF0aW9uIG9mIHJlbmRlciBwaXBlbGluZXMuXG4gICAgICovXG4gICAgcmVuZGVyUGlwZWxpbmUgPSBuZXcgV2ViZ3B1UmVuZGVyUGlwZWxpbmUodGhpcyk7XG5cbiAgICAvKipcbiAgICAgKiBPYmplY3QgcmVzcG9uc2libGUgZm9yIGNsZWFyaW5nIHRoZSByZW5kZXJpbmcgc3VyZmFjZSBieSByZW5kZXJpbmcgYSBxdWFkLlxuICAgICAqXG4gICAgICogQHR5cGUgeyBXZWJncHVDbGVhclJlbmRlcmVyIH1cbiAgICAgKi9cbiAgICBjbGVhclJlbmRlcmVyO1xuXG4gICAgLyoqXG4gICAgICogT2JqZWN0IHJlc3BvbnNpYmxlIGZvciBtaXBtYXAgZ2VuZXJhdGlvbi5cbiAgICAgKlxuICAgICAqIEB0eXBlIHsgV2ViZ3B1TWlwbWFwUmVuZGVyZXIgfVxuICAgICAqL1xuICAgIG1pcG1hcFJlbmRlcmVyO1xuXG4gICAgLyoqXG4gICAgICogUmVuZGVyIHBpcGVsaW5lIGN1cnJlbnRseSBzZXQgb24gdGhlIGRldmljZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtHUFVSZW5kZXJQaXBlbGluZX1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHBpcGVsaW5lO1xuXG4gICAgLyoqXG4gICAgICogQW4gYXJyYXkgb2YgYmluZCBncm91cCBmb3JtYXRzLCBiYXNlZCBvbiBjdXJyZW50bHkgYXNzaWduZWQgYmluZCBncm91cHNcbiAgICAgKlxuICAgICAqIEB0eXBlIHtXZWJncHVCaW5kR3JvdXBGb3JtYXRbXX1cbiAgICAgKi9cbiAgICBiaW5kR3JvdXBGb3JtYXRzID0gW107XG5cbiAgICAvKipcbiAgICAgKiBDdXJyZW50IGNvbW1hbmQgYnVmZmVyIGVuY29kZXIuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7R1BVQ29tbWFuZEVuY29kZXJ9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBjb21tYW5kRW5jb2RlcjtcblxuICAgIC8qKlxuICAgICAqIENvbW1hbmQgYnVmZmVycyBzY2hlZHVsZWQgZm9yIGV4ZWN1dGlvbiBvbiB0aGUgR1BVLlxuICAgICAqXG4gICAgICogQHR5cGUge0dQVUNvbW1hbmRCdWZmZXJbXX1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIGNvbW1hbmRCdWZmZXJzID0gW107XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7R1BVU3VwcG9ydGVkTGltaXRzfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgbGltaXRzO1xuXG4gICAgY29uc3RydWN0b3IoY2FudmFzLCBvcHRpb25zID0ge30pIHtcbiAgICAgICAgc3VwZXIoY2FudmFzLCBvcHRpb25zKTtcbiAgICAgICAgb3B0aW9ucyA9IHRoaXMuaW5pdE9wdGlvbnM7XG5cbiAgICAgICAgdGhpcy5pc1dlYkdQVSA9IHRydWU7XG4gICAgICAgIHRoaXMuX2RldmljZVR5cGUgPSBERVZJQ0VUWVBFX1dFQkdQVTtcblxuICAgICAgICAvLyBXZWJHUFUgY3VycmVudGx5IG9ubHkgc3VwcG9ydHMgMSBhbmQgNCBzYW1wbGVzXG4gICAgICAgIHRoaXMuc2FtcGxlcyA9IG9wdGlvbnMuYW50aWFsaWFzID8gNCA6IDE7XG5cbiAgICAgICAgdGhpcy5zZXR1cFBhc3NFbmNvZGVyRGVmYXVsdHMoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEZXN0cm95IHRoZSBncmFwaGljcyBkZXZpY2UuXG4gICAgICovXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgc3VwZXIuZGVzdHJveSgpO1xuICAgICAgICB0aGlzLnRpbWVzdGFtcFF1ZXJpZXNTZXQ/LmRlc3Ryb3koKTtcbiAgICB9XG5cbiAgICBpbml0RGV2aWNlQ2FwcygpIHtcblxuICAgICAgICAvLyB0ZW1wb3JhcmlseSBkaXNhYmxlZCBmdW5jdGlvbmFsaXR5IHdoaWNoIGlzIG5vdCBzdXBwb3J0ZWQgdG8gYXZvaWQgZXJyb3JzXG4gICAgICAgIHRoaXMuZGlzYWJsZVBhcnRpY2xlU3lzdGVtID0gdHJ1ZTtcblxuICAgICAgICBjb25zdCBsaW1pdHMgPSB0aGlzLmdwdUFkYXB0ZXIubGltaXRzO1xuICAgICAgICB0aGlzLmxpbWl0cyA9IGxpbWl0cztcblxuICAgICAgICB0aGlzLnByZWNpc2lvbiA9ICdoaWdocCc7XG4gICAgICAgIHRoaXMubWF4UHJlY2lzaW9uID0gJ2hpZ2hwJztcbiAgICAgICAgdGhpcy5tYXhTYW1wbGVzID0gNDtcbiAgICAgICAgdGhpcy5tYXhUZXh0dXJlcyA9IDE2O1xuICAgICAgICB0aGlzLm1heFRleHR1cmVTaXplID0gbGltaXRzLm1heFRleHR1cmVEaW1lbnNpb24yRDtcbiAgICAgICAgdGhpcy5tYXhDdWJlTWFwU2l6ZSA9IGxpbWl0cy5tYXhUZXh0dXJlRGltZW5zaW9uMkQ7XG4gICAgICAgIHRoaXMubWF4Vm9sdW1lU2l6ZSA9IGxpbWl0cy5tYXhUZXh0dXJlRGltZW5zaW9uM0Q7XG4gICAgICAgIHRoaXMubWF4Q29sb3JBdHRhY2htZW50cyA9IGxpbWl0cy5tYXhDb2xvckF0dGFjaG1lbnRzO1xuICAgICAgICB0aGlzLm1heFBpeGVsUmF0aW8gPSAxO1xuICAgICAgICB0aGlzLm1heEFuaXNvdHJvcHkgPSAxNjtcbiAgICAgICAgdGhpcy5zdXBwb3J0c0luc3RhbmNpbmcgPSB0cnVlO1xuICAgICAgICB0aGlzLnN1cHBvcnRzVW5pZm9ybUJ1ZmZlcnMgPSB0cnVlO1xuICAgICAgICB0aGlzLnN1cHBvcnRzVm9sdW1lVGV4dHVyZXMgPSB0cnVlO1xuICAgICAgICB0aGlzLnN1cHBvcnRzQm9uZVRleHR1cmVzID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5zdXBwb3J0c01vcnBoVGFyZ2V0VGV4dHVyZXNDb3JlID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5zdXBwb3J0c0FyZWFMaWdodHMgPSB0cnVlO1xuICAgICAgICB0aGlzLnN1cHBvcnRzRGVwdGhTaGFkb3cgPSB0cnVlO1xuICAgICAgICB0aGlzLnN1cHBvcnRzR3B1UGFydGljbGVzID0gZmFsc2U7XG4gICAgICAgIHRoaXMuc3VwcG9ydHNNcnQgPSB0cnVlO1xuICAgICAgICB0aGlzLmV4dFVpbnRFbGVtZW50ID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5leHRUZXh0dXJlRmxvYXQgPSB0cnVlO1xuICAgICAgICB0aGlzLnRleHR1cmVGbG9hdFJlbmRlcmFibGUgPSB0cnVlO1xuICAgICAgICB0aGlzLmV4dFRleHR1cmVIYWxmRmxvYXQgPSB0cnVlO1xuICAgICAgICB0aGlzLnRleHR1cmVIYWxmRmxvYXRSZW5kZXJhYmxlID0gdHJ1ZTtcbiAgICAgICAgdGhpcy50ZXh0dXJlSGFsZkZsb2F0VXBkYXRhYmxlID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5ib25lTGltaXQgPSAxMDI0O1xuICAgICAgICB0aGlzLnN1cHBvcnRzSW1hZ2VCaXRtYXAgPSB0cnVlO1xuICAgICAgICB0aGlzLmV4dFN0YW5kYXJkRGVyaXZhdGl2ZXMgPSB0cnVlO1xuICAgICAgICB0aGlzLmV4dEJsZW5kTWlubWF4ID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5hcmVhTGlnaHRMdXRGb3JtYXQgPSB0aGlzLmZsb2F0RmlsdGVyYWJsZSA/IFBJWEVMRk9STUFUX1JHQkEzMkYgOiBQSVhFTEZPUk1BVF9SR0JBODtcbiAgICAgICAgdGhpcy5zdXBwb3J0c1RleHR1cmVGZXRjaCA9IHRydWU7XG4gICAgfVxuXG4gICAgYXN5bmMgaW5pdFdlYkdwdShnbHNsYW5nVXJsLCB0d2dzbFVybCkge1xuXG4gICAgICAgIGlmICghd2luZG93Lm5hdmlnYXRvci5ncHUpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5hYmxlIHRvIHJldHJpZXZlIEdQVS4gRW5zdXJlIHlvdSBhcmUgdXNpbmcgYSBicm93c2VyIHRoYXQgc3VwcG9ydHMgV2ViR1BVIHJlbmRlcmluZy4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHRlbXBvcmFyeSBtZXNzYWdlIHRvIGNvbmZpcm0gV2ViZ3B1IGlzIGJlaW5nIHVzZWRcbiAgICAgICAgRGVidWcubG9nKFwiV2ViZ3B1R3JhcGhpY3NEZXZpY2UgaW5pdGlhbGl6YXRpb24gLi5cIik7XG5cbiAgICAgICAgY29uc3QgbG9hZFNjcmlwdCA9ICh1cmwpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc2NyaXB0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2NyaXB0Jyk7XG4gICAgICAgICAgICAgICAgc2NyaXB0LnNyYyA9IHVybDtcbiAgICAgICAgICAgICAgICBzY3JpcHQuYXN5bmMgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBzY3JpcHQub25sb2FkID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHVybCk7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBzY3JpcHQub25lcnJvciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihgRmFpbGVkIHRvIGRvd25sb2FkIHNjcmlwdCAke3VybH1gKSk7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHNjcmlwdCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBUT0RPOiBhZGQgYm90aCBsb2FkU2NyaXB0IGNhbGxzIGFuZCByZXF1ZXN0QWRhcHRlciB0byBwcm9taXNlIGxpc3QgYW5kIHdhaXQgZm9yIGFsbC5cbiAgICAgICAgYXdhaXQgbG9hZFNjcmlwdChnbHNsYW5nVXJsKTtcbiAgICAgICAgYXdhaXQgbG9hZFNjcmlwdCh0d2dzbFVybCk7XG5cbiAgICAgICAgdGhpcy5nbHNsYW5nID0gYXdhaXQgZ2xzbGFuZygpO1xuXG4gICAgICAgIGNvbnN0IHdhc21QYXRoID0gdHdnc2xVcmwucmVwbGFjZSgnLmpzJywgJy53YXNtJyk7XG4gICAgICAgIHRoaXMudHdnc2wgPSBhd2FpdCB0d2dzbCh3YXNtUGF0aCk7XG5cbiAgICAgICAgLyoqIEB0eXBlIHtHUFVSZXF1ZXN0QWRhcHRlck9wdGlvbnN9ICovXG4gICAgICAgIGNvbnN0IGFkYXB0ZXJPcHRpb25zID0ge1xuICAgICAgICAgICAgcG93ZXJQcmVmZXJlbmNlOiB0aGlzLmluaXRPcHRpb25zLnBvd2VyUHJlZmVyZW5jZSAhPT0gJ2RlZmF1bHQnID8gdGhpcy5pbml0T3B0aW9ucy5wb3dlclByZWZlcmVuY2UgOiB1bmRlZmluZWRcbiAgICAgICAgfTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge0dQVUFkYXB0ZXJ9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmdwdUFkYXB0ZXIgPSBhd2FpdCB3aW5kb3cubmF2aWdhdG9yLmdwdS5yZXF1ZXN0QWRhcHRlcihhZGFwdGVyT3B0aW9ucyk7XG5cbiAgICAgICAgLy8gb3B0aW9uYWwgZmVhdHVyZXM6XG4gICAgICAgIC8vICAgICAgXCJkZXB0aC1jbGlwLWNvbnRyb2xcIixcbiAgICAgICAgLy8gICAgICBcImRlcHRoMzJmbG9hdC1zdGVuY2lsOFwiLFxuICAgICAgICAvLyAgICAgIFwiaW5kaXJlY3QtZmlyc3QtaW5zdGFuY2VcIixcbiAgICAgICAgLy8gICAgICBcInNoYWRlci1mMTZcIixcbiAgICAgICAgLy8gICAgICBcInJnMTFiMTB1ZmxvYXQtcmVuZGVyYWJsZVwiLFxuICAgICAgICAvLyAgICAgIFwiYmdyYTh1bm9ybS1zdG9yYWdlXCIsXG4gICAgICAgIC8vICAgICAgXCJmbG9hdDMyLWZpbHRlcmFibGVcIlxuXG4gICAgICAgIC8vIHJlcXVlc3Qgb3B0aW9uYWwgZmVhdHVyZXNcbiAgICAgICAgY29uc3QgcmVxdWlyZWRGZWF0dXJlcyA9IFtdO1xuICAgICAgICBjb25zdCByZXF1aXJlRmVhdHVyZSA9IChmZWF0dXJlKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBzdXBwb3J0ZWQgPSB0aGlzLmdwdUFkYXB0ZXIuZmVhdHVyZXMuaGFzKGZlYXR1cmUpO1xuICAgICAgICAgICAgaWYgKHN1cHBvcnRlZCkge1xuICAgICAgICAgICAgICAgIHJlcXVpcmVkRmVhdHVyZXMucHVzaChmZWF0dXJlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIERlYnVnLmxvZyhgV0VCR1BVIGZlYXR1cmUgWyR7ZmVhdHVyZX1dOiAke3N1cHBvcnRlZH1gKTtcbiAgICAgICAgICAgIHJldHVybiBzdXBwb3J0ZWQ7XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuZmxvYXRGaWx0ZXJhYmxlID0gcmVxdWlyZUZlYXR1cmUoJ2Zsb2F0MzItZmlsdGVyYWJsZScpO1xuICAgICAgICB0aGlzLmV4dENvbXByZXNzZWRUZXh0dXJlUzNUQyA9IHJlcXVpcmVGZWF0dXJlKCd0ZXh0dXJlLWNvbXByZXNzaW9uLWJjJyk7XG4gICAgICAgIHRoaXMuZXh0Q29tcHJlc3NlZFRleHR1cmVFVEMgPSByZXF1aXJlRmVhdHVyZSgndGV4dHVyZS1jb21wcmVzc2lvbi1ldGMyJyk7XG4gICAgICAgIHRoaXMuZXh0Q29tcHJlc3NlZFRleHR1cmVBU1RDID0gcmVxdWlyZUZlYXR1cmUoJ3RleHR1cmUtY29tcHJlc3Npb24tYXN0YycpO1xuICAgICAgICB0aGlzLnN1cHBvcnRzVGltZXN0YW1wUXVlcnkgPSByZXF1aXJlRmVhdHVyZSgndGltZXN0YW1wLXF1ZXJ5Jyk7XG5cbiAgICAgICAgLyoqIEB0eXBlIHtHUFVEZXZpY2VEZXNjcmlwdG9yfSAqL1xuICAgICAgICBjb25zdCBkZXZpY2VEZXNjciA9IHtcbiAgICAgICAgICAgIHJlcXVpcmVkRmVhdHVyZXMsXG5cbiAgICAgICAgICAgIC8vIE5vdGUgdGhhdCB3ZSBjYW4gcmVxdWVzdCBsaW1pdHMsIGJ1dCBpdCBkb2VzIG5vdCBzZWVtIHRvIGJlIHN1cHBvcnRlZCBhdCB0aGUgbW9tZW50XG4gICAgICAgICAgICByZXF1aXJlZExpbWl0czoge1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgZGVmYXVsdFF1ZXVlOiB7XG4gICAgICAgICAgICAgICAgbGFiZWw6ICdEZWZhdWx0IFF1ZXVlJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7R1BVRGV2aWNlfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy53Z3B1ID0gYXdhaXQgdGhpcy5ncHVBZGFwdGVyLnJlcXVlc3REZXZpY2UoZGV2aWNlRGVzY3IpO1xuXG4gICAgICAgIHRoaXMuaW5pdERldmljZUNhcHMoKTtcblxuICAgICAgICAvLyBpbml0aWFsbHkgZmlsbCB0aGUgd2luZG93LiBUaGlzIG5lZWRzIGltcHJvdmVtZW50LlxuICAgICAgICB0aGlzLnNldFJlc29sdXRpb24od2luZG93LmlubmVyV2lkdGgsIHdpbmRvdy5pbm5lckhlaWdodCk7XG5cbiAgICAgICAgdGhpcy5ncHVDb250ZXh0ID0gdGhpcy5jYW52YXMuZ2V0Q29udGV4dCgnd2ViZ3B1Jyk7XG5cbiAgICAgICAgLy8gcGl4ZWwgZm9ybWF0IG9mIHRoZSBmcmFtZWJ1ZmZlciBpcyB0aGUgbW9zdCBlZmZpY2llbnQgb25lIG9uIHRoZSBzeXN0ZW1cbiAgICAgICAgY29uc3QgcHJlZmVycmVkQ2FudmFzRm9ybWF0ID0gbmF2aWdhdG9yLmdwdS5nZXRQcmVmZXJyZWRDYW52YXNGb3JtYXQoKTtcbiAgICAgICAgdGhpcy5mcmFtZWJ1ZmZlckZvcm1hdCA9IHByZWZlcnJlZENhbnZhc0Zvcm1hdCA9PT0gJ3JnYmE4dW5vcm0nID8gUElYRUxGT1JNQVRfUkdCQTggOiBQSVhFTEZPUk1BVF9CR1JBODtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQ29uZmlndXJhdGlvbiBvZiB0aGUgbWFpbiBjb2xvcmZyYW1lYnVmZmVyIHdlIG9idGFpbiB1c2luZyBnZXRDdXJyZW50VGV4dHVyZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7R1BVQ2FudmFzQ29uZmlndXJhdGlvbn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuY2FudmFzQ29uZmlnID0ge1xuICAgICAgICAgICAgZGV2aWNlOiB0aGlzLndncHUsXG4gICAgICAgICAgICBjb2xvclNwYWNlOiAnc3JnYicsXG4gICAgICAgICAgICBhbHBoYU1vZGU6ICdvcGFxdWUnLCAgLy8gY291bGQgYWxzbyBiZSAncHJlbXVsdGlwbGllZCdcblxuICAgICAgICAgICAgLy8gdXNlIHByZWZlcnJlZCBmb3JtYXQgZm9yIG9wdGltYWwgcGVyZm9ybWFuY2Ugb24gbW9iaWxlXG4gICAgICAgICAgICBmb3JtYXQ6IHByZWZlcnJlZENhbnZhc0Zvcm1hdCxcblxuICAgICAgICAgICAgLy8gUkVOREVSX0FUVEFDSE1FTlQgaXMgcmVxdWlyZWQsIENPUFlfU1JDIGFsbG93cyBzY2VuZSBncmFiIHRvIGNvcHkgb3V0IGZyb20gaXRcbiAgICAgICAgICAgIHVzYWdlOiBHUFVUZXh0dXJlVXNhZ2UuUkVOREVSX0FUVEFDSE1FTlQgfCBHUFVUZXh0dXJlVXNhZ2UuQ09QWV9TUkMgfCBHUFVUZXh0dXJlVXNhZ2UuQ09QWV9EU1QsXG5cbiAgICAgICAgICAgIC8vIGZvcm1hdHMgdGhhdCB2aWV3cyBjcmVhdGVkIGZyb20gdGV4dHVyZXMgcmV0dXJuZWQgYnkgZ2V0Q3VycmVudFRleHR1cmUgbWF5IHVzZVxuICAgICAgICAgICAgdmlld0Zvcm1hdHM6IFtdXG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuZ3B1Q29udGV4dC5jb25maWd1cmUodGhpcy5jYW52YXNDb25maWcpO1xuXG4gICAgICAgIHRoaXMuY3JlYXRlRnJhbWVidWZmZXIoKTtcblxuICAgICAgICB0aGlzLmNsZWFyUmVuZGVyZXIgPSBuZXcgV2ViZ3B1Q2xlYXJSZW5kZXJlcih0aGlzKTtcbiAgICAgICAgdGhpcy5taXBtYXBSZW5kZXJlciA9IG5ldyBXZWJncHVNaXBtYXBSZW5kZXJlcih0aGlzKTtcblxuICAgICAgICB0aGlzLnBvc3RJbml0KCk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgcG9zdEluaXQoKSB7XG4gICAgICAgIHN1cGVyLnBvc3RJbml0KCk7XG5cbiAgICAgICAgLy8gZ3B1IHRpbWluZyBxdWVyaWVzXG4gICAgICAgIHRoaXMudGltZXN0YW1wUXVlcmllc1NldCA9IHRoaXMuc3VwcG9ydHNUaW1lc3RhbXBRdWVyeSA/IG5ldyBXZWJncHVRdWVyeVNldCh0aGlzLCB0cnVlLCA1MTIpIDogbnVsbDtcblxuICAgICAgICAvLyBpbml0IGR5bmFtaWMgYnVmZmVyIHVzaW5nIDFNQiBhbGxvY2F0aW9uXG4gICAgICAgIHRoaXMuZHluYW1pY0J1ZmZlcnMgPSBuZXcgV2ViZ3B1RHluYW1pY0J1ZmZlcnModGhpcywgMTAyNCAqIDEwMjQsIHRoaXMubGltaXRzLm1pblVuaWZvcm1CdWZmZXJPZmZzZXRBbGlnbm1lbnQpO1xuICAgIH1cblxuICAgIGNyZWF0ZUZyYW1lYnVmZmVyKCkge1xuICAgICAgICB0aGlzLnN1cHBvcnRzU3RlbmNpbCA9IHRoaXMuaW5pdE9wdGlvbnMuc3RlbmNpbDtcbiAgICAgICAgdGhpcy5mcmFtZUJ1ZmZlckRpbWVuc2lvbnMgPSBuZXcgVmVjMigpO1xuICAgICAgICB0aGlzLmZyYW1lQnVmZmVyID0gbmV3IFJlbmRlclRhcmdldCh7XG4gICAgICAgICAgICBuYW1lOiAnV2ViZ3B1RnJhbWVidWZmZXInLFxuICAgICAgICAgICAgZ3JhcGhpY3NEZXZpY2U6IHRoaXMsXG4gICAgICAgICAgICBkZXB0aDogdGhpcy5pbml0T3B0aW9ucy5kZXB0aCxcbiAgICAgICAgICAgIHN0ZW5jaWw6IHRoaXMuc3VwcG9ydHNTdGVuY2lsLFxuICAgICAgICAgICAgc2FtcGxlczogdGhpcy5zYW1wbGVzXG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHJlc2l6ZUNhbnZhcyh3aWR0aCwgaGVpZ2h0KSB7XG5cbiAgICAgICAgdGhpcy5fd2lkdGggPSB3aWR0aDtcbiAgICAgICAgdGhpcy5faGVpZ2h0ID0gaGVpZ2h0O1xuXG4gICAgICAgIGlmICh0aGlzLmNhbnZhcy53aWR0aCAhPT0gd2lkdGggfHwgdGhpcy5jYW52YXMuaGVpZ2h0ICE9PSBoZWlnaHQpIHtcbiAgICAgICAgICAgIHRoaXMuY2FudmFzLndpZHRoID0gd2lkdGg7XG4gICAgICAgICAgICB0aGlzLmNhbnZhcy5oZWlnaHQgPSBoZWlnaHQ7XG4gICAgICAgICAgICB0aGlzLmZpcmUoR3JhcGhpY3NEZXZpY2UuRVZFTlRfUkVTSVpFLCB3aWR0aCwgaGVpZ2h0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZyYW1lU3RhcnQoKSB7XG5cbiAgICAgICAgc3VwZXIuZnJhbWVTdGFydCgpO1xuXG4gICAgICAgIC8vIHN1Ym1pdCBhbnkgY29tbWFuZHMgY29sbGVjdGVkIGJlZm9yZSB0aGUgZnJhbWUgcmVuZGVyaW5nXG4gICAgICAgIHRoaXMuc3VibWl0KCk7XG5cbiAgICAgICAgV2ViZ3B1RGVidWcubWVtb3J5KHRoaXMpO1xuICAgICAgICBXZWJncHVEZWJ1Zy52YWxpZGF0ZSh0aGlzKTtcblxuICAgICAgICAvLyBjdXJyZW50IGZyYW1lIGNvbG9yIG91dHB1dCBidWZmZXJcbiAgICAgICAgY29uc3Qgb3V0Q29sb3JCdWZmZXIgPSB0aGlzLmdwdUNvbnRleHQuZ2V0Q3VycmVudFRleHR1cmUoKTtcbiAgICAgICAgRGVidWdIZWxwZXIuc2V0TGFiZWwob3V0Q29sb3JCdWZmZXIsIGAke3RoaXMuZnJhbWVCdWZmZXIubmFtZX1gKTtcblxuICAgICAgICAvLyByZWFsbG9jYXRlIGZyYW1lYnVmZmVyIGlmIGRpbWVuc2lvbnMgY2hhbmdlLCB0byBtYXRjaCB0aGUgb3V0cHV0IHRleHR1cmVcbiAgICAgICAgaWYgKHRoaXMuZnJhbWVCdWZmZXJEaW1lbnNpb25zLnggIT09IG91dENvbG9yQnVmZmVyLndpZHRoIHx8IHRoaXMuZnJhbWVCdWZmZXJEaW1lbnNpb25zLnkgIT09IG91dENvbG9yQnVmZmVyLmhlaWdodCkge1xuXG4gICAgICAgICAgICB0aGlzLmZyYW1lQnVmZmVyRGltZW5zaW9ucy5zZXQob3V0Q29sb3JCdWZmZXIud2lkdGgsIG91dENvbG9yQnVmZmVyLmhlaWdodCk7XG5cbiAgICAgICAgICAgIHRoaXMuZnJhbWVCdWZmZXIuZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy5mcmFtZUJ1ZmZlciA9IG51bGw7XG5cbiAgICAgICAgICAgIHRoaXMuY3JlYXRlRnJhbWVidWZmZXIoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHJ0ID0gdGhpcy5mcmFtZUJ1ZmZlcjtcbiAgICAgICAgY29uc3Qgd3J0ID0gcnQuaW1wbDtcblxuICAgICAgICAvLyBhc3NpZ24gdGhlIGZvcm1hdCwgYWxsb3dpbmcgZm9sbG93aW5nIGluaXQgY2FsbCB0byB1c2UgaXQgdG8gYWxsb2NhdGUgbWF0Y2hpbmcgbXVsdGlzYW1wbGVkIGJ1ZmZlclxuICAgICAgICB3cnQuc2V0Q29sb3JBdHRhY2htZW50KDAsIHVuZGVmaW5lZCwgb3V0Q29sb3JCdWZmZXIuZm9ybWF0KTtcblxuICAgICAgICB0aGlzLmluaXRSZW5kZXJUYXJnZXQocnQpO1xuXG4gICAgICAgIC8vIGFzc2lnbiBjdXJyZW50IGZyYW1lJ3MgcmVuZGVyIHRleHR1cmVcbiAgICAgICAgd3J0LmFzc2lnbkNvbG9yVGV4dHVyZShvdXRDb2xvckJ1ZmZlcik7XG5cbiAgICAgICAgV2ViZ3B1RGVidWcuZW5kKHRoaXMpO1xuICAgICAgICBXZWJncHVEZWJ1Zy5lbmQodGhpcyk7XG4gICAgfVxuXG4gICAgZnJhbWVFbmQoKSB7XG4gICAgICAgIHN1cGVyLmZyYW1lRW5kKCk7XG5cbiAgICAgICAgLy8gc2NoZWR1bGUgY29tbWFuZCBidWZmZXIgd2hlcmUgdGltZXN0YW1wcyBhcmUgY29waWVkIHRvIENQVVxuICAgICAgICB0aGlzLnRpbWVzdGFtcFF1ZXJpZXNTZXQ/LnJlc29sdmUoKTtcblxuICAgICAgICAvLyBzdWJtaXQgc2NoZWR1bGVkIGNvbW1hbmQgYnVmZmVyc1xuICAgICAgICB0aGlzLnN1Ym1pdCgpO1xuXG4gICAgICAgIC8vIHJlcXVlc3QgcmVzdWx0c1xuICAgICAgICBjb25zdCByZW5kZXJWZXJzaW9uID0gdGhpcy5yZW5kZXJWZXJzaW9uO1xuICAgICAgICB0aGlzLnRpbWVzdGFtcFF1ZXJpZXNTZXQ/LnJlcXVlc3QodGhpcy5ncHVQcm9maWxlci5zbG90Q291bnQsIHJlbmRlclZlcnNpb24pLnRoZW4oKHJlc3VsdHMpID0+IHtcbiAgICAgICAgICAgIHRoaXMuZ3B1UHJvZmlsZXIucmVwb3J0KHJlc3VsdHMucmVuZGVyVmVyc2lvbiwgcmVzdWx0cy50aW1pbmdzKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuZ3B1UHJvZmlsZXIuZnJhbWVFbmQocmVuZGVyVmVyc2lvbik7XG4gICAgfVxuXG4gICAgY3JlYXRlVW5pZm9ybUJ1ZmZlckltcGwodW5pZm9ybUJ1ZmZlcikge1xuICAgICAgICByZXR1cm4gbmV3IFdlYmdwdVVuaWZvcm1CdWZmZXIodW5pZm9ybUJ1ZmZlcik7XG4gICAgfVxuXG4gICAgY3JlYXRlVmVydGV4QnVmZmVySW1wbCh2ZXJ0ZXhCdWZmZXIsIGZvcm1hdCkge1xuICAgICAgICByZXR1cm4gbmV3IFdlYmdwdVZlcnRleEJ1ZmZlcih2ZXJ0ZXhCdWZmZXIsIGZvcm1hdCk7XG4gICAgfVxuXG4gICAgY3JlYXRlSW5kZXhCdWZmZXJJbXBsKGluZGV4QnVmZmVyKSB7XG4gICAgICAgIHJldHVybiBuZXcgV2ViZ3B1SW5kZXhCdWZmZXIoaW5kZXhCdWZmZXIpO1xuICAgIH1cblxuICAgIGNyZWF0ZVNoYWRlckltcGwoc2hhZGVyKSB7XG4gICAgICAgIHJldHVybiBuZXcgV2ViZ3B1U2hhZGVyKHNoYWRlcik7XG4gICAgfVxuXG4gICAgY3JlYXRlVGV4dHVyZUltcGwodGV4dHVyZSkge1xuICAgICAgICByZXR1cm4gbmV3IFdlYmdwdVRleHR1cmUodGV4dHVyZSk7XG4gICAgfVxuXG4gICAgY3JlYXRlUmVuZGVyVGFyZ2V0SW1wbChyZW5kZXJUYXJnZXQpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBXZWJncHVSZW5kZXJUYXJnZXQocmVuZGVyVGFyZ2V0KTtcbiAgICB9XG5cbiAgICBjcmVhdGVCaW5kR3JvdXBGb3JtYXRJbXBsKGJpbmRHcm91cEZvcm1hdCkge1xuICAgICAgICByZXR1cm4gbmV3IFdlYmdwdUJpbmRHcm91cEZvcm1hdChiaW5kR3JvdXBGb3JtYXQpO1xuICAgIH1cblxuICAgIGNyZWF0ZUJpbmRHcm91cEltcGwoYmluZEdyb3VwKSB7XG4gICAgICAgIHJldHVybiBuZXcgV2ViZ3B1QmluZEdyb3VwKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGluZGV4IC0gSW5kZXggb2YgdGhlIGJpbmQgZ3JvdXAgc2xvdFxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9iaW5kLWdyb3VwLmpzJykuQmluZEdyb3VwfSBiaW5kR3JvdXAgLSBCaW5kIGdyb3VwIHRvIGF0dGFjaFxuICAgICAqL1xuICAgIHNldEJpbmRHcm91cChpbmRleCwgYmluZEdyb3VwKSB7XG5cbiAgICAgICAgLy8gVE9ETzogdGhpcyBjb25kaXRpb24gc2hvdWxkIGJlIHJlbW92ZWQsIGl0J3MgaGVyZSB0byBoYW5kbGUgZmFrZSBncmFiIHBhc3MsIHdoaWNoIHNob3VsZCBiZSByZWZhY3RvcmVkIGluc3RlYWRcbiAgICAgICAgaWYgKHRoaXMucGFzc0VuY29kZXIpIHtcblxuICAgICAgICAgICAgLy8gc2V0IGl0IG9uIHRoZSBkZXZpY2VcbiAgICAgICAgICAgIHRoaXMucGFzc0VuY29kZXIuc2V0QmluZEdyb3VwKGluZGV4LCBiaW5kR3JvdXAuaW1wbC5iaW5kR3JvdXAsIGJpbmRHcm91cC51bmlmb3JtQnVmZmVyT2Zmc2V0cyk7XG5cbiAgICAgICAgICAgIC8vIHN0b3JlIHRoZSBhY3RpdmUgZm9ybWF0cywgdXNlZCBieSB0aGUgcGlwZWxpbmUgY3JlYXRpb25cbiAgICAgICAgICAgIHRoaXMuYmluZEdyb3VwRm9ybWF0c1tpbmRleF0gPSBiaW5kR3JvdXAuZm9ybWF0LmltcGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdWJtaXRWZXJ0ZXhCdWZmZXIodmVydGV4QnVmZmVyLCBzbG90KSB7XG5cbiAgICAgICAgY29uc3QgZWxlbWVudHMgPSB2ZXJ0ZXhCdWZmZXIuZm9ybWF0LmVsZW1lbnRzO1xuICAgICAgICBjb25zdCBlbGVtZW50Q291bnQgPSBlbGVtZW50cy5sZW5ndGg7XG4gICAgICAgIGNvbnN0IHZiQnVmZmVyID0gdmVydGV4QnVmZmVyLmltcGwuYnVmZmVyO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGVsZW1lbnRDb3VudDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLnBhc3NFbmNvZGVyLnNldFZlcnRleEJ1ZmZlcihzbG90ICsgaSwgdmJCdWZmZXIsIGVsZW1lbnRzW2ldLm9mZnNldCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZWxlbWVudENvdW50O1xuICAgIH1cblxuICAgIGRyYXcocHJpbWl0aXZlLCBudW1JbnN0YW5jZXMgPSAxLCBrZWVwQnVmZmVycykge1xuXG4gICAgICAgIGlmICh0aGlzLnNoYWRlci5yZWFkeSAmJiAhdGhpcy5zaGFkZXIuZmFpbGVkKSB7XG5cbiAgICAgICAgICAgIFdlYmdwdURlYnVnLnZhbGlkYXRlKHRoaXMpO1xuXG4gICAgICAgICAgICBjb25zdCBwYXNzRW5jb2RlciA9IHRoaXMucGFzc0VuY29kZXI7XG4gICAgICAgICAgICBEZWJ1Zy5hc3NlcnQocGFzc0VuY29kZXIpO1xuXG4gICAgICAgICAgICAvLyB2ZXJ0ZXggYnVmZmVyc1xuICAgICAgICAgICAgY29uc3QgdmIwID0gdGhpcy52ZXJ0ZXhCdWZmZXJzWzBdO1xuICAgICAgICAgICAgY29uc3QgdmIxID0gdGhpcy52ZXJ0ZXhCdWZmZXJzWzFdO1xuICAgICAgICAgICAgdGhpcy52ZXJ0ZXhCdWZmZXJzLmxlbmd0aCA9IDA7XG5cbiAgICAgICAgICAgIGlmICh2YjApIHtcbiAgICAgICAgICAgICAgICBjb25zdCB2YlNsb3QgPSB0aGlzLnN1Ym1pdFZlcnRleEJ1ZmZlcih2YjAsIDApO1xuICAgICAgICAgICAgICAgIGlmICh2YjEpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zdWJtaXRWZXJ0ZXhCdWZmZXIodmIxLCB2YlNsb3QpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gcmVuZGVyIHBpcGVsaW5lXG4gICAgICAgICAgICBjb25zdCBwaXBlbGluZSA9IHRoaXMucmVuZGVyUGlwZWxpbmUuZ2V0KHByaW1pdGl2ZSwgdmIwPy5mb3JtYXQsIHZiMT8uZm9ybWF0LCB0aGlzLnNoYWRlciwgdGhpcy5yZW5kZXJUYXJnZXQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYmluZEdyb3VwRm9ybWF0cywgdGhpcy5ibGVuZFN0YXRlLCB0aGlzLmRlcHRoU3RhdGUsIHRoaXMuY3VsbE1vZGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3RlbmNpbEVuYWJsZWQsIHRoaXMuc3RlbmNpbEZyb250LCB0aGlzLnN0ZW5jaWxCYWNrKTtcbiAgICAgICAgICAgIERlYnVnLmFzc2VydChwaXBlbGluZSk7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLnBpcGVsaW5lICE9PSBwaXBlbGluZSkge1xuICAgICAgICAgICAgICAgIHRoaXMucGlwZWxpbmUgPSBwaXBlbGluZTtcbiAgICAgICAgICAgICAgICBwYXNzRW5jb2Rlci5zZXRQaXBlbGluZShwaXBlbGluZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGRyYXdcbiAgICAgICAgICAgIGNvbnN0IGliID0gdGhpcy5pbmRleEJ1ZmZlcjtcbiAgICAgICAgICAgIGlmIChpYikge1xuICAgICAgICAgICAgICAgIHRoaXMuaW5kZXhCdWZmZXIgPSBudWxsO1xuICAgICAgICAgICAgICAgIHBhc3NFbmNvZGVyLnNldEluZGV4QnVmZmVyKGliLmltcGwuYnVmZmVyLCBpYi5pbXBsLmZvcm1hdCk7XG4gICAgICAgICAgICAgICAgcGFzc0VuY29kZXIuZHJhd0luZGV4ZWQocHJpbWl0aXZlLmNvdW50LCBudW1JbnN0YW5jZXMsIDAsIDAsIDApO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwYXNzRW5jb2Rlci5kcmF3KHByaW1pdGl2ZS5jb3VudCwgbnVtSW5zdGFuY2VzLCAwLCAwKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgV2ViZ3B1RGVidWcuZW5kKHRoaXMsIHtcbiAgICAgICAgICAgICAgICB2YjAsXG4gICAgICAgICAgICAgICAgdmIxLFxuICAgICAgICAgICAgICAgIGliLFxuICAgICAgICAgICAgICAgIHByaW1pdGl2ZSxcbiAgICAgICAgICAgICAgICBudW1JbnN0YW5jZXMsXG4gICAgICAgICAgICAgICAgcGlwZWxpbmVcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0U2hhZGVyKHNoYWRlcikge1xuXG4gICAgICAgIHRoaXMuc2hhZGVyID0gc2hhZGVyO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgLy8gVE9ETzogd2Ugc2hvdWxkIHByb2JhYmx5IHRyYWNrIG90aGVyIHN0YXRzIGluc3RlYWQsIGxpa2UgcGlwZWxpbmUgc3dpdGNoZXNcbiAgICAgICAgdGhpcy5fc2hhZGVyU3dpdGNoZXNQZXJGcmFtZSsrO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBzZXRCbGVuZFN0YXRlKGJsZW5kU3RhdGUpIHtcbiAgICAgICAgdGhpcy5ibGVuZFN0YXRlLmNvcHkoYmxlbmRTdGF0ZSk7XG4gICAgfVxuXG4gICAgc2V0RGVwdGhTdGF0ZShkZXB0aFN0YXRlKSB7XG4gICAgICAgIHRoaXMuZGVwdGhTdGF0ZS5jb3B5KGRlcHRoU3RhdGUpO1xuICAgIH1cblxuICAgIHNldFN0ZW5jaWxTdGF0ZShzdGVuY2lsRnJvbnQsIHN0ZW5jaWxCYWNrKSB7XG4gICAgICAgIGlmIChzdGVuY2lsRnJvbnQgfHwgc3RlbmNpbEJhY2spIHtcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbEVuYWJsZWQgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5zdGVuY2lsRnJvbnQuY29weShzdGVuY2lsRnJvbnQgPz8gU3RlbmNpbFBhcmFtZXRlcnMuREVGQVVMVCk7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxCYWNrLmNvcHkoc3RlbmNpbEJhY2sgPz8gU3RlbmNpbFBhcmFtZXRlcnMuREVGQVVMVCk7XG5cbiAgICAgICAgICAgIC8vIHJlZiB2YWx1ZSAtIGJhc2VkIG9uIHN0ZW5jaWwgZnJvbnRcbiAgICAgICAgICAgIGNvbnN0IHJlZiA9IHRoaXMuc3RlbmNpbEZyb250LnJlZjtcbiAgICAgICAgICAgIGlmICh0aGlzLnN0ZW5jaWxSZWYgIT09IHJlZikge1xuICAgICAgICAgICAgICAgIHRoaXMuc3RlbmNpbFJlZiA9IHJlZjtcbiAgICAgICAgICAgICAgICB0aGlzLnBhc3NFbmNvZGVyLnNldFN0ZW5jaWxSZWZlcmVuY2UocmVmKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbEVuYWJsZWQgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldEJsZW5kQ29sb3IociwgZywgYiwgYSkge1xuICAgICAgICAvLyBUT0RPOiB0aGlzIHNob3VsZCB1c2UgcGFzc0VuY29kZXIuc2V0QmxlbmRDb25zdGFudChjb2xvcilcbiAgICAgICAgLy8gc2ltaWxhciBpbXBsZW1lbnRhdGlvbiB0byB0aGlzLnN0ZW5jaWxSZWZcbiAgICB9XG5cbiAgICBzZXRDdWxsTW9kZShjdWxsTW9kZSkge1xuICAgICAgICB0aGlzLmN1bGxNb2RlID0gY3VsbE1vZGU7XG4gICAgfVxuXG4gICAgc2V0QWxwaGFUb0NvdmVyYWdlKHN0YXRlKSB7XG4gICAgfVxuXG4gICAgaW5pdGlhbGl6ZUNvbnRleHRDYWNoZXMoKSB7XG4gICAgICAgIHN1cGVyLmluaXRpYWxpemVDb250ZXh0Q2FjaGVzKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IHVwIGRlZmF1bHQgdmFsdWVzIGZvciB0aGUgcmVuZGVyIHBhc3MgZW5jb2Rlci5cbiAgICAgKi9cbiAgICBzZXR1cFBhc3NFbmNvZGVyRGVmYXVsdHMoKSB7XG4gICAgICAgIHRoaXMuc3RlbmNpbFJlZiA9IDA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3RhcnQgYSByZW5kZXIgcGFzcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9yZW5kZXItcGFzcy5qcycpLlJlbmRlclBhc3N9IHJlbmRlclBhc3MgLSBUaGUgcmVuZGVyIHBhc3MgdG8gc3RhcnQuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHN0YXJ0UGFzcyhyZW5kZXJQYXNzKSB7XG5cbiAgICAgICAgV2ViZ3B1RGVidWcuaW50ZXJuYWwodGhpcyk7XG4gICAgICAgIFdlYmdwdURlYnVnLnZhbGlkYXRlKHRoaXMpO1xuXG4gICAgICAgIGNvbnN0IHJ0ID0gcmVuZGVyUGFzcy5yZW5kZXJUYXJnZXQgfHwgdGhpcy5mcmFtZUJ1ZmZlcjtcbiAgICAgICAgRGVidWcuYXNzZXJ0KHJ0KTtcblxuICAgICAgICB0aGlzLnJlbmRlclRhcmdldCA9IHJ0O1xuXG4gICAgICAgIC8qKiBAdHlwZSB7V2ViZ3B1UmVuZGVyVGFyZ2V0fSAqL1xuICAgICAgICBjb25zdCB3cnQgPSBydC5pbXBsO1xuXG4gICAgICAgIC8vIGNyZWF0ZSBhIG5ldyBlbmNvZGVyIGZvciBlYWNoIHBhc3NcbiAgICAgICAgdGhpcy5jb21tYW5kRW5jb2RlciA9IHRoaXMud2dwdS5jcmVhdGVDb21tYW5kRW5jb2RlcigpO1xuICAgICAgICBEZWJ1Z0hlbHBlci5zZXRMYWJlbCh0aGlzLmNvbW1hbmRFbmNvZGVyLCBgJHtyZW5kZXJQYXNzLm5hbWV9LUVuY29kZXJgKTtcblxuICAgICAgICAvLyBmcmFtZWJ1ZmZlciBpcyBpbml0aWFsaXplZCBhdCB0aGUgc3RhcnQgb2YgdGhlIGZyYW1lXG4gICAgICAgIGlmIChydCAhPT0gdGhpcy5mcmFtZUJ1ZmZlcikge1xuICAgICAgICAgICAgdGhpcy5pbml0UmVuZGVyVGFyZ2V0KHJ0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHNldCB1cCBjbGVhciAvIHN0b3JlIC8gbG9hZCBzZXR0aW5nc1xuICAgICAgICB3cnQuc2V0dXBGb3JSZW5kZXJQYXNzKHJlbmRlclBhc3MpO1xuXG4gICAgICAgIC8vIGNsZWFyIGNhY2hlZCBlbmNvZGVyIHN0YXRlXG4gICAgICAgIHRoaXMucGlwZWxpbmUgPSBudWxsO1xuXG4gICAgICAgIGNvbnN0IHJlbmRlclBhc3NEZXNjID0gd3J0LnJlbmRlclBhc3NEZXNjcmlwdG9yO1xuXG4gICAgICAgIC8vIHRpbWVzdGFtcFxuICAgICAgICBpZiAodGhpcy50aW1lc3RhbXBRdWVyaWVzU2V0KSB7XG4gICAgICAgICAgICBjb25zdCBzbG90ID0gdGhpcy5ncHVQcm9maWxlci5nZXRTbG90KHJlbmRlclBhc3MubmFtZSk7XG4gICAgICAgICAgICByZW5kZXJQYXNzRGVzYy50aW1lc3RhbXBXcml0ZXMgPSB7XG4gICAgICAgICAgICAgICAgcXVlcnlTZXQ6IHRoaXMudGltZXN0YW1wUXVlcmllc1NldC5xdWVyeVNldCxcbiAgICAgICAgICAgICAgICBiZWdpbm5pbmdPZlBhc3NXcml0ZUluZGV4OiBzbG90ICogMixcbiAgICAgICAgICAgICAgICBlbmRPZlBhc3NXcml0ZUluZGV4OiBzbG90ICogMiArIDFcbiAgICAgICAgICAgIH07XG4vLyAgICAgICAgICAgIHRoaXMuY29tbWFuZEVuY29kZXIud3JpdGVUaW1lc3RhbXAodGhpcy50aW1lc3RhbXBRdWVyaWVzU2V0LnF1ZXJ5U2V0LCAwKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gc3RhcnQgdGhlIHBhc3NcbiAgICAgICAgdGhpcy5wYXNzRW5jb2RlciA9IHRoaXMuY29tbWFuZEVuY29kZXIuYmVnaW5SZW5kZXJQYXNzKHJlbmRlclBhc3NEZXNjKTtcbiAgICAgICAgRGVidWdIZWxwZXIuc2V0TGFiZWwodGhpcy5wYXNzRW5jb2RlciwgcmVuZGVyUGFzcy5uYW1lKTtcblxuICAgICAgICB0aGlzLnNldHVwUGFzc0VuY29kZXJEZWZhdWx0cygpO1xuXG4gICAgICAgIC8vIHRoZSBwYXNzIGFsd2F5cyBjbGVhcnMgZnVsbCB0YXJnZXRcbiAgICAgICAgLy8gVE9ETzogYXZvaWQgdGhpcyBzZXR0aW5nIHRoZSBhY3R1YWwgdmlld3BvcnQvc2Npc3NvciBvbiB3ZWJncHUgYXMgdGhvc2UgYXJlIGF1dG9tYXRpY2FsbHkgcmVzZXQgdG8gZnVsbFxuICAgICAgICAvLyByZW5kZXIgdGFyZ2V0LiBXZSBqdXN0IG5lZWQgdG8gdXBkYXRlIGludGVybmFsIHN0YXRlLCBmb3IgdGhlIGdldCBmdW5jdGlvbmFsaXR5IHRvIHJldHVybiBpdC5cbiAgICAgICAgY29uc3QgeyB3aWR0aCwgaGVpZ2h0IH0gPSBydDtcbiAgICAgICAgdGhpcy5zZXRWaWV3cG9ydCgwLCAwLCB3aWR0aCwgaGVpZ2h0KTtcbiAgICAgICAgdGhpcy5zZXRTY2lzc29yKDAsIDAsIHdpZHRoLCBoZWlnaHQpO1xuXG4gICAgICAgIERlYnVnLmFzc2VydCghdGhpcy5pbnNpZGVSZW5kZXJQYXNzLCAnUmVuZGVyUGFzcyBjYW5ub3QgYmUgc3RhcnRlZCB3aGlsZSBpbnNpZGUgYW5vdGhlciByZW5kZXIgcGFzcy4nKTtcbiAgICAgICAgdGhpcy5pbnNpZGVSZW5kZXJQYXNzID0gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFbmQgYSByZW5kZXIgcGFzcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9yZW5kZXItcGFzcy5qcycpLlJlbmRlclBhc3N9IHJlbmRlclBhc3MgLSBUaGUgcmVuZGVyIHBhc3MgdG8gZW5kLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBlbmRQYXNzKHJlbmRlclBhc3MpIHtcblxuICAgICAgICAvLyBlbmQgdGhlIHJlbmRlciBwYXNzXG4gICAgICAgIHRoaXMucGFzc0VuY29kZXIuZW5kKCk7XG4gICAgICAgIHRoaXMucGFzc0VuY29kZXIgPSBudWxsO1xuICAgICAgICB0aGlzLmluc2lkZVJlbmRlclBhc3MgPSBmYWxzZTtcblxuICAgICAgICAvLyBlYWNoIHJlbmRlciBwYXNzIGNhbiB1c2UgZGlmZmVyZW50IG51bWJlciBvZiBiaW5kIGdyb3Vwc1xuICAgICAgICB0aGlzLmJpbmRHcm91cEZvcm1hdHMubGVuZ3RoID0gMDtcblxuICAgICAgICAvLyBnZW5lcmF0ZSBtaXBtYXBzIHVzaW5nIHRoZSBzYW1lIGNvbW1hbmQgYnVmZmVyIGVuY29kZXJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCByZW5kZXJQYXNzLmNvbG9yQXJyYXlPcHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGNvbG9yT3BzID0gcmVuZGVyUGFzcy5jb2xvckFycmF5T3BzW2ldO1xuICAgICAgICAgICAgaWYgKGNvbG9yT3BzLm1pcG1hcHMpIHtcbiAgICAgICAgICAgICAgICB0aGlzLm1pcG1hcFJlbmRlcmVyLmdlbmVyYXRlKHJlbmRlclBhc3MucmVuZGVyVGFyZ2V0Ll9jb2xvckJ1ZmZlcnNbaV0uaW1wbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyB0aW1lc3RhbXBcbiAgICAgICAgLy8gaWYgKHRoaXMudGltZXN0YW1wUXVlcmllc1NldCkge1xuICAgICAgICAvLyAgICAgdGhpcy5jb21tYW5kRW5jb2Rlci53cml0ZVRpbWVzdGFtcCh0aGlzLnRpbWVzdGFtcFF1ZXJpZXNTZXQucXVlcnlTZXQsIDEpO1xuICAgICAgICAvLyB9XG5cbiAgICAgICAgLy8gc2NoZWR1bGUgY29tbWFuZCBidWZmZXIgc3VibWlzc2lvblxuICAgICAgICBjb25zdCBjYiA9IHRoaXMuY29tbWFuZEVuY29kZXIuZmluaXNoKCk7XG4gICAgICAgIERlYnVnSGVscGVyLnNldExhYmVsKGNiLCBgJHtyZW5kZXJQYXNzLm5hbWV9LUNvbW1hbmRCdWZmZXJgKTtcblxuICAgICAgICB0aGlzLmFkZENvbW1hbmRCdWZmZXIoY2IpO1xuICAgICAgICB0aGlzLmNvbW1hbmRFbmNvZGVyID0gbnVsbDtcblxuICAgICAgICBXZWJncHVEZWJ1Zy5lbmQodGhpcywgeyByZW5kZXJQYXNzIH0pO1xuICAgICAgICBXZWJncHVEZWJ1Zy5lbmQodGhpcywgeyByZW5kZXJQYXNzIH0pO1xuICAgIH1cblxuICAgIGFkZENvbW1hbmRCdWZmZXIoY29tbWFuZEJ1ZmZlciwgZnJvbnQgPSBmYWxzZSkge1xuICAgICAgICBpZiAoZnJvbnQpIHtcbiAgICAgICAgICAgIHRoaXMuY29tbWFuZEJ1ZmZlcnMudW5zaGlmdChjb21tYW5kQnVmZmVyKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuY29tbWFuZEJ1ZmZlcnMucHVzaChjb21tYW5kQnVmZmVyKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHN1Ym1pdCgpIHtcbiAgICAgICAgaWYgKHRoaXMuY29tbWFuZEJ1ZmZlcnMubGVuZ3RoID4gMCkge1xuXG4gICAgICAgICAgICAvLyBjb3B5IGR5bmFtaWMgYnVmZmVycyBkYXRhIHRvIHRoZSBHUFUgKHRoaXMgc2NoZWR1bGVzIHRoZSBjb3B5IENCIHRvIHJ1biBiZWZvcmUgYWxsIG90aGVyIENCcylcbiAgICAgICAgICAgIHRoaXMuZHluYW1pY0J1ZmZlcnMuc3VibWl0KCk7XG5cbiAgICAgICAgICAgIC8vIHRyYWNlIGFsbCBzY2hlZHVsZWQgY29tbWFuZCBidWZmZXJzXG4gICAgICAgICAgICBEZWJ1Zy5jYWxsKCgpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5jb21tYW5kQnVmZmVycy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIERlYnVnLnRyYWNlKFRSQUNFSURfUkVOREVSX1FVRVVFLCBgU1VCTUlUICgke3RoaXMuY29tbWFuZEJ1ZmZlcnMubGVuZ3RofSlgKTtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmNvbW1hbmRCdWZmZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBEZWJ1Zy50cmFjZShUUkFDRUlEX1JFTkRFUl9RVUVVRSwgYCAgQ0I6ICR7dGhpcy5jb21tYW5kQnVmZmVyc1tpXS5sYWJlbH1gKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB0aGlzLndncHUucXVldWUuc3VibWl0KHRoaXMuY29tbWFuZEJ1ZmZlcnMpO1xuICAgICAgICAgICAgdGhpcy5jb21tYW5kQnVmZmVycy5sZW5ndGggPSAwO1xuXG4gICAgICAgICAgICAvLyBub3RpZnkgZHluYW1pYyBidWZmZXJzXG4gICAgICAgICAgICB0aGlzLmR5bmFtaWNCdWZmZXJzLm9uQ29tbWFuZEJ1ZmZlcnNTdWJtaXR0ZWQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNsZWFyKG9wdGlvbnMpIHtcbiAgICAgICAgaWYgKG9wdGlvbnMuZmxhZ3MpIHtcbiAgICAgICAgICAgIHRoaXMuY2xlYXJSZW5kZXJlci5jbGVhcih0aGlzLCB0aGlzLnJlbmRlclRhcmdldCwgb3B0aW9ucywgdGhpcy5kZWZhdWx0Q2xlYXJPcHRpb25zKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCB3aWR0aCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3dpZHRoO1xuICAgIH1cblxuICAgIGdldCBoZWlnaHQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9oZWlnaHQ7XG4gICAgfVxuXG4gICAgc2V0RGVwdGhCaWFzKG9uKSB7XG4gICAgfVxuXG4gICAgc2V0RGVwdGhCaWFzVmFsdWVzKGNvbnN0Qmlhcywgc2xvcGVCaWFzKSB7XG4gICAgfVxuXG4gICAgc2V0Vmlld3BvcnQoeCwgeSwgdywgaCkge1xuICAgICAgICAvLyBUT0RPOiBvbmx5IGV4ZWN1dGUgd2hlbiBpdCBjaGFuZ2VzLiBBbHNvLCB0aGUgdmlld3BvcnQgb2YgZW5jb2RlciAgbWF0Y2hlcyB0aGUgcmVuZGVyaW5nIGF0dGFjaG1lbnRzLFxuICAgICAgICAvLyBzbyB3ZSBjYW4gc2tpcCB0aGlzIGlmIGZ1bGxzY3JlZW5cbiAgICAgICAgLy8gVE9ETzogdGhpcyBjb25kaXRpb24gc2hvdWxkIGJlIHJlbW92ZWQsIGl0J3MgaGVyZSB0byBoYW5kbGUgZmFrZSBncmFiIHBhc3MsIHdoaWNoIHNob3VsZCBiZSByZWZhY3RvcmVkIGluc3RlYWRcbiAgICAgICAgaWYgKHRoaXMucGFzc0VuY29kZXIpIHtcblxuICAgICAgICAgICAgaWYgKCF0aGlzLnJlbmRlclRhcmdldC5mbGlwWSkge1xuICAgICAgICAgICAgICAgIHkgPSB0aGlzLnJlbmRlclRhcmdldC5oZWlnaHQgLSB5IC0gaDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy52eCA9IHg7XG4gICAgICAgICAgICB0aGlzLnZ5ID0geTtcbiAgICAgICAgICAgIHRoaXMudncgPSB3O1xuICAgICAgICAgICAgdGhpcy52aCA9IGg7XG5cbiAgICAgICAgICAgIHRoaXMucGFzc0VuY29kZXIuc2V0Vmlld3BvcnQoeCwgeSwgdywgaCwgMCwgMSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRTY2lzc29yKHgsIHksIHcsIGgpIHtcbiAgICAgICAgLy8gVE9ETzogb25seSBleGVjdXRlIHdoZW4gaXQgY2hhbmdlcy4gQWxzbywgdGhlIHZpZXdwb3J0IG9mIGVuY29kZXIgIG1hdGNoZXMgdGhlIHJlbmRlcmluZyBhdHRhY2htZW50cyxcbiAgICAgICAgLy8gc28gd2UgY2FuIHNraXAgdGhpcyBpZiBmdWxsc2NyZWVuXG4gICAgICAgIC8vIFRPRE86IHRoaXMgY29uZGl0aW9uIHNob3VsZCBiZSByZW1vdmVkLCBpdCdzIGhlcmUgdG8gaGFuZGxlIGZha2UgZ3JhYiBwYXNzLCB3aGljaCBzaG91bGQgYmUgcmVmYWN0b3JlZCBpbnN0ZWFkXG4gICAgICAgIGlmICh0aGlzLnBhc3NFbmNvZGVyKSB7XG5cbiAgICAgICAgICAgIGlmICghdGhpcy5yZW5kZXJUYXJnZXQuZmxpcFkpIHtcbiAgICAgICAgICAgICAgICB5ID0gdGhpcy5yZW5kZXJUYXJnZXQuaGVpZ2h0IC0geSAtIGg7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuc3ggPSB4O1xuICAgICAgICAgICAgdGhpcy5zeSA9IHk7XG4gICAgICAgICAgICB0aGlzLnN3ID0gdztcbiAgICAgICAgICAgIHRoaXMuc2ggPSBoO1xuXG4gICAgICAgICAgICB0aGlzLnBhc3NFbmNvZGVyLnNldFNjaXNzb3JSZWN0KHgsIHksIHcsIGgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29waWVzIHNvdXJjZSByZW5kZXIgdGFyZ2V0IGludG8gZGVzdGluYXRpb24gcmVuZGVyIHRhcmdldC4gTW9zdGx5IHVzZWQgYnkgcG9zdC1lZmZlY3RzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtSZW5kZXJUYXJnZXR9IFtzb3VyY2VdIC0gVGhlIHNvdXJjZSByZW5kZXIgdGFyZ2V0LiBEZWZhdWx0cyB0byBmcmFtZSBidWZmZXIuXG4gICAgICogQHBhcmFtIHtSZW5kZXJUYXJnZXR9IFtkZXN0XSAtIFRoZSBkZXN0aW5hdGlvbiByZW5kZXIgdGFyZ2V0LiBEZWZhdWx0cyB0byBmcmFtZSBidWZmZXIuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbY29sb3JdIC0gSWYgdHJ1ZSB3aWxsIGNvcHkgdGhlIGNvbG9yIGJ1ZmZlci4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbZGVwdGhdIC0gSWYgdHJ1ZSB3aWxsIGNvcHkgdGhlIGRlcHRoIGJ1ZmZlci4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIGNvcHkgd2FzIHN1Y2Nlc3NmdWwsIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKi9cbiAgICBjb3B5UmVuZGVyVGFyZ2V0KHNvdXJjZSwgZGVzdCwgY29sb3IsIGRlcHRoKSB7XG5cbiAgICAgICAgLyoqIEB0eXBlIHtHUFVFeHRlbnQzRH0gKi9cbiAgICAgICAgY29uc3QgY29weVNpemUgPSB7XG4gICAgICAgICAgICB3aWR0aDogc291cmNlID8gc291cmNlLndpZHRoIDogZGVzdC53aWR0aCxcbiAgICAgICAgICAgIGhlaWdodDogc291cmNlID8gc291cmNlLmhlaWdodCA6IGRlc3QuaGVpZ2h0LFxuICAgICAgICAgICAgZGVwdGhPckFycmF5TGF5ZXJzOiAxXG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gdXNlIGV4aXN0aW5nIG9yIGNyZWF0ZSBuZXcgZW5jb2RlciBpZiBub3QgaW4gYSByZW5kZXIgcGFzc1xuICAgICAgICBjb25zdCBjb21tYW5kRW5jb2RlciA9IHRoaXMuY29tbWFuZEVuY29kZXIgPz8gdGhpcy53Z3B1LmNyZWF0ZUNvbW1hbmRFbmNvZGVyKCk7XG4gICAgICAgIERlYnVnSGVscGVyLnNldExhYmVsKGNvbW1hbmRFbmNvZGVyLCAnQ29weVJlbmRlclRhcmdldC1FbmNvZGVyJyk7XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKHRoaXMsICdDT1BZLVJUJyk7XG5cbiAgICAgICAgaWYgKGNvbG9yKSB7XG5cbiAgICAgICAgICAgIC8vIHJlYWQgZnJvbSBzdXBwbGllZCByZW5kZXIgdGFyZ2V0LCBvciBmcm9tIHRoZSBmcmFtZWJ1ZmZlclxuICAgICAgICAgICAgLyoqIEB0eXBlIHtHUFVJbWFnZUNvcHlUZXh0dXJlfSAqL1xuICAgICAgICAgICAgY29uc3QgY29weVNyYyA9IHtcbiAgICAgICAgICAgICAgICB0ZXh0dXJlOiBzb3VyY2UgPyBzb3VyY2UuY29sb3JCdWZmZXIuaW1wbC5ncHVUZXh0dXJlIDogdGhpcy5yZW5kZXJUYXJnZXQuaW1wbC5hc3NpZ25lZENvbG9yVGV4dHVyZSxcbiAgICAgICAgICAgICAgICBtaXBMZXZlbDogMFxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgLy8gd3JpdGUgdG8gc3VwcGxpZWQgcmVuZGVyIHRhcmdldCwgb3IgdG8gdGhlIGZyYW1lYnVmZmVyXG4gICAgICAgICAgICAvKiogQHR5cGUge0dQVUltYWdlQ29weVRleHR1cmV9ICovXG4gICAgICAgICAgICBjb25zdCBjb3B5RHN0ID0ge1xuICAgICAgICAgICAgICAgIHRleHR1cmU6IGRlc3QgPyBkZXN0LmNvbG9yQnVmZmVyLmltcGwuZ3B1VGV4dHVyZSA6IHRoaXMucmVuZGVyVGFyZ2V0LmltcGwuYXNzaWduZWRDb2xvclRleHR1cmUsXG4gICAgICAgICAgICAgICAgbWlwTGV2ZWw6IDBcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIERlYnVnLmFzc2VydChjb3B5U3JjLnRleHR1cmUgIT09IG51bGwgJiYgY29weURzdC50ZXh0dXJlICE9PSBudWxsKTtcbiAgICAgICAgICAgIGNvbW1hbmRFbmNvZGVyLmNvcHlUZXh0dXJlVG9UZXh0dXJlKGNvcHlTcmMsIGNvcHlEc3QsIGNvcHlTaXplKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChkZXB0aCkge1xuXG4gICAgICAgICAgICAvLyByZWFkIGZyb20gc3VwcGxpZWQgcmVuZGVyIHRhcmdldCwgb3IgZnJvbSB0aGUgZnJhbWVidWZmZXJcbiAgICAgICAgICAgIGNvbnN0IHNvdXJjZVJUID0gc291cmNlID8gc291cmNlIDogdGhpcy5yZW5kZXJUYXJnZXQ7XG5cbiAgICAgICAgICAgIC8vIGNhbm5vdCBjb3B5IGRlcHRoIGZyb20gbXVsdGlzYW1wbGVkIGJ1ZmZlci4gT24gV2ViR1BVLCBpdCBjYW5ub3QgYmUgcmVzb2x2ZSBhdCB0aGUgZW5kIG9mIHRoZSBwYXNzIGVpdGhlcixcbiAgICAgICAgICAgIC8vIGFuZCBzbyB3ZSBuZWVkIHRvIGltcGxlbWVudCBhIGN1c3RvbSBkZXB0aCByZXNvbHZlIHNoYWRlciBiYXNlZCBjb3B5XG4gICAgICAgICAgICAvLyBUaGlzIGlzIGN1cnJlbnRseSBuZWVkZWQgZm9yIHVTY2VuZURlcHRoTWFwIHdoZW4gdGhlIGNhbWVyYSByZW5kZXJzIHRvIG11bHRpc2FtcGxlZCByZW5kZXIgdGFyZ2V0XG4gICAgICAgICAgICBEZWJ1Zy5hc3NlcnQoc291cmNlLnNhbXBsZXMgPD0gMSwgYGNvcHlSZW5kZXJUYXJnZXQgZG9lcyBub3QgY3VycmVudGx5IHN1cHBvcnQgY29weSBvZiBkZXB0aCBmcm9tIG11bHRpc2FtcGxlZCB0ZXh0dXJlICR7c291cmNlUlQubmFtZX1gLCBzb3VyY2VSVCk7XG5cbiAgICAgICAgICAgIC8qKiBAdHlwZSB7R1BVSW1hZ2VDb3B5VGV4dHVyZX0gKi9cbiAgICAgICAgICAgIGNvbnN0IGNvcHlTcmMgPSB7XG4gICAgICAgICAgICAgICAgdGV4dHVyZTogc291cmNlUlQuaW1wbC5kZXB0aFRleHR1cmUsXG4gICAgICAgICAgICAgICAgbWlwTGV2ZWw6IDBcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIC8vIHdyaXRlIHRvIHN1cHBsaWVkIHJlbmRlciB0YXJnZXQsIG9yIHRvIHRoZSBmcmFtZWJ1ZmZlclxuICAgICAgICAgICAgLyoqIEB0eXBlIHtHUFVJbWFnZUNvcHlUZXh0dXJlfSAqL1xuICAgICAgICAgICAgY29uc3QgY29weURzdCA9IHtcbiAgICAgICAgICAgICAgICB0ZXh0dXJlOiBkZXN0ID8gZGVzdC5kZXB0aEJ1ZmZlci5pbXBsLmdwdVRleHR1cmUgOiB0aGlzLnJlbmRlclRhcmdldC5pbXBsLmRlcHRoVGV4dHVyZSxcbiAgICAgICAgICAgICAgICBtaXBMZXZlbDogMFxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgRGVidWcuYXNzZXJ0KGNvcHlTcmMudGV4dHVyZSAhPT0gbnVsbCAmJiBjb3B5RHN0LnRleHR1cmUgIT09IG51bGwpO1xuICAgICAgICAgICAgY29tbWFuZEVuY29kZXIuY29weVRleHR1cmVUb1RleHR1cmUoY29weVNyYywgY29weURzdCwgY29weVNpemUpO1xuICAgICAgICB9XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIodGhpcyk7XG5cbiAgICAgICAgLy8gaWYgd2UgY3JlYXRlZCB0aGUgZW5jb2RlclxuICAgICAgICBpZiAoIXRoaXMuY29tbWFuZEVuY29kZXIpIHtcblxuICAgICAgICAgICAgLy8gY29weSBvcGVyYXRpb24gcnVucyBuZXh0XG4gICAgICAgICAgICBjb25zdCBjYiA9IGNvbW1hbmRFbmNvZGVyLmZpbmlzaCgpO1xuICAgICAgICAgICAgRGVidWdIZWxwZXIuc2V0TGFiZWwoY2IsICdDb3B5UmVuZGVyVGFyZ2V0LUNvbW1hbmRCdWZmZXInKTtcbiAgICAgICAgICAgIHRoaXMuYWRkQ29tbWFuZEJ1ZmZlcihjYik7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvLyAjaWYgX0RFQlVHXG4gICAgcHVzaE1hcmtlcihuYW1lKSB7XG4gICAgICAgIHRoaXMucGFzc0VuY29kZXI/LnB1c2hEZWJ1Z0dyb3VwKG5hbWUpO1xuICAgIH1cblxuICAgIHBvcE1hcmtlcigpIHtcbiAgICAgICAgdGhpcy5wYXNzRW5jb2Rlcj8ucG9wRGVidWdHcm91cCgpO1xuICAgIH1cbiAgICAvLyAjZW5kaWZcbn1cblxuZXhwb3J0IHsgV2ViZ3B1R3JhcGhpY3NEZXZpY2UgfTtcbiJdLCJuYW1lcyI6WyJXZWJncHVHcmFwaGljc0RldmljZSIsIkdyYXBoaWNzRGV2aWNlIiwiY29uc3RydWN0b3IiLCJjYW52YXMiLCJvcHRpb25zIiwiZnJhbWVCdWZmZXIiLCJyZW5kZXJQaXBlbGluZSIsIldlYmdwdVJlbmRlclBpcGVsaW5lIiwiY2xlYXJSZW5kZXJlciIsIm1pcG1hcFJlbmRlcmVyIiwicGlwZWxpbmUiLCJiaW5kR3JvdXBGb3JtYXRzIiwiY29tbWFuZEVuY29kZXIiLCJjb21tYW5kQnVmZmVycyIsImxpbWl0cyIsImluaXRPcHRpb25zIiwiaXNXZWJHUFUiLCJfZGV2aWNlVHlwZSIsIkRFVklDRVRZUEVfV0VCR1BVIiwic2FtcGxlcyIsImFudGlhbGlhcyIsInNldHVwUGFzc0VuY29kZXJEZWZhdWx0cyIsImRlc3Ryb3kiLCJfdGhpcyR0aW1lc3RhbXBRdWVyaWUiLCJ0aW1lc3RhbXBRdWVyaWVzU2V0IiwiaW5pdERldmljZUNhcHMiLCJkaXNhYmxlUGFydGljbGVTeXN0ZW0iLCJncHVBZGFwdGVyIiwicHJlY2lzaW9uIiwibWF4UHJlY2lzaW9uIiwibWF4U2FtcGxlcyIsIm1heFRleHR1cmVzIiwibWF4VGV4dHVyZVNpemUiLCJtYXhUZXh0dXJlRGltZW5zaW9uMkQiLCJtYXhDdWJlTWFwU2l6ZSIsIm1heFZvbHVtZVNpemUiLCJtYXhUZXh0dXJlRGltZW5zaW9uM0QiLCJtYXhDb2xvckF0dGFjaG1lbnRzIiwibWF4UGl4ZWxSYXRpbyIsIm1heEFuaXNvdHJvcHkiLCJzdXBwb3J0c0luc3RhbmNpbmciLCJzdXBwb3J0c1VuaWZvcm1CdWZmZXJzIiwic3VwcG9ydHNWb2x1bWVUZXh0dXJlcyIsInN1cHBvcnRzQm9uZVRleHR1cmVzIiwic3VwcG9ydHNNb3JwaFRhcmdldFRleHR1cmVzQ29yZSIsInN1cHBvcnRzQXJlYUxpZ2h0cyIsInN1cHBvcnRzRGVwdGhTaGFkb3ciLCJzdXBwb3J0c0dwdVBhcnRpY2xlcyIsInN1cHBvcnRzTXJ0IiwiZXh0VWludEVsZW1lbnQiLCJleHRUZXh0dXJlRmxvYXQiLCJ0ZXh0dXJlRmxvYXRSZW5kZXJhYmxlIiwiZXh0VGV4dHVyZUhhbGZGbG9hdCIsInRleHR1cmVIYWxmRmxvYXRSZW5kZXJhYmxlIiwidGV4dHVyZUhhbGZGbG9hdFVwZGF0YWJsZSIsImJvbmVMaW1pdCIsInN1cHBvcnRzSW1hZ2VCaXRtYXAiLCJleHRTdGFuZGFyZERlcml2YXRpdmVzIiwiZXh0QmxlbmRNaW5tYXgiLCJhcmVhTGlnaHRMdXRGb3JtYXQiLCJmbG9hdEZpbHRlcmFibGUiLCJQSVhFTEZPUk1BVF9SR0JBMzJGIiwiUElYRUxGT1JNQVRfUkdCQTgiLCJzdXBwb3J0c1RleHR1cmVGZXRjaCIsImluaXRXZWJHcHUiLCJnbHNsYW5nVXJsIiwidHdnc2xVcmwiLCJ3aW5kb3ciLCJuYXZpZ2F0b3IiLCJncHUiLCJFcnJvciIsIkRlYnVnIiwibG9nIiwibG9hZFNjcmlwdCIsInVybCIsIlByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0Iiwic2NyaXB0IiwiZG9jdW1lbnQiLCJjcmVhdGVFbGVtZW50Iiwic3JjIiwiYXN5bmMiLCJvbmxvYWQiLCJvbmVycm9yIiwiYm9keSIsImFwcGVuZENoaWxkIiwiZ2xzbGFuZyIsIndhc21QYXRoIiwicmVwbGFjZSIsInR3Z3NsIiwiYWRhcHRlck9wdGlvbnMiLCJwb3dlclByZWZlcmVuY2UiLCJ1bmRlZmluZWQiLCJyZXF1ZXN0QWRhcHRlciIsInJlcXVpcmVkRmVhdHVyZXMiLCJyZXF1aXJlRmVhdHVyZSIsImZlYXR1cmUiLCJzdXBwb3J0ZWQiLCJmZWF0dXJlcyIsImhhcyIsInB1c2giLCJleHRDb21wcmVzc2VkVGV4dHVyZVMzVEMiLCJleHRDb21wcmVzc2VkVGV4dHVyZUVUQyIsImV4dENvbXByZXNzZWRUZXh0dXJlQVNUQyIsInN1cHBvcnRzVGltZXN0YW1wUXVlcnkiLCJkZXZpY2VEZXNjciIsInJlcXVpcmVkTGltaXRzIiwiZGVmYXVsdFF1ZXVlIiwibGFiZWwiLCJ3Z3B1IiwicmVxdWVzdERldmljZSIsInNldFJlc29sdXRpb24iLCJpbm5lcldpZHRoIiwiaW5uZXJIZWlnaHQiLCJncHVDb250ZXh0IiwiZ2V0Q29udGV4dCIsInByZWZlcnJlZENhbnZhc0Zvcm1hdCIsImdldFByZWZlcnJlZENhbnZhc0Zvcm1hdCIsImZyYW1lYnVmZmVyRm9ybWF0IiwiUElYRUxGT1JNQVRfQkdSQTgiLCJjYW52YXNDb25maWciLCJkZXZpY2UiLCJjb2xvclNwYWNlIiwiYWxwaGFNb2RlIiwiZm9ybWF0IiwidXNhZ2UiLCJHUFVUZXh0dXJlVXNhZ2UiLCJSRU5ERVJfQVRUQUNITUVOVCIsIkNPUFlfU1JDIiwiQ09QWV9EU1QiLCJ2aWV3Rm9ybWF0cyIsImNvbmZpZ3VyZSIsImNyZWF0ZUZyYW1lYnVmZmVyIiwiV2ViZ3B1Q2xlYXJSZW5kZXJlciIsIldlYmdwdU1pcG1hcFJlbmRlcmVyIiwicG9zdEluaXQiLCJXZWJncHVRdWVyeVNldCIsImR5bmFtaWNCdWZmZXJzIiwiV2ViZ3B1RHluYW1pY0J1ZmZlcnMiLCJtaW5Vbmlmb3JtQnVmZmVyT2Zmc2V0QWxpZ25tZW50Iiwic3VwcG9ydHNTdGVuY2lsIiwic3RlbmNpbCIsImZyYW1lQnVmZmVyRGltZW5zaW9ucyIsIlZlYzIiLCJSZW5kZXJUYXJnZXQiLCJuYW1lIiwiZ3JhcGhpY3NEZXZpY2UiLCJkZXB0aCIsInJlc2l6ZUNhbnZhcyIsIndpZHRoIiwiaGVpZ2h0IiwiX3dpZHRoIiwiX2hlaWdodCIsImZpcmUiLCJFVkVOVF9SRVNJWkUiLCJmcmFtZVN0YXJ0Iiwic3VibWl0IiwiV2ViZ3B1RGVidWciLCJtZW1vcnkiLCJ2YWxpZGF0ZSIsIm91dENvbG9yQnVmZmVyIiwiZ2V0Q3VycmVudFRleHR1cmUiLCJEZWJ1Z0hlbHBlciIsInNldExhYmVsIiwieCIsInkiLCJzZXQiLCJydCIsIndydCIsImltcGwiLCJzZXRDb2xvckF0dGFjaG1lbnQiLCJpbml0UmVuZGVyVGFyZ2V0IiwiYXNzaWduQ29sb3JUZXh0dXJlIiwiZW5kIiwiZnJhbWVFbmQiLCJfdGhpcyR0aW1lc3RhbXBRdWVyaWUyIiwiX3RoaXMkdGltZXN0YW1wUXVlcmllMyIsInJlbmRlclZlcnNpb24iLCJyZXF1ZXN0IiwiZ3B1UHJvZmlsZXIiLCJzbG90Q291bnQiLCJ0aGVuIiwicmVzdWx0cyIsInJlcG9ydCIsInRpbWluZ3MiLCJjcmVhdGVVbmlmb3JtQnVmZmVySW1wbCIsInVuaWZvcm1CdWZmZXIiLCJXZWJncHVVbmlmb3JtQnVmZmVyIiwiY3JlYXRlVmVydGV4QnVmZmVySW1wbCIsInZlcnRleEJ1ZmZlciIsIldlYmdwdVZlcnRleEJ1ZmZlciIsImNyZWF0ZUluZGV4QnVmZmVySW1wbCIsImluZGV4QnVmZmVyIiwiV2ViZ3B1SW5kZXhCdWZmZXIiLCJjcmVhdGVTaGFkZXJJbXBsIiwic2hhZGVyIiwiV2ViZ3B1U2hhZGVyIiwiY3JlYXRlVGV4dHVyZUltcGwiLCJ0ZXh0dXJlIiwiV2ViZ3B1VGV4dHVyZSIsImNyZWF0ZVJlbmRlclRhcmdldEltcGwiLCJyZW5kZXJUYXJnZXQiLCJXZWJncHVSZW5kZXJUYXJnZXQiLCJjcmVhdGVCaW5kR3JvdXBGb3JtYXRJbXBsIiwiYmluZEdyb3VwRm9ybWF0IiwiV2ViZ3B1QmluZEdyb3VwRm9ybWF0IiwiY3JlYXRlQmluZEdyb3VwSW1wbCIsImJpbmRHcm91cCIsIldlYmdwdUJpbmRHcm91cCIsInNldEJpbmRHcm91cCIsImluZGV4IiwicGFzc0VuY29kZXIiLCJ1bmlmb3JtQnVmZmVyT2Zmc2V0cyIsInN1Ym1pdFZlcnRleEJ1ZmZlciIsInNsb3QiLCJlbGVtZW50cyIsImVsZW1lbnRDb3VudCIsImxlbmd0aCIsInZiQnVmZmVyIiwiYnVmZmVyIiwiaSIsInNldFZlcnRleEJ1ZmZlciIsIm9mZnNldCIsImRyYXciLCJwcmltaXRpdmUiLCJudW1JbnN0YW5jZXMiLCJrZWVwQnVmZmVycyIsInJlYWR5IiwiZmFpbGVkIiwiYXNzZXJ0IiwidmIwIiwidmVydGV4QnVmZmVycyIsInZiMSIsInZiU2xvdCIsImdldCIsImJsZW5kU3RhdGUiLCJkZXB0aFN0YXRlIiwiY3VsbE1vZGUiLCJzdGVuY2lsRW5hYmxlZCIsInN0ZW5jaWxGcm9udCIsInN0ZW5jaWxCYWNrIiwic2V0UGlwZWxpbmUiLCJpYiIsInNldEluZGV4QnVmZmVyIiwiZHJhd0luZGV4ZWQiLCJjb3VudCIsInNldFNoYWRlciIsIl9zaGFkZXJTd2l0Y2hlc1BlckZyYW1lIiwic2V0QmxlbmRTdGF0ZSIsImNvcHkiLCJzZXREZXB0aFN0YXRlIiwic2V0U3RlbmNpbFN0YXRlIiwiU3RlbmNpbFBhcmFtZXRlcnMiLCJERUZBVUxUIiwicmVmIiwic3RlbmNpbFJlZiIsInNldFN0ZW5jaWxSZWZlcmVuY2UiLCJzZXRCbGVuZENvbG9yIiwiciIsImciLCJiIiwiYSIsInNldEN1bGxNb2RlIiwic2V0QWxwaGFUb0NvdmVyYWdlIiwic3RhdGUiLCJpbml0aWFsaXplQ29udGV4dENhY2hlcyIsInN0YXJ0UGFzcyIsInJlbmRlclBhc3MiLCJpbnRlcm5hbCIsImNyZWF0ZUNvbW1hbmRFbmNvZGVyIiwic2V0dXBGb3JSZW5kZXJQYXNzIiwicmVuZGVyUGFzc0Rlc2MiLCJyZW5kZXJQYXNzRGVzY3JpcHRvciIsImdldFNsb3QiLCJ0aW1lc3RhbXBXcml0ZXMiLCJxdWVyeVNldCIsImJlZ2lubmluZ09mUGFzc1dyaXRlSW5kZXgiLCJlbmRPZlBhc3NXcml0ZUluZGV4IiwiYmVnaW5SZW5kZXJQYXNzIiwic2V0Vmlld3BvcnQiLCJzZXRTY2lzc29yIiwiaW5zaWRlUmVuZGVyUGFzcyIsImVuZFBhc3MiLCJjb2xvckFycmF5T3BzIiwiY29sb3JPcHMiLCJtaXBtYXBzIiwiZ2VuZXJhdGUiLCJfY29sb3JCdWZmZXJzIiwiY2IiLCJmaW5pc2giLCJhZGRDb21tYW5kQnVmZmVyIiwiY29tbWFuZEJ1ZmZlciIsImZyb250IiwidW5zaGlmdCIsImNhbGwiLCJ0cmFjZSIsIlRSQUNFSURfUkVOREVSX1FVRVVFIiwicXVldWUiLCJvbkNvbW1hbmRCdWZmZXJzU3VibWl0dGVkIiwiY2xlYXIiLCJmbGFncyIsImRlZmF1bHRDbGVhck9wdGlvbnMiLCJzZXREZXB0aEJpYXMiLCJvbiIsInNldERlcHRoQmlhc1ZhbHVlcyIsImNvbnN0QmlhcyIsInNsb3BlQmlhcyIsInciLCJoIiwiZmxpcFkiLCJ2eCIsInZ5IiwidnciLCJ2aCIsInN4Iiwic3kiLCJzdyIsInNoIiwic2V0U2Npc3NvclJlY3QiLCJjb3B5UmVuZGVyVGFyZ2V0Iiwic291cmNlIiwiZGVzdCIsImNvbG9yIiwiX3RoaXMkY29tbWFuZEVuY29kZXIiLCJjb3B5U2l6ZSIsImRlcHRoT3JBcnJheUxheWVycyIsIkRlYnVnR3JhcGhpY3MiLCJwdXNoR3B1TWFya2VyIiwiY29weVNyYyIsImNvbG9yQnVmZmVyIiwiZ3B1VGV4dHVyZSIsImFzc2lnbmVkQ29sb3JUZXh0dXJlIiwibWlwTGV2ZWwiLCJjb3B5RHN0IiwiY29weVRleHR1cmVUb1RleHR1cmUiLCJzb3VyY2VSVCIsImRlcHRoVGV4dHVyZSIsImRlcHRoQnVmZmVyIiwicG9wR3B1TWFya2VyIiwicHVzaE1hcmtlciIsIl90aGlzJHBhc3NFbmNvZGVyIiwicHVzaERlYnVnR3JvdXAiLCJwb3BNYXJrZXIiLCJfdGhpcyRwYXNzRW5jb2RlcjIiLCJwb3BEZWJ1Z0dyb3VwIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQTJCQSxNQUFNQSxvQkFBb0IsU0FBU0MsY0FBYyxDQUFDO0FBZ0U5Q0MsRUFBQUEsV0FBV0EsQ0FBQ0MsTUFBTSxFQUFFQyxPQUFPLEdBQUcsRUFBRSxFQUFFO0FBQzlCLElBQUEsS0FBSyxDQUFDRCxNQUFNLEVBQUVDLE9BQU8sQ0FBQyxDQUFBO0FBaEUxQjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBSkksSUFBQSxJQUFBLENBS0FDLFdBQVcsR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUVYO0FBQ0o7QUFDQTtBQUZJLElBQUEsSUFBQSxDQUdBQyxjQUFjLEdBQUcsSUFBSUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLENBQUE7QUFFL0M7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUpJLElBQUEsSUFBQSxDQUtBQyxhQUFhLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFFYjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBSkksSUFBQSxJQUFBLENBS0FDLGNBQWMsR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUVkO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUxJLElBQUEsSUFBQSxDQU1BQyxRQUFRLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFFUjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0lBSkksSUFLQUMsQ0FB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
