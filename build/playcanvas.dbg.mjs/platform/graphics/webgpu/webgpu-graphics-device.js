import { Debug, DebugHelper } from '../../../core/debug.js';
import { Vec2 } from '../../../core/math/vec2.js';
import { DEVICETYPE_WEBGPU, PIXELFORMAT_RGBA32F, PIXELFORMAT_RGBA8, PIXELFORMAT_BGRA8 } from '../constants.js';
import { GraphicsDevice } from '../graphics-device.js';
import { RenderTarget } from '../render-target.js';
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
import { DebugGraphics } from '../debug-graphics.js';
import { WebgpuDebug } from './webgpu-debug.js';
import { StencilParameters } from '../stencil-parameters.js';

class WebgpuGraphicsDevice extends GraphicsDevice {
  /**
   * The render target representing the main framebuffer.
   *
   * @type {RenderTarget}
   */

  /**
   * Object responsible for caching and creation of render pipelines.
   */

  /**
   * Object responsible for clearing the rendering surface by rendering a quad.
   *
   * @type { WebgpuClearRenderer }
   */

  /**
   * Object responsible for mipmap generation.
   *
   * @type { WebgpuMipmapRenderer }
   */

  /**
   * Render pipeline currently set on the device.
   *
   * @type {GPURenderPipeline}
   * @private
   */

  /**
   * An array of bind group formats, based on currently assigned bind groups
   *
   * @type {WebgpuBindGroupFormat[]}
   */

  /**
   * Current command buffer encoder.
   *
   * @type {GPUCommandEncoder}
   * @private
   */

