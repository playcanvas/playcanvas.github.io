/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Debug, DebugHelper } from '../../../core/debug.js';
import { Vec2 } from '../../../core/math/vec2.js';
import { DEVICETYPE_WEBGPU, PIXELFORMAT_RGBA32F, PIXELFORMAT_RGBA8, PIXELFORMAT_BGRA8, CULLFACE_BACK } from '../constants.js';
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
import { DebugGraphics } from '../debug-graphics.js';
import { WebgpuDebug } from './webgpu-debug.js';

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
    super(canvas);
    this.frameBuffer = void 0;
    this.renderPipeline = new WebgpuRenderPipeline(this);
    this.clearRenderer = void 0;
    this.pipeline = void 0;
    this.bindGroupFormats = [];
    this.commandEncoder = void 0;
    this.isWebGPU = true;
    this._deviceType = DEVICETYPE_WEBGPU;

    // WebGPU currently only supports 1 and 4 samples
    this.samples = options.antialias ? 4 : 1;
  }

  /**
   * Destroy the graphics device.
   */
  destroy() {
    super.destroy();
  }
  initDeviceCaps() {
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

      // use prefered format for optimal performance on mobile
      format: preferredCanvasFormat,
      // RENDER_ATTACHMENT is required, COPY_SRC allows scene grab to copy out from it
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
      // formats that views created from textures returned by getCurrentTexture may use
      viewFormats: []
    };
    this.gpuContext.configure(this.canvasConfig);
    this.createFramebuffer();
    this.clearRenderer = new WebgpuClearRenderer(this);
    this.postInit();
    return this;
  }
  createFramebuffer() {
    this.frameBufferDimensions = new Vec2();
    this.frameBuffer = new RenderTarget({
      name: 'WebgpuFramebuffer',
      graphicsDevice: this,
      depth: true,
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
      const pipeline = this.renderPipeline.get(primitive, vb0 == null ? void 0 : vb0.format, vb1 == null ? void 0 : vb1.format, this.shader, this.renderTarget, this.bindGroupFormats, this.blendState, this.depthState);
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
  setBlendColor(r, g, b, a) {
    // TODO: this should use passEncoder.setBlendConstant(color)
  }
  setDepthFunc(func) {}
  setDepthTest(depthTest) {}
  setCullMode(cullMode) {}
  getCullMode() {
    return CULLFACE_BACK;
  }
  setAlphaToCoverage(state) {}
  setDepthWrite(writeDepth) {}
  initializeContextCaches() {
    super.initializeContextCaches();
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
  setStencilTest(enable) {}
  setStencilFunc(func, ref, mask) {}
  setStencilOperation(fail, zfail, zpass, writeMask) {}
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViZ3B1LWdyYXBoaWNzLWRldmljZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL3BsYXRmb3JtL2dyYXBoaWNzL3dlYmdwdS93ZWJncHUtZ3JhcGhpY3MtZGV2aWNlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnLCBEZWJ1Z0hlbHBlciB9IGZyb20gJy4uLy4uLy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgVmVjMiB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC92ZWMyLmpzJztcblxuaW1wb3J0IHtcbiAgICBQSVhFTEZPUk1BVF9SR0JBMzJGLCBQSVhFTEZPUk1BVF9SR0JBOCwgUElYRUxGT1JNQVRfQkdSQTgsIENVTExGQUNFX0JBQ0ssIERFVklDRVRZUEVfV0VCR1BVXG59IGZyb20gJy4uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBHcmFwaGljc0RldmljZSB9IGZyb20gJy4uL2dyYXBoaWNzLWRldmljZS5qcyc7XG5pbXBvcnQgeyBSZW5kZXJUYXJnZXQgfSBmcm9tICcuLi9yZW5kZXItdGFyZ2V0LmpzJztcblxuaW1wb3J0IHsgV2ViZ3B1QmluZEdyb3VwIH0gZnJvbSAnLi93ZWJncHUtYmluZC1ncm91cC5qcyc7XG5pbXBvcnQgeyBXZWJncHVCaW5kR3JvdXBGb3JtYXQgfSBmcm9tICcuL3dlYmdwdS1iaW5kLWdyb3VwLWZvcm1hdC5qcyc7XG5pbXBvcnQgeyBXZWJncHVJbmRleEJ1ZmZlciB9IGZyb20gJy4vd2ViZ3B1LWluZGV4LWJ1ZmZlci5qcyc7XG5pbXBvcnQgeyBXZWJncHVSZW5kZXJQaXBlbGluZSB9IGZyb20gJy4vd2ViZ3B1LXJlbmRlci1waXBlbGluZS5qcyc7XG5pbXBvcnQgeyBXZWJncHVSZW5kZXJUYXJnZXQgfSBmcm9tICcuL3dlYmdwdS1yZW5kZXItdGFyZ2V0LmpzJztcbmltcG9ydCB7IFdlYmdwdVNoYWRlciB9IGZyb20gJy4vd2ViZ3B1LXNoYWRlci5qcyc7XG5pbXBvcnQgeyBXZWJncHVUZXh0dXJlIH0gZnJvbSAnLi93ZWJncHUtdGV4dHVyZS5qcyc7XG5pbXBvcnQgeyBXZWJncHVVbmlmb3JtQnVmZmVyIH0gZnJvbSAnLi93ZWJncHUtdW5pZm9ybS1idWZmZXIuanMnO1xuaW1wb3J0IHsgV2ViZ3B1VmVydGV4QnVmZmVyIH0gZnJvbSAnLi93ZWJncHUtdmVydGV4LWJ1ZmZlci5qcyc7XG5pbXBvcnQgeyBXZWJncHVDbGVhclJlbmRlcmVyIH0gZnJvbSAnLi93ZWJncHUtY2xlYXItcmVuZGVyZXIuanMnO1xuaW1wb3J0IHsgRGVidWdHcmFwaGljcyB9IGZyb20gJy4uL2RlYnVnLWdyYXBoaWNzLmpzJztcbmltcG9ydCB7IFdlYmdwdURlYnVnIH0gZnJvbSAnLi93ZWJncHUtZGVidWcuanMnO1xuXG5jbGFzcyBXZWJncHVHcmFwaGljc0RldmljZSBleHRlbmRzIEdyYXBoaWNzRGV2aWNlIHtcbiAgICAvKipcbiAgICAgKiBUaGUgcmVuZGVyIHRhcmdldCByZXByZXNlbnRpbmcgdGhlIG1haW4gZnJhbWVidWZmZXIuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7UmVuZGVyVGFyZ2V0fVxuICAgICAqL1xuICAgIGZyYW1lQnVmZmVyO1xuXG4gICAgLyoqXG4gICAgICogT2JqZWN0IHJlc3BvbnNpYmxlIGZvciBjYWNoaW5nIGFuZCBjcmVhdGlvbiBvZiByZW5kZXIgcGlwZWxpbmVzLlxuICAgICAqL1xuICAgIHJlbmRlclBpcGVsaW5lID0gbmV3IFdlYmdwdVJlbmRlclBpcGVsaW5lKHRoaXMpO1xuXG4gICAgLyoqXG4gICAgICogT2JqZWN0IHJlc3BvbnNpYmxlIGZvciBjbGVhcmluZyB0aGUgcmVuZGVyaW5nIHN1cmZhY2UgYnkgcmVuZGVyaW5nIGEgcXVhZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHsgV2ViZ3B1Q2xlYXJSZW5kZXJlciB9XG4gICAgICovXG4gICAgY2xlYXJSZW5kZXJlcjtcblxuICAgIC8qKlxuICAgICAqIFJlbmRlciBwaXBlbGluZSBjdXJyZW50bHkgc2V0IG9uIHRoZSBkZXZpY2UuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7R1BVUmVuZGVyUGlwZWxpbmV9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBwaXBlbGluZTtcblxuICAgIC8qKlxuICAgICAqIEFuIGFycmF5IG9mIGJpbmQgZ3JvdXAgZm9ybWF0cywgYmFzZWQgb24gY3VycmVudGx5IGFzc2lnbmVkIGJpbmQgZ3JvdXBzXG4gICAgICpcbiAgICAgKiBAdHlwZSB7V2ViZ3B1QmluZEdyb3VwRm9ybWF0W119XG4gICAgICovXG4gICAgYmluZEdyb3VwRm9ybWF0cyA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogQ3VycmVudCBjb21tYW5kIGJ1ZmZlciBlbmNvZGVyLlxuICAgICAqXG4gICAgICogQHR5cGUge0dQVUNvbW1hbmRFbmNvZGVyfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgY29tbWFuZEVuY29kZXI7XG5cbiAgICBjb25zdHJ1Y3RvcihjYW52YXMsIG9wdGlvbnMgPSB7fSkge1xuICAgICAgICBzdXBlcihjYW52YXMpO1xuICAgICAgICB0aGlzLmlzV2ViR1BVID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fZGV2aWNlVHlwZSA9IERFVklDRVRZUEVfV0VCR1BVO1xuXG4gICAgICAgIC8vIFdlYkdQVSBjdXJyZW50bHkgb25seSBzdXBwb3J0cyAxIGFuZCA0IHNhbXBsZXNcbiAgICAgICAgdGhpcy5zYW1wbGVzID0gb3B0aW9ucy5hbnRpYWxpYXMgPyA0IDogMTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEZXN0cm95IHRoZSBncmFwaGljcyBkZXZpY2UuXG4gICAgICovXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgc3VwZXIuZGVzdHJveSgpO1xuICAgIH1cblxuICAgIGluaXREZXZpY2VDYXBzKCkge1xuXG4gICAgICAgIGNvbnN0IGxpbWl0cyA9IHRoaXMuZ3B1QWRhcHRlci5saW1pdHM7XG5cbiAgICAgICAgdGhpcy5wcmVjaXNpb24gPSAnaGlnaHAnO1xuICAgICAgICB0aGlzLm1heFByZWNpc2lvbiA9ICdoaWdocCc7XG4gICAgICAgIHRoaXMubWF4U2FtcGxlcyA9IDQ7XG4gICAgICAgIHRoaXMubWF4VGV4dHVyZXMgPSAxNjtcbiAgICAgICAgdGhpcy5tYXhUZXh0dXJlU2l6ZSA9IGxpbWl0cy5tYXhUZXh0dXJlRGltZW5zaW9uMkQ7XG4gICAgICAgIHRoaXMubWF4Q3ViZU1hcFNpemUgPSBsaW1pdHMubWF4VGV4dHVyZURpbWVuc2lvbjJEO1xuICAgICAgICB0aGlzLm1heFZvbHVtZVNpemUgPSBsaW1pdHMubWF4VGV4dHVyZURpbWVuc2lvbjNEO1xuICAgICAgICB0aGlzLm1heFBpeGVsUmF0aW8gPSAxO1xuICAgICAgICB0aGlzLnN1cHBvcnRzSW5zdGFuY2luZyA9IHRydWU7XG4gICAgICAgIHRoaXMuc3VwcG9ydHNVbmlmb3JtQnVmZmVycyA9IHRydWU7XG4gICAgICAgIHRoaXMuc3VwcG9ydHNCb25lVGV4dHVyZXMgPSB0cnVlO1xuICAgICAgICB0aGlzLnN1cHBvcnRzTW9ycGhUYXJnZXRUZXh0dXJlc0NvcmUgPSB0cnVlO1xuICAgICAgICB0aGlzLnN1cHBvcnRzQXJlYUxpZ2h0cyA9IHRydWU7XG4gICAgICAgIHRoaXMuc3VwcG9ydHNEZXB0aFNoYWRvdyA9IHRydWU7XG4gICAgICAgIHRoaXMuZXh0VWludEVsZW1lbnQgPSB0cnVlO1xuICAgICAgICB0aGlzLmV4dFRleHR1cmVGbG9hdCA9IHRydWU7XG4gICAgICAgIHRoaXMudGV4dHVyZUZsb2F0UmVuZGVyYWJsZSA9IHRydWU7XG4gICAgICAgIHRoaXMuZXh0VGV4dHVyZUhhbGZGbG9hdCA9IHRydWU7XG4gICAgICAgIHRoaXMudGV4dHVyZUhhbGZGbG9hdFJlbmRlcmFibGUgPSB0cnVlO1xuICAgICAgICB0aGlzLnRleHR1cmVIYWxmRmxvYXRVcGRhdGFibGUgPSB0cnVlO1xuICAgICAgICB0aGlzLmJvbmVMaW1pdCA9IDEwMjQ7XG4gICAgICAgIHRoaXMuc3VwcG9ydHNJbWFnZUJpdG1hcCA9IHRydWU7XG4gICAgICAgIHRoaXMuZXh0U3RhbmRhcmREZXJpdmF0aXZlcyA9IHRydWU7XG4gICAgICAgIHRoaXMuZXh0QmxlbmRNaW5tYXggPSB0cnVlO1xuICAgICAgICB0aGlzLmFyZWFMaWdodEx1dEZvcm1hdCA9IHRoaXMuZmxvYXRGaWx0ZXJhYmxlID8gUElYRUxGT1JNQVRfUkdCQTMyRiA6IFBJWEVMRk9STUFUX1JHQkE4O1xuICAgICAgICB0aGlzLnN1cHBvcnRzVGV4dHVyZUZldGNoID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBhc3luYyBpbml0V2ViR3B1KGdsc2xhbmdVcmwsIHR3Z3NsVXJsKSB7XG5cbiAgICAgICAgaWYgKCF3aW5kb3cubmF2aWdhdG9yLmdwdSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmFibGUgdG8gcmV0cmlldmUgR1BVLiBFbnN1cmUgeW91IGFyZSB1c2luZyBhIGJyb3dzZXIgdGhhdCBzdXBwb3J0cyBXZWJHUFUgcmVuZGVyaW5nLicpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gdGVtcG9yYXJ5IG1lc3NhZ2UgdG8gY29uZmlybSBXZWJncHUgaXMgYmVpbmcgdXNlZFxuICAgICAgICBEZWJ1Zy5sb2coXCJXZWJncHVHcmFwaGljc0RldmljZSBpbml0aWFsaXphdGlvbiAuLlwiKTtcblxuICAgICAgICBjb25zdCBsb2FkU2NyaXB0ID0gKHVybCkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBzY3JpcHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzY3JpcHQnKTtcbiAgICAgICAgICAgICAgICBzY3JpcHQuc3JjID0gdXJsO1xuICAgICAgICAgICAgICAgIHNjcmlwdC5hc3luYyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIHNjcmlwdC5vbmxvYWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUodXJsKTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIHNjcmlwdC5vbmVycm9yID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICByZWplY3QobmV3IEVycm9yKGBGYWlsZWQgdG8gZG93bmxvYWQgc2NyaXB0ICR7dXJsfWApKTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoc2NyaXB0KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8vIFRPRE86IGFkZCBib3RoIGxvYWRTY3JpcHQgY2FsbHMgYW5kIHJlcXVlc3RBZGFwdGVyIHRvIHByb21pc2UgbGlzdCBhbmQgd2FpdCBmb3IgYWxsLlxuICAgICAgICBhd2FpdCBsb2FkU2NyaXB0KGdsc2xhbmdVcmwpO1xuICAgICAgICBhd2FpdCBsb2FkU2NyaXB0KHR3Z3NsVXJsKTtcblxuICAgICAgICB0aGlzLmdsc2xhbmcgPSBhd2FpdCBnbHNsYW5nKCk7XG5cbiAgICAgICAgY29uc3Qgd2FzbVBhdGggPSB0d2dzbFVybC5yZXBsYWNlKCcuanMnLCAnLndhc20nKTtcbiAgICAgICAgdGhpcy50d2dzbCA9IGF3YWl0IHR3Z3NsKHdhc21QYXRoKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge0dQVUFkYXB0ZXJ9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmdwdUFkYXB0ZXIgPSBhd2FpdCB3aW5kb3cubmF2aWdhdG9yLmdwdS5yZXF1ZXN0QWRhcHRlcigpO1xuXG4gICAgICAgIC8vIG9wdGlvbmFsIGZlYXR1cmVzOlxuICAgICAgICAvLyAgICAgIFwiZGVwdGgtY2xpcC1jb250cm9sXCIsXG4gICAgICAgIC8vICAgICAgXCJkZXB0aDMyZmxvYXQtc3RlbmNpbDhcIixcbiAgICAgICAgLy8gICAgICBcInRleHR1cmUtY29tcHJlc3Npb24tYmNcIixcbiAgICAgICAgLy8gICAgICBcInRleHR1cmUtY29tcHJlc3Npb24tZXRjMlwiLFxuICAgICAgICAvLyAgICAgIFwidGV4dHVyZS1jb21wcmVzc2lvbi1hc3RjXCIsXG4gICAgICAgIC8vICAgICAgXCJ0aW1lc3RhbXAtcXVlcnlcIixcbiAgICAgICAgLy8gICAgICBcImluZGlyZWN0LWZpcnN0LWluc3RhbmNlXCIsXG4gICAgICAgIC8vICAgICAgXCJzaGFkZXItZjE2XCIsXG4gICAgICAgIC8vICAgICAgXCJyZzExYjEwdWZsb2F0LXJlbmRlcmFibGVcIixcbiAgICAgICAgLy8gICAgICBcImJncmE4dW5vcm0tc3RvcmFnZVwiLFxuICAgICAgICAvLyAgICAgIFwiZmxvYXQzMi1maWx0ZXJhYmxlXCJcblxuICAgICAgICAvLyByZXF1ZXN0IG9wdGlvbmFsIGZlYXR1cmVzXG4gICAgICAgIGNvbnN0IHJlcXVpcmVkRmVhdHVyZXMgPSBbXTtcbiAgICAgICAgY29uc3QgcmVxdWlyZUZlYXR1cmUgPSAoZmVhdHVyZSkgPT4ge1xuICAgICAgICAgICAgaWYgKHRoaXMuZ3B1QWRhcHRlci5mZWF0dXJlcy5oYXMoZmVhdHVyZSkpIHtcbiAgICAgICAgICAgICAgICByZXF1aXJlZEZlYXR1cmVzLnB1c2goZmVhdHVyZSk7XG4gICAgICAgICAgICAgICAgRGVidWcubG9nKFwiRW5hYmxlZCBXRUJHUFUgZmVhdHVyZTogXCIgKyBmZWF0dXJlKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5mbG9hdEZpbHRlcmFibGUgPSByZXF1aXJlRmVhdHVyZSgnZmxvYXQzMi1maWx0ZXJhYmxlJyk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtHUFVEZXZpY2V9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLndncHUgPSBhd2FpdCB0aGlzLmdwdUFkYXB0ZXIucmVxdWVzdERldmljZSh7XG4gICAgICAgICAgICByZXF1aXJlZEZlYXR1cmVzLFxuXG4gICAgICAgICAgICAvLyBOb3RlIHRoYXQgd2UgY2FuIHJlcXVlc3QgbGltaXRzLCBidXQgaXQgZG9lcyBub3Qgc2VlbSB0byBiZSBzdXBwb3J0ZWQgYXQgdGhlIG1vbWVudFxuICAgICAgICAgICAgcmVxdWlyZWRMaW1pdHM6IHtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5pbml0RGV2aWNlQ2FwcygpO1xuXG4gICAgICAgIC8vIGluaXRpYWxseSBmaWxsIHRoZSB3aW5kb3cuIFRoaXMgbmVlZHMgaW1wcm92ZW1lbnQuXG4gICAgICAgIHRoaXMuc2V0UmVzb2x1dGlvbih3aW5kb3cuaW5uZXJXaWR0aCwgd2luZG93LmlubmVySGVpZ2h0KTtcblxuICAgICAgICB0aGlzLmdwdUNvbnRleHQgPSB0aGlzLmNhbnZhcy5nZXRDb250ZXh0KCd3ZWJncHUnKTtcblxuICAgICAgICAvLyBwaXhlbCBmb3JtYXQgb2YgdGhlIGZyYW1lYnVmZmVyIGlzIHRoZSBtb3N0IGVmZmljaWVudCBvbmUgb24gdGhlIHN5c3RlbVxuICAgICAgICBjb25zdCBwcmVmZXJyZWRDYW52YXNGb3JtYXQgPSBuYXZpZ2F0b3IuZ3B1LmdldFByZWZlcnJlZENhbnZhc0Zvcm1hdCgpO1xuICAgICAgICB0aGlzLmZyYW1lYnVmZmVyRm9ybWF0ID0gcHJlZmVycmVkQ2FudmFzRm9ybWF0ID09PSAncmdiYTh1bm9ybScgPyBQSVhFTEZPUk1BVF9SR0JBOCA6IFBJWEVMRk9STUFUX0JHUkE4O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDb25maWd1cmF0aW9uIG9mIHRoZSBtYWluIGNvbG9yZnJhbWVidWZmZXIgd2Ugb2J0YWluIHVzaW5nIGdldEN1cnJlbnRUZXh0dXJlXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtHUFVDYW52YXNDb25maWd1cmF0aW9ufVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5jYW52YXNDb25maWcgPSB7XG4gICAgICAgICAgICBkZXZpY2U6IHRoaXMud2dwdSxcbiAgICAgICAgICAgIGNvbG9yU3BhY2U6ICdzcmdiJyxcbiAgICAgICAgICAgIGFscGhhTW9kZTogJ29wYXF1ZScsICAvLyBjb3VsZCBhbHNvIGJlICdwcmVtdWx0aXBsaWVkJ1xuXG4gICAgICAgICAgICAvLyB1c2UgcHJlZmVyZWQgZm9ybWF0IGZvciBvcHRpbWFsIHBlcmZvcm1hbmNlIG9uIG1vYmlsZVxuICAgICAgICAgICAgZm9ybWF0OiBwcmVmZXJyZWRDYW52YXNGb3JtYXQsXG5cbiAgICAgICAgICAgIC8vIFJFTkRFUl9BVFRBQ0hNRU5UIGlzIHJlcXVpcmVkLCBDT1BZX1NSQyBhbGxvd3Mgc2NlbmUgZ3JhYiB0byBjb3B5IG91dCBmcm9tIGl0XG4gICAgICAgICAgICB1c2FnZTogR1BVVGV4dHVyZVVzYWdlLlJFTkRFUl9BVFRBQ0hNRU5UIHwgR1BVVGV4dHVyZVVzYWdlLkNPUFlfU1JDIHwgR1BVVGV4dHVyZVVzYWdlLkNPUFlfRFNULFxuXG4gICAgICAgICAgICAvLyBmb3JtYXRzIHRoYXQgdmlld3MgY3JlYXRlZCBmcm9tIHRleHR1cmVzIHJldHVybmVkIGJ5IGdldEN1cnJlbnRUZXh0dXJlIG1heSB1c2VcbiAgICAgICAgICAgIHZpZXdGb3JtYXRzOiBbXVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLmdwdUNvbnRleHQuY29uZmlndXJlKHRoaXMuY2FudmFzQ29uZmlnKTtcblxuICAgICAgICB0aGlzLmNyZWF0ZUZyYW1lYnVmZmVyKCk7XG5cbiAgICAgICAgdGhpcy5jbGVhclJlbmRlcmVyID0gbmV3IFdlYmdwdUNsZWFyUmVuZGVyZXIodGhpcyk7XG5cbiAgICAgICAgdGhpcy5wb3N0SW5pdCgpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIGNyZWF0ZUZyYW1lYnVmZmVyKCkge1xuICAgICAgICB0aGlzLmZyYW1lQnVmZmVyRGltZW5zaW9ucyA9IG5ldyBWZWMyKCk7XG4gICAgICAgIHRoaXMuZnJhbWVCdWZmZXIgPSBuZXcgUmVuZGVyVGFyZ2V0KHtcbiAgICAgICAgICAgIG5hbWU6ICdXZWJncHVGcmFtZWJ1ZmZlcicsXG4gICAgICAgICAgICBncmFwaGljc0RldmljZTogdGhpcyxcbiAgICAgICAgICAgIGRlcHRoOiB0cnVlLFxuICAgICAgICAgICAgc2FtcGxlczogdGhpcy5zYW1wbGVzXG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHJlc2l6ZUNhbnZhcyh3aWR0aCwgaGVpZ2h0KSB7XG5cbiAgICAgICAgdGhpcy5fd2lkdGggPSB3aWR0aDtcbiAgICAgICAgdGhpcy5faGVpZ2h0ID0gaGVpZ2h0O1xuXG4gICAgICAgIGlmICh0aGlzLmNhbnZhcy53aWR0aCAhPT0gd2lkdGggfHwgdGhpcy5jYW52YXMuaGVpZ2h0ICE9PSBoZWlnaHQpIHtcbiAgICAgICAgICAgIHRoaXMuY2FudmFzLndpZHRoID0gd2lkdGg7XG4gICAgICAgICAgICB0aGlzLmNhbnZhcy5oZWlnaHQgPSBoZWlnaHQ7XG4gICAgICAgICAgICB0aGlzLmZpcmUoR3JhcGhpY3NEZXZpY2UuRVZFTlRfUkVTSVpFLCB3aWR0aCwgaGVpZ2h0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZyYW1lU3RhcnQoKSB7XG5cbiAgICAgICAgc3VwZXIuZnJhbWVTdGFydCgpO1xuXG4gICAgICAgIFdlYmdwdURlYnVnLm1lbW9yeSh0aGlzKTtcbiAgICAgICAgV2ViZ3B1RGVidWcudmFsaWRhdGUodGhpcyk7XG5cbiAgICAgICAgLy8gY3VycmVudCBmcmFtZSBjb2xvciBvdXRwdXQgYnVmZmVyXG4gICAgICAgIGNvbnN0IG91dENvbG9yQnVmZmVyID0gdGhpcy5ncHVDb250ZXh0LmdldEN1cnJlbnRUZXh0dXJlKCk7XG4gICAgICAgIERlYnVnSGVscGVyLnNldExhYmVsKG91dENvbG9yQnVmZmVyLCBgJHt0aGlzLmZyYW1lQnVmZmVyLm5hbWV9YCk7XG5cbiAgICAgICAgLy8gcmVhbGxvY2F0ZSBmcmFtZWJ1ZmZlciBpZiBkaW1lbnNpb25zIGNoYW5nZSwgdG8gbWF0Y2ggdGhlIG91dHB1dCB0ZXh0dXJlXG4gICAgICAgIGlmICh0aGlzLmZyYW1lQnVmZmVyRGltZW5zaW9ucy54ICE9PSBvdXRDb2xvckJ1ZmZlci53aWR0aCB8fCB0aGlzLmZyYW1lQnVmZmVyRGltZW5zaW9ucy55ICE9PSBvdXRDb2xvckJ1ZmZlci5oZWlnaHQpIHtcblxuICAgICAgICAgICAgdGhpcy5mcmFtZUJ1ZmZlckRpbWVuc2lvbnMuc2V0KG91dENvbG9yQnVmZmVyLndpZHRoLCBvdXRDb2xvckJ1ZmZlci5oZWlnaHQpO1xuXG4gICAgICAgICAgICB0aGlzLmZyYW1lQnVmZmVyLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHRoaXMuZnJhbWVCdWZmZXIgPSBudWxsO1xuXG4gICAgICAgICAgICB0aGlzLmNyZWF0ZUZyYW1lYnVmZmVyKCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBydCA9IHRoaXMuZnJhbWVCdWZmZXI7XG4gICAgICAgIGNvbnN0IHdydCA9IHJ0LmltcGw7XG5cbiAgICAgICAgLy8gYXNzaWduIHRoZSBmb3JtYXQsIGFsbG93aW5nIGZvbGxvd2luZyBpbml0IGNhbGwgdG8gdXNlIGl0IHRvIGFsbG9jYXRlIG1hdGNoaW5nIG11bHRpc2FtcGxlZCBidWZmZXJcbiAgICAgICAgd3J0LmNvbG9yRm9ybWF0ID0gb3V0Q29sb3JCdWZmZXIuZm9ybWF0O1xuXG4gICAgICAgIHRoaXMuaW5pdFJlbmRlclRhcmdldChydCk7XG5cbiAgICAgICAgLy8gYXNzaWduIGN1cnJlbnQgZnJhbWUncyByZW5kZXIgdGV4dHVyZVxuICAgICAgICB3cnQuYXNzaWduQ29sb3JUZXh0dXJlKG91dENvbG9yQnVmZmVyKTtcblxuICAgICAgICBXZWJncHVEZWJ1Zy5lbmQodGhpcyk7XG4gICAgICAgIFdlYmdwdURlYnVnLmVuZCh0aGlzKTtcbiAgICB9XG5cbiAgICBjcmVhdGVVbmlmb3JtQnVmZmVySW1wbCh1bmlmb3JtQnVmZmVyKSB7XG4gICAgICAgIHJldHVybiBuZXcgV2ViZ3B1VW5pZm9ybUJ1ZmZlcih1bmlmb3JtQnVmZmVyKTtcbiAgICB9XG5cbiAgICBjcmVhdGVWZXJ0ZXhCdWZmZXJJbXBsKHZlcnRleEJ1ZmZlciwgZm9ybWF0KSB7XG4gICAgICAgIHJldHVybiBuZXcgV2ViZ3B1VmVydGV4QnVmZmVyKHZlcnRleEJ1ZmZlciwgZm9ybWF0KTtcbiAgICB9XG5cbiAgICBjcmVhdGVJbmRleEJ1ZmZlckltcGwoaW5kZXhCdWZmZXIpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBXZWJncHVJbmRleEJ1ZmZlcihpbmRleEJ1ZmZlcik7XG4gICAgfVxuXG4gICAgY3JlYXRlU2hhZGVySW1wbChzaGFkZXIpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBXZWJncHVTaGFkZXIoc2hhZGVyKTtcbiAgICB9XG5cbiAgICBjcmVhdGVUZXh0dXJlSW1wbCh0ZXh0dXJlKSB7XG4gICAgICAgIHJldHVybiBuZXcgV2ViZ3B1VGV4dHVyZSh0ZXh0dXJlKTtcbiAgICB9XG5cbiAgICBjcmVhdGVSZW5kZXJUYXJnZXRJbXBsKHJlbmRlclRhcmdldCkge1xuICAgICAgICByZXR1cm4gbmV3IFdlYmdwdVJlbmRlclRhcmdldChyZW5kZXJUYXJnZXQpO1xuICAgIH1cblxuICAgIGNyZWF0ZUJpbmRHcm91cEZvcm1hdEltcGwoYmluZEdyb3VwRm9ybWF0KSB7XG4gICAgICAgIHJldHVybiBuZXcgV2ViZ3B1QmluZEdyb3VwRm9ybWF0KGJpbmRHcm91cEZvcm1hdCk7XG4gICAgfVxuXG4gICAgY3JlYXRlQmluZEdyb3VwSW1wbChiaW5kR3JvdXApIHtcbiAgICAgICAgcmV0dXJuIG5ldyBXZWJncHVCaW5kR3JvdXAoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaW5kZXggLSBJbmRleCBvZiB0aGUgYmluZCBncm91cCBzbG90XG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2JpbmQtZ3JvdXAuanMnKS5CaW5kR3JvdXB9IGJpbmRHcm91cCAtIEJpbmQgZ3JvdXAgdG8gYXR0YWNoXG4gICAgICovXG4gICAgc2V0QmluZEdyb3VwKGluZGV4LCBiaW5kR3JvdXApIHtcblxuICAgICAgICAvLyBUT0RPOiB0aGlzIGNvbmRpdGlvbiBzaG91bGQgYmUgcmVtb3ZlZCwgaXQncyBoZXJlIHRvIGhhbmRsZSBmYWtlIGdyYWIgcGFzcywgd2hpY2ggc2hvdWxkIGJlIHJlZmFjdG9yZWQgaW5zdGVhZFxuICAgICAgICBpZiAodGhpcy5wYXNzRW5jb2Rlcikge1xuXG4gICAgICAgICAgICAvLyBzZXQgaXQgb24gdGhlIGRldmljZVxuICAgICAgICAgICAgdGhpcy5wYXNzRW5jb2Rlci5zZXRCaW5kR3JvdXAoaW5kZXgsIGJpbmRHcm91cC5pbXBsLmJpbmRHcm91cCk7XG5cbiAgICAgICAgICAgIC8vIHN0b3JlIHRoZSBhY3RpdmUgZm9ybWF0cywgdXNlZCBieSB0aGUgcGlwZWxpbmUgY3JlYXRpb25cbiAgICAgICAgICAgIHRoaXMuYmluZEdyb3VwRm9ybWF0c1tpbmRleF0gPSBiaW5kR3JvdXAuZm9ybWF0LmltcGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdWJtaXRWZXJ0ZXhCdWZmZXIodmVydGV4QnVmZmVyLCBzbG90KSB7XG5cbiAgICAgICAgY29uc3QgZm9ybWF0ID0gdmVydGV4QnVmZmVyLmZvcm1hdDtcbiAgICAgICAgY29uc3QgZWxlbWVudENvdW50ID0gZm9ybWF0LmVsZW1lbnRzLmxlbmd0aDtcbiAgICAgICAgY29uc3QgdmJCdWZmZXIgPSB2ZXJ0ZXhCdWZmZXIuaW1wbC5idWZmZXI7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZWxlbWVudENvdW50OyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGVsZW1lbnQgPSBmb3JtYXQuZWxlbWVudHNbaV07XG4gICAgICAgICAgICB0aGlzLnBhc3NFbmNvZGVyLnNldFZlcnRleEJ1ZmZlcihzbG90ICsgaSwgdmJCdWZmZXIsIGVsZW1lbnQub2Zmc2V0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBlbGVtZW50Q291bnQ7XG4gICAgfVxuXG4gICAgZHJhdyhwcmltaXRpdmUsIG51bUluc3RhbmNlcyA9IDEsIGtlZXBCdWZmZXJzKSB7XG5cbiAgICAgICAgaWYgKHRoaXMuc2hhZGVyLnJlYWR5ICYmICF0aGlzLnNoYWRlci5mYWlsZWQpIHtcblxuICAgICAgICAgICAgV2ViZ3B1RGVidWcudmFsaWRhdGUodGhpcyk7XG5cbiAgICAgICAgICAgIGNvbnN0IHBhc3NFbmNvZGVyID0gdGhpcy5wYXNzRW5jb2RlcjtcbiAgICAgICAgICAgIERlYnVnLmFzc2VydChwYXNzRW5jb2Rlcik7XG5cbiAgICAgICAgICAgIC8vIHZlcnRleCBidWZmZXJzXG4gICAgICAgICAgICBjb25zdCB2YjAgPSB0aGlzLnZlcnRleEJ1ZmZlcnNbMF07XG4gICAgICAgICAgICBjb25zdCB2YjEgPSB0aGlzLnZlcnRleEJ1ZmZlcnNbMV07XG4gICAgICAgICAgICB0aGlzLnZlcnRleEJ1ZmZlcnMubGVuZ3RoID0gMDtcblxuICAgICAgICAgICAgaWYgKHZiMCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHZiU2xvdCA9IHRoaXMuc3VibWl0VmVydGV4QnVmZmVyKHZiMCwgMCk7XG4gICAgICAgICAgICAgICAgaWYgKHZiMSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnN1Ym1pdFZlcnRleEJ1ZmZlcih2YjEsIHZiU2xvdCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyByZW5kZXIgcGlwZWxpbmVcbiAgICAgICAgICAgIGNvbnN0IHBpcGVsaW5lID0gdGhpcy5yZW5kZXJQaXBlbGluZS5nZXQocHJpbWl0aXZlLCB2YjA/LmZvcm1hdCwgdmIxPy5mb3JtYXQsIHRoaXMuc2hhZGVyLCB0aGlzLnJlbmRlclRhcmdldCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5iaW5kR3JvdXBGb3JtYXRzLCB0aGlzLmJsZW5kU3RhdGUsIHRoaXMuZGVwdGhTdGF0ZSk7XG4gICAgICAgICAgICBEZWJ1Zy5hc3NlcnQocGlwZWxpbmUpO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5waXBlbGluZSAhPT0gcGlwZWxpbmUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnBpcGVsaW5lID0gcGlwZWxpbmU7XG4gICAgICAgICAgICAgICAgcGFzc0VuY29kZXIuc2V0UGlwZWxpbmUocGlwZWxpbmUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBkcmF3XG4gICAgICAgICAgICBjb25zdCBpYiA9IHRoaXMuaW5kZXhCdWZmZXI7XG4gICAgICAgICAgICBpZiAoaWIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmluZGV4QnVmZmVyID0gbnVsbDtcbiAgICAgICAgICAgICAgICBwYXNzRW5jb2Rlci5zZXRJbmRleEJ1ZmZlcihpYi5pbXBsLmJ1ZmZlciwgaWIuaW1wbC5mb3JtYXQpO1xuICAgICAgICAgICAgICAgIHBhc3NFbmNvZGVyLmRyYXdJbmRleGVkKHByaW1pdGl2ZS5jb3VudCwgbnVtSW5zdGFuY2VzLCAwLCAwLCAwKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGFzc0VuY29kZXIuZHJhdyhwcmltaXRpdmUuY291bnQsIG51bUluc3RhbmNlcywgMCwgMCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIFdlYmdwdURlYnVnLmVuZCh0aGlzLCB7XG4gICAgICAgICAgICAgICAgdmIwLFxuICAgICAgICAgICAgICAgIHZiMSxcbiAgICAgICAgICAgICAgICBpYixcbiAgICAgICAgICAgICAgICBwcmltaXRpdmUsXG4gICAgICAgICAgICAgICAgbnVtSW5zdGFuY2VzLFxuICAgICAgICAgICAgICAgIHBpcGVsaW5lXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldFNoYWRlcihzaGFkZXIpIHtcblxuICAgICAgICB0aGlzLnNoYWRlciA9IHNoYWRlcjtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIC8vIFRPRE86IHdlIHNob3VsZCBwcm9iYWJseSB0cmFjayBvdGhlciBzdGF0cyBpbnN0ZWFkLCBsaWtlIHBpcGVsaW5lIHN3aXRjaGVzXG4gICAgICAgIHRoaXMuX3NoYWRlclN3aXRjaGVzUGVyRnJhbWUrKztcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgc2V0QmxlbmRTdGF0ZShibGVuZFN0YXRlKSB7XG4gICAgICAgIHRoaXMuYmxlbmRTdGF0ZS5jb3B5KGJsZW5kU3RhdGUpO1xuICAgIH1cblxuICAgIHNldERlcHRoU3RhdGUoZGVwdGhTdGF0ZSkge1xuICAgICAgICB0aGlzLmRlcHRoU3RhdGUuY29weShkZXB0aFN0YXRlKTtcbiAgICB9XG5cbiAgICBzZXRCbGVuZENvbG9yKHIsIGcsIGIsIGEpIHtcbiAgICAgICAgLy8gVE9ETzogdGhpcyBzaG91bGQgdXNlIHBhc3NFbmNvZGVyLnNldEJsZW5kQ29uc3RhbnQoY29sb3IpXG4gICAgfVxuXG4gICAgc2V0RGVwdGhGdW5jKGZ1bmMpIHtcbiAgICB9XG5cbiAgICBzZXREZXB0aFRlc3QoZGVwdGhUZXN0KSB7XG4gICAgfVxuXG4gICAgc2V0Q3VsbE1vZGUoY3VsbE1vZGUpIHtcbiAgICB9XG5cbiAgICBnZXRDdWxsTW9kZSgpIHtcbiAgICAgICAgcmV0dXJuIENVTExGQUNFX0JBQ0s7XG4gICAgfVxuXG4gICAgc2V0QWxwaGFUb0NvdmVyYWdlKHN0YXRlKSB7XG4gICAgfVxuXG4gICAgc2V0RGVwdGhXcml0ZSh3cml0ZURlcHRoKSB7XG4gICAgfVxuXG4gICAgaW5pdGlhbGl6ZUNvbnRleHRDYWNoZXMoKSB7XG4gICAgICAgIHN1cGVyLmluaXRpYWxpemVDb250ZXh0Q2FjaGVzKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3RhcnQgYSByZW5kZXIgcGFzcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9yZW5kZXItcGFzcy5qcycpLlJlbmRlclBhc3N9IHJlbmRlclBhc3MgLSBUaGUgcmVuZGVyIHBhc3MgdG8gc3RhcnQuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHN0YXJ0UGFzcyhyZW5kZXJQYXNzKSB7XG5cbiAgICAgICAgY29uc3QgcnQgPSByZW5kZXJQYXNzLnJlbmRlclRhcmdldCB8fCB0aGlzLmZyYW1lQnVmZmVyO1xuICAgICAgICBEZWJ1Zy5hc3NlcnQocnQpO1xuXG4gICAgICAgIHRoaXMucmVuZGVyVGFyZ2V0ID0gcnQ7XG5cbiAgICAgICAgLyoqIEB0eXBlIHtXZWJncHVSZW5kZXJUYXJnZXR9ICovXG4gICAgICAgIGNvbnN0IHdydCA9IHJ0LmltcGw7XG5cbiAgICAgICAgV2ViZ3B1RGVidWcuaW50ZXJuYWwodGhpcyk7XG4gICAgICAgIFdlYmdwdURlYnVnLnZhbGlkYXRlKHRoaXMpO1xuXG4gICAgICAgIC8vIGZyYW1lYnVmZmVyIGlzIGluaXRpYWxpemVkIGF0IHRoZSBzdGFydCBvZiB0aGUgZnJhbWVcbiAgICAgICAgaWYgKHJ0ICE9PSB0aGlzLmZyYW1lQnVmZmVyKSB7XG4gICAgICAgICAgICB0aGlzLmluaXRSZW5kZXJUYXJnZXQocnQpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gc2V0IHVwIGNsZWFyIC8gc3RvcmUgLyBsb2FkIHNldHRpbmdzXG4gICAgICAgIHdydC5zZXR1cEZvclJlbmRlclBhc3MocmVuZGVyUGFzcyk7XG5cbiAgICAgICAgLy8gY3JlYXRlIGEgbmV3IGVuY29kZXIgZm9yIGVhY2ggcGFzcyB0byBrZWVwIHRoZSBHUFUgYnVzeSB3aXRoIGNvbW1hbmRzXG4gICAgICAgIHRoaXMuY29tbWFuZEVuY29kZXIgPSB0aGlzLndncHUuY3JlYXRlQ29tbWFuZEVuY29kZXIoKTtcbiAgICAgICAgRGVidWdIZWxwZXIuc2V0TGFiZWwodGhpcy5jb21tYW5kRW5jb2RlciwgcmVuZGVyUGFzcy5uYW1lKTtcblxuICAgICAgICAvLyBjbGVhciBjYWNoZWQgZW5jb2RlciBzdGF0ZVxuICAgICAgICB0aGlzLnBpcGVsaW5lID0gbnVsbDtcblxuICAgICAgICAvLyBzdGFydCB0aGUgcGFzc1xuICAgICAgICB0aGlzLnBhc3NFbmNvZGVyID0gdGhpcy5jb21tYW5kRW5jb2Rlci5iZWdpblJlbmRlclBhc3Mod3J0LnJlbmRlclBhc3NEZXNjcmlwdG9yKTtcbiAgICAgICAgRGVidWdIZWxwZXIuc2V0TGFiZWwodGhpcy5wYXNzRW5jb2RlciwgcmVuZGVyUGFzcy5uYW1lKTtcblxuICAgICAgICAvLyB0aGUgcGFzcyBhbHdheXMgY2xlYXJzIGZ1bGwgdGFyZ2V0XG4gICAgICAgIC8vIFRPRE86IGF2b2lkIHRoaXMgc2V0dGluZyB0aGUgYWN0dWFsIHZpZXdwb3J0L3NjaXNzb3Igb24gd2ViZ3B1IGFzIHRob3NlIGFyZSBhdXRvbWF0aWNhbGx5IHJlc2V0IHRvIGZ1bGxcbiAgICAgICAgLy8gcmVuZGVyIHRhcmdldC4gV2UganVzdCBuZWVkIHRvIHVwZGF0ZSBpbnRlcm5hbCBzdGF0ZSwgZm9yIHRoZSBnZXQgZnVuY3Rpb25hbGl0eSB0byByZXR1cm4gaXQuXG4gICAgICAgIGNvbnN0IHsgd2lkdGgsIGhlaWdodCB9ID0gcnQ7XG4gICAgICAgIHRoaXMuc2V0Vmlld3BvcnQoMCwgMCwgd2lkdGgsIGhlaWdodCk7XG4gICAgICAgIHRoaXMuc2V0U2Npc3NvcigwLCAwLCB3aWR0aCwgaGVpZ2h0KTtcblxuICAgICAgICBEZWJ1Zy5hc3NlcnQoIXRoaXMuaW5zaWRlUmVuZGVyUGFzcywgJ1JlbmRlclBhc3MgY2Fubm90IGJlIHN0YXJ0ZWQgd2hpbGUgaW5zaWRlIGFub3RoZXIgcmVuZGVyIHBhc3MuJyk7XG4gICAgICAgIHRoaXMuaW5zaWRlUmVuZGVyUGFzcyA9IHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRW5kIGEgcmVuZGVyIHBhc3MuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vcmVuZGVyLXBhc3MuanMnKS5SZW5kZXJQYXNzfSByZW5kZXJQYXNzIC0gVGhlIHJlbmRlciBwYXNzIHRvIGVuZC5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZW5kUGFzcyhyZW5kZXJQYXNzKSB7XG5cbiAgICAgICAgdGhpcy5wYXNzRW5jb2Rlci5lbmQoKTtcbiAgICAgICAgdGhpcy5wYXNzRW5jb2RlciA9IG51bGw7XG5cbiAgICAgICAgdGhpcy53Z3B1LnF1ZXVlLnN1Ym1pdChbdGhpcy5jb21tYW5kRW5jb2Rlci5maW5pc2goKV0pO1xuICAgICAgICB0aGlzLmNvbW1hbmRFbmNvZGVyID0gbnVsbDtcblxuICAgICAgICBXZWJncHVEZWJ1Zy5lbmQodGhpcywgeyByZW5kZXJQYXNzIH0pO1xuICAgICAgICBXZWJncHVEZWJ1Zy5lbmQodGhpcywgeyByZW5kZXJQYXNzIH0pO1xuXG4gICAgICAgIC8vIGVhY2ggcmVuZGVyIHBhc3MgY2FuIHVzZSBkaWZmZXJlbnQgbnVtYmVyIG9mIGJpbmQgZ3JvdXBzXG4gICAgICAgIHRoaXMuYmluZEdyb3VwRm9ybWF0cy5sZW5ndGggPSAwO1xuXG4gICAgICAgIHRoaXMuaW5zaWRlUmVuZGVyUGFzcyA9IGZhbHNlO1xuICAgIH1cblxuICAgIGNsZWFyKG9wdGlvbnMpIHtcbiAgICAgICAgaWYgKG9wdGlvbnMuZmxhZ3MpIHtcbiAgICAgICAgICAgIHRoaXMuY2xlYXJSZW5kZXJlci5jbGVhcih0aGlzLCB0aGlzLnJlbmRlclRhcmdldCwgb3B0aW9ucywgdGhpcy5kZWZhdWx0Q2xlYXJPcHRpb25zKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCB3aWR0aCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3dpZHRoO1xuICAgIH1cblxuICAgIGdldCBoZWlnaHQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9oZWlnaHQ7XG4gICAgfVxuXG4gICAgc2V0RGVwdGhCaWFzKG9uKSB7XG4gICAgfVxuXG4gICAgc2V0RGVwdGhCaWFzVmFsdWVzKGNvbnN0Qmlhcywgc2xvcGVCaWFzKSB7XG4gICAgfVxuXG4gICAgc2V0U3RlbmNpbFRlc3QoZW5hYmxlKSB7XG4gICAgfVxuXG4gICAgc2V0U3RlbmNpbEZ1bmMoZnVuYywgcmVmLCBtYXNrKSB7XG4gICAgfVxuXG4gICAgc2V0U3RlbmNpbE9wZXJhdGlvbihmYWlsLCB6ZmFpbCwgenBhc3MsIHdyaXRlTWFzaykge1xuICAgIH1cblxuICAgIHNldFZpZXdwb3J0KHgsIHksIHcsIGgpIHtcbiAgICAgICAgLy8gVE9ETzogb25seSBleGVjdXRlIHdoZW4gaXQgY2hhbmdlcy4gQWxzbywgdGhlIHZpZXdwb3J0IG9mIGVuY29kZXIgIG1hdGNoZXMgdGhlIHJlbmRlcmluZyBhdHRhY2htZW50cyxcbiAgICAgICAgLy8gc28gd2UgY2FuIHNraXAgdGhpcyBpZiBmdWxsc2NyZWVuXG4gICAgICAgIC8vIFRPRE86IHRoaXMgY29uZGl0aW9uIHNob3VsZCBiZSByZW1vdmVkLCBpdCdzIGhlcmUgdG8gaGFuZGxlIGZha2UgZ3JhYiBwYXNzLCB3aGljaCBzaG91bGQgYmUgcmVmYWN0b3JlZCBpbnN0ZWFkXG4gICAgICAgIGlmICh0aGlzLnBhc3NFbmNvZGVyKSB7XG5cbiAgICAgICAgICAgIGlmICghdGhpcy5yZW5kZXJUYXJnZXQuZmxpcFkpIHtcbiAgICAgICAgICAgICAgICB5ID0gdGhpcy5yZW5kZXJUYXJnZXQuaGVpZ2h0IC0geSAtIGg7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMudnggPSB4O1xuICAgICAgICAgICAgdGhpcy52eSA9IHk7XG4gICAgICAgICAgICB0aGlzLnZ3ID0gdztcbiAgICAgICAgICAgIHRoaXMudmggPSBoO1xuXG4gICAgICAgICAgICB0aGlzLnBhc3NFbmNvZGVyLnNldFZpZXdwb3J0KHgsIHksIHcsIGgsIDAsIDEpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0U2Npc3Nvcih4LCB5LCB3LCBoKSB7XG4gICAgICAgIC8vIFRPRE86IG9ubHkgZXhlY3V0ZSB3aGVuIGl0IGNoYW5nZXMuIEFsc28sIHRoZSB2aWV3cG9ydCBvZiBlbmNvZGVyICBtYXRjaGVzIHRoZSByZW5kZXJpbmcgYXR0YWNobWVudHMsXG4gICAgICAgIC8vIHNvIHdlIGNhbiBza2lwIHRoaXMgaWYgZnVsbHNjcmVlblxuICAgICAgICAvLyBUT0RPOiB0aGlzIGNvbmRpdGlvbiBzaG91bGQgYmUgcmVtb3ZlZCwgaXQncyBoZXJlIHRvIGhhbmRsZSBmYWtlIGdyYWIgcGFzcywgd2hpY2ggc2hvdWxkIGJlIHJlZmFjdG9yZWQgaW5zdGVhZFxuICAgICAgICBpZiAodGhpcy5wYXNzRW5jb2Rlcikge1xuXG4gICAgICAgICAgICBpZiAoIXRoaXMucmVuZGVyVGFyZ2V0LmZsaXBZKSB7XG4gICAgICAgICAgICAgICAgeSA9IHRoaXMucmVuZGVyVGFyZ2V0LmhlaWdodCAtIHkgLSBoO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnN4ID0geDtcbiAgICAgICAgICAgIHRoaXMuc3kgPSB5O1xuICAgICAgICAgICAgdGhpcy5zdyA9IHc7XG4gICAgICAgICAgICB0aGlzLnNoID0gaDtcblxuICAgICAgICAgICAgdGhpcy5wYXNzRW5jb2Rlci5zZXRTY2lzc29yUmVjdCh4LCB5LCB3LCBoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvcGllcyBzb3VyY2UgcmVuZGVyIHRhcmdldCBpbnRvIGRlc3RpbmF0aW9uIHJlbmRlciB0YXJnZXQuIE1vc3RseSB1c2VkIGJ5IHBvc3QtZWZmZWN0cy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7UmVuZGVyVGFyZ2V0fSBbc291cmNlXSAtIFRoZSBzb3VyY2UgcmVuZGVyIHRhcmdldC4gRGVmYXVsdHMgdG8gZnJhbWUgYnVmZmVyLlxuICAgICAqIEBwYXJhbSB7UmVuZGVyVGFyZ2V0fSBbZGVzdF0gLSBUaGUgZGVzdGluYXRpb24gcmVuZGVyIHRhcmdldC4gRGVmYXVsdHMgdG8gZnJhbWUgYnVmZmVyLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW2NvbG9yXSAtIElmIHRydWUgd2lsbCBjb3B5IHRoZSBjb2xvciBidWZmZXIuIERlZmF1bHRzIHRvIGZhbHNlLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW2RlcHRoXSAtIElmIHRydWUgd2lsbCBjb3B5IHRoZSBkZXB0aCBidWZmZXIuIERlZmF1bHRzIHRvIGZhbHNlLlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHRoZSBjb3B5IHdhcyBzdWNjZXNzZnVsLCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICovXG4gICAgY29weVJlbmRlclRhcmdldChzb3VyY2UsIGRlc3QsIGNvbG9yLCBkZXB0aCkge1xuXG4gICAgICAgIC8qKiBAdHlwZSB7R1BVRXh0ZW50M0R9ICovXG4gICAgICAgIGNvbnN0IGNvcHlTaXplID0ge1xuICAgICAgICAgICAgd2lkdGg6IHNvdXJjZSA/IHNvdXJjZS53aWR0aCA6IGRlc3Qud2lkdGgsXG4gICAgICAgICAgICBoZWlnaHQ6IHNvdXJjZSA/IHNvdXJjZS5oZWlnaHQgOiBkZXN0LmhlaWdodCxcbiAgICAgICAgICAgIGRlcHRoT3JBcnJheUxheWVyczogMVxuICAgICAgICB9O1xuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcih0aGlzLCAnQ09QWS1SVCcpO1xuXG4gICAgICAgIC8vIHVzZSBleGlzdGluZyBvciBjcmVhdGUgbmV3IGVuY29kZXIgaWYgYmV0d2VlbiByZW5kZXIgcGFzc2VzXG4gICAgICAgIGNvbnN0IGNvbW1hbmRFbmNvZGVyID0gdGhpcy5jb21tYW5kRW5jb2RlciA/PyB0aGlzLndncHUuY3JlYXRlQ29tbWFuZEVuY29kZXIoKTtcblxuICAgICAgICBpZiAoY29sb3IpIHtcblxuICAgICAgICAgICAgLy8gcmVhZCBmcm9tIHN1cHBsaWVkIHJlbmRlciB0YXJnZXQsIG9yIGZyb20gdGhlIGZyYW1lYnVmZmVyXG4gICAgICAgICAgICAvKiogQHR5cGUge0dQVUltYWdlQ29weVRleHR1cmV9ICovXG4gICAgICAgICAgICBjb25zdCBjb3B5U3JjID0ge1xuICAgICAgICAgICAgICAgIHRleHR1cmU6IHNvdXJjZSA/IHNvdXJjZS5jb2xvckJ1ZmZlci5pbXBsLmdwdVRleHR1cmUgOiB0aGlzLnJlbmRlclRhcmdldC5pbXBsLmFzc2lnbmVkQ29sb3JUZXh0dXJlLFxuICAgICAgICAgICAgICAgIG1pcExldmVsOiAwXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAvLyB3cml0ZSB0byBzdXBwbGllZCByZW5kZXIgdGFyZ2V0LCBvciB0byB0aGUgZnJhbWVidWZmZXJcbiAgICAgICAgICAgIC8qKiBAdHlwZSB7R1BVSW1hZ2VDb3B5VGV4dHVyZX0gKi9cbiAgICAgICAgICAgIGNvbnN0IGNvcHlEc3QgPSB7XG4gICAgICAgICAgICAgICAgdGV4dHVyZTogZGVzdCA/IGRlc3QuY29sb3JCdWZmZXIuaW1wbC5ncHVUZXh0dXJlIDogdGhpcy5yZW5kZXJUYXJnZXQuaW1wbC5hc3NpZ25lZENvbG9yVGV4dHVyZSxcbiAgICAgICAgICAgICAgICBtaXBMZXZlbDogMFxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgRGVidWcuYXNzZXJ0KGNvcHlTcmMudGV4dHVyZSAhPT0gbnVsbCAmJiBjb3B5RHN0LnRleHR1cmUgIT09IG51bGwpO1xuICAgICAgICAgICAgY29tbWFuZEVuY29kZXIuY29weVRleHR1cmVUb1RleHR1cmUoY29weVNyYywgY29weURzdCwgY29weVNpemUpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGRlcHRoKSB7XG5cbiAgICAgICAgICAgIC8vIHJlYWQgZnJvbSBzdXBwbGllZCByZW5kZXIgdGFyZ2V0LCBvciBmcm9tIHRoZSBmcmFtZWJ1ZmZlclxuICAgICAgICAgICAgY29uc3Qgc291cmNlUlQgPSBzb3VyY2UgPyBzb3VyY2UgOiB0aGlzLnJlbmRlclRhcmdldDtcblxuICAgICAgICAgICAgLy8gY2Fubm90IGNvcHkgZGVwdGggZnJvbSBtdWx0aXNhbXBsZWQgYnVmZmVyLiBPbiBXZWJHUFUsIGl0IGNhbm5vdCBiZSByZXNvbHZlIGF0IHRoZSBlbmQgb2YgdGhlIHBhc3MgZWl0aGVyLFxuICAgICAgICAgICAgLy8gYW5kIHNvIHdlIG5lZWQgdG8gaW1wbGVtZW50IGEgY3VzdG9tIGRlcHRoIHJlc29sdmUgc2hhZGVyIGJhc2VkIGNvcHlcbiAgICAgICAgICAgIC8vIFRoaXMgaXMgY3VycmVudGx5IG5lZWRlZCBmb3IgdVNjZW5lRGVwdGhNYXAgd2hlbiB0aGUgY2FtZXJhIHJlbmRlcnMgdG8gbXVsdGlzYW1wbGVkIHJlbmRlciB0YXJnZXRcbiAgICAgICAgICAgIERlYnVnLmFzc2VydChzb3VyY2Uuc2FtcGxlcyA8PSAxLCBgY29weVJlbmRlclRhcmdldCBkb2VzIG5vdCBjdXJyZW50bHkgc3VwcG9ydCBjb3B5IG9mIGRlcHRoIGZyb20gbXVsdGlzYW1wbGVkIHRleHR1cmUgJHtzb3VyY2VSVC5uYW1lfWAsIHNvdXJjZVJUKTtcblxuICAgICAgICAgICAgLyoqIEB0eXBlIHtHUFVJbWFnZUNvcHlUZXh0dXJlfSAqL1xuICAgICAgICAgICAgY29uc3QgY29weVNyYyA9IHtcbiAgICAgICAgICAgICAgICB0ZXh0dXJlOiBzb3VyY2VSVC5pbXBsLmRlcHRoVGV4dHVyZSxcbiAgICAgICAgICAgICAgICBtaXBMZXZlbDogMFxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgLy8gd3JpdGUgdG8gc3VwcGxpZWQgcmVuZGVyIHRhcmdldCwgb3IgdG8gdGhlIGZyYW1lYnVmZmVyXG4gICAgICAgICAgICAvKiogQHR5cGUge0dQVUltYWdlQ29weVRleHR1cmV9ICovXG4gICAgICAgICAgICBjb25zdCBjb3B5RHN0ID0ge1xuICAgICAgICAgICAgICAgIHRleHR1cmU6IGRlc3QgPyBkZXN0LmRlcHRoQnVmZmVyLmltcGwuZ3B1VGV4dHVyZSA6IHRoaXMucmVuZGVyVGFyZ2V0LmltcGwuZGVwdGhUZXh0dXJlLFxuICAgICAgICAgICAgICAgIG1pcExldmVsOiAwXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBEZWJ1Zy5hc3NlcnQoY29weVNyYy50ZXh0dXJlICE9PSBudWxsICYmIGNvcHlEc3QudGV4dHVyZSAhPT0gbnVsbCk7XG4gICAgICAgICAgICBjb21tYW5kRW5jb2Rlci5jb3B5VGV4dHVyZVRvVGV4dHVyZShjb3B5U3JjLCBjb3B5RHN0LCBjb3B5U2l6ZSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzdWJtaXQgdGhlIGVuY29kZWQgY29tbWFuZHMgaWYgd2UgY3JlYXRlZCB0aGUgZW5jb2RlclxuICAgICAgICBpZiAoIXRoaXMuY29tbWFuZEVuY29kZXIpIHtcbiAgICAgICAgICAgIHRoaXMud2dwdS5xdWV1ZS5zdWJtaXQoW2NvbW1hbmRFbmNvZGVyLmZpbmlzaCgpXSk7XG4gICAgICAgIH1cblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcih0aGlzKTtcblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvLyAjaWYgX0RFQlVHXG4gICAgcHVzaE1hcmtlcihuYW1lKSB7XG4gICAgICAgIHRoaXMucGFzc0VuY29kZXI/LnB1c2hEZWJ1Z0dyb3VwKG5hbWUpO1xuICAgIH1cblxuICAgIHBvcE1hcmtlcigpIHtcbiAgICAgICAgdGhpcy5wYXNzRW5jb2Rlcj8ucG9wRGVidWdHcm91cCgpO1xuICAgIH1cbiAgICAvLyAjZW5kaWZcbn1cblxuZXhwb3J0IHsgV2ViZ3B1R3JhcGhpY3NEZXZpY2UgfTtcbiJdLCJuYW1lcyI6WyJXZWJncHVHcmFwaGljc0RldmljZSIsIkdyYXBoaWNzRGV2aWNlIiwiY29uc3RydWN0b3IiLCJjYW52YXMiLCJvcHRpb25zIiwiZnJhbWVCdWZmZXIiLCJyZW5kZXJQaXBlbGluZSIsIldlYmdwdVJlbmRlclBpcGVsaW5lIiwiY2xlYXJSZW5kZXJlciIsInBpcGVsaW5lIiwiYmluZEdyb3VwRm9ybWF0cyIsImNvbW1hbmRFbmNvZGVyIiwiaXNXZWJHUFUiLCJfZGV2aWNlVHlwZSIsIkRFVklDRVRZUEVfV0VCR1BVIiwic2FtcGxlcyIsImFudGlhbGlhcyIsImRlc3Ryb3kiLCJpbml0RGV2aWNlQ2FwcyIsImxpbWl0cyIsImdwdUFkYXB0ZXIiLCJwcmVjaXNpb24iLCJtYXhQcmVjaXNpb24iLCJtYXhTYW1wbGVzIiwibWF4VGV4dHVyZXMiLCJtYXhUZXh0dXJlU2l6ZSIsIm1heFRleHR1cmVEaW1lbnNpb24yRCIsIm1heEN1YmVNYXBTaXplIiwibWF4Vm9sdW1lU2l6ZSIsIm1heFRleHR1cmVEaW1lbnNpb24zRCIsIm1heFBpeGVsUmF0aW8iLCJzdXBwb3J0c0luc3RhbmNpbmciLCJzdXBwb3J0c1VuaWZvcm1CdWZmZXJzIiwic3VwcG9ydHNCb25lVGV4dHVyZXMiLCJzdXBwb3J0c01vcnBoVGFyZ2V0VGV4dHVyZXNDb3JlIiwic3VwcG9ydHNBcmVhTGlnaHRzIiwic3VwcG9ydHNEZXB0aFNoYWRvdyIsImV4dFVpbnRFbGVtZW50IiwiZXh0VGV4dHVyZUZsb2F0IiwidGV4dHVyZUZsb2F0UmVuZGVyYWJsZSIsImV4dFRleHR1cmVIYWxmRmxvYXQiLCJ0ZXh0dXJlSGFsZkZsb2F0UmVuZGVyYWJsZSIsInRleHR1cmVIYWxmRmxvYXRVcGRhdGFibGUiLCJib25lTGltaXQiLCJzdXBwb3J0c0ltYWdlQml0bWFwIiwiZXh0U3RhbmRhcmREZXJpdmF0aXZlcyIsImV4dEJsZW5kTWlubWF4IiwiYXJlYUxpZ2h0THV0Rm9ybWF0IiwiZmxvYXRGaWx0ZXJhYmxlIiwiUElYRUxGT1JNQVRfUkdCQTMyRiIsIlBJWEVMRk9STUFUX1JHQkE4Iiwic3VwcG9ydHNUZXh0dXJlRmV0Y2giLCJpbml0V2ViR3B1IiwiZ2xzbGFuZ1VybCIsInR3Z3NsVXJsIiwid2luZG93IiwibmF2aWdhdG9yIiwiZ3B1IiwiRXJyb3IiLCJEZWJ1ZyIsImxvZyIsImxvYWRTY3JpcHQiLCJ1cmwiLCJQcm9taXNlIiwicmVzb2x2ZSIsInJlamVjdCIsInNjcmlwdCIsImRvY3VtZW50IiwiY3JlYXRlRWxlbWVudCIsInNyYyIsImFzeW5jIiwib25sb2FkIiwib25lcnJvciIsImJvZHkiLCJhcHBlbmRDaGlsZCIsImdsc2xhbmciLCJ3YXNtUGF0aCIsInJlcGxhY2UiLCJ0d2dzbCIsInJlcXVlc3RBZGFwdGVyIiwicmVxdWlyZWRGZWF0dXJlcyIsInJlcXVpcmVGZWF0dXJlIiwiZmVhdHVyZSIsImZlYXR1cmVzIiwiaGFzIiwicHVzaCIsIndncHUiLCJyZXF1ZXN0RGV2aWNlIiwicmVxdWlyZWRMaW1pdHMiLCJzZXRSZXNvbHV0aW9uIiwiaW5uZXJXaWR0aCIsImlubmVySGVpZ2h0IiwiZ3B1Q29udGV4dCIsImdldENvbnRleHQiLCJwcmVmZXJyZWRDYW52YXNGb3JtYXQiLCJnZXRQcmVmZXJyZWRDYW52YXNGb3JtYXQiLCJmcmFtZWJ1ZmZlckZvcm1hdCIsIlBJWEVMRk9STUFUX0JHUkE4IiwiY2FudmFzQ29uZmlnIiwiZGV2aWNlIiwiY29sb3JTcGFjZSIsImFscGhhTW9kZSIsImZvcm1hdCIsInVzYWdlIiwiR1BVVGV4dHVyZVVzYWdlIiwiUkVOREVSX0FUVEFDSE1FTlQiLCJDT1BZX1NSQyIsIkNPUFlfRFNUIiwidmlld0Zvcm1hdHMiLCJjb25maWd1cmUiLCJjcmVhdGVGcmFtZWJ1ZmZlciIsIldlYmdwdUNsZWFyUmVuZGVyZXIiLCJwb3N0SW5pdCIsImZyYW1lQnVmZmVyRGltZW5zaW9ucyIsIlZlYzIiLCJSZW5kZXJUYXJnZXQiLCJuYW1lIiwiZ3JhcGhpY3NEZXZpY2UiLCJkZXB0aCIsInJlc2l6ZUNhbnZhcyIsIndpZHRoIiwiaGVpZ2h0IiwiX3dpZHRoIiwiX2hlaWdodCIsImZpcmUiLCJFVkVOVF9SRVNJWkUiLCJmcmFtZVN0YXJ0IiwiV2ViZ3B1RGVidWciLCJtZW1vcnkiLCJ2YWxpZGF0ZSIsIm91dENvbG9yQnVmZmVyIiwiZ2V0Q3VycmVudFRleHR1cmUiLCJEZWJ1Z0hlbHBlciIsInNldExhYmVsIiwieCIsInkiLCJzZXQiLCJydCIsIndydCIsImltcGwiLCJjb2xvckZvcm1hdCIsImluaXRSZW5kZXJUYXJnZXQiLCJhc3NpZ25Db2xvclRleHR1cmUiLCJlbmQiLCJjcmVhdGVVbmlmb3JtQnVmZmVySW1wbCIsInVuaWZvcm1CdWZmZXIiLCJXZWJncHVVbmlmb3JtQnVmZmVyIiwiY3JlYXRlVmVydGV4QnVmZmVySW1wbCIsInZlcnRleEJ1ZmZlciIsIldlYmdwdVZlcnRleEJ1ZmZlciIsImNyZWF0ZUluZGV4QnVmZmVySW1wbCIsImluZGV4QnVmZmVyIiwiV2ViZ3B1SW5kZXhCdWZmZXIiLCJjcmVhdGVTaGFkZXJJbXBsIiwic2hhZGVyIiwiV2ViZ3B1U2hhZGVyIiwiY3JlYXRlVGV4dHVyZUltcGwiLCJ0ZXh0dXJlIiwiV2ViZ3B1VGV4dHVyZSIsImNyZWF0ZVJlbmRlclRhcmdldEltcGwiLCJyZW5kZXJUYXJnZXQiLCJXZWJncHVSZW5kZXJUYXJnZXQiLCJjcmVhdGVCaW5kR3JvdXBGb3JtYXRJbXBsIiwiYmluZEdyb3VwRm9ybWF0IiwiV2ViZ3B1QmluZEdyb3VwRm9ybWF0IiwiY3JlYXRlQmluZEdyb3VwSW1wbCIsImJpbmRHcm91cCIsIldlYmdwdUJpbmRHcm91cCIsInNldEJpbmRHcm91cCIsImluZGV4IiwicGFzc0VuY29kZXIiLCJzdWJtaXRWZXJ0ZXhCdWZmZXIiLCJzbG90IiwiZWxlbWVudENvdW50IiwiZWxlbWVudHMiLCJsZW5ndGgiLCJ2YkJ1ZmZlciIsImJ1ZmZlciIsImkiLCJlbGVtZW50Iiwic2V0VmVydGV4QnVmZmVyIiwib2Zmc2V0IiwiZHJhdyIsInByaW1pdGl2ZSIsIm51bUluc3RhbmNlcyIsImtlZXBCdWZmZXJzIiwicmVhZHkiLCJmYWlsZWQiLCJhc3NlcnQiLCJ2YjAiLCJ2ZXJ0ZXhCdWZmZXJzIiwidmIxIiwidmJTbG90IiwiZ2V0IiwiYmxlbmRTdGF0ZSIsImRlcHRoU3RhdGUiLCJzZXRQaXBlbGluZSIsImliIiwic2V0SW5kZXhCdWZmZXIiLCJkcmF3SW5kZXhlZCIsImNvdW50Iiwic2V0U2hhZGVyIiwiX3NoYWRlclN3aXRjaGVzUGVyRnJhbWUiLCJzZXRCbGVuZFN0YXRlIiwiY29weSIsInNldERlcHRoU3RhdGUiLCJzZXRCbGVuZENvbG9yIiwiciIsImciLCJiIiwiYSIsInNldERlcHRoRnVuYyIsImZ1bmMiLCJzZXREZXB0aFRlc3QiLCJkZXB0aFRlc3QiLCJzZXRDdWxsTW9kZSIsImN1bGxNb2RlIiwiZ2V0Q3VsbE1vZGUiLCJDVUxMRkFDRV9CQUNLIiwic2V0QWxwaGFUb0NvdmVyYWdlIiwic3RhdGUiLCJzZXREZXB0aFdyaXRlIiwid3JpdGVEZXB0aCIsImluaXRpYWxpemVDb250ZXh0Q2FjaGVzIiwic3RhcnRQYXNzIiwicmVuZGVyUGFzcyIsImludGVybmFsIiwic2V0dXBGb3JSZW5kZXJQYXNzIiwiY3JlYXRlQ29tbWFuZEVuY29kZXIiLCJiZWdpblJlbmRlclBhc3MiLCJyZW5kZXJQYXNzRGVzY3JpcHRvciIsInNldFZpZXdwb3J0Iiwic2V0U2Npc3NvciIsImluc2lkZVJlbmRlclBhc3MiLCJlbmRQYXNzIiwicXVldWUiLCJzdWJtaXQiLCJmaW5pc2giLCJjbGVhciIsImZsYWdzIiwiZGVmYXVsdENsZWFyT3B0aW9ucyIsInNldERlcHRoQmlhcyIsIm9uIiwic2V0RGVwdGhCaWFzVmFsdWVzIiwiY29uc3RCaWFzIiwic2xvcGVCaWFzIiwic2V0U3RlbmNpbFRlc3QiLCJlbmFibGUiLCJzZXRTdGVuY2lsRnVuYyIsInJlZiIsIm1hc2siLCJzZXRTdGVuY2lsT3BlcmF0aW9uIiwiZmFpbCIsInpmYWlsIiwienBhc3MiLCJ3cml0ZU1hc2siLCJ3IiwiaCIsImZsaXBZIiwidngiLCJ2eSIsInZ3IiwidmgiLCJzeCIsInN5Iiwic3ciLCJzaCIsInNldFNjaXNzb3JSZWN0IiwiY29weVJlbmRlclRhcmdldCIsInNvdXJjZSIsImRlc3QiLCJjb2xvciIsImNvcHlTaXplIiwiZGVwdGhPckFycmF5TGF5ZXJzIiwiRGVidWdHcmFwaGljcyIsInB1c2hHcHVNYXJrZXIiLCJjb3B5U3JjIiwiY29sb3JCdWZmZXIiLCJncHVUZXh0dXJlIiwiYXNzaWduZWRDb2xvclRleHR1cmUiLCJtaXBMZXZlbCIsImNvcHlEc3QiLCJjb3B5VGV4dHVyZVRvVGV4dHVyZSIsInNvdXJjZVJUIiwiZGVwdGhUZXh0dXJlIiwiZGVwdGhCdWZmZXIiLCJwb3BHcHVNYXJrZXIiLCJwdXNoTWFya2VyIiwicHVzaERlYnVnR3JvdXAiLCJwb3BNYXJrZXIiLCJwb3BEZWJ1Z0dyb3VwIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQXNCQSxNQUFNQSxvQkFBb0IsU0FBU0MsY0FBYyxDQUFDO0FBQzlDO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUdJQyxFQUFBQSxXQUFXLENBQUNDLE1BQU0sRUFBRUMsT0FBTyxHQUFHLEVBQUUsRUFBRTtJQUM5QixLQUFLLENBQUNELE1BQU0sQ0FBQyxDQUFBO0FBQUMsSUFBQSxJQUFBLENBdENsQkUsV0FBVyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBQUEsSUFBQSxJQUFBLENBS1hDLGNBQWMsR0FBRyxJQUFJQyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsQ0FBQTtBQUFBLElBQUEsSUFBQSxDQU8vQ0MsYUFBYSxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBQUEsSUFBQSxJQUFBLENBUWJDLFFBQVEsR0FBQSxLQUFBLENBQUEsQ0FBQTtJQUFBLElBT1JDLENBQUFBLGdCQUFnQixHQUFHLEVBQUUsQ0FBQTtBQUFBLElBQUEsSUFBQSxDQVFyQkMsY0FBYyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0lBSVYsSUFBSSxDQUFDQyxRQUFRLEdBQUcsSUFBSSxDQUFBO0lBQ3BCLElBQUksQ0FBQ0MsV0FBVyxHQUFHQyxpQkFBaUIsQ0FBQTs7QUFFcEM7SUFDQSxJQUFJLENBQUNDLE9BQU8sR0FBR1gsT0FBTyxDQUFDWSxTQUFTLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQTtBQUM1QyxHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNJQyxFQUFBQSxPQUFPLEdBQUc7SUFDTixLQUFLLENBQUNBLE9BQU8sRUFBRSxDQUFBO0FBQ25CLEdBQUE7QUFFQUMsRUFBQUEsY0FBYyxHQUFHO0FBRWIsSUFBQSxNQUFNQyxNQUFNLEdBQUcsSUFBSSxDQUFDQyxVQUFVLENBQUNELE1BQU0sQ0FBQTtJQUVyQyxJQUFJLENBQUNFLFNBQVMsR0FBRyxPQUFPLENBQUE7SUFDeEIsSUFBSSxDQUFDQyxZQUFZLEdBQUcsT0FBTyxDQUFBO0lBQzNCLElBQUksQ0FBQ0MsVUFBVSxHQUFHLENBQUMsQ0FBQTtJQUNuQixJQUFJLENBQUNDLFdBQVcsR0FBRyxFQUFFLENBQUE7QUFDckIsSUFBQSxJQUFJLENBQUNDLGNBQWMsR0FBR04sTUFBTSxDQUFDTyxxQkFBcUIsQ0FBQTtBQUNsRCxJQUFBLElBQUksQ0FBQ0MsY0FBYyxHQUFHUixNQUFNLENBQUNPLHFCQUFxQixDQUFBO0FBQ2xELElBQUEsSUFBSSxDQUFDRSxhQUFhLEdBQUdULE1BQU0sQ0FBQ1UscUJBQXFCLENBQUE7SUFDakQsSUFBSSxDQUFDQyxhQUFhLEdBQUcsQ0FBQyxDQUFBO0lBQ3RCLElBQUksQ0FBQ0Msa0JBQWtCLEdBQUcsSUFBSSxDQUFBO0lBQzlCLElBQUksQ0FBQ0Msc0JBQXNCLEdBQUcsSUFBSSxDQUFBO0lBQ2xDLElBQUksQ0FBQ0Msb0JBQW9CLEdBQUcsSUFBSSxDQUFBO0lBQ2hDLElBQUksQ0FBQ0MsK0JBQStCLEdBQUcsSUFBSSxDQUFBO0lBQzNDLElBQUksQ0FBQ0Msa0JBQWtCLEdBQUcsSUFBSSxDQUFBO0lBQzlCLElBQUksQ0FBQ0MsbUJBQW1CLEdBQUcsSUFBSSxDQUFBO0lBQy9CLElBQUksQ0FBQ0MsY0FBYyxHQUFHLElBQUksQ0FBQTtJQUMxQixJQUFJLENBQUNDLGVBQWUsR0FBRyxJQUFJLENBQUE7SUFDM0IsSUFBSSxDQUFDQyxzQkFBc0IsR0FBRyxJQUFJLENBQUE7SUFDbEMsSUFBSSxDQUFDQyxtQkFBbUIsR0FBRyxJQUFJLENBQUE7SUFDL0IsSUFBSSxDQUFDQywwQkFBMEIsR0FBRyxJQUFJLENBQUE7SUFDdEMsSUFBSSxDQUFDQyx5QkFBeUIsR0FBRyxJQUFJLENBQUE7SUFDckMsSUFBSSxDQUFDQyxTQUFTLEdBQUcsSUFBSSxDQUFBO0lBQ3JCLElBQUksQ0FBQ0MsbUJBQW1CLEdBQUcsSUFBSSxDQUFBO0lBQy9CLElBQUksQ0FBQ0Msc0JBQXNCLEdBQUcsSUFBSSxDQUFBO0lBQ2xDLElBQUksQ0FBQ0MsY0FBYyxHQUFHLElBQUksQ0FBQTtJQUMxQixJQUFJLENBQUNDLGtCQUFrQixHQUFHLElBQUksQ0FBQ0MsZUFBZSxHQUFHQyxtQkFBbUIsR0FBR0MsaUJBQWlCLENBQUE7SUFDeEYsSUFBSSxDQUFDQyxvQkFBb0IsR0FBRyxJQUFJLENBQUE7QUFDcEMsR0FBQTtBQUVBLEVBQUEsTUFBTUMsVUFBVSxDQUFDQyxVQUFVLEVBQUVDLFFBQVEsRUFBRTtBQUVuQyxJQUFBLElBQUksQ0FBQ0MsTUFBTSxDQUFDQyxTQUFTLENBQUNDLEdBQUcsRUFBRTtBQUN2QixNQUFBLE1BQU0sSUFBSUMsS0FBSyxDQUFDLHdGQUF3RixDQUFDLENBQUE7QUFDN0csS0FBQTs7QUFFQTtBQUNBQyxJQUFBQSxLQUFLLENBQUNDLEdBQUcsQ0FBQyx3Q0FBd0MsQ0FBQyxDQUFBO0lBRW5ELE1BQU1DLFVBQVUsR0FBSUMsR0FBRyxJQUFLO0FBQ3hCLE1BQUEsT0FBTyxJQUFJQyxPQUFPLENBQUMsVUFBVUMsT0FBTyxFQUFFQyxNQUFNLEVBQUU7QUFDMUMsUUFBQSxNQUFNQyxNQUFNLEdBQUdDLFFBQVEsQ0FBQ0MsYUFBYSxDQUFDLFFBQVEsQ0FBQyxDQUFBO1FBQy9DRixNQUFNLENBQUNHLEdBQUcsR0FBR1AsR0FBRyxDQUFBO1FBQ2hCSSxNQUFNLENBQUNJLEtBQUssR0FBRyxLQUFLLENBQUE7UUFDcEJKLE1BQU0sQ0FBQ0ssTUFBTSxHQUFHLFlBQVk7VUFDeEJQLE9BQU8sQ0FBQ0YsR0FBRyxDQUFDLENBQUE7U0FDZixDQUFBO1FBQ0RJLE1BQU0sQ0FBQ00sT0FBTyxHQUFHLFlBQVk7VUFDekJQLE1BQU0sQ0FBQyxJQUFJUCxLQUFLLENBQUUsNkJBQTRCSSxHQUFJLENBQUEsQ0FBQyxDQUFDLENBQUMsQ0FBQTtTQUN4RCxDQUFBO0FBQ0RLLFFBQUFBLFFBQVEsQ0FBQ00sSUFBSSxDQUFDQyxXQUFXLENBQUNSLE1BQU0sQ0FBQyxDQUFBO0FBQ3JDLE9BQUMsQ0FBQyxDQUFBO0tBQ0wsQ0FBQTs7QUFFRDtJQUNBLE1BQU1MLFVBQVUsQ0FBQ1IsVUFBVSxDQUFDLENBQUE7SUFDNUIsTUFBTVEsVUFBVSxDQUFDUCxRQUFRLENBQUMsQ0FBQTtBQUUxQixJQUFBLElBQUksQ0FBQ3FCLE9BQU8sR0FBRyxNQUFNQSxPQUFPLEVBQUUsQ0FBQTtJQUU5QixNQUFNQyxRQUFRLEdBQUd0QixRQUFRLENBQUN1QixPQUFPLENBQUMsS0FBSyxFQUFFLE9BQU8sQ0FBQyxDQUFBO0FBQ2pELElBQUEsSUFBSSxDQUFDQyxLQUFLLEdBQUcsTUFBTUEsS0FBSyxDQUFDRixRQUFRLENBQUMsQ0FBQTs7QUFFbEM7QUFDUjtBQUNBO0FBQ0E7SUFDUSxJQUFJLENBQUN4RCxVQUFVLEdBQUcsTUFBTW1DLE1BQU0sQ0FBQ0MsU0FBUyxDQUFDQyxHQUFHLENBQUNzQixjQUFjLEVBQUUsQ0FBQTs7QUFFN0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0lBQ0EsTUFBTUMsZ0JBQWdCLEdBQUcsRUFBRSxDQUFBO0lBQzNCLE1BQU1DLGNBQWMsR0FBSUMsT0FBTyxJQUFLO01BQ2hDLElBQUksSUFBSSxDQUFDOUQsVUFBVSxDQUFDK0QsUUFBUSxDQUFDQyxHQUFHLENBQUNGLE9BQU8sQ0FBQyxFQUFFO0FBQ3ZDRixRQUFBQSxnQkFBZ0IsQ0FBQ0ssSUFBSSxDQUFDSCxPQUFPLENBQUMsQ0FBQTtBQUM5QnZCLFFBQUFBLEtBQUssQ0FBQ0MsR0FBRyxDQUFDLDBCQUEwQixHQUFHc0IsT0FBTyxDQUFDLENBQUE7QUFDL0MsUUFBQSxPQUFPLElBQUksQ0FBQTtBQUNmLE9BQUE7QUFDQSxNQUFBLE9BQU8sS0FBSyxDQUFBO0tBQ2YsQ0FBQTtBQUNELElBQUEsSUFBSSxDQUFDbEMsZUFBZSxHQUFHaUMsY0FBYyxDQUFDLG9CQUFvQixDQUFDLENBQUE7O0FBRTNEO0FBQ1I7QUFDQTtBQUNBO0lBQ1EsSUFBSSxDQUFDSyxJQUFJLEdBQUcsTUFBTSxJQUFJLENBQUNsRSxVQUFVLENBQUNtRSxhQUFhLENBQUM7TUFDNUNQLGdCQUFnQjtBQUVoQjtBQUNBUSxNQUFBQSxjQUFjLEVBQUUsRUFDaEI7QUFDSixLQUFDLENBQUMsQ0FBQTtJQUVGLElBQUksQ0FBQ3RFLGNBQWMsRUFBRSxDQUFBOztBQUVyQjtJQUNBLElBQUksQ0FBQ3VFLGFBQWEsQ0FBQ2xDLE1BQU0sQ0FBQ21DLFVBQVUsRUFBRW5DLE1BQU0sQ0FBQ29DLFdBQVcsQ0FBQyxDQUFBO0lBRXpELElBQUksQ0FBQ0MsVUFBVSxHQUFHLElBQUksQ0FBQ3pGLE1BQU0sQ0FBQzBGLFVBQVUsQ0FBQyxRQUFRLENBQUMsQ0FBQTs7QUFFbEQ7QUFDQSxJQUFBLE1BQU1DLHFCQUFxQixHQUFHdEMsU0FBUyxDQUFDQyxHQUFHLENBQUNzQyx3QkFBd0IsRUFBRSxDQUFBO0lBQ3RFLElBQUksQ0FBQ0MsaUJBQWlCLEdBQUdGLHFCQUFxQixLQUFLLFlBQVksR0FBRzVDLGlCQUFpQixHQUFHK0MsaUJBQWlCLENBQUE7O0FBRXZHO0FBQ1I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNRLElBQUksQ0FBQ0MsWUFBWSxHQUFHO01BQ2hCQyxNQUFNLEVBQUUsSUFBSSxDQUFDYixJQUFJO0FBQ2pCYyxNQUFBQSxVQUFVLEVBQUUsTUFBTTtBQUNsQkMsTUFBQUEsU0FBUyxFQUFFLFFBQVE7QUFBRzs7QUFFdEI7QUFDQUMsTUFBQUEsTUFBTSxFQUFFUixxQkFBcUI7QUFFN0I7TUFDQVMsS0FBSyxFQUFFQyxlQUFlLENBQUNDLGlCQUFpQixHQUFHRCxlQUFlLENBQUNFLFFBQVEsR0FBR0YsZUFBZSxDQUFDRyxRQUFRO0FBRTlGO0FBQ0FDLE1BQUFBLFdBQVcsRUFBRSxFQUFBO0tBQ2hCLENBQUE7SUFDRCxJQUFJLENBQUNoQixVQUFVLENBQUNpQixTQUFTLENBQUMsSUFBSSxDQUFDWCxZQUFZLENBQUMsQ0FBQTtJQUU1QyxJQUFJLENBQUNZLGlCQUFpQixFQUFFLENBQUE7QUFFeEIsSUFBQSxJQUFJLENBQUN0RyxhQUFhLEdBQUcsSUFBSXVHLG1CQUFtQixDQUFDLElBQUksQ0FBQyxDQUFBO0lBRWxELElBQUksQ0FBQ0MsUUFBUSxFQUFFLENBQUE7QUFFZixJQUFBLE9BQU8sSUFBSSxDQUFBO0FBQ2YsR0FBQTtBQUVBRixFQUFBQSxpQkFBaUIsR0FBRztBQUNoQixJQUFBLElBQUksQ0FBQ0cscUJBQXFCLEdBQUcsSUFBSUMsSUFBSSxFQUFFLENBQUE7QUFDdkMsSUFBQSxJQUFJLENBQUM3RyxXQUFXLEdBQUcsSUFBSThHLFlBQVksQ0FBQztBQUNoQ0MsTUFBQUEsSUFBSSxFQUFFLG1CQUFtQjtBQUN6QkMsTUFBQUEsY0FBYyxFQUFFLElBQUk7QUFDcEJDLE1BQUFBLEtBQUssRUFBRSxJQUFJO01BQ1h2RyxPQUFPLEVBQUUsSUFBSSxDQUFDQSxPQUFBQTtBQUNsQixLQUFDLENBQUMsQ0FBQTtBQUNOLEdBQUE7QUFFQXdHLEVBQUFBLFlBQVksQ0FBQ0MsS0FBSyxFQUFFQyxNQUFNLEVBQUU7SUFFeEIsSUFBSSxDQUFDQyxNQUFNLEdBQUdGLEtBQUssQ0FBQTtJQUNuQixJQUFJLENBQUNHLE9BQU8sR0FBR0YsTUFBTSxDQUFBO0FBRXJCLElBQUEsSUFBSSxJQUFJLENBQUN0SCxNQUFNLENBQUNxSCxLQUFLLEtBQUtBLEtBQUssSUFBSSxJQUFJLENBQUNySCxNQUFNLENBQUNzSCxNQUFNLEtBQUtBLE1BQU0sRUFBRTtBQUM5RCxNQUFBLElBQUksQ0FBQ3RILE1BQU0sQ0FBQ3FILEtBQUssR0FBR0EsS0FBSyxDQUFBO0FBQ3pCLE1BQUEsSUFBSSxDQUFDckgsTUFBTSxDQUFDc0gsTUFBTSxHQUFHQSxNQUFNLENBQUE7TUFDM0IsSUFBSSxDQUFDRyxJQUFJLENBQUMzSCxjQUFjLENBQUM0SCxZQUFZLEVBQUVMLEtBQUssRUFBRUMsTUFBTSxDQUFDLENBQUE7QUFDekQsS0FBQTtBQUNKLEdBQUE7QUFFQUssRUFBQUEsVUFBVSxHQUFHO0lBRVQsS0FBSyxDQUFDQSxVQUFVLEVBQUUsQ0FBQTtBQUVsQkMsSUFBQUEsV0FBVyxDQUFDQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUE7QUFDeEJELElBQUFBLFdBQVcsQ0FBQ0UsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFBOztBQUUxQjtBQUNBLElBQUEsTUFBTUMsY0FBYyxHQUFHLElBQUksQ0FBQ3RDLFVBQVUsQ0FBQ3VDLGlCQUFpQixFQUFFLENBQUE7QUFDMURDLElBQUFBLFdBQVcsQ0FBQ0MsUUFBUSxDQUFDSCxjQUFjLEVBQUcsQ0FBQSxFQUFFLElBQUksQ0FBQzdILFdBQVcsQ0FBQytHLElBQUssQ0FBQSxDQUFDLENBQUMsQ0FBQTs7QUFFaEU7QUFDQSxJQUFBLElBQUksSUFBSSxDQUFDSCxxQkFBcUIsQ0FBQ3FCLENBQUMsS0FBS0osY0FBYyxDQUFDVixLQUFLLElBQUksSUFBSSxDQUFDUCxxQkFBcUIsQ0FBQ3NCLENBQUMsS0FBS0wsY0FBYyxDQUFDVCxNQUFNLEVBQUU7QUFFakgsTUFBQSxJQUFJLENBQUNSLHFCQUFxQixDQUFDdUIsR0FBRyxDQUFDTixjQUFjLENBQUNWLEtBQUssRUFBRVUsY0FBYyxDQUFDVCxNQUFNLENBQUMsQ0FBQTtBQUUzRSxNQUFBLElBQUksQ0FBQ3BILFdBQVcsQ0FBQ1ksT0FBTyxFQUFFLENBQUE7TUFDMUIsSUFBSSxDQUFDWixXQUFXLEdBQUcsSUFBSSxDQUFBO01BRXZCLElBQUksQ0FBQ3lHLGlCQUFpQixFQUFFLENBQUE7QUFDNUIsS0FBQTtBQUVBLElBQUEsTUFBTTJCLEVBQUUsR0FBRyxJQUFJLENBQUNwSSxXQUFXLENBQUE7QUFDM0IsSUFBQSxNQUFNcUksR0FBRyxHQUFHRCxFQUFFLENBQUNFLElBQUksQ0FBQTs7QUFFbkI7QUFDQUQsSUFBQUEsR0FBRyxDQUFDRSxXQUFXLEdBQUdWLGNBQWMsQ0FBQzVCLE1BQU0sQ0FBQTtBQUV2QyxJQUFBLElBQUksQ0FBQ3VDLGdCQUFnQixDQUFDSixFQUFFLENBQUMsQ0FBQTs7QUFFekI7QUFDQUMsSUFBQUEsR0FBRyxDQUFDSSxrQkFBa0IsQ0FBQ1osY0FBYyxDQUFDLENBQUE7QUFFdENILElBQUFBLFdBQVcsQ0FBQ2dCLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQTtBQUNyQmhCLElBQUFBLFdBQVcsQ0FBQ2dCLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQTtBQUN6QixHQUFBO0VBRUFDLHVCQUF1QixDQUFDQyxhQUFhLEVBQUU7QUFDbkMsSUFBQSxPQUFPLElBQUlDLG1CQUFtQixDQUFDRCxhQUFhLENBQUMsQ0FBQTtBQUNqRCxHQUFBO0FBRUFFLEVBQUFBLHNCQUFzQixDQUFDQyxZQUFZLEVBQUU5QyxNQUFNLEVBQUU7QUFDekMsSUFBQSxPQUFPLElBQUkrQyxrQkFBa0IsQ0FBQ0QsWUFBWSxFQUFFOUMsTUFBTSxDQUFDLENBQUE7QUFDdkQsR0FBQTtFQUVBZ0QscUJBQXFCLENBQUNDLFdBQVcsRUFBRTtBQUMvQixJQUFBLE9BQU8sSUFBSUMsaUJBQWlCLENBQUNELFdBQVcsQ0FBQyxDQUFBO0FBQzdDLEdBQUE7RUFFQUUsZ0JBQWdCLENBQUNDLE1BQU0sRUFBRTtBQUNyQixJQUFBLE9BQU8sSUFBSUMsWUFBWSxDQUFDRCxNQUFNLENBQUMsQ0FBQTtBQUNuQyxHQUFBO0VBRUFFLGlCQUFpQixDQUFDQyxPQUFPLEVBQUU7QUFDdkIsSUFBQSxPQUFPLElBQUlDLGFBQWEsQ0FBQ0QsT0FBTyxDQUFDLENBQUE7QUFDckMsR0FBQTtFQUVBRSxzQkFBc0IsQ0FBQ0MsWUFBWSxFQUFFO0FBQ2pDLElBQUEsT0FBTyxJQUFJQyxrQkFBa0IsQ0FBQ0QsWUFBWSxDQUFDLENBQUE7QUFDL0MsR0FBQTtFQUVBRSx5QkFBeUIsQ0FBQ0MsZUFBZSxFQUFFO0FBQ3ZDLElBQUEsT0FBTyxJQUFJQyxxQkFBcUIsQ0FBQ0QsZUFBZSxDQUFDLENBQUE7QUFDckQsR0FBQTtFQUVBRSxtQkFBbUIsQ0FBQ0MsU0FBUyxFQUFFO0lBQzNCLE9BQU8sSUFBSUMsZUFBZSxFQUFFLENBQUE7QUFDaEMsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNJQyxFQUFBQSxZQUFZLENBQUNDLEtBQUssRUFBRUgsU0FBUyxFQUFFO0FBRTNCO0lBQ0EsSUFBSSxJQUFJLENBQUNJLFdBQVcsRUFBRTtBQUVsQjtBQUNBLE1BQUEsSUFBSSxDQUFDQSxXQUFXLENBQUNGLFlBQVksQ0FBQ0MsS0FBSyxFQUFFSCxTQUFTLENBQUMzQixJQUFJLENBQUMyQixTQUFTLENBQUMsQ0FBQTs7QUFFOUQ7TUFDQSxJQUFJLENBQUM1SixnQkFBZ0IsQ0FBQytKLEtBQUssQ0FBQyxHQUFHSCxTQUFTLENBQUNoRSxNQUFNLENBQUNxQyxJQUFJLENBQUE7QUFDeEQsS0FBQTtBQUNKLEdBQUE7QUFFQWdDLEVBQUFBLGtCQUFrQixDQUFDdkIsWUFBWSxFQUFFd0IsSUFBSSxFQUFFO0FBRW5DLElBQUEsTUFBTXRFLE1BQU0sR0FBRzhDLFlBQVksQ0FBQzlDLE1BQU0sQ0FBQTtBQUNsQyxJQUFBLE1BQU11RSxZQUFZLEdBQUd2RSxNQUFNLENBQUN3RSxRQUFRLENBQUNDLE1BQU0sQ0FBQTtBQUMzQyxJQUFBLE1BQU1DLFFBQVEsR0FBRzVCLFlBQVksQ0FBQ1QsSUFBSSxDQUFDc0MsTUFBTSxDQUFBO0lBQ3pDLEtBQUssSUFBSUMsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHTCxZQUFZLEVBQUVLLENBQUMsRUFBRSxFQUFFO0FBQ25DLE1BQUEsTUFBTUMsT0FBTyxHQUFHN0UsTUFBTSxDQUFDd0UsUUFBUSxDQUFDSSxDQUFDLENBQUMsQ0FBQTtBQUNsQyxNQUFBLElBQUksQ0FBQ1IsV0FBVyxDQUFDVSxlQUFlLENBQUNSLElBQUksR0FBR00sQ0FBQyxFQUFFRixRQUFRLEVBQUVHLE9BQU8sQ0FBQ0UsTUFBTSxDQUFDLENBQUE7QUFDeEUsS0FBQTtBQUVBLElBQUEsT0FBT1IsWUFBWSxDQUFBO0FBQ3ZCLEdBQUE7RUFFQVMsSUFBSSxDQUFDQyxTQUFTLEVBQUVDLFlBQVksR0FBRyxDQUFDLEVBQUVDLFdBQVcsRUFBRTtBQUUzQyxJQUFBLElBQUksSUFBSSxDQUFDL0IsTUFBTSxDQUFDZ0MsS0FBSyxJQUFJLENBQUMsSUFBSSxDQUFDaEMsTUFBTSxDQUFDaUMsTUFBTSxFQUFFO0FBRTFDNUQsTUFBQUEsV0FBVyxDQUFDRSxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUE7QUFFMUIsTUFBQSxNQUFNeUMsV0FBVyxHQUFHLElBQUksQ0FBQ0EsV0FBVyxDQUFBO0FBQ3BDL0csTUFBQUEsS0FBSyxDQUFDaUksTUFBTSxDQUFDbEIsV0FBVyxDQUFDLENBQUE7O0FBRXpCO0FBQ0EsTUFBQSxNQUFNbUIsR0FBRyxHQUFHLElBQUksQ0FBQ0MsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2pDLE1BQUEsTUFBTUMsR0FBRyxHQUFHLElBQUksQ0FBQ0QsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2pDLE1BQUEsSUFBSSxDQUFDQSxhQUFhLENBQUNmLE1BQU0sR0FBRyxDQUFDLENBQUE7QUFFN0IsTUFBQSxJQUFJYyxHQUFHLEVBQUU7UUFDTCxNQUFNRyxNQUFNLEdBQUcsSUFBSSxDQUFDckIsa0JBQWtCLENBQUNrQixHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUE7QUFDOUMsUUFBQSxJQUFJRSxHQUFHLEVBQUU7QUFDTCxVQUFBLElBQUksQ0FBQ3BCLGtCQUFrQixDQUFDb0IsR0FBRyxFQUFFQyxNQUFNLENBQUMsQ0FBQTtBQUN4QyxTQUFBO0FBQ0osT0FBQTs7QUFFQTtBQUNBLE1BQUEsTUFBTXZMLFFBQVEsR0FBRyxJQUFJLENBQUNILGNBQWMsQ0FBQzJMLEdBQUcsQ0FBQ1YsU0FBUyxFQUFFTSxHQUFHLG9CQUFIQSxHQUFHLENBQUV2RixNQUFNLEVBQUV5RixHQUFHLG9CQUFIQSxHQUFHLENBQUV6RixNQUFNLEVBQUUsSUFBSSxDQUFDb0QsTUFBTSxFQUFFLElBQUksQ0FBQ00sWUFBWSxFQUNuRSxJQUFJLENBQUN0SixnQkFBZ0IsRUFBRSxJQUFJLENBQUN3TCxVQUFVLEVBQUUsSUFBSSxDQUFDQyxVQUFVLENBQUMsQ0FBQTtBQUNqR3hJLE1BQUFBLEtBQUssQ0FBQ2lJLE1BQU0sQ0FBQ25MLFFBQVEsQ0FBQyxDQUFBO0FBRXRCLE1BQUEsSUFBSSxJQUFJLENBQUNBLFFBQVEsS0FBS0EsUUFBUSxFQUFFO1FBQzVCLElBQUksQ0FBQ0EsUUFBUSxHQUFHQSxRQUFRLENBQUE7QUFDeEJpSyxRQUFBQSxXQUFXLENBQUMwQixXQUFXLENBQUMzTCxRQUFRLENBQUMsQ0FBQTtBQUNyQyxPQUFBOztBQUVBO0FBQ0EsTUFBQSxNQUFNNEwsRUFBRSxHQUFHLElBQUksQ0FBQzlDLFdBQVcsQ0FBQTtBQUMzQixNQUFBLElBQUk4QyxFQUFFLEVBQUU7UUFDSixJQUFJLENBQUM5QyxXQUFXLEdBQUcsSUFBSSxDQUFBO0FBQ3ZCbUIsUUFBQUEsV0FBVyxDQUFDNEIsY0FBYyxDQUFDRCxFQUFFLENBQUMxRCxJQUFJLENBQUNzQyxNQUFNLEVBQUVvQixFQUFFLENBQUMxRCxJQUFJLENBQUNyQyxNQUFNLENBQUMsQ0FBQTtBQUMxRG9FLFFBQUFBLFdBQVcsQ0FBQzZCLFdBQVcsQ0FBQ2hCLFNBQVMsQ0FBQ2lCLEtBQUssRUFBRWhCLFlBQVksRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFBO0FBQ25FLE9BQUMsTUFBTTtBQUNIZCxRQUFBQSxXQUFXLENBQUNZLElBQUksQ0FBQ0MsU0FBUyxDQUFDaUIsS0FBSyxFQUFFaEIsWUFBWSxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQTtBQUN6RCxPQUFBO0FBRUF6RCxNQUFBQSxXQUFXLENBQUNnQixHQUFHLENBQUMsSUFBSSxFQUFFO1FBQ2xCOEMsR0FBRztRQUNIRSxHQUFHO1FBQ0hNLEVBQUU7UUFDRmQsU0FBUztRQUNUQyxZQUFZO0FBQ1ovSyxRQUFBQSxRQUFBQTtBQUNKLE9BQUMsQ0FBQyxDQUFBO0FBQ04sS0FBQTtBQUNKLEdBQUE7RUFFQWdNLFNBQVMsQ0FBQy9DLE1BQU0sRUFBRTtJQUVkLElBQUksQ0FBQ0EsTUFBTSxHQUFHQSxNQUFNLENBQUE7O0FBR3BCO0lBQ0EsSUFBSSxDQUFDZ0QsdUJBQXVCLEVBQUUsQ0FBQTtBQUc5QixJQUFBLE9BQU8sSUFBSSxDQUFBO0FBQ2YsR0FBQTtFQUVBQyxhQUFhLENBQUNULFVBQVUsRUFBRTtBQUN0QixJQUFBLElBQUksQ0FBQ0EsVUFBVSxDQUFDVSxJQUFJLENBQUNWLFVBQVUsQ0FBQyxDQUFBO0FBQ3BDLEdBQUE7RUFFQVcsYUFBYSxDQUFDVixVQUFVLEVBQUU7QUFDdEIsSUFBQSxJQUFJLENBQUNBLFVBQVUsQ0FBQ1MsSUFBSSxDQUFDVCxVQUFVLENBQUMsQ0FBQTtBQUNwQyxHQUFBO0VBRUFXLGFBQWEsQ0FBQ0MsQ0FBQyxFQUFFQyxDQUFDLEVBQUVDLENBQUMsRUFBRUMsQ0FBQyxFQUFFO0FBQ3RCO0FBQUEsR0FBQTtFQUdKQyxZQUFZLENBQUNDLElBQUksRUFBRSxFQUNuQjtFQUVBQyxZQUFZLENBQUNDLFNBQVMsRUFBRSxFQUN4QjtFQUVBQyxXQUFXLENBQUNDLFFBQVEsRUFBRSxFQUN0QjtBQUVBQyxFQUFBQSxXQUFXLEdBQUc7QUFDVixJQUFBLE9BQU9DLGFBQWEsQ0FBQTtBQUN4QixHQUFBO0VBRUFDLGtCQUFrQixDQUFDQyxLQUFLLEVBQUUsRUFDMUI7RUFFQUMsYUFBYSxDQUFDQyxVQUFVLEVBQUUsRUFDMUI7QUFFQUMsRUFBQUEsdUJBQXVCLEdBQUc7SUFDdEIsS0FBSyxDQUFDQSx1QkFBdUIsRUFBRSxDQUFBO0FBQ25DLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0lDLFNBQVMsQ0FBQ0MsVUFBVSxFQUFFO0lBRWxCLE1BQU14RixFQUFFLEdBQUd3RixVQUFVLENBQUNqRSxZQUFZLElBQUksSUFBSSxDQUFDM0osV0FBVyxDQUFBO0FBQ3REc0QsSUFBQUEsS0FBSyxDQUFDaUksTUFBTSxDQUFDbkQsRUFBRSxDQUFDLENBQUE7SUFFaEIsSUFBSSxDQUFDdUIsWUFBWSxHQUFHdkIsRUFBRSxDQUFBOztBQUV0QjtBQUNBLElBQUEsTUFBTUMsR0FBRyxHQUFHRCxFQUFFLENBQUNFLElBQUksQ0FBQTtBQUVuQlosSUFBQUEsV0FBVyxDQUFDbUcsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFBO0FBQzFCbkcsSUFBQUEsV0FBVyxDQUFDRSxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUE7O0FBRTFCO0FBQ0EsSUFBQSxJQUFJUSxFQUFFLEtBQUssSUFBSSxDQUFDcEksV0FBVyxFQUFFO0FBQ3pCLE1BQUEsSUFBSSxDQUFDd0ksZ0JBQWdCLENBQUNKLEVBQUUsQ0FBQyxDQUFBO0FBQzdCLEtBQUE7O0FBRUE7QUFDQUMsSUFBQUEsR0FBRyxDQUFDeUYsa0JBQWtCLENBQUNGLFVBQVUsQ0FBQyxDQUFBOztBQUVsQztJQUNBLElBQUksQ0FBQ3ROLGNBQWMsR0FBRyxJQUFJLENBQUMyRSxJQUFJLENBQUM4SSxvQkFBb0IsRUFBRSxDQUFBO0lBQ3REaEcsV0FBVyxDQUFDQyxRQUFRLENBQUMsSUFBSSxDQUFDMUgsY0FBYyxFQUFFc04sVUFBVSxDQUFDN0csSUFBSSxDQUFDLENBQUE7O0FBRTFEO0lBQ0EsSUFBSSxDQUFDM0csUUFBUSxHQUFHLElBQUksQ0FBQTs7QUFFcEI7QUFDQSxJQUFBLElBQUksQ0FBQ2lLLFdBQVcsR0FBRyxJQUFJLENBQUMvSixjQUFjLENBQUMwTixlQUFlLENBQUMzRixHQUFHLENBQUM0RixvQkFBb0IsQ0FBQyxDQUFBO0lBQ2hGbEcsV0FBVyxDQUFDQyxRQUFRLENBQUMsSUFBSSxDQUFDcUMsV0FBVyxFQUFFdUQsVUFBVSxDQUFDN0csSUFBSSxDQUFDLENBQUE7O0FBRXZEO0FBQ0E7QUFDQTtJQUNBLE1BQU07TUFBRUksS0FBSztBQUFFQyxNQUFBQSxNQUFBQTtBQUFPLEtBQUMsR0FBR2dCLEVBQUUsQ0FBQTtJQUM1QixJQUFJLENBQUM4RixXQUFXLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRS9HLEtBQUssRUFBRUMsTUFBTSxDQUFDLENBQUE7SUFDckMsSUFBSSxDQUFDK0csVUFBVSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUVoSCxLQUFLLEVBQUVDLE1BQU0sQ0FBQyxDQUFBO0lBRXBDOUQsS0FBSyxDQUFDaUksTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDNkMsZ0JBQWdCLEVBQUUsZ0VBQWdFLENBQUMsQ0FBQTtJQUN0RyxJQUFJLENBQUNBLGdCQUFnQixHQUFHLElBQUksQ0FBQTtBQUNoQyxHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJQyxPQUFPLENBQUNULFVBQVUsRUFBRTtBQUVoQixJQUFBLElBQUksQ0FBQ3ZELFdBQVcsQ0FBQzNCLEdBQUcsRUFBRSxDQUFBO0lBQ3RCLElBQUksQ0FBQzJCLFdBQVcsR0FBRyxJQUFJLENBQUE7QUFFdkIsSUFBQSxJQUFJLENBQUNwRixJQUFJLENBQUNxSixLQUFLLENBQUNDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQ2pPLGNBQWMsQ0FBQ2tPLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQTtJQUN0RCxJQUFJLENBQUNsTyxjQUFjLEdBQUcsSUFBSSxDQUFBO0FBRTFCb0gsSUFBQUEsV0FBVyxDQUFDZ0IsR0FBRyxDQUFDLElBQUksRUFBRTtBQUFFa0YsTUFBQUEsVUFBQUE7QUFBVyxLQUFDLENBQUMsQ0FBQTtBQUNyQ2xHLElBQUFBLFdBQVcsQ0FBQ2dCLEdBQUcsQ0FBQyxJQUFJLEVBQUU7QUFBRWtGLE1BQUFBLFVBQUFBO0FBQVcsS0FBQyxDQUFDLENBQUE7O0FBRXJDO0FBQ0EsSUFBQSxJQUFJLENBQUN2TixnQkFBZ0IsQ0FBQ3FLLE1BQU0sR0FBRyxDQUFDLENBQUE7SUFFaEMsSUFBSSxDQUFDMEQsZ0JBQWdCLEdBQUcsS0FBSyxDQUFBO0FBQ2pDLEdBQUE7RUFFQUssS0FBSyxDQUFDMU8sT0FBTyxFQUFFO0lBQ1gsSUFBSUEsT0FBTyxDQUFDMk8sS0FBSyxFQUFFO0FBQ2YsTUFBQSxJQUFJLENBQUN2TyxhQUFhLENBQUNzTyxLQUFLLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQzlFLFlBQVksRUFBRTVKLE9BQU8sRUFBRSxJQUFJLENBQUM0TyxtQkFBbUIsQ0FBQyxDQUFBO0FBQ3hGLEtBQUE7QUFDSixHQUFBO0FBRUEsRUFBQSxJQUFJeEgsS0FBSyxHQUFHO0lBQ1IsT0FBTyxJQUFJLENBQUNFLE1BQU0sQ0FBQTtBQUN0QixHQUFBO0FBRUEsRUFBQSxJQUFJRCxNQUFNLEdBQUc7SUFDVCxPQUFPLElBQUksQ0FBQ0UsT0FBTyxDQUFBO0FBQ3ZCLEdBQUE7RUFFQXNILFlBQVksQ0FBQ0MsRUFBRSxFQUFFLEVBQ2pCO0FBRUFDLEVBQUFBLGtCQUFrQixDQUFDQyxTQUFTLEVBQUVDLFNBQVMsRUFBRSxFQUN6QztFQUVBQyxjQUFjLENBQUNDLE1BQU0sRUFBRSxFQUN2QjtBQUVBQyxFQUFBQSxjQUFjLENBQUNwQyxJQUFJLEVBQUVxQyxHQUFHLEVBQUVDLElBQUksRUFBRSxFQUNoQztFQUVBQyxtQkFBbUIsQ0FBQ0MsSUFBSSxFQUFFQyxLQUFLLEVBQUVDLEtBQUssRUFBRUMsU0FBUyxFQUFFLEVBQ25EO0VBRUF4QixXQUFXLENBQUNqRyxDQUFDLEVBQUVDLENBQUMsRUFBRXlILENBQUMsRUFBRUMsQ0FBQyxFQUFFO0FBQ3BCO0FBQ0E7QUFDQTtJQUNBLElBQUksSUFBSSxDQUFDdkYsV0FBVyxFQUFFO0FBRWxCLE1BQUEsSUFBSSxDQUFDLElBQUksQ0FBQ1YsWUFBWSxDQUFDa0csS0FBSyxFQUFFO1FBQzFCM0gsQ0FBQyxHQUFHLElBQUksQ0FBQ3lCLFlBQVksQ0FBQ3ZDLE1BQU0sR0FBR2MsQ0FBQyxHQUFHMEgsQ0FBQyxDQUFBO0FBQ3hDLE9BQUE7TUFFQSxJQUFJLENBQUNFLEVBQUUsR0FBRzdILENBQUMsQ0FBQTtNQUNYLElBQUksQ0FBQzhILEVBQUUsR0FBRzdILENBQUMsQ0FBQTtNQUNYLElBQUksQ0FBQzhILEVBQUUsR0FBR0wsQ0FBQyxDQUFBO01BQ1gsSUFBSSxDQUFDTSxFQUFFLEdBQUdMLENBQUMsQ0FBQTtBQUVYLE1BQUEsSUFBSSxDQUFDdkYsV0FBVyxDQUFDNkQsV0FBVyxDQUFDakcsQ0FBQyxFQUFFQyxDQUFDLEVBQUV5SCxDQUFDLEVBQUVDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUE7QUFDbEQsS0FBQTtBQUNKLEdBQUE7RUFFQXpCLFVBQVUsQ0FBQ2xHLENBQUMsRUFBRUMsQ0FBQyxFQUFFeUgsQ0FBQyxFQUFFQyxDQUFDLEVBQUU7QUFDbkI7QUFDQTtBQUNBO0lBQ0EsSUFBSSxJQUFJLENBQUN2RixXQUFXLEVBQUU7QUFFbEIsTUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDVixZQUFZLENBQUNrRyxLQUFLLEVBQUU7UUFDMUIzSCxDQUFDLEdBQUcsSUFBSSxDQUFDeUIsWUFBWSxDQUFDdkMsTUFBTSxHQUFHYyxDQUFDLEdBQUcwSCxDQUFDLENBQUE7QUFDeEMsT0FBQTtNQUVBLElBQUksQ0FBQ00sRUFBRSxHQUFHakksQ0FBQyxDQUFBO01BQ1gsSUFBSSxDQUFDa0ksRUFBRSxHQUFHakksQ0FBQyxDQUFBO01BQ1gsSUFBSSxDQUFDa0ksRUFBRSxHQUFHVCxDQUFDLENBQUE7TUFDWCxJQUFJLENBQUNVLEVBQUUsR0FBR1QsQ0FBQyxDQUFBO0FBRVgsTUFBQSxJQUFJLENBQUN2RixXQUFXLENBQUNpRyxjQUFjLENBQUNySSxDQUFDLEVBQUVDLENBQUMsRUFBRXlILENBQUMsRUFBRUMsQ0FBQyxDQUFDLENBQUE7QUFDL0MsS0FBQTtBQUNKLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0lXLGdCQUFnQixDQUFDQyxNQUFNLEVBQUVDLElBQUksRUFBRUMsS0FBSyxFQUFFekosS0FBSyxFQUFFO0FBQUEsSUFBQSxJQUFBLG9CQUFBLENBQUE7QUFFekM7QUFDQSxJQUFBLE1BQU0wSixRQUFRLEdBQUc7TUFDYnhKLEtBQUssRUFBRXFKLE1BQU0sR0FBR0EsTUFBTSxDQUFDckosS0FBSyxHQUFHc0osSUFBSSxDQUFDdEosS0FBSztNQUN6Q0MsTUFBTSxFQUFFb0osTUFBTSxHQUFHQSxNQUFNLENBQUNwSixNQUFNLEdBQUdxSixJQUFJLENBQUNySixNQUFNO0FBQzVDd0osTUFBQUEsa0JBQWtCLEVBQUUsQ0FBQTtLQUN2QixDQUFBO0FBRURDLElBQUFBLGFBQWEsQ0FBQ0MsYUFBYSxDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsQ0FBQTs7QUFFNUM7SUFDQSxNQUFNeFEsY0FBYyxHQUFHLENBQUEsb0JBQUEsR0FBQSxJQUFJLENBQUNBLGNBQWMsS0FBSSxJQUFBLEdBQUEsb0JBQUEsR0FBQSxJQUFJLENBQUMyRSxJQUFJLENBQUM4SSxvQkFBb0IsRUFBRSxDQUFBO0FBRTlFLElBQUEsSUFBSTJDLEtBQUssRUFBRTtBQUVQO0FBQ0E7QUFDQSxNQUFBLE1BQU1LLE9BQU8sR0FBRztBQUNadkgsUUFBQUEsT0FBTyxFQUFFZ0gsTUFBTSxHQUFHQSxNQUFNLENBQUNRLFdBQVcsQ0FBQzFJLElBQUksQ0FBQzJJLFVBQVUsR0FBRyxJQUFJLENBQUN0SCxZQUFZLENBQUNyQixJQUFJLENBQUM0SSxvQkFBb0I7QUFDbEdDLFFBQUFBLFFBQVEsRUFBRSxDQUFBO09BQ2IsQ0FBQTs7QUFFRDtBQUNBO0FBQ0EsTUFBQSxNQUFNQyxPQUFPLEdBQUc7QUFDWjVILFFBQUFBLE9BQU8sRUFBRWlILElBQUksR0FBR0EsSUFBSSxDQUFDTyxXQUFXLENBQUMxSSxJQUFJLENBQUMySSxVQUFVLEdBQUcsSUFBSSxDQUFDdEgsWUFBWSxDQUFDckIsSUFBSSxDQUFDNEksb0JBQW9CO0FBQzlGQyxRQUFBQSxRQUFRLEVBQUUsQ0FBQTtPQUNiLENBQUE7QUFFRDdOLE1BQUFBLEtBQUssQ0FBQ2lJLE1BQU0sQ0FBQ3dGLE9BQU8sQ0FBQ3ZILE9BQU8sS0FBSyxJQUFJLElBQUk0SCxPQUFPLENBQUM1SCxPQUFPLEtBQUssSUFBSSxDQUFDLENBQUE7TUFDbEVsSixjQUFjLENBQUMrUSxvQkFBb0IsQ0FBQ04sT0FBTyxFQUFFSyxPQUFPLEVBQUVULFFBQVEsQ0FBQyxDQUFBO0FBQ25FLEtBQUE7QUFFQSxJQUFBLElBQUkxSixLQUFLLEVBQUU7QUFFUDtNQUNBLE1BQU1xSyxRQUFRLEdBQUdkLE1BQU0sR0FBR0EsTUFBTSxHQUFHLElBQUksQ0FBQzdHLFlBQVksQ0FBQTs7QUFFcEQ7QUFDQTtBQUNBO0FBQ0FyRyxNQUFBQSxLQUFLLENBQUNpSSxNQUFNLENBQUNpRixNQUFNLENBQUM5UCxPQUFPLElBQUksQ0FBQyxFQUFHLENBQUEsb0ZBQUEsRUFBc0Y0USxRQUFRLENBQUN2SyxJQUFLLENBQUMsQ0FBQSxFQUFFdUssUUFBUSxDQUFDLENBQUE7O0FBRW5KO0FBQ0EsTUFBQSxNQUFNUCxPQUFPLEdBQUc7QUFDWnZILFFBQUFBLE9BQU8sRUFBRThILFFBQVEsQ0FBQ2hKLElBQUksQ0FBQ2lKLFlBQVk7QUFDbkNKLFFBQUFBLFFBQVEsRUFBRSxDQUFBO09BQ2IsQ0FBQTs7QUFFRDtBQUNBO0FBQ0EsTUFBQSxNQUFNQyxPQUFPLEdBQUc7QUFDWjVILFFBQUFBLE9BQU8sRUFBRWlILElBQUksR0FBR0EsSUFBSSxDQUFDZSxXQUFXLENBQUNsSixJQUFJLENBQUMySSxVQUFVLEdBQUcsSUFBSSxDQUFDdEgsWUFBWSxDQUFDckIsSUFBSSxDQUFDaUosWUFBWTtBQUN0RkosUUFBQUEsUUFBUSxFQUFFLENBQUE7T0FDYixDQUFBO0FBRUQ3TixNQUFBQSxLQUFLLENBQUNpSSxNQUFNLENBQUN3RixPQUFPLENBQUN2SCxPQUFPLEtBQUssSUFBSSxJQUFJNEgsT0FBTyxDQUFDNUgsT0FBTyxLQUFLLElBQUksQ0FBQyxDQUFBO01BQ2xFbEosY0FBYyxDQUFDK1Esb0JBQW9CLENBQUNOLE9BQU8sRUFBRUssT0FBTyxFQUFFVCxRQUFRLENBQUMsQ0FBQTtBQUNuRSxLQUFBOztBQUVBO0FBQ0EsSUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDclEsY0FBYyxFQUFFO0FBQ3RCLE1BQUEsSUFBSSxDQUFDMkUsSUFBSSxDQUFDcUosS0FBSyxDQUFDQyxNQUFNLENBQUMsQ0FBQ2pPLGNBQWMsQ0FBQ2tPLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQTtBQUNyRCxLQUFBO0FBRUFxQyxJQUFBQSxhQUFhLENBQUNZLFlBQVksQ0FBQyxJQUFJLENBQUMsQ0FBQTtBQUVoQyxJQUFBLE9BQU8sSUFBSSxDQUFBO0FBQ2YsR0FBQTtFQUdBQyxVQUFVLENBQUMzSyxJQUFJLEVBQUU7QUFBQSxJQUFBLElBQUEsaUJBQUEsQ0FBQTtBQUNiLElBQUEsQ0FBQSxpQkFBQSxHQUFBLElBQUksQ0FBQ3NELFdBQVcsS0FBQSxJQUFBLEdBQUEsS0FBQSxDQUFBLEdBQWhCLGtCQUFrQnNILGNBQWMsQ0FBQzVLLElBQUksQ0FBQyxDQUFBO0FBQzFDLEdBQUE7QUFFQTZLLEVBQUFBLFNBQVMsR0FBRztBQUFBLElBQUEsSUFBQSxrQkFBQSxDQUFBO0FBQ1IsSUFBQSxDQUFBLGtCQUFBLEdBQUEsSUFBSSxDQUFDdkgsV0FBVyxLQUFoQixJQUFBLEdBQUEsS0FBQSxDQUFBLEdBQUEsa0JBQUEsQ0FBa0J3SCxhQUFhLEVBQUUsQ0FBQTtBQUNyQyxHQUFBO0FBRUo7Ozs7In0=
