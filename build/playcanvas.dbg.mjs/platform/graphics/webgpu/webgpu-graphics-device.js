/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Debug, DebugHelper } from '../../../core/debug.js';
import { DEVICETYPE_WEBGPU, PIXELFORMAT_RGBA32F, PIXELFORMAT_RGBA8, PIXELFORMAT_BGRA8, CULLFACE_BACK } from '../constants.js';
import { GraphicsDevice } from '../graphics-device.js';
import { RenderTarget } from '../render-target.js';
import { WebgpuBindGroup } from './webgpu-bind-group.js';
import { WebgpuBindGroupFormat } from './webgpu-bind-group-format.js';
import { WebgpuIndexBuffer } from './webgpu-index-buffer.js';
import { WebgpuRenderPipeline } from './webgpu-render-pipeline.js';
import { WebgpuRenderState } from './webgpu-render-state.js';
import { WebgpuRenderTarget } from './webgpu-render-target.js';
import { WebgpuShader } from './webgpu-shader.js';
import { WebgpuTexture } from './webgpu-texture.js';
import { WebgpuUniformBuffer } from './webgpu-uniform-buffer.js';
import { WebgpuVertexBuffer } from './webgpu-vertex-buffer.js';
import { WebgpuClearRenderer } from './webgpu-clear-renderer.js';
import { DebugGraphics } from '../debug-graphics.js';

class WebgpuGraphicsDevice extends GraphicsDevice {
  /**
   * The render target representing the main framebuffer.
   *
   * @type {RenderTarget}
   */

  /**
   * Internal representation of the current render state, as requested by the renderer.
   * In the future this can be completely replaced by a more optimal solution, where
   * render states are bundled together (DX11 style) and set using a single call.
   */

  /**
   * Object responsible for caching and creation of render pipelines.
   */