  constructor(canvas, options = {}) {
    super(canvas, options);
    this.frameBuffer = void 0;
    this.renderPipeline = new WebgpuRenderPipeline(this);
    this.clearRenderer = void 0;
    this.mipmapRenderer = void 0;
    this.pipeline = void 0;
    this.bindGroupFormats = [];
    this.commandEncoder = void 0;
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
    super.destroy();
  }
  initDeviceCaps() {
    // temporarily disabled functionality which is not supported to avoid errors
    this.disableParticleSystem = true;
    const limits = this.gpuAdapter.limits;
    this.precision = 'highp';
    this.maxPrecision = 'highp';
    this.maxSamples = 4;
    this.maxTextures = 16;
    this.maxTextureSize = limits.maxTextureDimension2D;
    this.maxCubeMapSize = limits.maxTextureDimension2D;
    this.maxVolumeSize = limits.maxTextureDimension3D;
    this.maxPixelRatio = 1;
    this.supportsInstancing = true;
    this.supportsUniformBuffers = true;
    this.supportsBoneTextures = true;
    this.supportsMorphTargetTexturesCore = true;
    this.supportsAreaLights = true;
    this.supportsDepthShadow = true;
    this.supportsGpuParticles = false;
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

    /**
     * @type {GPUAdapter}
     * @private
     */
    this.gpuAdapter = await window.navigator.gpu.requestAdapter();

    // optional features:
    //      "depth-clip-control",
    //      "depth32float-stencil8",
    //      "texture-compression-bc",
    //      "texture-compression-etc2",
    //      "texture-compression-astc",
    //      "timestamp-query",
    //      "indirect-first-instance",
    //      "shader-f16",
    //      "rg11b10ufloat-renderable",
    //      "bgra8unorm-storage",
    //      "float32-filterable"

    // request optional features
    const requiredFeatures = [];
    const requireFeature = feature => {
      if (this.gpuAdapter.features.has(feature)) {
        requiredFeatures.push(feature);
        Debug.log("Enabled WEBGPU feature: " + feature);
        return true;
      }
      return false;
    };
    this.floatFilterable = requireFeature('float32-filterable');

    /**
     * @type {GPUDevice}
     * @private
     */
    this.wgpu = await this.gpuAdapter.requestDevice({
      requiredFeatures,
      // Note that we can request limits, but it does not seem to be supported at the moment
      requiredLimits: {}
    });
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
    wrt.colorFormat = outColorBuffer.format;
    this.initRenderTarget(rt);

    // assign current frame's render texture
    wrt.assignColorTexture(outColorBuffer);
    WebgpuDebug.end(this);
    WebgpuDebug.end(this);
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
      this.passEncoder.setBindGroup(index, bindGroup.impl.bindGroup);

      // store the active formats, used by the pipeline creation
      this.bindGroupFormats[index] = bindGroup.format.impl;
    }
  }
  submitVertexBuffer(vertexBuffer, slot) {
    const format = vertexBuffer.format;
    const elementCount = format.elements.length;
    const vbBuffer = vertexBuffer.impl.buffer;
    for (let i = 0; i < elementCount; i++) {
      const element = format.elements[i];
      this.passEncoder.setVertexBuffer(slot + i, vbBuffer, element.offset);
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
    const rt = renderPass.renderTarget || this.frameBuffer;
    Debug.assert(rt);
    this.renderTarget = rt;

    /** @type {WebgpuRenderTarget} */
    const wrt = rt.impl;
    WebgpuDebug.internal(this);
    WebgpuDebug.validate(this);

    // framebuffer is initialized at the start of the frame
    if (rt !== this.frameBuffer) {
      this.initRenderTarget(rt);
    }

    // set up clear / store / load settings
    wrt.setupForRenderPass(renderPass);

    // create a new encoder for each pass to keep the GPU busy with commands
    this.commandEncoder = this.wgpu.createCommandEncoder();
    DebugHelper.setLabel(this.commandEncoder, renderPass.name);

    // clear cached encoder state
    this.pipeline = null;

    // start the pass
    this.passEncoder = this.commandEncoder.beginRenderPass(wrt.renderPassDescriptor);
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
    this.passEncoder.end();
    this.passEncoder = null;
    this.wgpu.queue.submit([this.commandEncoder.finish()]);
    this.commandEncoder = null;
    WebgpuDebug.end(this, {
      renderPass
    });
    WebgpuDebug.end(this, {
      renderPass
    });

    // each render pass can use different number of bind groups
    this.bindGroupFormats.length = 0;
    this.insideRenderPass = false;

    // generate mipmaps
    if (renderPass.colorOps.mipmaps) {
      this.mipmapRenderer.generate(renderPass.renderTarget.colorBuffer.impl);
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
    DebugGraphics.pushGpuMarker(this, 'COPY-RT');

    // use existing or create new encoder if between render passes
    const commandEncoder = (_this$commandEncoder = this.commandEncoder) != null ? _this$commandEncoder : this.wgpu.createCommandEncoder();
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

    // submit the encoded commands if we created the encoder
    if (!this.commandEncoder) {
      this.wgpu.queue.submit([commandEncoder.finish()]);
    }
    DebugGraphics.popGpuMarker(this);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViZ3B1LWdyYXBoaWNzLWRldmljZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL3BsYXRmb3JtL2dyYXBoaWNzL3dlYmdwdS93ZWJncHUtZ3JhcGhpY3MtZGV2aWNlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnLCBEZWJ1Z0hlbHBlciB9IGZyb20gJy4uLy4uLy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgVmVjMiB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC92ZWMyLmpzJztcblxuaW1wb3J0IHtcbiAgICBQSVhFTEZPUk1BVF9SR0JBMzJGLCBQSVhFTEZPUk1BVF9SR0JBOCwgUElYRUxGT1JNQVRfQkdSQTgsIERFVklDRVRZUEVfV0VCR1BVXG59IGZyb20gJy4uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBHcmFwaGljc0RldmljZSB9IGZyb20gJy4uL2dyYXBoaWNzLWRldmljZS5qcyc7XG5pbXBvcnQgeyBSZW5kZXJUYXJnZXQgfSBmcm9tICcuLi9yZW5kZXItdGFyZ2V0LmpzJztcblxuaW1wb3J0IHsgV2ViZ3B1QmluZEdyb3VwIH0gZnJvbSAnLi93ZWJncHUtYmluZC1ncm91cC5qcyc7XG5pbXBvcnQgeyBXZWJncHVCaW5kR3JvdXBGb3JtYXQgfSBmcm9tICcuL3dlYmdwdS1iaW5kLWdyb3VwLWZvcm1hdC5qcyc7XG5pbXBvcnQgeyBXZWJncHVJbmRleEJ1ZmZlciB9IGZyb20gJy4vd2ViZ3B1LWluZGV4LWJ1ZmZlci5qcyc7XG5pbXBvcnQgeyBXZWJncHVSZW5kZXJQaXBlbGluZSB9IGZyb20gJy4vd2ViZ3B1LXJlbmRlci1waXBlbGluZS5qcyc7XG5pbXBvcnQgeyBXZWJncHVSZW5kZXJUYXJnZXQgfSBmcm9tICcuL3dlYmdwdS1yZW5kZXItdGFyZ2V0LmpzJztcbmltcG9ydCB7IFdlYmdwdVNoYWRlciB9IGZyb20gJy4vd2ViZ3B1LXNoYWRlci5qcyc7XG5pbXBvcnQgeyBXZWJncHVUZXh0dXJlIH0gZnJvbSAnLi93ZWJncHUtdGV4dHVyZS5qcyc7XG5pbXBvcnQgeyBXZWJncHVVbmlmb3JtQnVmZmVyIH0gZnJvbSAnLi93ZWJncHUtdW5pZm9ybS1idWZmZXIuanMnO1xuaW1wb3J0IHsgV2ViZ3B1VmVydGV4QnVmZmVyIH0gZnJvbSAnLi93ZWJncHUtdmVydGV4LWJ1ZmZlci5qcyc7XG5pbXBvcnQgeyBXZWJncHVDbGVhclJlbmRlcmVyIH0gZnJvbSAnLi93ZWJncHUtY2xlYXItcmVuZGVyZXIuanMnO1xuaW1wb3J0IHsgV2ViZ3B1TWlwbWFwUmVuZGVyZXIgfSBmcm9tICcuL3dlYmdwdS1taXBtYXAtcmVuZGVyZXIuanMnO1xuaW1wb3J0IHsgRGVidWdHcmFwaGljcyB9IGZyb20gJy4uL2RlYnVnLWdyYXBoaWNzLmpzJztcbmltcG9ydCB7IFdlYmdwdURlYnVnIH0gZnJvbSAnLi93ZWJncHUtZGVidWcuanMnO1xuaW1wb3J0IHsgU3RlbmNpbFBhcmFtZXRlcnMgfSBmcm9tICcuLi9zdGVuY2lsLXBhcmFtZXRlcnMuanMnO1xuXG5jbGFzcyBXZWJncHVHcmFwaGljc0RldmljZSBleHRlbmRzIEdyYXBoaWNzRGV2aWNlIHtcbiAgICAvKipcbiAgICAgKiBUaGUgcmVuZGVyIHRhcmdldCByZXByZXNlbnRpbmcgdGhlIG1haW4gZnJhbWVidWZmZXIuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7UmVuZGVyVGFyZ2V0fVxuICAgICAqL1xuICAgIGZyYW1lQnVmZmVyO1xuXG4gICAgLyoqXG4gICAgICogT2JqZWN0IHJlc3BvbnNpYmxlIGZvciBjYWNoaW5nIGFuZCBjcmVhdGlvbiBvZiByZW5kZXIgcGlwZWxpbmVzLlxuICAgICAqL1xuICAgIHJlbmRlclBpcGVsaW5lID0gbmV3IFdlYmdwdVJlbmRlclBpcGVsaW5lKHRoaXMpO1xuXG4gICAgLyoqXG4gICAgICogT2JqZWN0IHJlc3BvbnNpYmxlIGZvciBjbGVhcmluZyB0aGUgcmVuZGVyaW5nIHN1cmZhY2UgYnkgcmVuZGVyaW5nIGEgcXVhZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHsgV2ViZ3B1Q2xlYXJSZW5kZXJlciB9XG4gICAgICovXG4gICAgY2xlYXJSZW5kZXJlcjtcblxuICAgIC8qKlxuICAgICAqIE9iamVjdCByZXNwb25zaWJsZSBmb3IgbWlwbWFwIGdlbmVyYXRpb24uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7IFdlYmdwdU1pcG1hcFJlbmRlcmVyIH1cbiAgICAgKi9cbiAgICBtaXBtYXBSZW5kZXJlcjtcblxuICAgIC8qKlxuICAgICAqIFJlbmRlciBwaXBlbGluZSBjdXJyZW50bHkgc2V0IG9uIHRoZSBkZXZpY2UuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7R1BVUmVuZGVyUGlwZWxpbmV9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBwaXBlbGluZTtcblxuICAgIC8qKlxuICAgICAqIEFuIGFycmF5IG9mIGJpbmQgZ3JvdXAgZm9ybWF0cywgYmFzZWQgb24gY3VycmVudGx5IGFzc2lnbmVkIGJpbmQgZ3JvdXBzXG4gICAgICpcbiAgICAgKiBAdHlwZSB7V2ViZ3B1QmluZEdyb3VwRm9ybWF0W119XG4gICAgICovXG4gICAgYmluZEdyb3VwRm9ybWF0cyA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogQ3VycmVudCBjb21tYW5kIGJ1ZmZlciBlbmNvZGVyLlxuICAgICAqXG4gICAgICogQHR5cGUge0dQVUNvbW1hbmRFbmNvZGVyfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgY29tbWFuZEVuY29kZXI7XG5cbiAgICBjb25zdHJ1Y3RvcihjYW52YXMsIG9wdGlvbnMgPSB7fSkge1xuICAgICAgICBzdXBlcihjYW52YXMsIG9wdGlvbnMpO1xuICAgICAgICBvcHRpb25zID0gdGhpcy5pbml0T3B0aW9ucztcblxuICAgICAgICB0aGlzLmlzV2ViR1BVID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fZGV2aWNlVHlwZSA9IERFVklDRVRZUEVfV0VCR1BVO1xuXG4gICAgICAgIC8vIFdlYkdQVSBjdXJyZW50bHkgb25seSBzdXBwb3J0cyAxIGFuZCA0IHNhbXBsZXNcbiAgICAgICAgdGhpcy5zYW1wbGVzID0gb3B0aW9ucy5hbnRpYWxpYXMgPyA0IDogMTtcblxuICAgICAgICB0aGlzLnNldHVwUGFzc0VuY29kZXJEZWZhdWx0cygpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERlc3Ryb3kgdGhlIGdyYXBoaWNzIGRldmljZS5cbiAgICAgKi9cbiAgICBkZXN0cm95KCkge1xuICAgICAgICBzdXBlci5kZXN0cm95KCk7XG4gICAgfVxuXG4gICAgaW5pdERldmljZUNhcHMoKSB7XG5cbiAgICAgICAgLy8gdGVtcG9yYXJpbHkgZGlzYWJsZWQgZnVuY3Rpb25hbGl0eSB3aGljaCBpcyBub3Qgc3VwcG9ydGVkIHRvIGF2b2lkIGVycm9yc1xuICAgICAgICB0aGlzLmRpc2FibGVQYXJ0aWNsZVN5c3RlbSA9IHRydWU7XG5cbiAgICAgICAgY29uc3QgbGltaXRzID0gdGhpcy5ncHVBZGFwdGVyLmxpbWl0cztcblxuICAgICAgICB0aGlzLnByZWNpc2lvbiA9ICdoaWdocCc7XG4gICAgICAgIHRoaXMubWF4UHJlY2lzaW9uID0gJ2hpZ2hwJztcbiAgICAgICAgdGhpcy5tYXhTYW1wbGVzID0gNDtcbiAgICAgICAgdGhpcy5tYXhUZXh0dXJlcyA9IDE2O1xuICAgICAgICB0aGlzLm1heFRleHR1cmVTaXplID0gbGltaXRzLm1heFRleHR1cmVEaW1lbnNpb24yRDtcbiAgICAgICAgdGhpcy5tYXhDdWJlTWFwU2l6ZSA9IGxpbWl0cy5tYXhUZXh0dXJlRGltZW5zaW9uMkQ7XG4gICAgICAgIHRoaXMubWF4Vm9sdW1lU2l6ZSA9IGxpbWl0cy5tYXhUZXh0dXJlRGltZW5zaW9uM0Q7XG4gICAgICAgIHRoaXMubWF4UGl4ZWxSYXRpbyA9IDE7XG4gICAgICAgIHRoaXMuc3VwcG9ydHNJbnN0YW5jaW5nID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5zdXBwb3J0c1VuaWZvcm1CdWZmZXJzID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5zdXBwb3J0c0JvbmVUZXh0dXJlcyA9IHRydWU7XG4gICAgICAgIHRoaXMuc3VwcG9ydHNNb3JwaFRhcmdldFRleHR1cmVzQ29yZSA9IHRydWU7XG4gICAgICAgIHRoaXMuc3VwcG9ydHNBcmVhTGlnaHRzID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5zdXBwb3J0c0RlcHRoU2hhZG93ID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5zdXBwb3J0c0dwdVBhcnRpY2xlcyA9IGZhbHNlO1xuICAgICAgICB0aGlzLmV4dFVpbnRFbGVtZW50ID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5leHRUZXh0dXJlRmxvYXQgPSB0cnVlO1xuICAgICAgICB0aGlzLnRleHR1cmVGbG9hdFJlbmRlcmFibGUgPSB0cnVlO1xuICAgICAgICB0aGlzLmV4dFRleHR1cmVIYWxmRmxvYXQgPSB0cnVlO1xuICAgICAgICB0aGlzLnRleHR1cmVIYWxmRmxvYXRSZW5kZXJhYmxlID0gdHJ1ZTtcbiAgICAgICAgdGhpcy50ZXh0dXJlSGFsZkZsb2F0VXBkYXRhYmxlID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5ib25lTGltaXQgPSAxMDI0O1xuICAgICAgICB0aGlzLnN1cHBvcnRzSW1hZ2VCaXRtYXAgPSB0cnVlO1xuICAgICAgICB0aGlzLmV4dFN0YW5kYXJkRGVyaXZhdGl2ZXMgPSB0cnVlO1xuICAgICAgICB0aGlzLmV4dEJsZW5kTWlubWF4ID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5hcmVhTGlnaHRMdXRGb3JtYXQgPSB0aGlzLmZsb2F0RmlsdGVyYWJsZSA/IFBJWEVMRk9STUFUX1JHQkEzMkYgOiBQSVhFTEZPUk1BVF9SR0JBODtcbiAgICAgICAgdGhpcy5zdXBwb3J0c1RleHR1cmVGZXRjaCA9IHRydWU7XG4gICAgfVxuXG4gICAgYXN5bmMgaW5pdFdlYkdwdShnbHNsYW5nVXJsLCB0d2dzbFVybCkge1xuXG4gICAgICAgIGlmICghd2luZG93Lm5hdmlnYXRvci5ncHUpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5hYmxlIHRvIHJldHJpZXZlIEdQVS4gRW5zdXJlIHlvdSBhcmUgdXNpbmcgYSBicm93c2VyIHRoYXQgc3VwcG9ydHMgV2ViR1BVIHJlbmRlcmluZy4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHRlbXBvcmFyeSBtZXNzYWdlIHRvIGNvbmZpcm0gV2ViZ3B1IGlzIGJlaW5nIHVzZWRcbiAgICAgICAgRGVidWcubG9nKFwiV2ViZ3B1R3JhcGhpY3NEZXZpY2UgaW5pdGlhbGl6YXRpb24gLi5cIik7XG5cbiAgICAgICAgY29uc3QgbG9hZFNjcmlwdCA9ICh1cmwpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc2NyaXB0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2NyaXB0Jyk7XG4gICAgICAgICAgICAgICAgc2NyaXB0LnNyYyA9IHVybDtcbiAgICAgICAgICAgICAgICBzY3JpcHQuYXN5bmMgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBzY3JpcHQub25sb2FkID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHVybCk7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBzY3JpcHQub25lcnJvciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihgRmFpbGVkIHRvIGRvd25sb2FkIHNjcmlwdCAke3VybH1gKSk7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHNjcmlwdCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBUT0RPOiBhZGQgYm90aCBsb2FkU2NyaXB0IGNhbGxzIGFuZCByZXF1ZXN0QWRhcHRlciB0byBwcm9taXNlIGxpc3QgYW5kIHdhaXQgZm9yIGFsbC5cbiAgICAgICAgYXdhaXQgbG9hZFNjcmlwdChnbHNsYW5nVXJsKTtcbiAgICAgICAgYXdhaXQgbG9hZFNjcmlwdCh0d2dzbFVybCk7XG5cbiAgICAgICAgdGhpcy5nbHNsYW5nID0gYXdhaXQgZ2xzbGFuZygpO1xuXG4gICAgICAgIGNvbnN0IHdhc21QYXRoID0gdHdnc2xVcmwucmVwbGFjZSgnLmpzJywgJy53YXNtJyk7XG4gICAgICAgIHRoaXMudHdnc2wgPSBhd2FpdCB0d2dzbCh3YXNtUGF0aCk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtHUFVBZGFwdGVyfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5ncHVBZGFwdGVyID0gYXdhaXQgd2luZG93Lm5hdmlnYXRvci5ncHUucmVxdWVzdEFkYXB0ZXIoKTtcblxuICAgICAgICAvLyBvcHRpb25hbCBmZWF0dXJlczpcbiAgICAgICAgLy8gICAgICBcImRlcHRoLWNsaXAtY29udHJvbFwiLFxuICAgICAgICAvLyAgICAgIFwiZGVwdGgzMmZsb2F0LXN0ZW5jaWw4XCIsXG4gICAgICAgIC8vICAgICAgXCJ0ZXh0dXJlLWNvbXByZXNzaW9uLWJjXCIsXG4gICAgICAgIC8vICAgICAgXCJ0ZXh0dXJlLWNvbXByZXNzaW9uLWV0YzJcIixcbiAgICAgICAgLy8gICAgICBcInRleHR1cmUtY29tcHJlc3Npb24tYXN0Y1wiLFxuICAgICAgICAvLyAgICAgIFwidGltZXN0YW1wLXF1ZXJ5XCIsXG4gICAgICAgIC8vICAgICAgXCJpbmRpcmVjdC1maXJzdC1pbnN0YW5jZVwiLFxuICAgICAgICAvLyAgICAgIFwic2hhZGVyLWYxNlwiLFxuICAgICAgICAvLyAgICAgIFwicmcxMWIxMHVmbG9hdC1yZW5kZXJhYmxlXCIsXG4gICAgICAgIC8vICAgICAgXCJiZ3JhOHVub3JtLXN0b3JhZ2VcIixcbiAgICAgICAgLy8gICAgICBcImZsb2F0MzItZmlsdGVyYWJsZVwiXG5cbiAgICAgICAgLy8gcmVxdWVzdCBvcHRpb25hbCBmZWF0dXJlc1xuICAgICAgICBjb25zdCByZXF1aXJlZEZlYXR1cmVzID0gW107XG4gICAgICAgIGNvbnN0IHJlcXVpcmVGZWF0dXJlID0gKGZlYXR1cmUpID0+IHtcbiAgICAgICAgICAgIGlmICh0aGlzLmdwdUFkYXB0ZXIuZmVhdHVyZXMuaGFzKGZlYXR1cmUpKSB7XG4gICAgICAgICAgICAgICAgcmVxdWlyZWRGZWF0dXJlcy5wdXNoKGZlYXR1cmUpO1xuICAgICAgICAgICAgICAgIERlYnVnLmxvZyhcIkVuYWJsZWQgV0VCR1BVIGZlYXR1cmU6IFwiICsgZmVhdHVyZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuZmxvYXRGaWx0ZXJhYmxlID0gcmVxdWlyZUZlYXR1cmUoJ2Zsb2F0MzItZmlsdGVyYWJsZScpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7R1BVRGV2aWNlfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy53Z3B1ID0gYXdhaXQgdGhpcy5ncHVBZGFwdGVyLnJlcXVlc3REZXZpY2Uoe1xuICAgICAgICAgICAgcmVxdWlyZWRGZWF0dXJlcyxcblxuICAgICAgICAgICAgLy8gTm90ZSB0aGF0IHdlIGNhbiByZXF1ZXN0IGxpbWl0cywgYnV0IGl0IGRvZXMgbm90IHNlZW0gdG8gYmUgc3VwcG9ydGVkIGF0IHRoZSBtb21lbnRcbiAgICAgICAgICAgIHJlcXVpcmVkTGltaXRzOiB7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuaW5pdERldmljZUNhcHMoKTtcblxuICAgICAgICAvLyBpbml0aWFsbHkgZmlsbCB0aGUgd2luZG93LiBUaGlzIG5lZWRzIGltcHJvdmVtZW50LlxuICAgICAgICB0aGlzLnNldFJlc29sdXRpb24od2luZG93LmlubmVyV2lkdGgsIHdpbmRvdy5pbm5lckhlaWdodCk7XG5cbiAgICAgICAgdGhpcy5ncHVDb250ZXh0ID0gdGhpcy5jYW52YXMuZ2V0Q29udGV4dCgnd2ViZ3B1Jyk7XG5cbiAgICAgICAgLy8gcGl4ZWwgZm9ybWF0IG9mIHRoZSBmcmFtZWJ1ZmZlciBpcyB0aGUgbW9zdCBlZmZpY2llbnQgb25lIG9uIHRoZSBzeXN0ZW1cbiAgICAgICAgY29uc3QgcHJlZmVycmVkQ2FudmFzRm9ybWF0ID0gbmF2aWdhdG9yLmdwdS5nZXRQcmVmZXJyZWRDYW52YXNGb3JtYXQoKTtcbiAgICAgICAgdGhpcy5mcmFtZWJ1ZmZlckZvcm1hdCA9IHByZWZlcnJlZENhbnZhc0Zvcm1hdCA9PT0gJ3JnYmE4dW5vcm0nID8gUElYRUxGT1JNQVRfUkdCQTggOiBQSVhFTEZPUk1BVF9CR1JBODtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQ29uZmlndXJhdGlvbiBvZiB0aGUgbWFpbiBjb2xvcmZyYW1lYnVmZmVyIHdlIG9idGFpbiB1c2luZyBnZXRDdXJyZW50VGV4dHVyZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7R1BVQ2FudmFzQ29uZmlndXJhdGlvbn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuY2FudmFzQ29uZmlnID0ge1xuICAgICAgICAgICAgZGV2aWNlOiB0aGlzLndncHUsXG4gICAgICAgICAgICBjb2xvclNwYWNlOiAnc3JnYicsXG4gICAgICAgICAgICBhbHBoYU1vZGU6ICdvcGFxdWUnLCAgLy8gY291bGQgYWxzbyBiZSAncHJlbXVsdGlwbGllZCdcblxuICAgICAgICAgICAgLy8gdXNlIHByZWZlcnJlZCBmb3JtYXQgZm9yIG9wdGltYWwgcGVyZm9ybWFuY2Ugb24gbW9iaWxlXG4gICAgICAgICAgICBmb3JtYXQ6IHByZWZlcnJlZENhbnZhc0Zvcm1hdCxcblxuICAgICAgICAgICAgLy8gUkVOREVSX0FUVEFDSE1FTlQgaXMgcmVxdWlyZWQsIENPUFlfU1JDIGFsbG93cyBzY2VuZSBncmFiIHRvIGNvcHkgb3V0IGZyb20gaXRcbiAgICAgICAgICAgIHVzYWdlOiBHUFVUZXh0dXJlVXNhZ2UuUkVOREVSX0FUVEFDSE1FTlQgfCBHUFVUZXh0dXJlVXNhZ2UuQ09QWV9TUkMgfCBHUFVUZXh0dXJlVXNhZ2UuQ09QWV9EU1QsXG5cbiAgICAgICAgICAgIC8vIGZvcm1hdHMgdGhhdCB2aWV3cyBjcmVhdGVkIGZyb20gdGV4dHVyZXMgcmV0dXJuZWQgYnkgZ2V0Q3VycmVudFRleHR1cmUgbWF5IHVzZVxuICAgICAgICAgICAgdmlld0Zvcm1hdHM6IFtdXG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuZ3B1Q29udGV4dC5jb25maWd1cmUodGhpcy5jYW52YXNDb25maWcpO1xuXG4gICAgICAgIHRoaXMuY3JlYXRlRnJhbWVidWZmZXIoKTtcblxuICAgICAgICB0aGlzLmNsZWFyUmVuZGVyZXIgPSBuZXcgV2ViZ3B1Q2xlYXJSZW5kZXJlcih0aGlzKTtcbiAgICAgICAgdGhpcy5taXBtYXBSZW5kZXJlciA9IG5ldyBXZWJncHVNaXBtYXBSZW5kZXJlcih0aGlzKTtcblxuICAgICAgICB0aGlzLnBvc3RJbml0KCk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgY3JlYXRlRnJhbWVidWZmZXIoKSB7XG4gICAgICAgIHRoaXMuc3VwcG9ydHNTdGVuY2lsID0gdGhpcy5pbml0T3B0aW9ucy5zdGVuY2lsO1xuICAgICAgICB0aGlzLmZyYW1lQnVmZmVyRGltZW5zaW9ucyA9IG5ldyBWZWMyKCk7XG4gICAgICAgIHRoaXMuZnJhbWVCdWZmZXIgPSBuZXcgUmVuZGVyVGFyZ2V0KHtcbiAgICAgICAgICAgIG5hbWU6ICdXZWJncHVGcmFtZWJ1ZmZlcicsXG4gICAgICAgICAgICBncmFwaGljc0RldmljZTogdGhpcyxcbiAgICAgICAgICAgIGRlcHRoOiB0aGlzLmluaXRPcHRpb25zLmRlcHRoLFxuICAgICAgICAgICAgc3RlbmNpbDogdGhpcy5zdXBwb3J0c1N0ZW5jaWwsXG4gICAgICAgICAgICBzYW1wbGVzOiB0aGlzLnNhbXBsZXNcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmVzaXplQ2FudmFzKHdpZHRoLCBoZWlnaHQpIHtcblxuICAgICAgICB0aGlzLl93aWR0aCA9IHdpZHRoO1xuICAgICAgICB0aGlzLl9oZWlnaHQgPSBoZWlnaHQ7XG5cbiAgICAgICAgaWYgKHRoaXMuY2FudmFzLndpZHRoICE9PSB3aWR0aCB8fCB0aGlzLmNhbnZhcy5oZWlnaHQgIT09IGhlaWdodCkge1xuICAgICAgICAgICAgdGhpcy5jYW52YXMud2lkdGggPSB3aWR0aDtcbiAgICAgICAgICAgIHRoaXMuY2FudmFzLmhlaWdodCA9IGhlaWdodDtcbiAgICAgICAgICAgIHRoaXMuZmlyZShHcmFwaGljc0RldmljZS5FVkVOVF9SRVNJWkUsIHdpZHRoLCBoZWlnaHQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnJhbWVTdGFydCgpIHtcblxuICAgICAgICBzdXBlci5mcmFtZVN0YXJ0KCk7XG5cbiAgICAgICAgV2ViZ3B1RGVidWcubWVtb3J5KHRoaXMpO1xuICAgICAgICBXZWJncHVEZWJ1Zy52YWxpZGF0ZSh0aGlzKTtcblxuICAgICAgICAvLyBjdXJyZW50IGZyYW1lIGNvbG9yIG91dHB1dCBidWZmZXJcbiAgICAgICAgY29uc3Qgb3V0Q29sb3JCdWZmZXIgPSB0aGlzLmdwdUNvbnRleHQuZ2V0Q3VycmVudFRleHR1cmUoKTtcbiAgICAgICAgRGVidWdIZWxwZXIuc2V0TGFiZWwob3V0Q29sb3JCdWZmZXIsIGAke3RoaXMuZnJhbWVCdWZmZXIubmFtZX1gKTtcblxuICAgICAgICAvLyByZWFsbG9jYXRlIGZyYW1lYnVmZmVyIGlmIGRpbWVuc2lvbnMgY2hhbmdlLCB0byBtYXRjaCB0aGUgb3V0cHV0IHRleHR1cmVcbiAgICAgICAgaWYgKHRoaXMuZnJhbWVCdWZmZXJEaW1lbnNpb25zLnggIT09IG91dENvbG9yQnVmZmVyLndpZHRoIHx8IHRoaXMuZnJhbWVCdWZmZXJEaW1lbnNpb25zLnkgIT09IG91dENvbG9yQnVmZmVyLmhlaWdodCkge1xuXG4gICAgICAgICAgICB0aGlzLmZyYW1lQnVmZmVyRGltZW5zaW9ucy5zZXQob3V0Q29sb3JCdWZmZXIud2lkdGgsIG91dENvbG9yQnVmZmVyLmhlaWdodCk7XG5cbiAgICAgICAgICAgIHRoaXMuZnJhbWVCdWZmZXIuZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy5mcmFtZUJ1ZmZlciA9IG51bGw7XG5cbiAgICAgICAgICAgIHRoaXMuY3JlYXRlRnJhbWVidWZmZXIoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHJ0ID0gdGhpcy5mcmFtZUJ1ZmZlcjtcbiAgICAgICAgY29uc3Qgd3J0ID0gcnQuaW1wbDtcblxuICAgICAgICAvLyBhc3NpZ24gdGhlIGZvcm1hdCwgYWxsb3dpbmcgZm9sbG93aW5nIGluaXQgY2FsbCB0byB1c2UgaXQgdG8gYWxsb2NhdGUgbWF0Y2hpbmcgbXVsdGlzYW1wbGVkIGJ1ZmZlclxuICAgICAgICB3cnQuY29sb3JGb3JtYXQgPSBvdXRDb2xvckJ1ZmZlci5mb3JtYXQ7XG5cbiAgICAgICAgdGhpcy5pbml0UmVuZGVyVGFyZ2V0KHJ0KTtcblxuICAgICAgICAvLyBhc3NpZ24gY3VycmVudCBmcmFtZSdzIHJlbmRlciB0ZXh0dXJlXG4gICAgICAgIHdydC5hc3NpZ25Db2xvclRleHR1cmUob3V0Q29sb3JCdWZmZXIpO1xuXG4gICAgICAgIFdlYmdwdURlYnVnLmVuZCh0aGlzKTtcbiAgICAgICAgV2ViZ3B1RGVidWcuZW5kKHRoaXMpO1xuICAgIH1cblxuICAgIGNyZWF0ZVVuaWZvcm1CdWZmZXJJbXBsKHVuaWZvcm1CdWZmZXIpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBXZWJncHVVbmlmb3JtQnVmZmVyKHVuaWZvcm1CdWZmZXIpO1xuICAgIH1cblxuICAgIGNyZWF0ZVZlcnRleEJ1ZmZlckltcGwodmVydGV4QnVmZmVyLCBmb3JtYXQpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBXZWJncHVWZXJ0ZXhCdWZmZXIodmVydGV4QnVmZmVyLCBmb3JtYXQpO1xuICAgIH1cblxuICAgIGNyZWF0ZUluZGV4QnVmZmVySW1wbChpbmRleEJ1ZmZlcikge1xuICAgICAgICByZXR1cm4gbmV3IFdlYmdwdUluZGV4QnVmZmVyKGluZGV4QnVmZmVyKTtcbiAgICB9XG5cbiAgICBjcmVhdGVTaGFkZXJJbXBsKHNoYWRlcikge1xuICAgICAgICByZXR1cm4gbmV3IFdlYmdwdVNoYWRlcihzaGFkZXIpO1xuICAgIH1cblxuICAgIGNyZWF0ZVRleHR1cmVJbXBsKHRleHR1cmUpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBXZWJncHVUZXh0dXJlKHRleHR1cmUpO1xuICAgIH1cblxuICAgIGNyZWF0ZVJlbmRlclRhcmdldEltcGwocmVuZGVyVGFyZ2V0KSB7XG4gICAgICAgIHJldHVybiBuZXcgV2ViZ3B1UmVuZGVyVGFyZ2V0KHJlbmRlclRhcmdldCk7XG4gICAgfVxuXG4gICAgY3JlYXRlQmluZEdyb3VwRm9ybWF0SW1wbChiaW5kR3JvdXBGb3JtYXQpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBXZWJncHVCaW5kR3JvdXBGb3JtYXQoYmluZEdyb3VwRm9ybWF0KTtcbiAgICB9XG5cbiAgICBjcmVhdGVCaW5kR3JvdXBJbXBsKGJpbmRHcm91cCkge1xuICAgICAgICByZXR1cm4gbmV3IFdlYmdwdUJpbmRHcm91cCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBpbmRleCAtIEluZGV4IG9mIHRoZSBiaW5kIGdyb3VwIHNsb3RcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vYmluZC1ncm91cC5qcycpLkJpbmRHcm91cH0gYmluZEdyb3VwIC0gQmluZCBncm91cCB0byBhdHRhY2hcbiAgICAgKi9cbiAgICBzZXRCaW5kR3JvdXAoaW5kZXgsIGJpbmRHcm91cCkge1xuXG4gICAgICAgIC8vIFRPRE86IHRoaXMgY29uZGl0aW9uIHNob3VsZCBiZSByZW1vdmVkLCBpdCdzIGhlcmUgdG8gaGFuZGxlIGZha2UgZ3JhYiBwYXNzLCB3aGljaCBzaG91bGQgYmUgcmVmYWN0b3JlZCBpbnN0ZWFkXG4gICAgICAgIGlmICh0aGlzLnBhc3NFbmNvZGVyKSB7XG5cbiAgICAgICAgICAgIC8vIHNldCBpdCBvbiB0aGUgZGV2aWNlXG4gICAgICAgICAgICB0aGlzLnBhc3NFbmNvZGVyLnNldEJpbmRHcm91cChpbmRleCwgYmluZEdyb3VwLmltcGwuYmluZEdyb3VwKTtcblxuICAgICAgICAgICAgLy8gc3RvcmUgdGhlIGFjdGl2ZSBmb3JtYXRzLCB1c2VkIGJ5IHRoZSBwaXBlbGluZSBjcmVhdGlvblxuICAgICAgICAgICAgdGhpcy5iaW5kR3JvdXBGb3JtYXRzW2luZGV4XSA9IGJpbmRHcm91cC5mb3JtYXQuaW1wbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHN1Ym1pdFZlcnRleEJ1ZmZlcih2ZXJ0ZXhCdWZmZXIsIHNsb3QpIHtcblxuICAgICAgICBjb25zdCBmb3JtYXQgPSB2ZXJ0ZXhCdWZmZXIuZm9ybWF0O1xuICAgICAgICBjb25zdCBlbGVtZW50Q291bnQgPSBmb3JtYXQuZWxlbWVudHMubGVuZ3RoO1xuICAgICAgICBjb25zdCB2YkJ1ZmZlciA9IHZlcnRleEJ1ZmZlci5pbXBsLmJ1ZmZlcjtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBlbGVtZW50Q291bnQ7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgZWxlbWVudCA9IGZvcm1hdC5lbGVtZW50c1tpXTtcbiAgICAgICAgICAgIHRoaXMucGFzc0VuY29kZXIuc2V0VmVydGV4QnVmZmVyKHNsb3QgKyBpLCB2YkJ1ZmZlciwgZWxlbWVudC5vZmZzZXQpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGVsZW1lbnRDb3VudDtcbiAgICB9XG5cbiAgICBkcmF3KHByaW1pdGl2ZSwgbnVtSW5zdGFuY2VzID0gMSwga2VlcEJ1ZmZlcnMpIHtcblxuICAgICAgICBpZiAodGhpcy5zaGFkZXIucmVhZHkgJiYgIXRoaXMuc2hhZGVyLmZhaWxlZCkge1xuXG4gICAgICAgICAgICBXZWJncHVEZWJ1Zy52YWxpZGF0ZSh0aGlzKTtcblxuICAgICAgICAgICAgY29uc3QgcGFzc0VuY29kZXIgPSB0aGlzLnBhc3NFbmNvZGVyO1xuICAgICAgICAgICAgRGVidWcuYXNzZXJ0KHBhc3NFbmNvZGVyKTtcblxuICAgICAgICAgICAgLy8gdmVydGV4IGJ1ZmZlcnNcbiAgICAgICAgICAgIGNvbnN0IHZiMCA9IHRoaXMudmVydGV4QnVmZmVyc1swXTtcbiAgICAgICAgICAgIGNvbnN0IHZiMSA9IHRoaXMudmVydGV4QnVmZmVyc1sxXTtcbiAgICAgICAgICAgIHRoaXMudmVydGV4QnVmZmVycy5sZW5ndGggPSAwO1xuXG4gICAgICAgICAgICBpZiAodmIwKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdmJTbG90ID0gdGhpcy5zdWJtaXRWZXJ0ZXhCdWZmZXIodmIwLCAwKTtcbiAgICAgICAgICAgICAgICBpZiAodmIxKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc3VibWl0VmVydGV4QnVmZmVyKHZiMSwgdmJTbG90KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHJlbmRlciBwaXBlbGluZVxuICAgICAgICAgICAgY29uc3QgcGlwZWxpbmUgPSB0aGlzLnJlbmRlclBpcGVsaW5lLmdldChwcmltaXRpdmUsIHZiMD8uZm9ybWF0LCB2YjE/LmZvcm1hdCwgdGhpcy5zaGFkZXIsIHRoaXMucmVuZGVyVGFyZ2V0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmJpbmRHcm91cEZvcm1hdHMsIHRoaXMuYmxlbmRTdGF0ZSwgdGhpcy5kZXB0aFN0YXRlLCB0aGlzLmN1bGxNb2RlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN0ZW5jaWxFbmFibGVkLCB0aGlzLnN0ZW5jaWxGcm9udCwgdGhpcy5zdGVuY2lsQmFjayk7XG4gICAgICAgICAgICBEZWJ1Zy5hc3NlcnQocGlwZWxpbmUpO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5waXBlbGluZSAhPT0gcGlwZWxpbmUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnBpcGVsaW5lID0gcGlwZWxpbmU7XG4gICAgICAgICAgICAgICAgcGFzc0VuY29kZXIuc2V0UGlwZWxpbmUocGlwZWxpbmUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBkcmF3XG4gICAgICAgICAgICBjb25zdCBpYiA9IHRoaXMuaW5kZXhCdWZmZXI7XG4gICAgICAgICAgICBpZiAoaWIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmluZGV4QnVmZmVyID0gbnVsbDtcbiAgICAgICAgICAgICAgICBwYXNzRW5jb2Rlci5zZXRJbmRleEJ1ZmZlcihpYi5pbXBsLmJ1ZmZlciwgaWIuaW1wbC5mb3JtYXQpO1xuICAgICAgICAgICAgICAgIHBhc3NFbmNvZGVyLmRyYXdJbmRleGVkKHByaW1pdGl2ZS5jb3VudCwgbnVtSW5zdGFuY2VzLCAwLCAwLCAwKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGFzc0VuY29kZXIuZHJhdyhwcmltaXRpdmUuY291bnQsIG51bUluc3RhbmNlcywgMCwgMCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIFdlYmdwdURlYnVnLmVuZCh0aGlzLCB7XG4gICAgICAgICAgICAgICAgdmIwLFxuICAgICAgICAgICAgICAgIHZiMSxcbiAgICAgICAgICAgICAgICBpYixcbiAgICAgICAgICAgICAgICBwcmltaXRpdmUsXG4gICAgICAgICAgICAgICAgbnVtSW5zdGFuY2VzLFxuICAgICAgICAgICAgICAgIHBpcGVsaW5lXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldFNoYWRlcihzaGFkZXIpIHtcblxuICAgICAgICB0aGlzLnNoYWRlciA9IHNoYWRlcjtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIC8vIFRPRE86IHdlIHNob3VsZCBwcm9iYWJseSB0cmFjayBvdGhlciBzdGF0cyBpbnN0ZWFkLCBsaWtlIHBpcGVsaW5lIHN3aXRjaGVzXG4gICAgICAgIHRoaXMuX3NoYWRlclN3aXRjaGVzUGVyRnJhbWUrKztcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgc2V0QmxlbmRTdGF0ZShibGVuZFN0YXRlKSB7XG4gICAgICAgIHRoaXMuYmxlbmRTdGF0ZS5jb3B5KGJsZW5kU3RhdGUpO1xuICAgIH1cblxuICAgIHNldERlcHRoU3RhdGUoZGVwdGhTdGF0ZSkge1xuICAgICAgICB0aGlzLmRlcHRoU3RhdGUuY29weShkZXB0aFN0YXRlKTtcbiAgICB9XG5cbiAgICBzZXRTdGVuY2lsU3RhdGUoc3RlbmNpbEZyb250LCBzdGVuY2lsQmFjaykge1xuICAgICAgICBpZiAoc3RlbmNpbEZyb250IHx8IHN0ZW5jaWxCYWNrKSB7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxFbmFibGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbEZyb250LmNvcHkoc3RlbmNpbEZyb250ID8/IFN0ZW5jaWxQYXJhbWV0ZXJzLkRFRkFVTFQpO1xuICAgICAgICAgICAgdGhpcy5zdGVuY2lsQmFjay5jb3B5KHN0ZW5jaWxCYWNrID8/IFN0ZW5jaWxQYXJhbWV0ZXJzLkRFRkFVTFQpO1xuXG4gICAgICAgICAgICAvLyByZWYgdmFsdWUgLSBiYXNlZCBvbiBzdGVuY2lsIGZyb250XG4gICAgICAgICAgICBjb25zdCByZWYgPSB0aGlzLnN0ZW5jaWxGcm9udC5yZWY7XG4gICAgICAgICAgICBpZiAodGhpcy5zdGVuY2lsUmVmICE9PSByZWYpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnN0ZW5jaWxSZWYgPSByZWY7XG4gICAgICAgICAgICAgICAgdGhpcy5wYXNzRW5jb2Rlci5zZXRTdGVuY2lsUmVmZXJlbmNlKHJlZik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxFbmFibGVkID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRCbGVuZENvbG9yKHIsIGcsIGIsIGEpIHtcbiAgICAgICAgLy8gVE9ETzogdGhpcyBzaG91bGQgdXNlIHBhc3NFbmNvZGVyLnNldEJsZW5kQ29uc3RhbnQoY29sb3IpXG4gICAgICAgIC8vIHNpbWlsYXIgaW1wbGVtZW50YXRpb24gdG8gdGhpcy5zdGVuY2lsUmVmXG4gICAgfVxuXG4gICAgc2V0Q3VsbE1vZGUoY3VsbE1vZGUpIHtcbiAgICAgICAgdGhpcy5jdWxsTW9kZSA9IGN1bGxNb2RlO1xuICAgIH1cblxuICAgIHNldEFscGhhVG9Db3ZlcmFnZShzdGF0ZSkge1xuICAgIH1cblxuICAgIGluaXRpYWxpemVDb250ZXh0Q2FjaGVzKCkge1xuICAgICAgICBzdXBlci5pbml0aWFsaXplQ29udGV4dENhY2hlcygpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCB1cCBkZWZhdWx0IHZhbHVlcyBmb3IgdGhlIHJlbmRlciBwYXNzIGVuY29kZXIuXG4gICAgICovXG4gICAgc2V0dXBQYXNzRW5jb2RlckRlZmF1bHRzKCkge1xuICAgICAgICB0aGlzLnN0ZW5jaWxSZWYgPSAwO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFN0YXJ0IGEgcmVuZGVyIHBhc3MuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vcmVuZGVyLXBhc3MuanMnKS5SZW5kZXJQYXNzfSByZW5kZXJQYXNzIC0gVGhlIHJlbmRlciBwYXNzIHRvIHN0YXJ0LlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzdGFydFBhc3MocmVuZGVyUGFzcykge1xuXG4gICAgICAgIGNvbnN0IHJ0ID0gcmVuZGVyUGFzcy5yZW5kZXJUYXJnZXQgfHwgdGhpcy5mcmFtZUJ1ZmZlcjtcbiAgICAgICAgRGVidWcuYXNzZXJ0KHJ0KTtcblxuICAgICAgICB0aGlzLnJlbmRlclRhcmdldCA9IHJ0O1xuXG4gICAgICAgIC8qKiBAdHlwZSB7V2ViZ3B1UmVuZGVyVGFyZ2V0fSAqL1xuICAgICAgICBjb25zdCB3cnQgPSBydC5pbXBsO1xuXG4gICAgICAgIFdlYmdwdURlYnVnLmludGVybmFsKHRoaXMpO1xuICAgICAgICBXZWJncHVEZWJ1Zy52YWxpZGF0ZSh0aGlzKTtcblxuICAgICAgICAvLyBmcmFtZWJ1ZmZlciBpcyBpbml0aWFsaXplZCBhdCB0aGUgc3RhcnQgb2YgdGhlIGZyYW1lXG4gICAgICAgIGlmIChydCAhPT0gdGhpcy5mcmFtZUJ1ZmZlcikge1xuICAgICAgICAgICAgdGhpcy5pbml0UmVuZGVyVGFyZ2V0KHJ0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHNldCB1cCBjbGVhciAvIHN0b3JlIC8gbG9hZCBzZXR0aW5nc1xuICAgICAgICB3cnQuc2V0dXBGb3JSZW5kZXJQYXNzKHJlbmRlclBhc3MpO1xuXG4gICAgICAgIC8vIGNyZWF0ZSBhIG5ldyBlbmNvZGVyIGZvciBlYWNoIHBhc3MgdG8ga2VlcCB0aGUgR1BVIGJ1c3kgd2l0aCBjb21tYW5kc1xuICAgICAgICB0aGlzLmNvbW1hbmRFbmNvZGVyID0gdGhpcy53Z3B1LmNyZWF0ZUNvbW1hbmRFbmNvZGVyKCk7XG4gICAgICAgIERlYnVnSGVscGVyLnNldExhYmVsKHRoaXMuY29tbWFuZEVuY29kZXIsIHJlbmRlclBhc3MubmFtZSk7XG5cbiAgICAgICAgLy8gY2xlYXIgY2FjaGVkIGVuY29kZXIgc3RhdGVcbiAgICAgICAgdGhpcy5waXBlbGluZSA9IG51bGw7XG5cbiAgICAgICAgLy8gc3RhcnQgdGhlIHBhc3NcbiAgICAgICAgdGhpcy5wYXNzRW5jb2RlciA9IHRoaXMuY29tbWFuZEVuY29kZXIuYmVnaW5SZW5kZXJQYXNzKHdydC5yZW5kZXJQYXNzRGVzY3JpcHRvcik7XG4gICAgICAgIERlYnVnSGVscGVyLnNldExhYmVsKHRoaXMucGFzc0VuY29kZXIsIHJlbmRlclBhc3MubmFtZSk7XG5cbiAgICAgICAgdGhpcy5zZXR1cFBhc3NFbmNvZGVyRGVmYXVsdHMoKTtcblxuICAgICAgICAvLyB0aGUgcGFzcyBhbHdheXMgY2xlYXJzIGZ1bGwgdGFyZ2V0XG4gICAgICAgIC8vIFRPRE86IGF2b2lkIHRoaXMgc2V0dGluZyB0aGUgYWN0dWFsIHZpZXdwb3J0L3NjaXNzb3Igb24gd2ViZ3B1IGFzIHRob3NlIGFyZSBhdXRvbWF0aWNhbGx5IHJlc2V0IHRvIGZ1bGxcbiAgICAgICAgLy8gcmVuZGVyIHRhcmdldC4gV2UganVzdCBuZWVkIHRvIHVwZGF0ZSBpbnRlcm5hbCBzdGF0ZSwgZm9yIHRoZSBnZXQgZnVuY3Rpb25hbGl0eSB0byByZXR1cm4gaXQuXG4gICAgICAgIGNvbnN0IHsgd2lkdGgsIGhlaWdodCB9ID0gcnQ7XG4gICAgICAgIHRoaXMuc2V0Vmlld3BvcnQoMCwgMCwgd2lkdGgsIGhlaWdodCk7XG4gICAgICAgIHRoaXMuc2V0U2Npc3NvcigwLCAwLCB3aWR0aCwgaGVpZ2h0KTtcblxuICAgICAgICBEZWJ1Zy5hc3NlcnQoIXRoaXMuaW5zaWRlUmVuZGVyUGFzcywgJ1JlbmRlclBhc3MgY2Fubm90IGJlIHN0YXJ0ZWQgd2hpbGUgaW5zaWRlIGFub3RoZXIgcmVuZGVyIHBhc3MuJyk7XG4gICAgICAgIHRoaXMuaW5zaWRlUmVuZGVyUGFzcyA9IHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRW5kIGEgcmVuZGVyIHBhc3MuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vcmVuZGVyLXBhc3MuanMnKS5SZW5kZXJQYXNzfSByZW5kZXJQYXNzIC0gVGhlIHJlbmRlciBwYXNzIHRvIGVuZC5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZW5kUGFzcyhyZW5kZXJQYXNzKSB7XG5cbiAgICAgICAgdGhpcy5wYXNzRW5jb2Rlci5lbmQoKTtcbiAgICAgICAgdGhpcy5wYXNzRW5jb2RlciA9IG51bGw7XG5cbiAgICAgICAgdGhpcy53Z3B1LnF1ZXVlLnN1Ym1pdChbdGhpcy5jb21tYW5kRW5jb2Rlci5maW5pc2goKV0pO1xuICAgICAgICB0aGlzLmNvbW1hbmRFbmNvZGVyID0gbnVsbDtcblxuICAgICAgICBXZWJncHVEZWJ1Zy5lbmQodGhpcywgeyByZW5kZXJQYXNzIH0pO1xuICAgICAgICBXZWJncHVEZWJ1Zy5lbmQodGhpcywgeyByZW5kZXJQYXNzIH0pO1xuXG4gICAgICAgIC8vIGVhY2ggcmVuZGVyIHBhc3MgY2FuIHVzZSBkaWZmZXJlbnQgbnVtYmVyIG9mIGJpbmQgZ3JvdXBzXG4gICAgICAgIHRoaXMuYmluZEdyb3VwRm9ybWF0cy5sZW5ndGggPSAwO1xuXG4gICAgICAgIHRoaXMuaW5zaWRlUmVuZGVyUGFzcyA9IGZhbHNlO1xuXG4gICAgICAgIC8vIGdlbmVyYXRlIG1pcG1hcHNcbiAgICAgICAgaWYgKHJlbmRlclBhc3MuY29sb3JPcHMubWlwbWFwcykge1xuICAgICAgICAgICAgdGhpcy5taXBtYXBSZW5kZXJlci5nZW5lcmF0ZShyZW5kZXJQYXNzLnJlbmRlclRhcmdldC5jb2xvckJ1ZmZlci5pbXBsKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNsZWFyKG9wdGlvbnMpIHtcbiAgICAgICAgaWYgKG9wdGlvbnMuZmxhZ3MpIHtcbiAgICAgICAgICAgIHRoaXMuY2xlYXJSZW5kZXJlci5jbGVhcih0aGlzLCB0aGlzLnJlbmRlclRhcmdldCwgb3B0aW9ucywgdGhpcy5kZWZhdWx0Q2xlYXJPcHRpb25zKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCB3aWR0aCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3dpZHRoO1xuICAgIH1cblxuICAgIGdldCBoZWlnaHQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9oZWlnaHQ7XG4gICAgfVxuXG4gICAgc2V0RGVwdGhCaWFzKG9uKSB7XG4gICAgfVxuXG4gICAgc2V0RGVwdGhCaWFzVmFsdWVzKGNvbnN0Qmlhcywgc2xvcGVCaWFzKSB7XG4gICAgfVxuXG4gICAgc2V0Vmlld3BvcnQoeCwgeSwgdywgaCkge1xuICAgICAgICAvLyBUT0RPOiBvbmx5IGV4ZWN1dGUgd2hlbiBpdCBjaGFuZ2VzLiBBbHNvLCB0aGUgdmlld3BvcnQgb2YgZW5jb2RlciAgbWF0Y2hlcyB0aGUgcmVuZGVyaW5nIGF0dGFjaG1lbnRzLFxuICAgICAgICAvLyBzbyB3ZSBjYW4gc2tpcCB0aGlzIGlmIGZ1bGxzY3JlZW5cbiAgICAgICAgLy8gVE9ETzogdGhpcyBjb25kaXRpb24gc2hvdWxkIGJlIHJlbW92ZWQsIGl0J3MgaGVyZSB0byBoYW5kbGUgZmFrZSBncmFiIHBhc3MsIHdoaWNoIHNob3VsZCBiZSByZWZhY3RvcmVkIGluc3RlYWRcbiAgICAgICAgaWYgKHRoaXMucGFzc0VuY29kZXIpIHtcblxuICAgICAgICAgICAgaWYgKCF0aGlzLnJlbmRlclRhcmdldC5mbGlwWSkge1xuICAgICAgICAgICAgICAgIHkgPSB0aGlzLnJlbmRlclRhcmdldC5oZWlnaHQgLSB5IC0gaDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy52eCA9IHg7XG4gICAgICAgICAgICB0aGlzLnZ5ID0geTtcbiAgICAgICAgICAgIHRoaXMudncgPSB3O1xuICAgICAgICAgICAgdGhpcy52aCA9IGg7XG5cbiAgICAgICAgICAgIHRoaXMucGFzc0VuY29kZXIuc2V0Vmlld3BvcnQoeCwgeSwgdywgaCwgMCwgMSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRTY2lzc29yKHgsIHksIHcsIGgpIHtcbiAgICAgICAgLy8gVE9ETzogb25seSBleGVjdXRlIHdoZW4gaXQgY2hhbmdlcy4gQWxzbywgdGhlIHZpZXdwb3J0IG9mIGVuY29kZXIgIG1hdGNoZXMgdGhlIHJlbmRlcmluZyBhdHRhY2htZW50cyxcbiAgICAgICAgLy8gc28gd2UgY2FuIHNraXAgdGhpcyBpZiBmdWxsc2NyZWVuXG4gICAgICAgIC8vIFRPRE86IHRoaXMgY29uZGl0aW9uIHNob3VsZCBiZSByZW1vdmVkLCBpdCdzIGhlcmUgdG8gaGFuZGxlIGZha2UgZ3JhYiBwYXNzLCB3aGljaCBzaG91bGQgYmUgcmVmYWN0b3JlZCBpbnN0ZWFkXG4gICAgICAgIGlmICh0aGlzLnBhc3NFbmNvZGVyKSB7XG5cbiAgICAgICAgICAgIGlmICghdGhpcy5yZW5kZXJUYXJnZXQuZmxpcFkpIHtcbiAgICAgICAgICAgICAgICB5ID0gdGhpcy5yZW5kZXJUYXJnZXQuaGVpZ2h0IC0geSAtIGg7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuc3ggPSB4O1xuICAgICAgICAgICAgdGhpcy5zeSA9IHk7XG4gICAgICAgICAgICB0aGlzLnN3ID0gdztcbiAgICAgICAgICAgIHRoaXMuc2ggPSBoO1xuXG4gICAgICAgICAgICB0aGlzLnBhc3NFbmNvZGVyLnNldFNjaXNzb3JSZWN0KHgsIHksIHcsIGgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29waWVzIHNvdXJjZSByZW5kZXIgdGFyZ2V0IGludG8gZGVzdGluYXRpb24gcmVuZGVyIHRhcmdldC4gTW9zdGx5IHVzZWQgYnkgcG9zdC1lZmZlY3RzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtSZW5kZXJUYXJnZXR9IFtzb3VyY2VdIC0gVGhlIHNvdXJjZSByZW5kZXIgdGFyZ2V0LiBEZWZhdWx0cyB0byBmcmFtZSBidWZmZXIuXG4gICAgICogQHBhcmFtIHtSZW5kZXJUYXJnZXR9IFtkZXN0XSAtIFRoZSBkZXN0aW5hdGlvbiByZW5kZXIgdGFyZ2V0LiBEZWZhdWx0cyB0byBmcmFtZSBidWZmZXIuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbY29sb3JdIC0gSWYgdHJ1ZSB3aWxsIGNvcHkgdGhlIGNvbG9yIGJ1ZmZlci4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbZGVwdGhdIC0gSWYgdHJ1ZSB3aWxsIGNvcHkgdGhlIGRlcHRoIGJ1ZmZlci4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIGNvcHkgd2FzIHN1Y2Nlc3NmdWwsIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKi9cbiAgICBjb3B5UmVuZGVyVGFyZ2V0KHNvdXJjZSwgZGVzdCwgY29sb3IsIGRlcHRoKSB7XG5cbiAgICAgICAgLyoqIEB0eXBlIHtHUFVFeHRlbnQzRH0gKi9cbiAgICAgICAgY29uc3QgY29weVNpemUgPSB7XG4gICAgICAgICAgICB3aWR0aDogc291cmNlID8gc291cmNlLndpZHRoIDogZGVzdC53aWR0aCxcbiAgICAgICAgICAgIGhlaWdodDogc291cmNlID8gc291cmNlLmhlaWdodCA6IGRlc3QuaGVpZ2h0LFxuICAgICAgICAgICAgZGVwdGhPckFycmF5TGF5ZXJzOiAxXG4gICAgICAgIH07XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKHRoaXMsICdDT1BZLVJUJyk7XG5cbiAgICAgICAgLy8gdXNlIGV4aXN0aW5nIG9yIGNyZWF0ZSBuZXcgZW5jb2RlciBpZiBiZXR3ZWVuIHJlbmRlciBwYXNzZXNcbiAgICAgICAgY29uc3QgY29tbWFuZEVuY29kZXIgPSB0aGlzLmNvbW1hbmRFbmNvZGVyID8/IHRoaXMud2dwdS5jcmVhdGVDb21tYW5kRW5jb2RlcigpO1xuXG4gICAgICAgIGlmIChjb2xvcikge1xuXG4gICAgICAgICAgICAvLyByZWFkIGZyb20gc3VwcGxpZWQgcmVuZGVyIHRhcmdldCwgb3IgZnJvbSB0aGUgZnJhbWVidWZmZXJcbiAgICAgICAgICAgIC8qKiBAdHlwZSB7R1BVSW1hZ2VDb3B5VGV4dHVyZX0gKi9cbiAgICAgICAgICAgIGNvbnN0IGNvcHlTcmMgPSB7XG4gICAgICAgICAgICAgICAgdGV4dHVyZTogc291cmNlID8gc291cmNlLmNvbG9yQnVmZmVyLmltcGwuZ3B1VGV4dHVyZSA6IHRoaXMucmVuZGVyVGFyZ2V0LmltcGwuYXNzaWduZWRDb2xvclRleHR1cmUsXG4gICAgICAgICAgICAgICAgbWlwTGV2ZWw6IDBcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIC8vIHdyaXRlIHRvIHN1cHBsaWVkIHJlbmRlciB0YXJnZXQsIG9yIHRvIHRoZSBmcmFtZWJ1ZmZlclxuICAgICAgICAgICAgLyoqIEB0eXBlIHtHUFVJbWFnZUNvcHlUZXh0dXJlfSAqL1xuICAgICAgICAgICAgY29uc3QgY29weURzdCA9IHtcbiAgICAgICAgICAgICAgICB0ZXh0dXJlOiBkZXN0ID8gZGVzdC5jb2xvckJ1ZmZlci5pbXBsLmdwdVRleHR1cmUgOiB0aGlzLnJlbmRlclRhcmdldC5pbXBsLmFzc2lnbmVkQ29sb3JUZXh0dXJlLFxuICAgICAgICAgICAgICAgIG1pcExldmVsOiAwXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBEZWJ1Zy5hc3NlcnQoY29weVNyYy50ZXh0dXJlICE9PSBudWxsICYmIGNvcHlEc3QudGV4dHVyZSAhPT0gbnVsbCk7XG4gICAgICAgICAgICBjb21tYW5kRW5jb2Rlci5jb3B5VGV4dHVyZVRvVGV4dHVyZShjb3B5U3JjLCBjb3B5RHN0LCBjb3B5U2l6ZSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZGVwdGgpIHtcblxuICAgICAgICAgICAgLy8gcmVhZCBmcm9tIHN1cHBsaWVkIHJlbmRlciB0YXJnZXQsIG9yIGZyb20gdGhlIGZyYW1lYnVmZmVyXG4gICAgICAgICAgICBjb25zdCBzb3VyY2VSVCA9IHNvdXJjZSA/IHNvdXJjZSA6IHRoaXMucmVuZGVyVGFyZ2V0O1xuXG4gICAgICAgICAgICAvLyBjYW5ub3QgY29weSBkZXB0aCBmcm9tIG11bHRpc2FtcGxlZCBidWZmZXIuIE9uIFdlYkdQVSwgaXQgY2Fubm90IGJlIHJlc29sdmUgYXQgdGhlIGVuZCBvZiB0aGUgcGFzcyBlaXRoZXIsXG4gICAgICAgICAgICAvLyBhbmQgc28gd2UgbmVlZCB0byBpbXBsZW1lbnQgYSBjdXN0b20gZGVwdGggcmVzb2x2ZSBzaGFkZXIgYmFzZWQgY29weVxuICAgICAgICAgICAgLy8gVGhpcyBpcyBjdXJyZW50bHkgbmVlZGVkIGZvciB1U2NlbmVEZXB0aE1hcCB3aGVuIHRoZSBjYW1lcmEgcmVuZGVycyB0byBtdWx0aXNhbXBsZWQgcmVuZGVyIHRhcmdldFxuICAgICAgICAgICAgRGVidWcuYXNzZXJ0KHNvdXJjZS5zYW1wbGVzIDw9IDEsIGBjb3B5UmVuZGVyVGFyZ2V0IGRvZXMgbm90IGN1cnJlbnRseSBzdXBwb3J0IGNvcHkgb2YgZGVwdGggZnJvbSBtdWx0aXNhbXBsZWQgdGV4dHVyZSAke3NvdXJjZVJULm5hbWV9YCwgc291cmNlUlQpO1xuXG4gICAgICAgICAgICAvKiogQHR5cGUge0dQVUltYWdlQ29weVRleHR1cmV9ICovXG4gICAgICAgICAgICBjb25zdCBjb3B5U3JjID0ge1xuICAgICAgICAgICAgICAgIHRleHR1cmU6IHNvdXJjZVJULmltcGwuZGVwdGhUZXh0dXJlLFxuICAgICAgICAgICAgICAgIG1pcExldmVsOiAwXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAvLyB3cml0ZSB0byBzdXBwbGllZCByZW5kZXIgdGFyZ2V0LCBvciB0byB0aGUgZnJhbWVidWZmZXJcbiAgICAgICAgICAgIC8qKiBAdHlwZSB7R1BVSW1hZ2VDb3B5VGV4dHVyZX0gKi9cbiAgICAgICAgICAgIGNvbnN0IGNvcHlEc3QgPSB7XG4gICAgICAgICAgICAgICAgdGV4dHVyZTogZGVzdCA/IGRlc3QuZGVwdGhCdWZmZXIuaW1wbC5ncHVUZXh0dXJlIDogdGhpcy5yZW5kZXJUYXJnZXQuaW1wbC5kZXB0aFRleHR1cmUsXG4gICAgICAgICAgICAgICAgbWlwTGV2ZWw6IDBcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIERlYnVnLmFzc2VydChjb3B5U3JjLnRleHR1cmUgIT09IG51bGwgJiYgY29weURzdC50ZXh0dXJlICE9PSBudWxsKTtcbiAgICAgICAgICAgIGNvbW1hbmRFbmNvZGVyLmNvcHlUZXh0dXJlVG9UZXh0dXJlKGNvcHlTcmMsIGNvcHlEc3QsIGNvcHlTaXplKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHN1Ym1pdCB0aGUgZW5jb2RlZCBjb21tYW5kcyBpZiB3ZSBjcmVhdGVkIHRoZSBlbmNvZGVyXG4gICAgICAgIGlmICghdGhpcy5jb21tYW5kRW5jb2Rlcikge1xuICAgICAgICAgICAgdGhpcy53Z3B1LnF1ZXVlLnN1Ym1pdChbY29tbWFuZEVuY29kZXIuZmluaXNoKCldKTtcbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKHRoaXMpO1xuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8vICNpZiBfREVCVUdcbiAgICBwdXNoTWFya2VyKG5hbWUpIHtcbiAgICAgICAgdGhpcy5wYXNzRW5jb2Rlcj8ucHVzaERlYnVnR3JvdXAobmFtZSk7XG4gICAgfVxuXG4gICAgcG9wTWFya2VyKCkge1xuICAgICAgICB0aGlzLnBhc3NFbmNvZGVyPy5wb3BEZWJ1Z0dyb3VwKCk7XG4gICAgfVxuICAgIC8vICNlbmRpZlxufVxuXG5leHBvcnQgeyBXZWJncHVHcmFwaGljc0RldmljZSB9O1xuIl0sIm5hbWVzIjpbIldlYmdwdUdyYXBoaWNzRGV2aWNlIiwiR3JhcGhpY3NEZXZpY2UiLCJjb25zdHJ1Y3RvciIsImNhbnZhcyIsIm9wdGlvbnMiLCJmcmFtZUJ1ZmZlciIsInJlbmRlclBpcGVsaW5lIiwiV2ViZ3B1UmVuZGVyUGlwZWxpbmUiLCJjbGVhclJlbmRlcmVyIiwibWlwbWFwUmVuZGVyZXIiLCJwaXBlbGluZSIsImJpbmRHcm91cEZvcm1hdHMiLCJjb21tYW5kRW5jb2RlciIsImluaXRPcHRpb25zIiwiaXNXZWJHUFUiLCJfZGV2aWNlVHlwZSIsIkRFVklDRVRZUEVfV0VCR1BVIiwic2FtcGxlcyIsImFudGlhbGlhcyIsInNldHVwUGFzc0VuY29kZXJEZWZhdWx0cyIsImRlc3Ryb3kiLCJpbml0RGV2aWNlQ2FwcyIsImRpc2FibGVQYXJ0aWNsZVN5c3RlbSIsImxpbWl0cyIsImdwdUFkYXB0ZXIiLCJwcmVjaXNpb24iLCJtYXhQcmVjaXNpb24iLCJtYXhTYW1wbGVzIiwibWF4VGV4dHVyZXMiLCJtYXhUZXh0dXJlU2l6ZSIsIm1heFRleHR1cmVEaW1lbnNpb24yRCIsIm1heEN1YmVNYXBTaXplIiwibWF4Vm9sdW1lU2l6ZSIsIm1heFRleHR1cmVEaW1lbnNpb24zRCIsIm1heFBpeGVsUmF0aW8iLCJzdXBwb3J0c0luc3RhbmNpbmciLCJzdXBwb3J0c1VuaWZvcm1CdWZmZXJzIiwic3VwcG9ydHNCb25lVGV4dHVyZXMiLCJzdXBwb3J0c01vcnBoVGFyZ2V0VGV4dHVyZXNDb3JlIiwic3VwcG9ydHNBcmVhTGlnaHRzIiwic3VwcG9ydHNEZXB0aFNoYWRvdyIsInN1cHBvcnRzR3B1UGFydGljbGVzIiwiZXh0VWludEVsZW1lbnQiLCJleHRUZXh0dXJlRmxvYXQiLCJ0ZXh0dXJlRmxvYXRSZW5kZXJhYmxlIiwiZXh0VGV4dHVyZUhhbGZGbG9hdCIsInRleHR1cmVIYWxmRmxvYXRSZW5kZXJhYmxlIiwidGV4dHVyZUhhbGZGbG9hdFVwZGF0YWJsZSIsImJvbmVMaW1pdCIsInN1cHBvcnRzSW1hZ2VCaXRtYXAiLCJleHRTdGFuZGFyZERlcml2YXRpdmVzIiwiZXh0QmxlbmRNaW5tYXgiLCJhcmVhTGlnaHRMdXRGb3JtYXQiLCJmbG9hdEZpbHRlcmFibGUiLCJQSVhFTEZPUk1BVF9SR0JBMzJGIiwiUElYRUxGT1JNQVRfUkdCQTgiLCJzdXBwb3J0c1RleHR1cmVGZXRjaCIsImluaXRXZWJHcHUiLCJnbHNsYW5nVXJsIiwidHdnc2xVcmwiLCJ3aW5kb3ciLCJuYXZpZ2F0b3IiLCJncHUiLCJFcnJvciIsIkRlYnVnIiwibG9nIiwibG9hZFNjcmlwdCIsInVybCIsIlByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0Iiwic2NyaXB0IiwiZG9jdW1lbnQiLCJjcmVhdGVFbGVtZW50Iiwic3JjIiwiYXN5bmMiLCJvbmxvYWQiLCJvbmVycm9yIiwiYm9keSIsImFwcGVuZENoaWxkIiwiZ2xzbGFuZyIsIndhc21QYXRoIiwicmVwbGFjZSIsInR3Z3NsIiwicmVxdWVzdEFkYXB0ZXIiLCJyZXF1aXJlZEZlYXR1cmVzIiwicmVxdWlyZUZlYXR1cmUiLCJmZWF0dXJlIiwiZmVhdHVyZXMiLCJoYXMiLCJwdXNoIiwid2dwdSIsInJlcXVlc3REZXZpY2UiLCJyZXF1aXJlZExpbWl0cyIsInNldFJlc29sdXRpb24iLCJpbm5lcldpZHRoIiwiaW5uZXJIZWlnaHQiLCJncHVDb250ZXh0IiwiZ2V0Q29udGV4dCIsInByZWZlcnJlZENhbnZhc0Zvcm1hdCIsImdldFByZWZlcnJlZENhbnZhc0Zvcm1hdCIsImZyYW1lYnVmZmVyRm9ybWF0IiwiUElYRUxGT1JNQVRfQkdSQTgiLCJjYW52YXNDb25maWciLCJkZXZpY2UiLCJjb2xvclNwYWNlIiwiYWxwaGFNb2RlIiwiZm9ybWF0IiwidXNhZ2UiLCJHUFVUZXh0dXJlVXNhZ2UiLCJSRU5ERVJfQVRUQUNITUVOVCIsIkNPUFlfU1JDIiwiQ09QWV9EU1QiLCJ2aWV3Rm9ybWF0cyIsImNvbmZpZ3VyZSIsImNyZWF0ZUZyYW1lYnVmZmVyIiwiV2ViZ3B1Q2xlYXJSZW5kZXJlciIsIldlYmdwdU1pcG1hcFJlbmRlcmVyIiwicG9zdEluaXQiLCJzdXBwb3J0c1N0ZW5jaWwiLCJzdGVuY2lsIiwiZnJhbWVCdWZmZXJEaW1lbnNpb25zIiwiVmVjMiIsIlJlbmRlclRhcmdldCIsIm5hbWUiLCJncmFwaGljc0RldmljZSIsImRlcHRoIiwicmVzaXplQ2FudmFzIiwid2lkdGgiLCJoZWlnaHQiLCJfd2lkdGgiLCJfaGVpZ2h0IiwiZmlyZSIsIkVWRU5UX1JFU0laRSIsImZyYW1lU3RhcnQiLCJXZWJncHVEZWJ1ZyIsIm1lbW9yeSIsInZhbGlkYXRlIiwib3V0Q29sb3JCdWZmZXIiLCJnZXRDdXJyZW50VGV4dHVyZSIsIkRlYnVnSGVscGVyIiwic2V0TGFiZWwiLCJ4IiwieSIsInNldCIsInJ0Iiwid3J0IiwiaW1wbCIsImNvbG9yRm9ybWF0IiwiaW5pdFJlbmRlclRhcmdldCIsImFzc2lnbkNvbG9yVGV4dHVyZSIsImVuZCIsImNyZWF0ZVVuaWZvcm1CdWZmZXJJbXBsIiwidW5pZm9ybUJ1ZmZlciIsIldlYmdwdVVuaWZvcm1CdWZmZXIiLCJjcmVhdGVWZXJ0ZXhCdWZmZXJJbXBsIiwidmVydGV4QnVmZmVyIiwiV2ViZ3B1VmVydGV4QnVmZmVyIiwiY3JlYXRlSW5kZXhCdWZmZXJJbXBsIiwiaW5kZXhCdWZmZXIiLCJXZWJncHVJbmRleEJ1ZmZlciIsImNyZWF0ZVNoYWRlckltcGwiLCJzaGFkZXIiLCJXZWJncHVTaGFkZXIiLCJjcmVhdGVUZXh0dXJlSW1wbCIsInRleHR1cmUiLCJXZWJncHVUZXh0dXJlIiwiY3JlYXRlUmVuZGVyVGFyZ2V0SW1wbCIsInJlbmRlclRhcmdldCIsIldlYmdwdVJlbmRlclRhcmdldCIsImNyZWF0ZUJpbmRHcm91cEZvcm1hdEltcGwiLCJiaW5kR3JvdXBGb3JtYXQiLCJXZWJncHVCaW5kR3JvdXBGb3JtYXQiLCJjcmVhdGVCaW5kR3JvdXBJbXBsIiwiYmluZEdyb3VwIiwiV2ViZ3B1QmluZEdyb3VwIiwic2V0QmluZEdyb3VwIiwiaW5kZXgiLCJwYXNzRW5jb2RlciIsInN1Ym1pdFZlcnRleEJ1ZmZlciIsInNsb3QiLCJlbGVtZW50Q291bnQiLCJlbGVtZW50cyIsImxlbmd0aCIsInZiQnVmZmVyIiwiYnVmZmVyIiwiaSIsImVsZW1lbnQiLCJzZXRWZXJ0ZXhCdWZmZXIiLCJvZmZzZXQiLCJkcmF3IiwicHJpbWl0aXZlIiwibnVtSW5zdGFuY2VzIiwia2VlcEJ1ZmZlcnMiLCJyZWFkeSIsImZhaWxlZCIsImFzc2VydCIsInZiMCIsInZlcnRleEJ1ZmZlcnMiLCJ2YjEiLCJ2YlNsb3QiLCJnZXQiLCJibGVuZFN0YXRlIiwiZGVwdGhTdGF0ZSIsImN1bGxNb2RlIiwic3RlbmNpbEVuYWJsZWQiLCJzdGVuY2lsRnJvbnQiLCJzdGVuY2lsQmFjayIsInNldFBpcGVsaW5lIiwiaWIiLCJzZXRJbmRleEJ1ZmZlciIsImRyYXdJbmRleGVkIiwiY291bnQiLCJzZXRTaGFkZXIiLCJfc2hhZGVyU3dpdGNoZXNQZXJGcmFtZSIsInNldEJsZW5kU3RhdGUiLCJjb3B5Iiwic2V0RGVwdGhTdGF0ZSIsInNldFN0ZW5jaWxTdGF0ZSIsIlN0ZW5jaWxQYXJhbWV0ZXJzIiwiREVGQVVMVCIsInJlZiIsInN0ZW5jaWxSZWYiLCJzZXRTdGVuY2lsUmVmZXJlbmNlIiwic2V0QmxlbmRDb2xvciIsInIiLCJnIiwiYiIsImEiLCJzZXRDdWxsTW9kZSIsInNldEFscGhhVG9Db3ZlcmFnZSIsInN0YXRlIiwiaW5pdGlhbGl6ZUNvbnRleHRDYWNoZXMiLCJzdGFydFBhc3MiLCJyZW5kZXJQYXNzIiwiaW50ZXJuYWwiLCJzZXR1cEZvclJlbmRlclBhc3MiLCJjcmVhdGVDb21tYW5kRW5jb2RlciIsImJlZ2luUmVuZGVyUGFzcyIsInJlbmRlclBhc3NEZXNjcmlwdG9yIiwic2V0Vmlld3BvcnQiLCJzZXRTY2lzc29yIiwiaW5zaWRlUmVuZGVyUGFzcyIsImVuZFBhc3MiLCJxdWV1ZSIsInN1Ym1pdCIsImZpbmlzaCIsImNvbG9yT3BzIiwibWlwbWFwcyIsImdlbmVyYXRlIiwiY29sb3JCdWZmZXIiLCJjbGVhciIsImZsYWdzIiwiZGVmYXVsdENsZWFyT3B0aW9ucyIsInNldERlcHRoQmlhcyIsIm9uIiwic2V0RGVwdGhCaWFzVmFsdWVzIiwiY29uc3RCaWFzIiwic2xvcGVCaWFzIiwidyIsImgiLCJmbGlwWSIsInZ4IiwidnkiLCJ2dyIsInZoIiwic3giLCJzeSIsInN3Iiwic2giLCJzZXRTY2lzc29yUmVjdCIsImNvcHlSZW5kZXJUYXJnZXQiLCJzb3VyY2UiLCJkZXN0IiwiY29sb3IiLCJfdGhpcyRjb21tYW5kRW5jb2RlciIsImNvcHlTaXplIiwiZGVwdGhPckFycmF5TGF5ZXJzIiwiRGVidWdHcmFwaGljcyIsInB1c2hHcHVNYXJrZXIiLCJjb3B5U3JjIiwiZ3B1VGV4dHVyZSIsImFzc2lnbmVkQ29sb3JUZXh0dXJlIiwibWlwTGV2ZWwiLCJjb3B5RHN0IiwiY29weVRleHR1cmVUb1RleHR1cmUiLCJzb3VyY2VSVCIsImRlcHRoVGV4dHVyZSIsImRlcHRoQnVmZmVyIiwicG9wR3B1TWFya2VyIiwicHVzaE1hcmtlciIsIl90aGlzJHBhc3NFbmNvZGVyIiwicHVzaERlYnVnR3JvdXAiLCJwb3BNYXJrZXIiLCJfdGhpcyRwYXNzRW5jb2RlcjIiLCJwb3BEZWJ1Z0dyb3VwIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQXdCQSxNQUFNQSxvQkFBb0IsU0FBU0MsY0FBYyxDQUFDO0FBQzlDO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBR0lDLEVBQUFBLFdBQVdBLENBQUNDLE1BQU0sRUFBRUMsT0FBTyxHQUFHLEVBQUUsRUFBRTtBQUM5QixJQUFBLEtBQUssQ0FBQ0QsTUFBTSxFQUFFQyxPQUFPLENBQUMsQ0FBQTtBQUFDLElBQUEsSUFBQSxDQTdDM0JDLFdBQVcsR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUFBLElBQUEsSUFBQSxDQUtYQyxjQUFjLEdBQUcsSUFBSUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLENBQUE7QUFBQSxJQUFBLElBQUEsQ0FPL0NDLGFBQWEsR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUFBLElBQUEsSUFBQSxDQU9iQyxjQUFjLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFBQSxJQUFBLElBQUEsQ0FRZEMsUUFBUSxHQUFBLEtBQUEsQ0FBQSxDQUFBO0lBQUEsSUFPUkMsQ0FBQUEsZ0JBQWdCLEdBQUcsRUFBRSxDQUFBO0FBQUEsSUFBQSxJQUFBLENBUXJCQyxjQUFjLEdBQUEsS0FBQSxDQUFBLENBQUE7SUFJVlIsT0FBTyxHQUFHLElBQUksQ0FBQ1MsV0FBVyxDQUFBO0lBRTFCLElB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