  /**
   * Object responsible for clearing the rendering surface by rendering a quad.
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
    this.renderState = new WebgpuRenderState();
    this.renderPipeline = new WebgpuRenderPipeline(this);
    this.clearRenderer = new WebgpuClearRenderer();
    this.pipeline = void 0;
    this.bindGroupFormats = [];
    this.commandEncoder = void 0;
    this.deviceType = DEVICETYPE_WEBGPU;

    // TODO: refactor as needed
    this.writeRed = true;
    this.writeGreen = true;
    this.writeBlue = true;
    this.writeAlpha = true;
    this.initDeviceCaps();
  }

  /**
   * Destroy the graphics device.
   */
  destroy() {
    super.destroy();
  }
  initDeviceCaps() {
    this.precision = 'highp';
    this.maxPrecision = 'highp';
    this.maxSamples = 4;
    this.maxTextures = 16;
    this.maxTextureSize = 4096;
    this.maxCubeMapSize = 4096;
    this.maxVolumeSize = 2048;
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
    this.areaLightLutFormat = PIXELFORMAT_RGBA32F;
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

    /**
     * @type {GPUDevice}
     * @private
     */
    this.wgpu = await this.gpuAdapter.requestDevice();

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
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
      // formats that views created from textures returned by getCurrentTexture may use
      viewFormats: []
    };
    this.gpuContext.configure(this.canvasConfig);
    this.createFramebuffer();
    this.postInit();
    return this;
  }
  createFramebuffer() {
    this.frameBuffer = new RenderTarget({
      name: 'WebgpuFramebuffer',
      graphicsDevice: this,
      depth: true,
      samples: 4
    });
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
    if (this.shader.ready) {
      const passEncoder = this.passEncoder;
      Debug.assert(passEncoder);

      // vertex buffers
      const vb0 = this.vertexBuffers[0];
      const vbSlot = this.submitVertexBuffer(vb0, 0);
      const vb1 = this.vertexBuffers[1];
      if (vb1) {
        this.submitVertexBuffer(vb1, vbSlot);
      }
      this.vertexBuffers.length = 0;

      // render pipeline
      const pipeline = this.renderPipeline.get(primitive, vb0.format, vb1 == null ? void 0 : vb1.format, this.shader, this.renderTarget, this.bindGroupFormats, this.renderState);
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
        passEncoder.drawIndexed(ib.numIndices, numInstances, 0, 0, 0);
      } else {
        passEncoder.draw(vb0.numVertices, numInstances, 0, 0);
      }
    }
  }
  setShader(shader) {
    this.shader = shader;

    // TODO: we should probably track other stats instead, like pipeline switches
    this._shaderSwitchesPerFrame++;
    return true;
  }
  setBlending(blending) {
    this.renderState.setBlending(blending);
  }
  setBlendFunction(blendSrc, blendDst) {
    this.renderState.setBlendFunction(blendSrc, blendDst);
  }
  setBlendEquation(blendEquation) {
    this.renderState.setBlendEquation(blendEquation);
  }
  setDepthFunc(func) {}
  setDepthTest(depthTest) {}
  getDepthTest() {
    return true;
  }
  setCullMode(cullMode) {}
  getCullMode() {
    return CULLFACE_BACK;
  }
  setAlphaToCoverage(state) {}
  setColorWrite(writeRed, writeGreen, writeBlue, writeAlpha) {}
  setDepthWrite(writeDepth) {}
  getDepthWrite() {
    return true;
  }
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
    const wrt = rt.impl;

    // current frame color buffer
    let outColorBuffer;
    if (rt === this.frameBuffer) {
      outColorBuffer = this.gpuContext.getCurrentTexture();
      DebugHelper.setLabel(outColorBuffer, rt.name);

      // assign the format, allowing following init call to use it to allocate matching multisampled buffer
      wrt.colorFormat = outColorBuffer.format;
    }
    this.initRenderTarget(rt);

    // assign current frame's render texture if rendering to the main frame buffer
    // TODO: this should probably be done at the start of the frame, so that it can be used
    // as a destination of the copy operation
    if (outColorBuffer) {
      wrt.assignColorTexture(outColorBuffer);
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

    // each render pass can use different number of bind groups
    this.bindGroupFormats.length = 0;
    this.insideRenderPass = false;
  }
  clear(options) {
    if (options.flags) {
      this.clearRenderer.clear(this, this.renderTarget, options);
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
  setViewport(x, y, w, h) {
    // TODO: only execute when it changes. Also, the viewport of encoder  matches the rendering attachments,
    // so we can skip this if fullscreen
    // TODO: this condition should be removed, it's here to handle fake grab pass, which should be refactored instead
    if (this.passEncoder) {
      this.vx = x;
      this.vy = y;
      this.vw = w;
      this.vh = h;
      this.passEncoder.setViewport(x, this.renderTarget.height - y - h, w, h, 0, 1);
    }
  }
  setScissor(x, y, w, h) {
    // TODO: only execute when it changes. Also, the viewport of encoder  matches the rendering attachments,
    // so we can skip this if fullscreen
    // TODO: this condition should be removed, it's here to handle fake grab pass, which should be refactored instead
    if (this.passEncoder) {
      this.sx = x;
      this.sy = y;
      this.sw = w;
      this.sh = h;
      this.passEncoder.setScissorRect(x, this.renderTarget.height - y - h, w, h);
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
      Debug.assert(source.samples <= 1, `copyRenderTarget does not currently support copy of depth from multisampled texture`, sourceRT);

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViZ3B1LWdyYXBoaWNzLWRldmljZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL3BsYXRmb3JtL2dyYXBoaWNzL3dlYmdwdS93ZWJncHUtZ3JhcGhpY3MtZGV2aWNlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnLCBEZWJ1Z0hlbHBlciB9IGZyb20gJy4uLy4uLy4uL2NvcmUvZGVidWcuanMnO1xuXG5pbXBvcnQge1xuICAgIERFVklDRVRZUEVfV0VCR1BVLCBQSVhFTEZPUk1BVF9SR0JBMzJGLCBQSVhFTEZPUk1BVF9SR0JBOCwgUElYRUxGT1JNQVRfQkdSQTgsIENVTExGQUNFX0JBQ0tcbn0gZnJvbSAnLi4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IEdyYXBoaWNzRGV2aWNlIH0gZnJvbSAnLi4vZ3JhcGhpY3MtZGV2aWNlLmpzJztcbmltcG9ydCB7IFJlbmRlclRhcmdldCB9IGZyb20gJy4uL3JlbmRlci10YXJnZXQuanMnO1xuXG5pbXBvcnQgeyBXZWJncHVCaW5kR3JvdXAgfSBmcm9tICcuL3dlYmdwdS1iaW5kLWdyb3VwLmpzJztcbmltcG9ydCB7IFdlYmdwdUJpbmRHcm91cEZvcm1hdCB9IGZyb20gJy4vd2ViZ3B1LWJpbmQtZ3JvdXAtZm9ybWF0LmpzJztcbmltcG9ydCB7IFdlYmdwdUluZGV4QnVmZmVyIH0gZnJvbSAnLi93ZWJncHUtaW5kZXgtYnVmZmVyLmpzJztcbmltcG9ydCB7IFdlYmdwdVJlbmRlclBpcGVsaW5lIH0gZnJvbSAnLi93ZWJncHUtcmVuZGVyLXBpcGVsaW5lLmpzJztcbmltcG9ydCB7IFdlYmdwdVJlbmRlclN0YXRlIH0gZnJvbSAnLi93ZWJncHUtcmVuZGVyLXN0YXRlLmpzJztcbmltcG9ydCB7IFdlYmdwdVJlbmRlclRhcmdldCB9IGZyb20gJy4vd2ViZ3B1LXJlbmRlci10YXJnZXQuanMnO1xuaW1wb3J0IHsgV2ViZ3B1U2hhZGVyIH0gZnJvbSAnLi93ZWJncHUtc2hhZGVyLmpzJztcbmltcG9ydCB7IFdlYmdwdVRleHR1cmUgfSBmcm9tICcuL3dlYmdwdS10ZXh0dXJlLmpzJztcbmltcG9ydCB7IFdlYmdwdVVuaWZvcm1CdWZmZXIgfSBmcm9tICcuL3dlYmdwdS11bmlmb3JtLWJ1ZmZlci5qcyc7XG5pbXBvcnQgeyBXZWJncHVWZXJ0ZXhCdWZmZXIgfSBmcm9tICcuL3dlYmdwdS12ZXJ0ZXgtYnVmZmVyLmpzJztcbmltcG9ydCB7IFdlYmdwdUNsZWFyUmVuZGVyZXIgfSBmcm9tICcuL3dlYmdwdS1jbGVhci1yZW5kZXJlci5qcyc7XG5pbXBvcnQgeyBEZWJ1Z0dyYXBoaWNzIH0gZnJvbSAnLi4vZGVidWctZ3JhcGhpY3MuanMnO1xuXG5jbGFzcyBXZWJncHVHcmFwaGljc0RldmljZSBleHRlbmRzIEdyYXBoaWNzRGV2aWNlIHtcbiAgICAvKipcbiAgICAgKiBUaGUgcmVuZGVyIHRhcmdldCByZXByZXNlbnRpbmcgdGhlIG1haW4gZnJhbWVidWZmZXIuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7UmVuZGVyVGFyZ2V0fVxuICAgICAqL1xuICAgIGZyYW1lQnVmZmVyO1xuXG4gICAgLyoqXG4gICAgICogSW50ZXJuYWwgcmVwcmVzZW50YXRpb24gb2YgdGhlIGN1cnJlbnQgcmVuZGVyIHN0YXRlLCBhcyByZXF1ZXN0ZWQgYnkgdGhlIHJlbmRlcmVyLlxuICAgICAqIEluIHRoZSBmdXR1cmUgdGhpcyBjYW4gYmUgY29tcGxldGVseSByZXBsYWNlZCBieSBhIG1vcmUgb3B0aW1hbCBzb2x1dGlvbiwgd2hlcmVcbiAgICAgKiByZW5kZXIgc3RhdGVzIGFyZSBidW5kbGVkIHRvZ2V0aGVyIChEWDExIHN0eWxlKSBhbmQgc2V0IHVzaW5nIGEgc2luZ2xlIGNhbGwuXG4gICAgICovXG4gICAgcmVuZGVyU3RhdGUgPSBuZXcgV2ViZ3B1UmVuZGVyU3RhdGUoKTtcblxuICAgIC8qKlxuICAgICAqIE9iamVjdCByZXNwb25zaWJsZSBmb3IgY2FjaGluZyBhbmQgY3JlYXRpb24gb2YgcmVuZGVyIHBpcGVsaW5lcy5cbiAgICAgKi9cbiAgICByZW5kZXJQaXBlbGluZSA9IG5ldyBXZWJncHVSZW5kZXJQaXBlbGluZSh0aGlzKTtcblxuICAgIC8qKlxuICAgICAqIE9iamVjdCByZXNwb25zaWJsZSBmb3IgY2xlYXJpbmcgdGhlIHJlbmRlcmluZyBzdXJmYWNlIGJ5IHJlbmRlcmluZyBhIHF1YWQuXG4gICAgICovXG4gICAgY2xlYXJSZW5kZXJlciA9IG5ldyBXZWJncHVDbGVhclJlbmRlcmVyKCk7XG5cbiAgICAvKipcbiAgICAgKiBSZW5kZXIgcGlwZWxpbmUgY3VycmVudGx5IHNldCBvbiB0aGUgZGV2aWNlLlxuICAgICAqXG4gICAgICogQHR5cGUge0dQVVJlbmRlclBpcGVsaW5lfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgcGlwZWxpbmU7XG5cbiAgICAvKipcbiAgICAgKiBBbiBhcnJheSBvZiBiaW5kIGdyb3VwIGZvcm1hdHMsIGJhc2VkIG9uIGN1cnJlbnRseSBhc3NpZ25lZCBiaW5kIGdyb3Vwc1xuICAgICAqXG4gICAgICogQHR5cGUge1dlYmdwdUJpbmRHcm91cEZvcm1hdFtdfVxuICAgICAqL1xuICAgIGJpbmRHcm91cEZvcm1hdHMgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIEN1cnJlbnQgY29tbWFuZCBidWZmZXIgZW5jb2Rlci5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtHUFVDb21tYW5kRW5jb2Rlcn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIGNvbW1hbmRFbmNvZGVyO1xuXG4gICAgY29uc3RydWN0b3IoY2FudmFzLCBvcHRpb25zID0ge30pIHtcbiAgICAgICAgc3VwZXIoY2FudmFzKTtcbiAgICAgICAgdGhpcy5kZXZpY2VUeXBlID0gREVWSUNFVFlQRV9XRUJHUFU7XG5cbiAgICAgICAgLy8gVE9ETzogcmVmYWN0b3IgYXMgbmVlZGVkXG4gICAgICAgIHRoaXMud3JpdGVSZWQgPSB0cnVlO1xuICAgICAgICB0aGlzLndyaXRlR3JlZW4gPSB0cnVlO1xuICAgICAgICB0aGlzLndyaXRlQmx1ZSA9IHRydWU7XG4gICAgICAgIHRoaXMud3JpdGVBbHBoYSA9IHRydWU7XG5cbiAgICAgICAgdGhpcy5pbml0RGV2aWNlQ2FwcygpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERlc3Ryb3kgdGhlIGdyYXBoaWNzIGRldmljZS5cbiAgICAgKi9cbiAgICBkZXN0cm95KCkge1xuICAgICAgICBzdXBlci5kZXN0cm95KCk7XG4gICAgfVxuXG4gICAgaW5pdERldmljZUNhcHMoKSB7XG4gICAgICAgIHRoaXMucHJlY2lzaW9uID0gJ2hpZ2hwJztcbiAgICAgICAgdGhpcy5tYXhQcmVjaXNpb24gPSAnaGlnaHAnO1xuICAgICAgICB0aGlzLm1heFNhbXBsZXMgPSA0O1xuICAgICAgICB0aGlzLm1heFRleHR1cmVzID0gMTY7XG4gICAgICAgIHRoaXMubWF4VGV4dHVyZVNpemUgPSA0MDk2O1xuICAgICAgICB0aGlzLm1heEN1YmVNYXBTaXplID0gNDA5NjtcbiAgICAgICAgdGhpcy5tYXhWb2x1bWVTaXplID0gMjA0ODtcbiAgICAgICAgdGhpcy5tYXhQaXhlbFJhdGlvID0gMTtcbiAgICAgICAgdGhpcy5zdXBwb3J0c0luc3RhbmNpbmcgPSB0cnVlO1xuICAgICAgICB0aGlzLnN1cHBvcnRzVW5pZm9ybUJ1ZmZlcnMgPSB0cnVlO1xuICAgICAgICB0aGlzLnN1cHBvcnRzQm9uZVRleHR1cmVzID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5zdXBwb3J0c01vcnBoVGFyZ2V0VGV4dHVyZXNDb3JlID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5zdXBwb3J0c0FyZWFMaWdodHMgPSB0cnVlO1xuICAgICAgICB0aGlzLnN1cHBvcnRzRGVwdGhTaGFkb3cgPSB0cnVlO1xuICAgICAgICB0aGlzLmV4dFVpbnRFbGVtZW50ID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5leHRUZXh0dXJlRmxvYXQgPSB0cnVlO1xuICAgICAgICB0aGlzLnRleHR1cmVGbG9hdFJlbmRlcmFibGUgPSB0cnVlO1xuICAgICAgICB0aGlzLmV4dFRleHR1cmVIYWxmRmxvYXQgPSB0cnVlO1xuICAgICAgICB0aGlzLnRleHR1cmVIYWxmRmxvYXRSZW5kZXJhYmxlID0gdHJ1ZTtcbiAgICAgICAgdGhpcy50ZXh0dXJlSGFsZkZsb2F0VXBkYXRhYmxlID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5ib25lTGltaXQgPSAxMDI0O1xuICAgICAgICB0aGlzLnN1cHBvcnRzSW1hZ2VCaXRtYXAgPSB0cnVlO1xuICAgICAgICB0aGlzLmV4dFN0YW5kYXJkRGVyaXZhdGl2ZXMgPSB0cnVlO1xuICAgICAgICB0aGlzLmFyZWFMaWdodEx1dEZvcm1hdCA9IFBJWEVMRk9STUFUX1JHQkEzMkY7XG4gICAgICAgIHRoaXMuc3VwcG9ydHNUZXh0dXJlRmV0Y2ggPSB0cnVlO1xuICAgIH1cblxuICAgIGFzeW5jIGluaXRXZWJHcHUoZ2xzbGFuZ1VybCwgdHdnc2xVcmwpIHtcblxuICAgICAgICBpZiAoIXdpbmRvdy5uYXZpZ2F0b3IuZ3B1KSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuYWJsZSB0byByZXRyaWV2ZSBHUFUuIEVuc3VyZSB5b3UgYXJlIHVzaW5nIGEgYnJvd3NlciB0aGF0IHN1cHBvcnRzIFdlYkdQVSByZW5kZXJpbmcuJyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB0ZW1wb3JhcnkgbWVzc2FnZSB0byBjb25maXJtIFdlYmdwdSBpcyBiZWluZyB1c2VkXG4gICAgICAgIERlYnVnLmxvZyhcIldlYmdwdUdyYXBoaWNzRGV2aWNlIGluaXRpYWxpemF0aW9uIC4uXCIpO1xuXG4gICAgICAgIGNvbnN0IGxvYWRTY3JpcHQgPSAodXJsKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHNjcmlwdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NjcmlwdCcpO1xuICAgICAgICAgICAgICAgIHNjcmlwdC5zcmMgPSB1cmw7XG4gICAgICAgICAgICAgICAgc2NyaXB0LmFzeW5jID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgc2NyaXB0Lm9ubG9hZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh1cmwpO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgc2NyaXB0Lm9uZXJyb3IgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChuZXcgRXJyb3IoYEZhaWxlZCB0byBkb3dubG9hZCBzY3JpcHQgJHt1cmx9YCkpO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChzY3JpcHQpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gVE9ETzogYWRkIGJvdGggbG9hZFNjcmlwdCBjYWxscyBhbmQgcmVxdWVzdEFkYXB0ZXIgdG8gcHJvbWlzZSBsaXN0IGFuZCB3YWl0IGZvciBhbGwuXG4gICAgICAgIGF3YWl0IGxvYWRTY3JpcHQoZ2xzbGFuZ1VybCk7XG4gICAgICAgIGF3YWl0IGxvYWRTY3JpcHQodHdnc2xVcmwpO1xuXG4gICAgICAgIHRoaXMuZ2xzbGFuZyA9IGF3YWl0IGdsc2xhbmcoKTtcblxuICAgICAgICBjb25zdCB3YXNtUGF0aCA9IHR3Z3NsVXJsLnJlcGxhY2UoJy5qcycsICcud2FzbScpO1xuICAgICAgICB0aGlzLnR3Z3NsID0gYXdhaXQgdHdnc2wod2FzbVBhdGgpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7R1BVQWRhcHRlcn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuZ3B1QWRhcHRlciA9IGF3YWl0IHdpbmRvdy5uYXZpZ2F0b3IuZ3B1LnJlcXVlc3RBZGFwdGVyKCk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtHUFVEZXZpY2V9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLndncHUgPSBhd2FpdCB0aGlzLmdwdUFkYXB0ZXIucmVxdWVzdERldmljZSgpO1xuXG4gICAgICAgIC8vIGluaXRpYWxseSBmaWxsIHRoZSB3aW5kb3cuIFRoaXMgbmVlZHMgaW1wcm92ZW1lbnQuXG4gICAgICAgIHRoaXMuc2V0UmVzb2x1dGlvbih3aW5kb3cuaW5uZXJXaWR0aCwgd2luZG93LmlubmVySGVpZ2h0KTtcblxuICAgICAgICB0aGlzLmdwdUNvbnRleHQgPSB0aGlzLmNhbnZhcy5nZXRDb250ZXh0KCd3ZWJncHUnKTtcblxuICAgICAgICAvLyBwaXhlbCBmb3JtYXQgb2YgdGhlIGZyYW1lYnVmZmVyIGlzIHRoZSBtb3N0IGVmZmljaWVudCBvbmUgb24gdGhlIHN5c3RlbVxuICAgICAgICBjb25zdCBwcmVmZXJyZWRDYW52YXNGb3JtYXQgPSBuYXZpZ2F0b3IuZ3B1LmdldFByZWZlcnJlZENhbnZhc0Zvcm1hdCgpO1xuICAgICAgICB0aGlzLmZyYW1lYnVmZmVyRm9ybWF0ID0gcHJlZmVycmVkQ2FudmFzRm9ybWF0ID09PSAncmdiYTh1bm9ybScgPyBQSVhFTEZPUk1BVF9SR0JBOCA6IFBJWEVMRk9STUFUX0JHUkE4O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDb25maWd1cmF0aW9uIG9mIHRoZSBtYWluIGNvbG9yZnJhbWVidWZmZXIgd2Ugb2J0YWluIHVzaW5nIGdldEN1cnJlbnRUZXh0dXJlXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtHUFVDYW52YXNDb25maWd1cmF0aW9ufVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5jYW52YXNDb25maWcgPSB7XG4gICAgICAgICAgICBkZXZpY2U6IHRoaXMud2dwdSxcbiAgICAgICAgICAgIGNvbG9yU3BhY2U6ICdzcmdiJyxcbiAgICAgICAgICAgIGFscGhhTW9kZTogJ29wYXF1ZScsICAvLyBjb3VsZCBhbHNvIGJlICdwcmVtdWx0aXBsaWVkJ1xuXG4gICAgICAgICAgICAvLyB1c2UgcHJlZmVyZWQgZm9ybWF0IGZvciBvcHRpbWFsIHBlcmZvcm1hbmNlIG9uIG1vYmlsZVxuICAgICAgICAgICAgZm9ybWF0OiBwcmVmZXJyZWRDYW52YXNGb3JtYXQsXG5cbiAgICAgICAgICAgIC8vIFJFTkRFUl9BVFRBQ0hNRU5UIGlzIHJlcXVpcmVkLCBDT1BZX1NSQyBhbGxvd3Mgc2NlbmUgZ3JhYiB0byBjb3B5IG91dCBmcm9tIGl0XG4gICAgICAgICAgICB1c2FnZTogR1BVVGV4dHVyZVVzYWdlLlJFTkRFUl9BVFRBQ0hNRU5UIHwgR1BVVGV4dHVyZVVzYWdlLkNPUFlfU1JDLFxuXG4gICAgICAgICAgICAvLyBmb3JtYXRzIHRoYXQgdmlld3MgY3JlYXRlZCBmcm9tIHRleHR1cmVzIHJldHVybmVkIGJ5IGdldEN1cnJlbnRUZXh0dXJlIG1heSB1c2VcbiAgICAgICAgICAgIHZpZXdGb3JtYXRzOiBbXVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLmdwdUNvbnRleHQuY29uZmlndXJlKHRoaXMuY2FudmFzQ29uZmlnKTtcblxuICAgICAgICB0aGlzLmNyZWF0ZUZyYW1lYnVmZmVyKCk7XG5cbiAgICAgICAgdGhpcy5wb3N0SW5pdCgpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIGNyZWF0ZUZyYW1lYnVmZmVyKCkge1xuICAgICAgICB0aGlzLmZyYW1lQnVmZmVyID0gbmV3IFJlbmRlclRhcmdldCh7XG4gICAgICAgICAgICBuYW1lOiAnV2ViZ3B1RnJhbWVidWZmZXInLFxuICAgICAgICAgICAgZ3JhcGhpY3NEZXZpY2U6IHRoaXMsXG4gICAgICAgICAgICBkZXB0aDogdHJ1ZSxcbiAgICAgICAgICAgIHNhbXBsZXM6IDRcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgY3JlYXRlVW5pZm9ybUJ1ZmZlckltcGwodW5pZm9ybUJ1ZmZlcikge1xuICAgICAgICByZXR1cm4gbmV3IFdlYmdwdVVuaWZvcm1CdWZmZXIodW5pZm9ybUJ1ZmZlcik7XG4gICAgfVxuXG4gICAgY3JlYXRlVmVydGV4QnVmZmVySW1wbCh2ZXJ0ZXhCdWZmZXIsIGZvcm1hdCkge1xuICAgICAgICByZXR1cm4gbmV3IFdlYmdwdVZlcnRleEJ1ZmZlcih2ZXJ0ZXhCdWZmZXIsIGZvcm1hdCk7XG4gICAgfVxuXG4gICAgY3JlYXRlSW5kZXhCdWZmZXJJbXBsKGluZGV4QnVmZmVyKSB7XG4gICAgICAgIHJldHVybiBuZXcgV2ViZ3B1SW5kZXhCdWZmZXIoaW5kZXhCdWZmZXIpO1xuICAgIH1cblxuICAgIGNyZWF0ZVNoYWRlckltcGwoc2hhZGVyKSB7XG4gICAgICAgIHJldHVybiBuZXcgV2ViZ3B1U2hhZGVyKHNoYWRlcik7XG4gICAgfVxuXG4gICAgY3JlYXRlVGV4dHVyZUltcGwodGV4dHVyZSkge1xuICAgICAgICByZXR1cm4gbmV3IFdlYmdwdVRleHR1cmUodGV4dHVyZSk7XG4gICAgfVxuXG4gICAgY3JlYXRlUmVuZGVyVGFyZ2V0SW1wbChyZW5kZXJUYXJnZXQpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBXZWJncHVSZW5kZXJUYXJnZXQocmVuZGVyVGFyZ2V0KTtcbiAgICB9XG5cbiAgICBjcmVhdGVCaW5kR3JvdXBGb3JtYXRJbXBsKGJpbmRHcm91cEZvcm1hdCkge1xuICAgICAgICByZXR1cm4gbmV3IFdlYmdwdUJpbmRHcm91cEZvcm1hdChiaW5kR3JvdXBGb3JtYXQpO1xuICAgIH1cblxuICAgIGNyZWF0ZUJpbmRHcm91cEltcGwoYmluZEdyb3VwKSB7XG4gICAgICAgIHJldHVybiBuZXcgV2ViZ3B1QmluZEdyb3VwKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGluZGV4IC0gSW5kZXggb2YgdGhlIGJpbmQgZ3JvdXAgc2xvdFxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9iaW5kLWdyb3VwLmpzJykuQmluZEdyb3VwfSBiaW5kR3JvdXAgLSBCaW5kIGdyb3VwIHRvIGF0dGFjaFxuICAgICAqL1xuICAgIHNldEJpbmRHcm91cChpbmRleCwgYmluZEdyb3VwKSB7XG5cbiAgICAgICAgLy8gVE9ETzogdGhpcyBjb25kaXRpb24gc2hvdWxkIGJlIHJlbW92ZWQsIGl0J3MgaGVyZSB0byBoYW5kbGUgZmFrZSBncmFiIHBhc3MsIHdoaWNoIHNob3VsZCBiZSByZWZhY3RvcmVkIGluc3RlYWRcbiAgICAgICAgaWYgKHRoaXMucGFzc0VuY29kZXIpIHtcblxuICAgICAgICAgICAgLy8gc2V0IGl0IG9uIHRoZSBkZXZpY2VcbiAgICAgICAgICAgIHRoaXMucGFzc0VuY29kZXIuc2V0QmluZEdyb3VwKGluZGV4LCBiaW5kR3JvdXAuaW1wbC5iaW5kR3JvdXApO1xuXG4gICAgICAgICAgICAvLyBzdG9yZSB0aGUgYWN0aXZlIGZvcm1hdHMsIHVzZWQgYnkgdGhlIHBpcGVsaW5lIGNyZWF0aW9uXG4gICAgICAgICAgICB0aGlzLmJpbmRHcm91cEZvcm1hdHNbaW5kZXhdID0gYmluZEdyb3VwLmZvcm1hdC5pbXBsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3VibWl0VmVydGV4QnVmZmVyKHZlcnRleEJ1ZmZlciwgc2xvdCkge1xuXG4gICAgICAgIGNvbnN0IGZvcm1hdCA9IHZlcnRleEJ1ZmZlci5mb3JtYXQ7XG4gICAgICAgIGNvbnN0IGVsZW1lbnRDb3VudCA9IGZvcm1hdC5lbGVtZW50cy5sZW5ndGg7XG4gICAgICAgIGNvbnN0IHZiQnVmZmVyID0gdmVydGV4QnVmZmVyLmltcGwuYnVmZmVyO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGVsZW1lbnRDb3VudDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBlbGVtZW50ID0gZm9ybWF0LmVsZW1lbnRzW2ldO1xuICAgICAgICAgICAgdGhpcy5wYXNzRW5jb2Rlci5zZXRWZXJ0ZXhCdWZmZXIoc2xvdCArIGksIHZiQnVmZmVyLCBlbGVtZW50Lm9mZnNldCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZWxlbWVudENvdW50O1xuICAgIH1cblxuICAgIGRyYXcocHJpbWl0aXZlLCBudW1JbnN0YW5jZXMgPSAxLCBrZWVwQnVmZmVycykge1xuXG4gICAgICAgIGlmICh0aGlzLnNoYWRlci5yZWFkeSkge1xuICAgICAgICAgICAgY29uc3QgcGFzc0VuY29kZXIgPSB0aGlzLnBhc3NFbmNvZGVyO1xuICAgICAgICAgICAgRGVidWcuYXNzZXJ0KHBhc3NFbmNvZGVyKTtcblxuICAgICAgICAgICAgLy8gdmVydGV4IGJ1ZmZlcnNcbiAgICAgICAgICAgIGNvbnN0IHZiMCA9IHRoaXMudmVydGV4QnVmZmVyc1swXTtcbiAgICAgICAgICAgIGNvbnN0IHZiU2xvdCA9IHRoaXMuc3VibWl0VmVydGV4QnVmZmVyKHZiMCwgMCk7XG4gICAgICAgICAgICBjb25zdCB2YjEgPSB0aGlzLnZlcnRleEJ1ZmZlcnNbMV07XG4gICAgICAgICAgICBpZiAodmIxKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zdWJtaXRWZXJ0ZXhCdWZmZXIodmIxLCB2YlNsb3QpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy52ZXJ0ZXhCdWZmZXJzLmxlbmd0aCA9IDA7XG5cbiAgICAgICAgICAgIC8vIHJlbmRlciBwaXBlbGluZVxuICAgICAgICAgICAgY29uc3QgcGlwZWxpbmUgPSB0aGlzLnJlbmRlclBpcGVsaW5lLmdldChwcmltaXRpdmUsIHZiMC5mb3JtYXQsIHZiMT8uZm9ybWF0LCB0aGlzLnNoYWRlciwgdGhpcy5yZW5kZXJUYXJnZXQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYmluZEdyb3VwRm9ybWF0cywgdGhpcy5yZW5kZXJTdGF0ZSk7XG4gICAgICAgICAgICBEZWJ1Zy5hc3NlcnQocGlwZWxpbmUpO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5waXBlbGluZSAhPT0gcGlwZWxpbmUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnBpcGVsaW5lID0gcGlwZWxpbmU7XG4gICAgICAgICAgICAgICAgcGFzc0VuY29kZXIuc2V0UGlwZWxpbmUocGlwZWxpbmUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBkcmF3XG4gICAgICAgICAgICBjb25zdCBpYiA9IHRoaXMuaW5kZXhCdWZmZXI7XG4gICAgICAgICAgICBpZiAoaWIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmluZGV4QnVmZmVyID0gbnVsbDtcbiAgICAgICAgICAgICAgICBwYXNzRW5jb2Rlci5zZXRJbmRleEJ1ZmZlcihpYi5pbXBsLmJ1ZmZlciwgaWIuaW1wbC5mb3JtYXQpO1xuICAgICAgICAgICAgICAgIHBhc3NFbmNvZGVyLmRyYXdJbmRleGVkKGliLm51bUluZGljZXMsIG51bUluc3RhbmNlcywgMCwgMCwgMCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBhc3NFbmNvZGVyLmRyYXcodmIwLm51bVZlcnRpY2VzLCBudW1JbnN0YW5jZXMsIDAsIDApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0U2hhZGVyKHNoYWRlcikge1xuXG4gICAgICAgIHRoaXMuc2hhZGVyID0gc2hhZGVyO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgLy8gVE9ETzogd2Ugc2hvdWxkIHByb2JhYmx5IHRyYWNrIG90aGVyIHN0YXRzIGluc3RlYWQsIGxpa2UgcGlwZWxpbmUgc3dpdGNoZXNcbiAgICAgICAgdGhpcy5fc2hhZGVyU3dpdGNoZXNQZXJGcmFtZSsrO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBzZXRCbGVuZGluZyhibGVuZGluZykge1xuICAgICAgICB0aGlzLnJlbmRlclN0YXRlLnNldEJsZW5kaW5nKGJsZW5kaW5nKTtcbiAgICB9XG5cbiAgICBzZXRCbGVuZEZ1bmN0aW9uKGJsZW5kU3JjLCBibGVuZERzdCkge1xuICAgICAgICB0aGlzLnJlbmRlclN0YXRlLnNldEJsZW5kRnVuY3Rpb24oYmxlbmRTcmMsIGJsZW5kRHN0KTtcbiAgICB9XG5cbiAgICBzZXRCbGVuZEVxdWF0aW9uKGJsZW5kRXF1YXRpb24pIHtcbiAgICAgICAgdGhpcy5yZW5kZXJTdGF0ZS5zZXRCbGVuZEVxdWF0aW9uKGJsZW5kRXF1YXRpb24pO1xuICAgIH1cblxuICAgIHNldERlcHRoRnVuYyhmdW5jKSB7XG4gICAgfVxuXG4gICAgc2V0RGVwdGhUZXN0KGRlcHRoVGVzdCkge1xuICAgIH1cblxuICAgIGdldERlcHRoVGVzdCgpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgc2V0Q3VsbE1vZGUoY3VsbE1vZGUpIHtcbiAgICB9XG5cbiAgICBnZXRDdWxsTW9kZSgpIHtcbiAgICAgICAgcmV0dXJuIENVTExGQUNFX0JBQ0s7XG4gICAgfVxuXG4gICAgc2V0QWxwaGFUb0NvdmVyYWdlKHN0YXRlKSB7XG4gICAgfVxuXG4gICAgc2V0Q29sb3JXcml0ZSh3cml0ZVJlZCwgd3JpdGVHcmVlbiwgd3JpdGVCbHVlLCB3cml0ZUFscGhhKSB7XG4gICAgfVxuXG4gICAgc2V0RGVwdGhXcml0ZSh3cml0ZURlcHRoKSB7XG4gICAgfVxuXG4gICAgZ2V0RGVwdGhXcml0ZSgpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgaW5pdGlhbGl6ZUNvbnRleHRDYWNoZXMoKSB7XG4gICAgICAgIHN1cGVyLmluaXRpYWxpemVDb250ZXh0Q2FjaGVzKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3RhcnQgYSByZW5kZXIgcGFzcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9yZW5kZXItcGFzcy5qcycpLlJlbmRlclBhc3N9IHJlbmRlclBhc3MgLSBUaGUgcmVuZGVyIHBhc3MgdG8gc3RhcnQuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHN0YXJ0UGFzcyhyZW5kZXJQYXNzKSB7XG5cbiAgICAgICAgY29uc3QgcnQgPSByZW5kZXJQYXNzLnJlbmRlclRhcmdldCB8fCB0aGlzLmZyYW1lQnVmZmVyO1xuICAgICAgICBEZWJ1Zy5hc3NlcnQocnQpO1xuXG4gICAgICAgIHRoaXMucmVuZGVyVGFyZ2V0ID0gcnQ7XG4gICAgICAgIGNvbnN0IHdydCA9IHJ0LmltcGw7XG5cbiAgICAgICAgLy8gY3VycmVudCBmcmFtZSBjb2xvciBidWZmZXJcbiAgICAgICAgbGV0IG91dENvbG9yQnVmZmVyO1xuICAgICAgICBpZiAocnQgPT09IHRoaXMuZnJhbWVCdWZmZXIpIHtcbiAgICAgICAgICAgIG91dENvbG9yQnVmZmVyID0gdGhpcy5ncHVDb250ZXh0LmdldEN1cnJlbnRUZXh0dXJlKCk7XG4gICAgICAgICAgICBEZWJ1Z0hlbHBlci5zZXRMYWJlbChvdXRDb2xvckJ1ZmZlciwgcnQubmFtZSk7XG5cbiAgICAgICAgICAgIC8vIGFzc2lnbiB0aGUgZm9ybWF0LCBhbGxvd2luZyBmb2xsb3dpbmcgaW5pdCBjYWxsIHRvIHVzZSBpdCB0byBhbGxvY2F0ZSBtYXRjaGluZyBtdWx0aXNhbXBsZWQgYnVmZmVyXG4gICAgICAgICAgICB3cnQuY29sb3JGb3JtYXQgPSBvdXRDb2xvckJ1ZmZlci5mb3JtYXQ7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmluaXRSZW5kZXJUYXJnZXQocnQpO1xuXG4gICAgICAgIC8vIGFzc2lnbiBjdXJyZW50IGZyYW1lJ3MgcmVuZGVyIHRleHR1cmUgaWYgcmVuZGVyaW5nIHRvIHRoZSBtYWluIGZyYW1lIGJ1ZmZlclxuICAgICAgICAvLyBUT0RPOiB0aGlzIHNob3VsZCBwcm9iYWJseSBiZSBkb25lIGF0IHRoZSBzdGFydCBvZiB0aGUgZnJhbWUsIHNvIHRoYXQgaXQgY2FuIGJlIHVzZWRcbiAgICAgICAgLy8gYXMgYSBkZXN0aW5hdGlvbiBvZiB0aGUgY29weSBvcGVyYXRpb25cbiAgICAgICAgaWYgKG91dENvbG9yQnVmZmVyKSB7XG4gICAgICAgICAgICB3cnQuYXNzaWduQ29sb3JUZXh0dXJlKG91dENvbG9yQnVmZmVyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHNldCB1cCBjbGVhciAvIHN0b3JlIC8gbG9hZCBzZXR0aW5nc1xuICAgICAgICB3cnQuc2V0dXBGb3JSZW5kZXJQYXNzKHJlbmRlclBhc3MpO1xuXG4gICAgICAgIC8vIGNyZWF0ZSBhIG5ldyBlbmNvZGVyIGZvciBlYWNoIHBhc3MgdG8ga2VlcCB0aGUgR1BVIGJ1c3kgd2l0aCBjb21tYW5kc1xuICAgICAgICB0aGlzLmNvbW1hbmRFbmNvZGVyID0gdGhpcy53Z3B1LmNyZWF0ZUNvbW1hbmRFbmNvZGVyKCk7XG4gICAgICAgIERlYnVnSGVscGVyLnNldExhYmVsKHRoaXMuY29tbWFuZEVuY29kZXIsIHJlbmRlclBhc3MubmFtZSk7XG5cbiAgICAgICAgLy8gY2xlYXIgY2FjaGVkIGVuY29kZXIgc3RhdGVcbiAgICAgICAgdGhpcy5waXBlbGluZSA9IG51bGw7XG5cbiAgICAgICAgLy8gc3RhcnQgdGhlIHBhc3NcbiAgICAgICAgdGhpcy5wYXNzRW5jb2RlciA9IHRoaXMuY29tbWFuZEVuY29kZXIuYmVnaW5SZW5kZXJQYXNzKHdydC5yZW5kZXJQYXNzRGVzY3JpcHRvcik7XG4gICAgICAgIERlYnVnSGVscGVyLnNldExhYmVsKHRoaXMucGFzc0VuY29kZXIsIHJlbmRlclBhc3MubmFtZSk7XG5cbiAgICAgICAgLy8gdGhlIHBhc3MgYWx3YXlzIGNsZWFycyBmdWxsIHRhcmdldFxuICAgICAgICAvLyBUT0RPOiBhdm9pZCB0aGlzIHNldHRpbmcgdGhlIGFjdHVhbCB2aWV3cG9ydC9zY2lzc29yIG9uIHdlYmdwdSBhcyB0aG9zZSBhcmUgYXV0b21hdGljYWxseSByZXNldCB0byBmdWxsXG4gICAgICAgIC8vIHJlbmRlciB0YXJnZXQuIFdlIGp1c3QgbmVlZCB0byB1cGRhdGUgaW50ZXJuYWwgc3RhdGUsIGZvciB0aGUgZ2V0IGZ1bmN0aW9uYWxpdHkgdG8gcmV0dXJuIGl0LlxuICAgICAgICBjb25zdCB7IHdpZHRoLCBoZWlnaHQgfSA9IHJ0O1xuICAgICAgICB0aGlzLnNldFZpZXdwb3J0KDAsIDAsIHdpZHRoLCBoZWlnaHQpO1xuICAgICAgICB0aGlzLnNldFNjaXNzb3IoMCwgMCwgd2lkdGgsIGhlaWdodCk7XG5cbiAgICAgICAgRGVidWcuYXNzZXJ0KCF0aGlzLmluc2lkZVJlbmRlclBhc3MsICdSZW5kZXJQYXNzIGNhbm5vdCBiZSBzdGFydGVkIHdoaWxlIGluc2lkZSBhbm90aGVyIHJlbmRlciBwYXNzLicpO1xuICAgICAgICB0aGlzLmluc2lkZVJlbmRlclBhc3MgPSB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEVuZCBhIHJlbmRlciBwYXNzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL3JlbmRlci1wYXNzLmpzJykuUmVuZGVyUGFzc30gcmVuZGVyUGFzcyAtIFRoZSByZW5kZXIgcGFzcyB0byBlbmQuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGVuZFBhc3MocmVuZGVyUGFzcykge1xuXG4gICAgICAgIHRoaXMucGFzc0VuY29kZXIuZW5kKCk7XG4gICAgICAgIHRoaXMucGFzc0VuY29kZXIgPSBudWxsO1xuXG4gICAgICAgIHRoaXMud2dwdS5xdWV1ZS5zdWJtaXQoW3RoaXMuY29tbWFuZEVuY29kZXIuZmluaXNoKCldKTtcbiAgICAgICAgdGhpcy5jb21tYW5kRW5jb2RlciA9IG51bGw7XG5cbiAgICAgICAgLy8gZWFjaCByZW5kZXIgcGFzcyBjYW4gdXNlIGRpZmZlcmVudCBudW1iZXIgb2YgYmluZCBncm91cHNcbiAgICAgICAgdGhpcy5iaW5kR3JvdXBGb3JtYXRzLmxlbmd0aCA9IDA7XG5cbiAgICAgICAgdGhpcy5pbnNpZGVSZW5kZXJQYXNzID0gZmFsc2U7XG4gICAgfVxuXG4gICAgY2xlYXIob3B0aW9ucykge1xuICAgICAgICBpZiAob3B0aW9ucy5mbGFncykge1xuICAgICAgICAgICAgdGhpcy5jbGVhclJlbmRlcmVyLmNsZWFyKHRoaXMsIHRoaXMucmVuZGVyVGFyZ2V0LCBvcHRpb25zKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCB3aWR0aCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3dpZHRoO1xuICAgIH1cblxuICAgIGdldCBoZWlnaHQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9oZWlnaHQ7XG4gICAgfVxuXG4gICAgc2V0RGVwdGhCaWFzKG9uKSB7XG4gICAgfVxuXG4gICAgc2V0RGVwdGhCaWFzVmFsdWVzKGNvbnN0Qmlhcywgc2xvcGVCaWFzKSB7XG4gICAgfVxuXG4gICAgc2V0U3RlbmNpbFRlc3QoZW5hYmxlKSB7XG4gICAgfVxuXG4gICAgc2V0Vmlld3BvcnQoeCwgeSwgdywgaCkge1xuICAgICAgICAvLyBUT0RPOiBvbmx5IGV4ZWN1dGUgd2hlbiBpdCBjaGFuZ2VzLiBBbHNvLCB0aGUgdmlld3BvcnQgb2YgZW5jb2RlciAgbWF0Y2hlcyB0aGUgcmVuZGVyaW5nIGF0dGFjaG1lbnRzLFxuICAgICAgICAvLyBzbyB3ZSBjYW4gc2tpcCB0aGlzIGlmIGZ1bGxzY3JlZW5cbiAgICAgICAgLy8gVE9ETzogdGhpcyBjb25kaXRpb24gc2hvdWxkIGJlIHJlbW92ZWQsIGl0J3MgaGVyZSB0byBoYW5kbGUgZmFrZSBncmFiIHBhc3MsIHdoaWNoIHNob3VsZCBiZSByZWZhY3RvcmVkIGluc3RlYWRcbiAgICAgICAgaWYgKHRoaXMucGFzc0VuY29kZXIpIHtcblxuICAgICAgICAgICAgdGhpcy52eCA9IHg7XG4gICAgICAgICAgICB0aGlzLnZ5ID0geTtcbiAgICAgICAgICAgIHRoaXMudncgPSB3O1xuICAgICAgICAgICAgdGhpcy52aCA9IGg7XG5cbiAgICAgICAgICAgIHRoaXMucGFzc0VuY29kZXIuc2V0Vmlld3BvcnQoeCwgdGhpcy5yZW5kZXJUYXJnZXQuaGVpZ2h0IC0geSAtIGgsIHcsIGgsIDAsIDEpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0U2Npc3Nvcih4LCB5LCB3LCBoKSB7XG4gICAgICAgIC8vIFRPRE86IG9ubHkgZXhlY3V0ZSB3aGVuIGl0IGNoYW5nZXMuIEFsc28sIHRoZSB2aWV3cG9ydCBvZiBlbmNvZGVyICBtYXRjaGVzIHRoZSByZW5kZXJpbmcgYXR0YWNobWVudHMsXG4gICAgICAgIC8vIHNvIHdlIGNhbiBza2lwIHRoaXMgaWYgZnVsbHNjcmVlblxuICAgICAgICAvLyBUT0RPOiB0aGlzIGNvbmRpdGlvbiBzaG91bGQgYmUgcmVtb3ZlZCwgaXQncyBoZXJlIHRvIGhhbmRsZSBmYWtlIGdyYWIgcGFzcywgd2hpY2ggc2hvdWxkIGJlIHJlZmFjdG9yZWQgaW5zdGVhZFxuICAgICAgICBpZiAodGhpcy5wYXNzRW5jb2Rlcikge1xuXG4gICAgICAgICAgICB0aGlzLnN4ID0geDtcbiAgICAgICAgICAgIHRoaXMuc3kgPSB5O1xuICAgICAgICAgICAgdGhpcy5zdyA9IHc7XG4gICAgICAgICAgICB0aGlzLnNoID0gaDtcblxuICAgICAgICAgICAgdGhpcy5wYXNzRW5jb2Rlci5zZXRTY2lzc29yUmVjdCh4LCB0aGlzLnJlbmRlclRhcmdldC5oZWlnaHQgLSB5IC0gaCwgdywgaCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb3BpZXMgc291cmNlIHJlbmRlciB0YXJnZXQgaW50byBkZXN0aW5hdGlvbiByZW5kZXIgdGFyZ2V0LiBNb3N0bHkgdXNlZCBieSBwb3N0LWVmZmVjdHMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1JlbmRlclRhcmdldH0gW3NvdXJjZV0gLSBUaGUgc291cmNlIHJlbmRlciB0YXJnZXQuIERlZmF1bHRzIHRvIGZyYW1lIGJ1ZmZlci5cbiAgICAgKiBAcGFyYW0ge1JlbmRlclRhcmdldH0gW2Rlc3RdIC0gVGhlIGRlc3RpbmF0aW9uIHJlbmRlciB0YXJnZXQuIERlZmF1bHRzIHRvIGZyYW1lIGJ1ZmZlci5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtjb2xvcl0gLSBJZiB0cnVlIHdpbGwgY29weSB0aGUgY29sb3IgYnVmZmVyLiBEZWZhdWx0cyB0byBmYWxzZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtkZXB0aF0gLSBJZiB0cnVlIHdpbGwgY29weSB0aGUgZGVwdGggYnVmZmVyLiBEZWZhdWx0cyB0byBmYWxzZS5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgY29weSB3YXMgc3VjY2Vzc2Z1bCwgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqL1xuICAgIGNvcHlSZW5kZXJUYXJnZXQoc291cmNlLCBkZXN0LCBjb2xvciwgZGVwdGgpIHtcblxuICAgICAgICAvKiogQHR5cGUge0dQVUV4dGVudDNEfSAqL1xuICAgICAgICBjb25zdCBjb3B5U2l6ZSA9IHtcbiAgICAgICAgICAgIHdpZHRoOiBzb3VyY2UgPyBzb3VyY2Uud2lkdGggOiBkZXN0LndpZHRoLFxuICAgICAgICAgICAgaGVpZ2h0OiBzb3VyY2UgPyBzb3VyY2UuaGVpZ2h0IDogZGVzdC5oZWlnaHQsXG4gICAgICAgICAgICBkZXB0aE9yQXJyYXlMYXllcnM6IDFcbiAgICAgICAgfTtcblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIodGhpcywgJ0NPUFktUlQnKTtcblxuICAgICAgICAvLyB1c2UgZXhpc3Rpbmcgb3IgY3JlYXRlIG5ldyBlbmNvZGVyIGlmIGJldHdlZW4gcmVuZGVyIHBhc3Nlc1xuICAgICAgICBjb25zdCBjb21tYW5kRW5jb2RlciA9IHRoaXMuY29tbWFuZEVuY29kZXIgPz8gdGhpcy53Z3B1LmNyZWF0ZUNvbW1hbmRFbmNvZGVyKCk7XG5cbiAgICAgICAgaWYgKGNvbG9yKSB7XG5cbiAgICAgICAgICAgIC8vIHJlYWQgZnJvbSBzdXBwbGllZCByZW5kZXIgdGFyZ2V0LCBvciBmcm9tIHRoZSBmcmFtZWJ1ZmZlclxuICAgICAgICAgICAgLyoqIEB0eXBlIHtHUFVJbWFnZUNvcHlUZXh0dXJlfSAqL1xuICAgICAgICAgICAgY29uc3QgY29weVNyYyA9IHtcbiAgICAgICAgICAgICAgICB0ZXh0dXJlOiBzb3VyY2UgPyBzb3VyY2UuY29sb3JCdWZmZXIuaW1wbC5ncHVUZXh0dXJlIDogdGhpcy5yZW5kZXJUYXJnZXQuaW1wbC5hc3NpZ25lZENvbG9yVGV4dHVyZSxcbiAgICAgICAgICAgICAgICBtaXBMZXZlbDogMFxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgLy8gd3JpdGUgdG8gc3VwcGxpZWQgcmVuZGVyIHRhcmdldCwgb3IgdG8gdGhlIGZyYW1lYnVmZmVyXG4gICAgICAgICAgICAvKiogQHR5cGUge0dQVUltYWdlQ29weVRleHR1cmV9ICovXG4gICAgICAgICAgICBjb25zdCBjb3B5RHN0ID0ge1xuICAgICAgICAgICAgICAgIHRleHR1cmU6IGRlc3QgPyBkZXN0LmNvbG9yQnVmZmVyLmltcGwuZ3B1VGV4dHVyZSA6IHRoaXMucmVuZGVyVGFyZ2V0LmltcGwuYXNzaWduZWRDb2xvclRleHR1cmUsXG4gICAgICAgICAgICAgICAgbWlwTGV2ZWw6IDBcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIERlYnVnLmFzc2VydChjb3B5U3JjLnRleHR1cmUgIT09IG51bGwgJiYgY29weURzdC50ZXh0dXJlICE9PSBudWxsKTtcbiAgICAgICAgICAgIGNvbW1hbmRFbmNvZGVyLmNvcHlUZXh0dXJlVG9UZXh0dXJlKGNvcHlTcmMsIGNvcHlEc3QsIGNvcHlTaXplKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChkZXB0aCkge1xuXG4gICAgICAgICAgICAvLyByZWFkIGZyb20gc3VwcGxpZWQgcmVuZGVyIHRhcmdldCwgb3IgZnJvbSB0aGUgZnJhbWVidWZmZXJcbiAgICAgICAgICAgIGNvbnN0IHNvdXJjZVJUID0gc291cmNlID8gc291cmNlIDogdGhpcy5yZW5kZXJUYXJnZXQ7XG5cbiAgICAgICAgICAgIC8vIGNhbm5vdCBjb3B5IGRlcHRoIGZyb20gbXVsdGlzYW1wbGVkIGJ1ZmZlci4gT24gV2ViR1BVLCBpdCBjYW5ub3QgYmUgcmVzb2x2ZSBhdCB0aGUgZW5kIG9mIHRoZSBwYXNzIGVpdGhlcixcbiAgICAgICAgICAgIC8vIGFuZCBzbyB3ZSBuZWVkIHRvIGltcGxlbWVudCBhIGN1c3RvbSBkZXB0aCByZXNvbHZlIHNoYWRlciBiYXNlZCBjb3B5XG4gICAgICAgICAgICAvLyBUaGlzIGlzIGN1cnJlbnRseSBuZWVkZWQgZm9yIHVTY2VuZURlcHRoTWFwIHdoZW4gdGhlIGNhbWVyYSByZW5kZXJzIHRvIG11bHRpc2FtcGxlZCByZW5kZXIgdGFyZ2V0XG4gICAgICAgICAgICBEZWJ1Zy5hc3NlcnQoc291cmNlLnNhbXBsZXMgPD0gMSwgYGNvcHlSZW5kZXJUYXJnZXQgZG9lcyBub3QgY3VycmVudGx5IHN1cHBvcnQgY29weSBvZiBkZXB0aCBmcm9tIG11bHRpc2FtcGxlZCB0ZXh0dXJlYCwgc291cmNlUlQpO1xuXG4gICAgICAgICAgICAvKiogQHR5cGUge0dQVUltYWdlQ29weVRleHR1cmV9ICovXG4gICAgICAgICAgICBjb25zdCBjb3B5U3JjID0ge1xuICAgICAgICAgICAgICAgIHRleHR1cmU6IHNvdXJjZVJULmltcGwuZGVwdGhUZXh0dXJlLFxuICAgICAgICAgICAgICAgIG1pcExldmVsOiAwXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAvLyB3cml0ZSB0byBzdXBwbGllZCByZW5kZXIgdGFyZ2V0LCBvciB0byB0aGUgZnJhbWVidWZmZXJcbiAgICAgICAgICAgIC8qKiBAdHlwZSB7R1BVSW1hZ2VDb3B5VGV4dHVyZX0gKi9cbiAgICAgICAgICAgIGNvbnN0IGNvcHlEc3QgPSB7XG4gICAgICAgICAgICAgICAgdGV4dHVyZTogZGVzdCA/IGRlc3QuZGVwdGhCdWZmZXIuaW1wbC5ncHVUZXh0dXJlIDogdGhpcy5yZW5kZXJUYXJnZXQuaW1wbC5kZXB0aFRleHR1cmUsXG4gICAgICAgICAgICAgICAgbWlwTGV2ZWw6IDBcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIERlYnVnLmFzc2VydChjb3B5U3JjLnRleHR1cmUgIT09IG51bGwgJiYgY29weURzdC50ZXh0dXJlICE9PSBudWxsKTtcbiAgICAgICAgICAgIGNvbW1hbmRFbmNvZGVyLmNvcHlUZXh0dXJlVG9UZXh0dXJlKGNvcHlTcmMsIGNvcHlEc3QsIGNvcHlTaXplKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHN1Ym1pdCB0aGUgZW5jb2RlZCBjb21tYW5kcyBpZiB3ZSBjcmVhdGVkIHRoZSBlbmNvZGVyXG4gICAgICAgIGlmICghdGhpcy5jb21tYW5kRW5jb2Rlcikge1xuICAgICAgICAgICAgdGhpcy53Z3B1LnF1ZXVlLnN1Ym1pdChbY29tbWFuZEVuY29kZXIuZmluaXNoKCldKTtcbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKHRoaXMpO1xuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8vICNpZiBfREVCVUdcbiAgICBwdXNoTWFya2VyKG5hbWUpIHtcbiAgICAgICAgdGhpcy5wYXNzRW5jb2Rlcj8ucHVzaERlYnVnR3JvdXAobmFtZSk7XG4gICAgfVxuXG4gICAgcG9wTWFya2VyKCkge1xuICAgICAgICB0aGlzLnBhc3NFbmNvZGVyPy5wb3BEZWJ1Z0dyb3VwKCk7XG4gICAgfVxuICAgIC8vICNlbmRpZlxufVxuXG5leHBvcnQgeyBXZWJncHVHcmFwaGljc0RldmljZSB9O1xuIl0sIm5hbWVzIjpbIldlYmdwdUdyYXBoaWNzRGV2aWNlIiwiR3JhcGhpY3NEZXZpY2UiLCJjb25zdHJ1Y3RvciIsImNhbnZhcyIsIm9wdGlvbnMiLCJmcmFtZUJ1ZmZlciIsInJlbmRlclN0YXRlIiwiV2ViZ3B1UmVuZGVyU3RhdGUiLCJyZW5kZXJQaXBlbGluZSIsIldlYmdwdVJlbmRlclBpcGVsaW5lIiwiY2xlYXJSZW5kZXJlciIsIldlYmdwdUNsZWFyUmVuZGVyZXIiLCJwaXBlbGluZSIsImJpbmRHcm91cEZvcm1hdHMiLCJjb21tYW5kRW5jb2RlciIsImRldmljZVR5cGUiLCJERVZJQ0VUWVBFX1dFQkdQVSIsIndyaXRlUmVkIiwid3JpdGVHcmVlbiIsIndyaXRlQmx1ZSIsIndyaXRlQWxwaGEiLCJpbml0RGV2aWNlQ2FwcyIsImRlc3Ryb3kiLCJwcmVjaXNpb24iLCJtYXhQcmVjaXNpb24iLCJtYXhTYW1wbGVzIiwibWF4VGV4dHVyZXMiLCJtYXhUZXh0dXJlU2l6ZSIsIm1heEN1YmVNYXBTaXplIiwibWF4Vm9sdW1lU2l6ZSIsIm1heFBpeGVsUmF0aW8iLCJzdXBwb3J0c0luc3RhbmNpbmciLCJzdXBwb3J0c1VuaWZvcm1CdWZmZXJzIiwic3VwcG9ydHNCb25lVGV4dHVyZXMiLCJzdXBwb3J0c01vcnBoVGFyZ2V0VGV4dHVyZXNDb3JlIiwic3VwcG9ydHNBcmVhTGlnaHRzIiwic3VwcG9ydHNEZXB0aFNoYWRvdyIsImV4dFVpbnRFbGVtZW50IiwiZXh0VGV4dHVyZUZsb2F0IiwidGV4dHVyZUZsb2F0UmVuZGVyYWJsZSIsImV4dFRleHR1cmVIYWxmRmxvYXQiLCJ0ZXh0dXJlSGFsZkZsb2F0UmVuZGVyYWJsZSIsInRleHR1cmVIYWxmRmxvYXRVcGRhdGFibGUiLCJib25lTGltaXQiLCJzdXBwb3J0c0ltYWdlQml0bWFwIiwiZXh0U3RhbmRhcmREZXJpdmF0aXZlcyIsImFyZWFMaWdodEx1dEZvcm1hdCIsIlBJWEVMRk9STUFUX1JHQkEzMkYiLCJzdXBwb3J0c1RleHR1cmVGZXRjaCIsImluaXRXZWJHcHUiLCJnbHNsYW5nVXJsIiwidHdnc2xVcmwiLCJ3aW5kb3ciLCJuYXZpZ2F0b3IiLCJncHUiLCJFcnJvciIsIkRlYnVnIiwibG9nIiwibG9hZFNjcmlwdCIsInVybCIsIlByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0Iiwic2NyaXB0IiwiZG9jdW1lbnQiLCJjcmVhdGVFbGVtZW50Iiwic3JjIiwiYXN5bmMiLCJvbmxvYWQiLCJvbmVycm9yIiwiYm9keSIsImFwcGVuZENoaWxkIiwiZ2xzbGFuZyIsIndhc21QYXRoIiwicmVwbGFjZSIsInR3Z3NsIiwiZ3B1QWRhcHRlciIsInJlcXVlc3RBZGFwdGVyIiwid2dwdSIsInJlcXVlc3REZXZpY2UiLCJzZXRSZXNvbHV0aW9uIiwiaW5uZXJXaWR0aCIsImlubmVySGVpZ2h0IiwiZ3B1Q29udGV4dCIsImdldENvbnRleHQiLCJwcmVmZXJyZWRDYW52YXNGb3JtYXQiLCJnZXRQcmVmZXJyZWRDYW52YXNGb3JtYXQiLCJmcmFtZWJ1ZmZlckZvcm1hdCIsIlBJWEVMRk9STUFUX1JHQkE4IiwiUElYRUxGT1JNQVRfQkdSQTgiLCJjYW52YXNDb25maWciLCJkZXZpY2UiLCJjb2xvclNwYWNlIiwiYWxwaGFNb2RlIiwiZm9ybWF0IiwidXNhZ2UiLCJHUFVUZXh0dXJlVXNhZ2UiLCJSRU5ERVJfQVRUQUNITUVOVCIsIkNPUFlfU1JDIiwidmlld0Zvcm1hdHMiLCJjb25maWd1cmUiLCJjcmVhdGVGcmFtZWJ1ZmZlciIsInBvc3RJbml0IiwiUmVuZGVyVGFyZ2V0IiwibmFtZSIsImdyYXBoaWNzRGV2aWNlIiwiZGVwdGgiLCJzYW1wbGVzIiwiY3JlYXRlVW5pZm9ybUJ1ZmZlckltcGwiLCJ1bmlmb3JtQnVmZmVyIiwiV2ViZ3B1VW5pZm9ybUJ1ZmZlciIsImNyZWF0ZVZlcnRleEJ1ZmZlckltcGwiLCJ2ZXJ0ZXhCdWZmZXIiLCJXZWJncHVWZXJ0ZXhCdWZmZXIiLCJjcmVhdGVJbmRleEJ1ZmZlckltcGwiLCJpbmRleEJ1ZmZlciIsIldlYmdwdUluZGV4QnVmZmVyIiwiY3JlYXRlU2hhZGVySW1wbCIsInNoYWRlciIsIldlYmdwdVNoYWRlciIsImNyZWF0ZVRleHR1cmVJbXBsIiwidGV4dHVyZSIsIldlYmdwdVRleHR1cmUiLCJjcmVhdGVSZW5kZXJUYXJnZXRJbXBsIiwicmVuZGVyVGFyZ2V0IiwiV2ViZ3B1UmVuZGVyVGFyZ2V0IiwiY3JlYXRlQmluZEdyb3VwRm9ybWF0SW1wbCIsImJpbmRHcm91cEZvcm1hdCIsIldlYmdwdUJpbmRHcm91cEZvcm1hdCIsImNyZWF0ZUJpbmRHcm91cEltcGwiLCJiaW5kR3JvdXAiLCJXZWJncHVCaW5kR3JvdXAiLCJzZXRCaW5kR3JvdXAiLCJpbmRleCIsInBhc3NFbmNvZGVyIiwiaW1wbCIsInN1Ym1pdFZlcnRleEJ1ZmZlciIsInNsb3QiLCJlbGVtZW50Q291bnQiLCJlbGVtZW50cyIsImxlbmd0aCIsInZiQnVmZmVyIiwiYnVmZmVyIiwiaSIsImVsZW1lbnQiLCJzZXRWZXJ0ZXhCdWZmZXIiLCJvZmZzZXQiLCJkcmF3IiwicHJpbWl0aXZlIiwibnVtSW5zdGFuY2VzIiwia2VlcEJ1ZmZlcnMiLCJyZWFkeSIsImFzc2VydCIsInZiMCIsInZlcnRleEJ1ZmZlcnMiLCJ2YlNsb3QiLCJ2YjEiLCJnZXQiLCJzZXRQaXBlbGluZSIsImliIiwic2V0SW5kZXhCdWZmZXIiLCJkcmF3SW5kZXhlZCIsIm51bUluZGljZXMiLCJudW1WZXJ0aWNlcyIsInNldFNoYWRlciIsIl9zaGFkZXJTd2l0Y2hlc1BlckZyYW1lIiwic2V0QmxlbmRpbmciLCJibGVuZGluZyIsInNldEJsZW5kRnVuY3Rpb24iLCJibGVuZFNyYyIsImJsZW5kRHN0Iiwic2V0QmxlbmRFcXVhdGlvbiIsImJsZW5kRXF1YXRpb24iLCJzZXREZXB0aEZ1bmMiLCJmdW5jIiwic2V0RGVwdGhUZXN0IiwiZGVwdGhUZXN0IiwiZ2V0RGVwdGhUZXN0Iiwic2V0Q3VsbE1vZGUiLCJjdWxsTW9kZSIsImdldEN1bGxNb2RlIiwiQ1VMTEZBQ0VfQkFDSyIsInNldEFscGhhVG9Db3ZlcmFnZSIsInN0YXRlIiwic2V0Q29sb3JXcml0ZSIsInNldERlcHRoV3JpdGUiLCJ3cml0ZURlcHRoIiwiZ2V0RGVwdGhXcml0ZSIsImluaXRpYWxpemVDb250ZXh0Q2FjaGVzIiwic3RhcnRQYXNzIiwicmVuZGVyUGFzcyIsInJ0Iiwid3J0Iiwib3V0Q29sb3JCdWZmZXIiLCJnZXRDdXJyZW50VGV4dHVyZSIsIkRlYnVnSGVscGVyIiwic2V0TGFiZWwiLCJjb2xvckZvcm1hdCIsImluaXRSZW5kZXJUYXJnZXQiLCJhc3NpZ25Db2xvclRleHR1cmUiLCJzZXR1cEZvclJlbmRlclBhc3MiLCJjcmVhdGVDb21tYW5kRW5jb2RlciIsImJlZ2luUmVuZGVyUGFzcyIsInJlbmRlclBhc3NEZXNjcmlwdG9yIiwid2lkdGgiLCJoZWlnaHQiLCJzZXRWaWV3cG9ydCIsInNldFNjaXNzb3IiLCJpbnNpZGVSZW5kZXJQYXNzIiwiZW5kUGFzcyIsImVuZCIsInF1ZXVlIiwic3VibWl0IiwiZmluaXNoIiwiY2xlYXIiLCJmbGFncyIsIl93aWR0aCIsIl9oZWlnaHQiLCJzZXREZXB0aEJpYXMiLCJvbiIsInNldERlcHRoQmlhc1ZhbHVlcyIsImNvbnN0QmlhcyIsInNsb3BlQmlhcyIsInNldFN0ZW5jaWxUZXN0IiwiZW5hYmxlIiwieCIsInkiLCJ3IiwiaCIsInZ4IiwidnkiLCJ2dyIsInZoIiwic3giLCJzeSIsInN3Iiwic2giLCJzZXRTY2lzc29yUmVjdCIsImNvcHlSZW5kZXJUYXJnZXQiLCJzb3VyY2UiLCJkZXN0IiwiY29sb3IiLCJjb3B5U2l6ZSIsImRlcHRoT3JBcnJheUxheWVycyIsIkRlYnVnR3JhcGhpY3MiLCJwdXNoR3B1TWFya2VyIiwiY29weVNyYyIsImNvbG9yQnVmZmVyIiwiZ3B1VGV4dHVyZSIsImFzc2lnbmVkQ29sb3JUZXh0dXJlIiwibWlwTGV2ZWwiLCJjb3B5RHN0IiwiY29weVRleHR1cmVUb1RleHR1cmUiLCJzb3VyY2VSVCIsImRlcHRoVGV4dHVyZSIsImRlcHRoQnVmZmVyIiwicG9wR3B1TWFya2VyIiwicHVzaE1hcmtlciIsInB1c2hEZWJ1Z0dyb3VwIiwicG9wTWFya2VyIiwicG9wRGVidWdHcm91cCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQXFCQSxNQUFNQSxvQkFBb0IsU0FBU0MsY0FBYyxDQUFDO0FBQzlDO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7O0FBR0k7QUFDSjtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFD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
