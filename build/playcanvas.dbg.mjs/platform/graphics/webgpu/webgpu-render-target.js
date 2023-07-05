import { Debug, DebugHelper } from '../../../core/debug.js';
import { WebgpuDebug } from './webgpu-debug.js';

/**
 * Private class storing info about color buffer.
 *
 * @ignore
 */
class ColorAttachment {
  constructor() {
    /**
     * @type {GPUTextureFormat}
     * @private
     */
    this.format = void 0;
    /**
     * @type {GPUTexture}
     * @private
     */
    this.multisampledBuffer = void 0;
  }
  destroy() {
    var _this$multisampledBuf;
    (_this$multisampledBuf = this.multisampledBuffer) == null ? void 0 : _this$multisampledBuf.destroy();
    this.multisampledBuffer = null;
  }
}

/**
 * A WebGPU implementation of the RenderTarget.
 *
 * @ignore
 */
class WebgpuRenderTarget {
  /**
   * @param {import('../render-target.js').RenderTarget} renderTarget - The render target owning
   * this implementation.
   */
  constructor(renderTarget) {
    /** @type {boolean} */
    this.initialized = false;
    /**
     * Unique key used by render pipeline creation
     *
     * @type {string}
     */
    this.key = void 0;
    /** @type {ColorAttachment[]} */
    this.colorAttachments = [];
    /**
     * @type {GPUTextureFormat}
     * @private
     */
    this.depthFormat = void 0;
    /** @type {boolean} */
    this.hasStencil = void 0;
    /**
     * @type {GPUTexture}
     * @private
     */
    this.depthTexture = null;
    /**
     * True if the depthTexture is internally allocated / owned
     *
     * @type {boolean}
     */
    this.depthTextureInternal = false;
    /**
     * Texture assigned each frame, and not owned by this render target. This is used on the
     * framebuffer to assign per frame texture obtained from the context.
     *
     * @type {GPUTexture}
     * @private
     */
    this.assignedColorTexture = null;
    /**
     * Render pass descriptor used when starting a render pass for this render target.
     *
     * @type {GPURenderPassDescriptor}
     * @private
     */
    this.renderPassDescriptor = {};
    this.renderTarget = renderTarget;

    // color formats are based on the textures
    if (renderTarget._colorBuffers) {
      renderTarget._colorBuffers.forEach((colorBuffer, index) => {
        this.setColorAttachment(index, undefined, colorBuffer.impl.format);
      });
    }
    this.updateKey();
  }

  /**
   * Release associated resources. Note that this needs to leave this instance in a state where
   * it can be re-initialized again, which is used by render target resizing.
   *
   * @param {import('../webgpu/webgpu-graphics-device.js').WebgpuGraphicsDevice} device - The
   * graphics device.
   */
  destroy(device) {
    this.initialized = false;
    if (this.depthTextureInternal) {
      var _this$depthTexture;
      (_this$depthTexture = this.depthTexture) == null ? void 0 : _this$depthTexture.destroy();
      this.depthTexture = null;
    }
    this.assignedColorTexture = null;
    this.colorAttachments.forEach(colorAttachment => {
      colorAttachment.destroy();
    });
    this.colorAttachments.length = 0;
  }
  updateKey() {
    const rt = this.renderTarget;

    // key used by render pipeline creation
    this.key = '';
    this.colorAttachments.forEach((colorAttachment, index) => {
      this.key += `${index}:${colorAttachment.format}-`;
    });
    this.key += `${rt.depth ? this.depthFormat : ''}-${rt.samples}`;
  }
  setDepthFormat(depthFormat) {
    Debug.assert(depthFormat);
    this.depthFormat = depthFormat;
    this.hasStencil = depthFormat === 'depth24plus-stencil8';
  }

  /**
   * Assign a color buffer. This allows the color buffer of the main framebuffer
   * to be swapped each frame to a buffer provided by the context.
   *
   * @param {any} gpuTexture - The color buffer.
   */
  assignColorTexture(gpuTexture) {
    Debug.assert(gpuTexture);
    this.assignedColorTexture = gpuTexture;
    const view = gpuTexture.createView();
    DebugHelper.setLabel(view, 'Framebuffer.assignedColor');

    // use it as render buffer or resolve target
    const colorAttachment = this.renderPassDescriptor.colorAttachments[0];
    const samples = this.renderTarget.samples;
    if (samples > 1) {
      colorAttachment.resolveTarget = view;
    } else {
      colorAttachment.view = view;
    }

    // for main framebuffer, this is how the format is obtained
    this.setColorAttachment(0, undefined, gpuTexture.format);
    this.updateKey();
  }
  setColorAttachment(index, multisampledBuffer, format) {
    if (!this.colorAttachments[index]) {
      this.colorAttachments[index] = new ColorAttachment();
    }
    if (multisampledBuffer) {
      this.colorAttachments[index].multisampledBuffer = multisampledBuffer;
    }
    if (format) {
      this.colorAttachments[index].format = format;
    }
  }

  /**
   * Initialize render target for rendering one time.
   *
   * @param {import('../webgpu/webgpu-graphics-device.js').WebgpuGraphicsDevice} device - The
   * graphics device.
   * @param {import('../render-target.js').RenderTarget} renderTarget - The render target.
   */
  init(device, renderTarget) {
    var _renderTarget$_colorB, _renderTarget$_colorB2;
    const wgpu = device.wgpu;
    Debug.assert(!this.initialized);
    WebgpuDebug.memory(device);
    WebgpuDebug.validate(device);

    // initialize depth/stencil
    this.initDepthStencil(wgpu, renderTarget);

    // initialize color attachments
    this.renderPassDescriptor.colorAttachments = [];
    const count = (_renderTarget$_colorB = (_renderTarget$_colorB2 = renderTarget._colorBuffers) == null ? void 0 : _renderTarget$_colorB2.length) != null ? _renderTarget$_colorB : 1;
    for (let i = 0; i < count; ++i) {
      var _this$colorAttachment;
      const colorAttachment = this.initColor(wgpu, renderTarget, i);

      // default framebuffer, buffer gets assigned later
      const isDefaultFramebuffer = i === 0 && ((_this$colorAttachment = this.colorAttachments[0]) == null ? void 0 : _this$colorAttachment.format);

      // if we have a color buffer, or is the default framebuffer
      if (colorAttachment.view || isDefaultFramebuffer) {
        this.renderPassDescriptor.colorAttachments.push(colorAttachment);
      }
    }
    this.initialized = true;
    WebgpuDebug.end(device, {
      renderTarget
    });
    WebgpuDebug.end(device, {
      renderTarget
    });
  }
  initDepthStencil(wgpu, renderTarget) {
    const {
      samples,
      width,
      height,
      depth,
      depthBuffer
    } = renderTarget;

    // depth buffer that we render to (single or multi-sampled). We don't create resolve
    // depth buffer as we don't currently resolve it. This might need to change in the future.
    if (depth || depthBuffer) {
      // allocate depth buffer if not provided
      if (!depthBuffer) {
        // TODO: support rendering to 32bit depth without a stencil as well
        this.setDepthFormat('depth24plus-stencil8');

        /** @type {GPUTextureDescriptor} */
        const depthTextureDesc = {
          size: [width, height, 1],
          dimension: '2d',
          sampleCount: samples,
          format: this.depthFormat,
          usage: GPUTextureUsage.RENDER_ATTACHMENT
        };

        // single sampled depth buffer can be copied out (grab pass), multisampled cannot
        // TODO: we should not enable this for shadow maps, as this is not needed it
        if (samples <= 1) {
          depthTextureDesc.usage |= GPUTextureUsage.COPY_SRC;
        }

        // allocate depth buffer
        this.depthTexture = wgpu.createTexture(depthTextureDesc);
        this.depthTextureInternal = true;
      } else {
        // use provided depth buffer
        this.depthTexture = depthBuffer.impl.gpuTexture;
        this.setDepthFormat(depthBuffer.impl.format);
      }
      Debug.assert(this.depthTexture);
      DebugHelper.setLabel(this.depthTexture, `${renderTarget.name}.depthTexture`);

      // @type {GPURenderPassDepthStencilAttachment}
      this.renderPassDescriptor.depthStencilAttachment = {
        view: this.depthTexture.createView()
      };
    }
  }

  /**
   * @private
   */
  initColor(wgpu, renderTarget, index) {
    // Single-sampled color buffer gets passed in:
    // - for normal render target, constructor takes the color buffer as an option
    // - for the main framebuffer, the device supplies the buffer each frame
    // And so we only need to create multi-sampled color buffer if needed here.
    /** @type {GPURenderPassColorAttachment} */
    const colorAttachment = {};
    const {
      samples,
      width,
      height
    } = renderTarget;
    const colorBuffer = renderTarget.getColorBuffer(index);

    // view used to write to the color buffer (either by rendering to it, or resolving to it)
    let colorView = null;
    if (colorBuffer) {
      // render to top mip level in case of mip-mapped buffer
      const mipLevelCount = 1;

      // cubemap face view - face is a single 2d array layer in order [+X, -X, +Y, -Y, +Z, -Z]
      if (colorBuffer.cubemap) {
        colorView = colorBuffer.impl.createView({
          dimension: '2d',
          baseArrayLayer: renderTarget.face,
          arrayLayerCount: 1,
          mipLevelCount
        });
      } else {
        colorView = colorBuffer.impl.createView({
          mipLevelCount
        });
      }
    }

    // multi-sampled color buffer
    if (samples > 1) {
      var _this$colorAttachment2, _this$colorAttachment3;
      /** @type {GPUTextureDescriptor} */
      const multisampledTextureDesc = {
        size: [width, height, 1],
        dimension: '2d',
        sampleCount: samples,
        format: (_this$colorAttachment2 = (_this$colorAttachment3 = this.colorAttachments[index]) == null ? void 0 : _this$colorAttachment3.format) != null ? _this$colorAttachment2 : colorBuffer.impl.format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT
      };

      // allocate multi-sampled color buffer
      const multisampledColorBuffer = wgpu.createTexture(multisampledTextureDesc);
      DebugHelper.setLabel(multisampledColorBuffer, `${renderTarget.name}.multisampledColor`);
      this.setColorAttachment(index, multisampledColorBuffer);
      colorAttachment.view = multisampledColorBuffer.createView();
      DebugHelper.setLabel(colorAttachment.view, `${renderTarget.name}.multisampledColorView`);
      colorAttachment.resolveTarget = colorView;
    } else {
      colorAttachment.view = colorView;
    }
    return colorAttachment;
  }

  /**
   * Update WebGPU render pass descriptor by RenderPass settings.
   *
   * @param {import('../render-pass.js').RenderPass} renderPass - The render pass to start.
   */
  setupForRenderPass(renderPass) {
    var _this$renderPassDescr, _this$renderPassDescr2;
    Debug.assert(this.renderPassDescriptor);
    const count = (_this$renderPassDescr = (_this$renderPassDescr2 = this.renderPassDescriptor.colorAttachments) == null ? void 0 : _this$renderPassDescr2.length) != null ? _this$renderPassDescr : 0;
    for (let i = 0; i < count; ++i) {
      const colorAttachment = this.renderPassDescriptor.colorAttachments[i];
      const colorOps = renderPass.colorArrayOps[i];
      colorAttachment.clearValue = colorOps.clearValue;
      colorAttachment.loadOp = colorOps.clear ? 'clear' : 'load';
      colorAttachment.storeOp = colorOps.store ? 'store' : 'discard';
    }
    const depthAttachment = this.renderPassDescriptor.depthStencilAttachment;
    if (depthAttachment) {
      depthAttachment.depthClearValue = renderPass.depthStencilOps.clearDepthValue;
      depthAttachment.depthLoadOp = renderPass.depthStencilOps.clearDepth ? 'clear' : 'load';
      depthAttachment.depthStoreOp = renderPass.depthStencilOps.storeDepth ? 'store' : 'discard';
      depthAttachment.depthReadOnly = false;
      if (this.hasStencil) {
        depthAttachment.stencilClearValue = renderPass.depthStencilOps.clearStencilValue;
        depthAttachment.stencilLoadOp = renderPass.depthStencilOps.clearStencil ? 'clear' : 'load';
        depthAttachment.stencilStoreOp = renderPass.depthStencilOps.storeStencil ? 'store' : 'discard';
        depthAttachment.stencilReadOnly = false;
      }
    }
  }
  loseContext() {
    this.initialized = false;
  }
  resolve(device, target, color, depth) {}
}

export { WebgpuRenderTarget };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViZ3B1LXJlbmRlci10YXJnZXQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9wbGF0Zm9ybS9ncmFwaGljcy93ZWJncHUvd2ViZ3B1LXJlbmRlci10YXJnZXQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcsIERlYnVnSGVscGVyIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBXZWJncHVEZWJ1ZyB9IGZyb20gJy4vd2ViZ3B1LWRlYnVnLmpzJztcblxuLyoqXG4gKiBQcml2YXRlIGNsYXNzIHN0b3JpbmcgaW5mbyBhYm91dCBjb2xvciBidWZmZXIuXG4gKlxuICogQGlnbm9yZVxuICovXG5jbGFzcyBDb2xvckF0dGFjaG1lbnQge1xuICAgIC8qKlxuICAgICAqIEB0eXBlIHtHUFVUZXh0dXJlRm9ybWF0fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgZm9ybWF0O1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0dQVVRleHR1cmV9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBtdWx0aXNhbXBsZWRCdWZmZXI7XG5cbiAgICBkZXN0cm95KCkge1xuICAgICAgICB0aGlzLm11bHRpc2FtcGxlZEJ1ZmZlcj8uZGVzdHJveSgpO1xuICAgICAgICB0aGlzLm11bHRpc2FtcGxlZEJ1ZmZlciA9IG51bGw7XG4gICAgfVxufVxuXG4vKipcbiAqIEEgV2ViR1BVIGltcGxlbWVudGF0aW9uIG9mIHRoZSBSZW5kZXJUYXJnZXQuXG4gKlxuICogQGlnbm9yZVxuICovXG5jbGFzcyBXZWJncHVSZW5kZXJUYXJnZXQge1xuICAgIC8qKiBAdHlwZSB7Ym9vbGVhbn0gKi9cbiAgICBpbml0aWFsaXplZCA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogVW5pcXVlIGtleSB1c2VkIGJ5IHJlbmRlciBwaXBlbGluZSBjcmVhdGlvblxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKi9cbiAgICBrZXk7XG5cbiAgICAvKiogQHR5cGUge0NvbG9yQXR0YWNobWVudFtdfSAqL1xuICAgIGNvbG9yQXR0YWNobWVudHMgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtHUFVUZXh0dXJlRm9ybWF0fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgZGVwdGhGb3JtYXQ7XG5cbiAgICAvKiogQHR5cGUge2Jvb2xlYW59ICovXG4gICAgaGFzU3RlbmNpbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtHUFVUZXh0dXJlfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgZGVwdGhUZXh0dXJlID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgdGhlIGRlcHRoVGV4dHVyZSBpcyBpbnRlcm5hbGx5IGFsbG9jYXRlZCAvIG93bmVkXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBkZXB0aFRleHR1cmVJbnRlcm5hbCA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogVGV4dHVyZSBhc3NpZ25lZCBlYWNoIGZyYW1lLCBhbmQgbm90IG93bmVkIGJ5IHRoaXMgcmVuZGVyIHRhcmdldC4gVGhpcyBpcyB1c2VkIG9uIHRoZVxuICAgICAqIGZyYW1lYnVmZmVyIHRvIGFzc2lnbiBwZXIgZnJhbWUgdGV4dHVyZSBvYnRhaW5lZCBmcm9tIHRoZSBjb250ZXh0LlxuICAgICAqXG4gICAgICogQHR5cGUge0dQVVRleHR1cmV9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBhc3NpZ25lZENvbG9yVGV4dHVyZSA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBSZW5kZXIgcGFzcyBkZXNjcmlwdG9yIHVzZWQgd2hlbiBzdGFydGluZyBhIHJlbmRlciBwYXNzIGZvciB0aGlzIHJlbmRlciB0YXJnZXQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7R1BVUmVuZGVyUGFzc0Rlc2NyaXB0b3J9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICByZW5kZXJQYXNzRGVzY3JpcHRvciA9IHt9O1xuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL3JlbmRlci10YXJnZXQuanMnKS5SZW5kZXJUYXJnZXR9IHJlbmRlclRhcmdldCAtIFRoZSByZW5kZXIgdGFyZ2V0IG93bmluZ1xuICAgICAqIHRoaXMgaW1wbGVtZW50YXRpb24uXG4gICAgICovXG4gICAgY29uc3RydWN0b3IocmVuZGVyVGFyZ2V0KSB7XG4gICAgICAgIHRoaXMucmVuZGVyVGFyZ2V0ID0gcmVuZGVyVGFyZ2V0O1xuXG4gICAgICAgIC8vIGNvbG9yIGZvcm1hdHMgYXJlIGJhc2VkIG9uIHRoZSB0ZXh0dXJlc1xuICAgICAgICBpZiAocmVuZGVyVGFyZ2V0Ll9jb2xvckJ1ZmZlcnMpIHtcbiAgICAgICAgICAgIHJlbmRlclRhcmdldC5fY29sb3JCdWZmZXJzLmZvckVhY2goKGNvbG9yQnVmZmVyLCBpbmRleCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0Q29sb3JBdHRhY2htZW50KGluZGV4LCB1bmRlZmluZWQsIGNvbG9yQnVmZmVyLmltcGwuZm9ybWF0KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy51cGRhdGVLZXkoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZWxlYXNlIGFzc29jaWF0ZWQgcmVzb3VyY2VzLiBOb3RlIHRoYXQgdGhpcyBuZWVkcyB0byBsZWF2ZSB0aGlzIGluc3RhbmNlIGluIGEgc3RhdGUgd2hlcmVcbiAgICAgKiBpdCBjYW4gYmUgcmUtaW5pdGlhbGl6ZWQgYWdhaW4sIHdoaWNoIGlzIHVzZWQgYnkgcmVuZGVyIHRhcmdldCByZXNpemluZy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi93ZWJncHUvd2ViZ3B1LWdyYXBoaWNzLWRldmljZS5qcycpLldlYmdwdUdyYXBoaWNzRGV2aWNlfSBkZXZpY2UgLSBUaGVcbiAgICAgKiBncmFwaGljcyBkZXZpY2UuXG4gICAgICovXG4gICAgZGVzdHJveShkZXZpY2UpIHtcbiAgICAgICAgdGhpcy5pbml0aWFsaXplZCA9IGZhbHNlO1xuXG4gICAgICAgIGlmICh0aGlzLmRlcHRoVGV4dHVyZUludGVybmFsKSB7XG4gICAgICAgICAgICB0aGlzLmRlcHRoVGV4dHVyZT8uZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy5kZXB0aFRleHR1cmUgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5hc3NpZ25lZENvbG9yVGV4dHVyZSA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5jb2xvckF0dGFjaG1lbnRzLmZvckVhY2goKGNvbG9yQXR0YWNobWVudCkgPT4ge1xuICAgICAgICAgICAgY29sb3JBdHRhY2htZW50LmRlc3Ryb3koKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuY29sb3JBdHRhY2htZW50cy5sZW5ndGggPSAwO1xuICAgIH1cblxuICAgIHVwZGF0ZUtleSgpIHtcbiAgICAgICAgY29uc3QgcnQgPSB0aGlzLnJlbmRlclRhcmdldDtcblxuICAgICAgICAvLyBrZXkgdXNlZCBieSByZW5kZXIgcGlwZWxpbmUgY3JlYXRpb25cbiAgICAgICAgdGhpcy5rZXkgPSAnJztcbiAgICAgICAgdGhpcy5jb2xvckF0dGFjaG1lbnRzLmZvckVhY2goKGNvbG9yQXR0YWNobWVudCwgaW5kZXgpID0+IHtcbiAgICAgICAgICAgIHRoaXMua2V5ICs9IGAke2luZGV4fToke2NvbG9yQXR0YWNobWVudC5mb3JtYXR9LWA7XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLmtleSArPSBgJHtydC5kZXB0aCA/IHRoaXMuZGVwdGhGb3JtYXQgOiAnJ30tJHtydC5zYW1wbGVzfWA7XG4gICAgfVxuXG4gICAgc2V0RGVwdGhGb3JtYXQoZGVwdGhGb3JtYXQpIHtcbiAgICAgICAgRGVidWcuYXNzZXJ0KGRlcHRoRm9ybWF0KTtcbiAgICAgICAgdGhpcy5kZXB0aEZvcm1hdCA9IGRlcHRoRm9ybWF0O1xuICAgICAgICB0aGlzLmhhc1N0ZW5jaWwgPSBkZXB0aEZvcm1hdCA9PT0gJ2RlcHRoMjRwbHVzLXN0ZW5jaWw4JztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBc3NpZ24gYSBjb2xvciBidWZmZXIuIFRoaXMgYWxsb3dzIHRoZSBjb2xvciBidWZmZXIgb2YgdGhlIG1haW4gZnJhbWVidWZmZXJcbiAgICAgKiB0byBiZSBzd2FwcGVkIGVhY2ggZnJhbWUgdG8gYSBidWZmZXIgcHJvdmlkZWQgYnkgdGhlIGNvbnRleHQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2FueX0gZ3B1VGV4dHVyZSAtIFRoZSBjb2xvciBidWZmZXIuXG4gICAgICovXG4gICAgYXNzaWduQ29sb3JUZXh0dXJlKGdwdVRleHR1cmUpIHtcblxuICAgICAgICBEZWJ1Zy5hc3NlcnQoZ3B1VGV4dHVyZSk7XG4gICAgICAgIHRoaXMuYXNzaWduZWRDb2xvclRleHR1cmUgPSBncHVUZXh0dXJlO1xuXG4gICAgICAgIGNvbnN0IHZpZXcgPSBncHVUZXh0dXJlLmNyZWF0ZVZpZXcoKTtcbiAgICAgICAgRGVidWdIZWxwZXIuc2V0TGFiZWwodmlldywgJ0ZyYW1lYnVmZmVyLmFzc2lnbmVkQ29sb3InKTtcblxuICAgICAgICAvLyB1c2UgaXQgYXMgcmVuZGVyIGJ1ZmZlciBvciByZXNvbHZlIHRhcmdldFxuICAgICAgICBjb25zdCBjb2xvckF0dGFjaG1lbnQgPSB0aGlzLnJlbmRlclBhc3NEZXNjcmlwdG9yLmNvbG9yQXR0YWNobWVudHNbMF07XG4gICAgICAgIGNvbnN0IHNhbXBsZXMgPSB0aGlzLnJlbmRlclRhcmdldC5zYW1wbGVzO1xuICAgICAgICBpZiAoc2FtcGxlcyA+IDEpIHtcbiAgICAgICAgICAgIGNvbG9yQXR0YWNobWVudC5yZXNvbHZlVGFyZ2V0ID0gdmlldztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbG9yQXR0YWNobWVudC52aWV3ID0gdmlldztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGZvciBtYWluIGZyYW1lYnVmZmVyLCB0aGlzIGlzIGhvdyB0aGUgZm9ybWF0IGlzIG9idGFpbmVkXG4gICAgICAgIHRoaXMuc2V0Q29sb3JBdHRhY2htZW50KDAsIHVuZGVmaW5lZCwgZ3B1VGV4dHVyZS5mb3JtYXQpO1xuICAgICAgICB0aGlzLnVwZGF0ZUtleSgpO1xuICAgIH1cblxuICAgIHNldENvbG9yQXR0YWNobWVudChpbmRleCwgbXVsdGlzYW1wbGVkQnVmZmVyLCBmb3JtYXQpIHtcbiAgICAgICAgaWYgKCF0aGlzLmNvbG9yQXR0YWNobWVudHNbaW5kZXhdKSB7XG4gICAgICAgICAgICB0aGlzLmNvbG9yQXR0YWNobWVudHNbaW5kZXhdID0gbmV3IENvbG9yQXR0YWNobWVudCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG11bHRpc2FtcGxlZEJ1ZmZlcikge1xuICAgICAgICAgICAgdGhpcy5jb2xvckF0dGFjaG1lbnRzW2luZGV4XS5tdWx0aXNhbXBsZWRCdWZmZXIgPSBtdWx0aXNhbXBsZWRCdWZmZXI7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZm9ybWF0KSB7XG4gICAgICAgICAgICB0aGlzLmNvbG9yQXR0YWNobWVudHNbaW5kZXhdLmZvcm1hdCA9IGZvcm1hdDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEluaXRpYWxpemUgcmVuZGVyIHRhcmdldCBmb3IgcmVuZGVyaW5nIG9uZSB0aW1lLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL3dlYmdwdS93ZWJncHUtZ3JhcGhpY3MtZGV2aWNlLmpzJykuV2ViZ3B1R3JhcGhpY3NEZXZpY2V9IGRldmljZSAtIFRoZVxuICAgICAqIGdyYXBoaWNzIGRldmljZS5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vcmVuZGVyLXRhcmdldC5qcycpLlJlbmRlclRhcmdldH0gcmVuZGVyVGFyZ2V0IC0gVGhlIHJlbmRlciB0YXJnZXQuXG4gICAgICovXG4gICAgaW5pdChkZXZpY2UsIHJlbmRlclRhcmdldCkge1xuXG4gICAgICAgIGNvbnN0IHdncHUgPSBkZXZpY2Uud2dwdTtcbiAgICAgICAgRGVidWcuYXNzZXJ0KCF0aGlzLmluaXRpYWxpemVkKTtcblxuICAgICAgICBXZWJncHVEZWJ1Zy5tZW1vcnkoZGV2aWNlKTtcbiAgICAgICAgV2ViZ3B1RGVidWcudmFsaWRhdGUoZGV2aWNlKTtcblxuICAgICAgICAvLyBpbml0aWFsaXplIGRlcHRoL3N0ZW5jaWxcbiAgICAgICAgdGhpcy5pbml0RGVwdGhTdGVuY2lsKHdncHUsIHJlbmRlclRhcmdldCk7XG5cbiAgICAgICAgLy8gaW5pdGlhbGl6ZSBjb2xvciBhdHRhY2htZW50c1xuICAgICAgICB0aGlzLnJlbmRlclBhc3NEZXNjcmlwdG9yLmNvbG9yQXR0YWNobWVudHMgPSBbXTtcbiAgICAgICAgY29uc3QgY291bnQgPSByZW5kZXJUYXJnZXQuX2NvbG9yQnVmZmVycz8ubGVuZ3RoID8/IDE7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY291bnQ7ICsraSkge1xuICAgICAgICAgICAgY29uc3QgY29sb3JBdHRhY2htZW50ID0gdGhpcy5pbml0Q29sb3Iod2dwdSwgcmVuZGVyVGFyZ2V0LCBpKTtcblxuICAgICAgICAgICAgLy8gZGVmYXVsdCBmcmFtZWJ1ZmZlciwgYnVmZmVyIGdldHMgYXNzaWduZWQgbGF0ZXJcbiAgICAgICAgICAgIGNvbnN0IGlzRGVmYXVsdEZyYW1lYnVmZmVyID0gaSA9PT0gMCAmJiB0aGlzLmNvbG9yQXR0YWNobWVudHNbMF0/LmZvcm1hdDtcblxuICAgICAgICAgICAgLy8gaWYgd2UgaGF2ZSBhIGNvbG9yIGJ1ZmZlciwgb3IgaXMgdGhlIGRlZmF1bHQgZnJhbWVidWZmZXJcbiAgICAgICAgICAgIGlmIChjb2xvckF0dGFjaG1lbnQudmlldyB8fCBpc0RlZmF1bHRGcmFtZWJ1ZmZlcikge1xuICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyUGFzc0Rlc2NyaXB0b3IuY29sb3JBdHRhY2htZW50cy5wdXNoKGNvbG9yQXR0YWNobWVudCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmluaXRpYWxpemVkID0gdHJ1ZTtcblxuICAgICAgICBXZWJncHVEZWJ1Zy5lbmQoZGV2aWNlLCB7IHJlbmRlclRhcmdldCB9KTtcbiAgICAgICAgV2ViZ3B1RGVidWcuZW5kKGRldmljZSwgeyByZW5kZXJUYXJnZXQgfSk7XG4gICAgfVxuXG4gICAgaW5pdERlcHRoU3RlbmNpbCh3Z3B1LCByZW5kZXJUYXJnZXQpIHtcblxuICAgICAgICBjb25zdCB7IHNhbXBsZXMsIHdpZHRoLCBoZWlnaHQsIGRlcHRoLCBkZXB0aEJ1ZmZlciB9ID0gcmVuZGVyVGFyZ2V0O1xuXG4gICAgICAgIC8vIGRlcHRoIGJ1ZmZlciB0aGF0IHdlIHJlbmRlciB0byAoc2luZ2xlIG9yIG11bHRpLXNhbXBsZWQpLiBXZSBkb24ndCBjcmVhdGUgcmVzb2x2ZVxuICAgICAgICAvLyBkZXB0aCBidWZmZXIgYXMgd2UgZG9uJ3QgY3VycmVudGx5IHJlc29sdmUgaXQuIFRoaXMgbWlnaHQgbmVlZCB0byBjaGFuZ2UgaW4gdGhlIGZ1dHVyZS5cbiAgICAgICAgaWYgKGRlcHRoIHx8IGRlcHRoQnVmZmVyKSB7XG5cbiAgICAgICAgICAgIC8vIGFsbG9jYXRlIGRlcHRoIGJ1ZmZlciBpZiBub3QgcHJvdmlkZWRcbiAgICAgICAgICAgIGlmICghZGVwdGhCdWZmZXIpIHtcblxuICAgICAgICAgICAgICAgIC8vIFRPRE86IHN1cHBvcnQgcmVuZGVyaW5nIHRvIDMyYml0IGRlcHRoIHdpdGhvdXQgYSBzdGVuY2lsIGFzIHdlbGxcbiAgICAgICAgICAgICAgICB0aGlzLnNldERlcHRoRm9ybWF0KCdkZXB0aDI0cGx1cy1zdGVuY2lsOCcpO1xuXG4gICAgICAgICAgICAgICAgLyoqIEB0eXBlIHtHUFVUZXh0dXJlRGVzY3JpcHRvcn0gKi9cbiAgICAgICAgICAgICAgICBjb25zdCBkZXB0aFRleHR1cmVEZXNjID0ge1xuICAgICAgICAgICAgICAgICAgICBzaXplOiBbd2lkdGgsIGhlaWdodCwgMV0sXG4gICAgICAgICAgICAgICAgICAgIGRpbWVuc2lvbjogJzJkJyxcbiAgICAgICAgICAgICAgICAgICAgc2FtcGxlQ291bnQ6IHNhbXBsZXMsXG4gICAgICAgICAgICAgICAgICAgIGZvcm1hdDogdGhpcy5kZXB0aEZvcm1hdCxcbiAgICAgICAgICAgICAgICAgICAgdXNhZ2U6IEdQVVRleHR1cmVVc2FnZS5SRU5ERVJfQVRUQUNITUVOVFxuICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICAvLyBzaW5nbGUgc2FtcGxlZCBkZXB0aCBidWZmZXIgY2FuIGJlIGNvcGllZCBvdXQgKGdyYWIgcGFzcyksIG11bHRpc2FtcGxlZCBjYW5ub3RcbiAgICAgICAgICAgICAgICAvLyBUT0RPOiB3ZSBzaG91bGQgbm90IGVuYWJsZSB0aGlzIGZvciBzaGFkb3cgbWFwcywgYXMgdGhpcyBpcyBub3QgbmVlZGVkIGl0XG4gICAgICAgICAgICAgICAgaWYgKHNhbXBsZXMgPD0gMSkge1xuICAgICAgICAgICAgICAgICAgICBkZXB0aFRleHR1cmVEZXNjLnVzYWdlIHw9IEdQVVRleHR1cmVVc2FnZS5DT1BZX1NSQztcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBhbGxvY2F0ZSBkZXB0aCBidWZmZXJcbiAgICAgICAgICAgICAgICB0aGlzLmRlcHRoVGV4dHVyZSA9IHdncHUuY3JlYXRlVGV4dHVyZShkZXB0aFRleHR1cmVEZXNjKTtcbiAgICAgICAgICAgICAgICB0aGlzLmRlcHRoVGV4dHVyZUludGVybmFsID0gdHJ1ZTtcblxuICAgICAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgICAgIC8vIHVzZSBwcm92aWRlZCBkZXB0aCBidWZmZXJcbiAgICAgICAgICAgICAgICB0aGlzLmRlcHRoVGV4dHVyZSA9IGRlcHRoQnVmZmVyLmltcGwuZ3B1VGV4dHVyZTtcbiAgICAgICAgICAgICAgICB0aGlzLnNldERlcHRoRm9ybWF0KGRlcHRoQnVmZmVyLmltcGwuZm9ybWF0KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgRGVidWcuYXNzZXJ0KHRoaXMuZGVwdGhUZXh0dXJlKTtcbiAgICAgICAgICAgIERlYnVnSGVscGVyLnNldExhYmVsKHRoaXMuZGVwdGhUZXh0dXJlLCBgJHtyZW5kZXJUYXJnZXQubmFtZX0uZGVwdGhUZXh0dXJlYCk7XG5cbiAgICAgICAgICAgIC8vIEB0eXBlIHtHUFVSZW5kZXJQYXNzRGVwdGhTdGVuY2lsQXR0YWNobWVudH1cbiAgICAgICAgICAgIHRoaXMucmVuZGVyUGFzc0Rlc2NyaXB0b3IuZGVwdGhTdGVuY2lsQXR0YWNobWVudCA9IHtcbiAgICAgICAgICAgICAgICB2aWV3OiB0aGlzLmRlcHRoVGV4dHVyZS5jcmVhdGVWaWV3KClcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIGluaXRDb2xvcih3Z3B1LCByZW5kZXJUYXJnZXQsIGluZGV4KSB7XG4gICAgICAgIC8vIFNpbmdsZS1zYW1wbGVkIGNvbG9yIGJ1ZmZlciBnZXRzIHBhc3NlZCBpbjpcbiAgICAgICAgLy8gLSBmb3Igbm9ybWFsIHJlbmRlciB0YXJnZXQsIGNvbnN0cnVjdG9yIHRha2VzIHRoZSBjb2xvciBidWZmZXIgYXMgYW4gb3B0aW9uXG4gICAgICAgIC8vIC0gZm9yIHRoZSBtYWluIGZyYW1lYnVmZmVyLCB0aGUgZGV2aWNlIHN1cHBsaWVzIHRoZSBidWZmZXIgZWFjaCBmcmFtZVxuICAgICAgICAvLyBBbmQgc28gd2Ugb25seSBuZWVkIHRvIGNyZWF0ZSBtdWx0aS1zYW1wbGVkIGNvbG9yIGJ1ZmZlciBpZiBuZWVkZWQgaGVyZS5cbiAgICAgICAgLyoqIEB0eXBlIHtHUFVSZW5kZXJQYXNzQ29sb3JBdHRhY2htZW50fSAqL1xuICAgICAgICBjb25zdCBjb2xvckF0dGFjaG1lbnQgPSB7fTtcblxuICAgICAgICBjb25zdCB7IHNhbXBsZXMsIHdpZHRoLCBoZWlnaHQgfSA9IHJlbmRlclRhcmdldDtcbiAgICAgICAgY29uc3QgY29sb3JCdWZmZXIgPSByZW5kZXJUYXJnZXQuZ2V0Q29sb3JCdWZmZXIoaW5kZXgpO1xuXG4gICAgICAgIC8vIHZpZXcgdXNlZCB0byB3cml0ZSB0byB0aGUgY29sb3IgYnVmZmVyIChlaXRoZXIgYnkgcmVuZGVyaW5nIHRvIGl0LCBvciByZXNvbHZpbmcgdG8gaXQpXG4gICAgICAgIGxldCBjb2xvclZpZXcgPSBudWxsO1xuICAgICAgICBpZiAoY29sb3JCdWZmZXIpIHtcblxuICAgICAgICAgICAgLy8gcmVuZGVyIHRvIHRvcCBtaXAgbGV2ZWwgaW4gY2FzZSBvZiBtaXAtbWFwcGVkIGJ1ZmZlclxuICAgICAgICAgICAgY29uc3QgbWlwTGV2ZWxDb3VudCA9IDE7XG5cbiAgICAgICAgICAgIC8vIGN1YmVtYXAgZmFjZSB2aWV3IC0gZmFjZSBpcyBhIHNpbmdsZSAyZCBhcnJheSBsYXllciBpbiBvcmRlciBbK1gsIC1YLCArWSwgLVksICtaLCAtWl1cbiAgICAgICAgICAgIGlmIChjb2xvckJ1ZmZlci5jdWJlbWFwKSB7XG4gICAgICAgICAgICAgICAgY29sb3JWaWV3ID0gY29sb3JCdWZmZXIuaW1wbC5jcmVhdGVWaWV3KHtcbiAgICAgICAgICAgICAgICAgICAgZGltZW5zaW9uOiAnMmQnLFxuICAgICAgICAgICAgICAgICAgICBiYXNlQXJyYXlMYXllcjogcmVuZGVyVGFyZ2V0LmZhY2UsXG4gICAgICAgICAgICAgICAgICAgIGFycmF5TGF5ZXJDb3VudDogMSxcbiAgICAgICAgICAgICAgICAgICAgbWlwTGV2ZWxDb3VudFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb2xvclZpZXcgPSBjb2xvckJ1ZmZlci5pbXBsLmNyZWF0ZVZpZXcoe1xuICAgICAgICAgICAgICAgICAgICBtaXBMZXZlbENvdW50XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBtdWx0aS1zYW1wbGVkIGNvbG9yIGJ1ZmZlclxuICAgICAgICBpZiAoc2FtcGxlcyA+IDEpIHtcblxuICAgICAgICAgICAgLyoqIEB0eXBlIHtHUFVUZXh0dXJlRGVzY3JpcHRvcn0gKi9cbiAgICAgICAgICAgIGNvbnN0IG11bHRpc2FtcGxlZFRleHR1cmVEZXNjID0ge1xuICAgICAgICAgICAgICAgIHNpemU6IFt3aWR0aCwgaGVpZ2h0LCAxXSxcbiAgICAgICAgICAgICAgICBkaW1lbnNpb246ICcyZCcsXG4gICAgICAgICAgICAgICAgc2FtcGxlQ291bnQ6IHNhbXBsZXMsXG4gICAgICAgICAgICAgICAgZm9ybWF0OiB0aGlzLmNvbG9yQXR0YWNobWVudHNbaW5kZXhdPy5mb3JtYXQgPz8gY29sb3JCdWZmZXIuaW1wbC5mb3JtYXQsXG4gICAgICAgICAgICAgICAgdXNhZ2U6IEdQVVRleHR1cmVVc2FnZS5SRU5ERVJfQVRUQUNITUVOVFxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgLy8gYWxsb2NhdGUgbXVsdGktc2FtcGxlZCBjb2xvciBidWZmZXJcbiAgICAgICAgICAgIGNvbnN0IG11bHRpc2FtcGxlZENvbG9yQnVmZmVyID0gd2dwdS5jcmVhdGVUZXh0dXJlKG11bHRpc2FtcGxlZFRleHR1cmVEZXNjKTtcbiAgICAgICAgICAgIERlYnVnSGVscGVyLnNldExhYmVsKG11bHRpc2FtcGxlZENvbG9yQnVmZmVyLCBgJHtyZW5kZXJUYXJnZXQubmFtZX0ubXVsdGlzYW1wbGVkQ29sb3JgKTtcbiAgICAgICAgICAgIHRoaXMuc2V0Q29sb3JBdHRhY2htZW50KGluZGV4LCBtdWx0aXNhbXBsZWRDb2xvckJ1ZmZlcik7XG5cbiAgICAgICAgICAgIGNvbG9yQXR0YWNobWVudC52aWV3ID0gbXVsdGlzYW1wbGVkQ29sb3JCdWZmZXIuY3JlYXRlVmlldygpO1xuICAgICAgICAgICAgRGVidWdIZWxwZXIuc2V0TGFiZWwoY29sb3JBdHRhY2htZW50LnZpZXcsIGAke3JlbmRlclRhcmdldC5uYW1lfS5tdWx0aXNhbXBsZWRDb2xvclZpZXdgKTtcblxuICAgICAgICAgICAgY29sb3JBdHRhY2htZW50LnJlc29sdmVUYXJnZXQgPSBjb2xvclZpZXc7XG5cbiAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgY29sb3JBdHRhY2htZW50LnZpZXcgPSBjb2xvclZpZXc7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gY29sb3JBdHRhY2htZW50O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVwZGF0ZSBXZWJHUFUgcmVuZGVyIHBhc3MgZGVzY3JpcHRvciBieSBSZW5kZXJQYXNzIHNldHRpbmdzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL3JlbmRlci1wYXNzLmpzJykuUmVuZGVyUGFzc30gcmVuZGVyUGFzcyAtIFRoZSByZW5kZXIgcGFzcyB0byBzdGFydC5cbiAgICAgKi9cbiAgICBzZXR1cEZvclJlbmRlclBhc3MocmVuZGVyUGFzcykge1xuXG4gICAgICAgIERlYnVnLmFzc2VydCh0aGlzLnJlbmRlclBhc3NEZXNjcmlwdG9yKTtcblxuICAgICAgICBjb25zdCBjb3VudCA9IHRoaXMucmVuZGVyUGFzc0Rlc2NyaXB0b3IuY29sb3JBdHRhY2htZW50cz8ubGVuZ3RoID8/IDA7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY291bnQ7ICsraSkge1xuICAgICAgICAgICAgY29uc3QgY29sb3JBdHRhY2htZW50ID0gdGhpcy5yZW5kZXJQYXNzRGVzY3JpcHRvci5jb2xvckF0dGFjaG1lbnRzW2ldO1xuICAgICAgICAgICAgY29uc3QgY29sb3JPcHMgPSByZW5kZXJQYXNzLmNvbG9yQXJyYXlPcHNbaV07XG4gICAgICAgICAgICBjb2xvckF0dGFjaG1lbnQuY2xlYXJWYWx1ZSA9IGNvbG9yT3BzLmNsZWFyVmFsdWU7XG4gICAgICAgICAgICBjb2xvckF0dGFjaG1lbnQubG9hZE9wID0gY29sb3JPcHMuY2xlYXIgPyAnY2xlYXInIDogJ2xvYWQnO1xuICAgICAgICAgICAgY29sb3JBdHRhY2htZW50LnN0b3JlT3AgPSBjb2xvck9wcy5zdG9yZSA/ICdzdG9yZScgOiAnZGlzY2FyZCc7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBkZXB0aEF0dGFjaG1lbnQgPSB0aGlzLnJlbmRlclBhc3NEZXNjcmlwdG9yLmRlcHRoU3RlbmNpbEF0dGFjaG1lbnQ7XG4gICAgICAgIGlmIChkZXB0aEF0dGFjaG1lbnQpIHtcbiAgICAgICAgICAgIGRlcHRoQXR0YWNobWVudC5kZXB0aENsZWFyVmFsdWUgPSByZW5kZXJQYXNzLmRlcHRoU3RlbmNpbE9wcy5jbGVhckRlcHRoVmFsdWU7XG4gICAgICAgICAgICBkZXB0aEF0dGFjaG1lbnQuZGVwdGhMb2FkT3AgPSByZW5kZXJQYXNzLmRlcHRoU3RlbmNpbE9wcy5jbGVhckRlcHRoID8gJ2NsZWFyJyA6ICdsb2FkJztcbiAgICAgICAgICAgIGRlcHRoQXR0YWNobWVudC5kZXB0aFN0b3JlT3AgPSByZW5kZXJQYXNzLmRlcHRoU3RlbmNpbE9wcy5zdG9yZURlcHRoID8gJ3N0b3JlJyA6ICdkaXNjYXJkJztcbiAgICAgICAgICAgIGRlcHRoQXR0YWNobWVudC5kZXB0aFJlYWRPbmx5ID0gZmFsc2U7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmhhc1N0ZW5jaWwpIHtcbiAgICAgICAgICAgICAgICBkZXB0aEF0dGFjaG1lbnQuc3RlbmNpbENsZWFyVmFsdWUgPSByZW5kZXJQYXNzLmRlcHRoU3RlbmNpbE9wcy5jbGVhclN0ZW5jaWxWYWx1ZTtcbiAgICAgICAgICAgICAgICBkZXB0aEF0dGFjaG1lbnQuc3RlbmNpbExvYWRPcCA9IHJlbmRlclBhc3MuZGVwdGhTdGVuY2lsT3BzLmNsZWFyU3RlbmNpbCA/ICdjbGVhcicgOiAnbG9hZCc7XG4gICAgICAgICAgICAgICAgZGVwdGhBdHRhY2htZW50LnN0ZW5jaWxTdG9yZU9wID0gcmVuZGVyUGFzcy5kZXB0aFN0ZW5jaWxPcHMuc3RvcmVTdGVuY2lsID8gJ3N0b3JlJyA6ICdkaXNjYXJkJztcbiAgICAgICAgICAgICAgICBkZXB0aEF0dGFjaG1lbnQuc3RlbmNpbFJlYWRPbmx5ID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBsb3NlQ29udGV4dCgpIHtcbiAgICAgICAgdGhpcy5pbml0aWFsaXplZCA9IGZhbHNlO1xuICAgIH1cblxuICAgIHJlc29sdmUoZGV2aWNlLCB0YXJnZXQsIGNvbG9yLCBkZXB0aCkge1xuICAgIH1cbn1cblxuZXhwb3J0IHsgV2ViZ3B1UmVuZGVyVGFyZ2V0IH07XG4iXSwibmFtZXMiOlsiQ29sb3JBdHRhY2htZW50IiwiY29uc3RydWN0b3IiLCJmb3JtYXQiLCJtdWx0aXNhbXBsZWRCdWZmZXIiLCJkZXN0cm95IiwiX3RoaXMkbXVsdGlzYW1wbGVkQnVmIiwiV2ViZ3B1UmVuZGVyVGFyZ2V0IiwicmVuZGVyVGFyZ2V0IiwiaW5pdGlhbGl6ZWQiLCJrZXkiLCJjb2xvckF0dGFjaG1lbnRzIiwiZGVwdGhGb3JtYXQiLCJoYXNTdGVuY2lsIiwiZGVwdGhUZXh0dXJlIiwiZGVwdGhUZXh0dXJlSW50ZXJuYWwiLCJhc3NpZ25lZENvbG9yVGV4dHVyZSIsInJlbmRlclBhc3NEZXNjcmlwdG9yIiwiX2NvbG9yQnVmZmVycyIsImZvckVhY2giLCJjb2xvckJ1ZmZlciIsImluZGV4Iiwic2V0Q29sb3JBdHRhY2htZW50IiwidW5kZWZpbmVkIiwiaW1wbCIsInVwZGF0ZUtleSIsImRldmljZSIsIl90aGlzJGRlcHRoVGV4dHVyZSIsImNvbG9yQXR0YWNobWVudCIsImxlbmd0aCIsInJ0IiwiZGVwdGgiLCJzYW1wbGVzIiwic2V0RGVwdGhGb3JtYXQiLCJEZWJ1ZyIsImFzc2VydCIsImFzc2lnbkNvbG9yVGV4dHVyZSIsImdwdVRleHR1cmUiLCJ2aWV3IiwiY3JlYXRlVmlldyIsIkRlYnVnSGVscGVyIiwic2V0TGFiZWwiLCJyZXNvbHZlVGFyZ2V0IiwiaW5pdCIsIl9yZW5kZXJUYXJnZXQkX2NvbG9yQiIsIl9yZW5kZXJUYXJnZXQkX2NvbG9yQjIiLCJ3Z3B1IiwiV2ViZ3B1RGVidWciLCJtZW1vcnkiLCJ2YWxpZGF0ZSIsImluaXREZXB0aFN0ZW5jaWwiLCJjb3VudCIsImkiLCJfdGhpcyRjb2xvckF0dGFjaG1lbnQiLCJpbml0Q29sb3IiLCJpc0RlZmF1bHRGcmFtZWJ1ZmZlciIsInB1c2giLCJlbmQiLCJ3aWR0aCIsImhlaWdodCIsImRlcHRoQnVmZmVyIiwiZGVwdGhUZXh0dXJlRGVzYyIsInNpemUiLCJkaW1lbnNpb24iLCJzYW1wbGVDb3VudCIsInVzYWdlIiwiR1BVVGV4dHVyZVVzYWdlIiwiUkVOREVSX0FUVEFDSE1FTlQiLCJDT1BZX1NSQyIsImNyZWF0ZVRleHR1cmUiLCJuYW1lIiwiZGVwdGhTdGVuY2lsQXR0YWNobWVudCIsImdldENvbG9yQnVmZmVyIiwiY29sb3JWaWV3IiwibWlwTGV2ZWxDb3VudCIsImN1YmVtYXAiLCJiYXNlQXJyYXlMYXllciIsImZhY2UiLCJhcnJheUxheWVyQ291bnQiLCJfdGhpcyRjb2xvckF0dGFjaG1lbnQyIiwiX3RoaXMkY29sb3JBdHRhY2htZW50MyIsIm11bHRpc2FtcGxlZFRleHR1cmVEZXNjIiwibXVsdGlzYW1wbGVkQ29sb3JCdWZmZXIiLCJzZXR1cEZvclJlbmRlclBhc3MiLCJyZW5kZXJQYXNzIiwiX3RoaXMkcmVuZGVyUGFzc0Rlc2NyIiwiX3RoaXMkcmVuZGVyUGFzc0Rlc2NyMiIsImNvbG9yT3BzIiwiY29sb3JBcnJheU9wcyIsImNsZWFyVmFsdWUiLCJsb2FkT3AiLCJjbGVhciIsInN0b3JlT3AiLCJzdG9yZSIsImRlcHRoQXR0YWNobWVudCIsImRlcHRoQ2xlYXJWYWx1ZSIsImRlcHRoU3RlbmNpbE9wcyIsImNsZWFyRGVwdGhWYWx1ZSIsImRlcHRoTG9hZE9wIiwiY2xlYXJEZXB0aCIsImRlcHRoU3RvcmVPcCIsInN0b3JlRGVwdGgiLCJkZXB0aFJlYWRPbmx5Iiwic3RlbmNpbENsZWFyVmFsdWUiLCJjbGVhclN0ZW5jaWxWYWx1ZSIsInN0ZW5jaWxMb2FkT3AiLCJjbGVhclN0ZW5jaWwiLCJzdGVuY2lsU3RvcmVPcCIsInN0b3JlU3RlbmNpbCIsInN0ZW5jaWxSZWFkT25seSIsImxvc2VDb250ZXh0IiwicmVzb2x2ZSIsInRhcmdldCIsImNvbG9yIl0sIm1hcHBpbmdzIjoiOzs7QUFHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsZUFBZSxDQUFDO0VBQUFDLFdBQUEsR0FBQTtBQUNsQjtBQUNKO0FBQ0E7QUFDQTtBQUhJLElBQUEsSUFBQSxDQUlBQyxNQUFNLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFFTjtBQUNKO0FBQ0E7QUFDQTtBQUhJLElBQUEsSUFBQSxDQUlBQyxrQkFBa0IsR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUFBLEdBQUE7QUFFbEJDLEVBQUFBLE9BQU9BLEdBQUc7QUFBQSxJQUFBLElBQUFDLHFCQUFBLENBQUE7SUFDTixDQUFBQSxxQkFBQSxPQUFJLENBQUNGLGtCQUFrQixxQkFBdkJFLHFCQUFBLENBQXlCRCxPQUFPLEVBQUUsQ0FBQTtJQUNsQyxJQUFJLENBQUNELGtCQUFrQixHQUFHLElBQUksQ0FBQTtBQUNsQyxHQUFBO0FBQ0osQ0FBQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUcsa0JBQWtCLENBQUM7QUFxRHJCO0FBQ0o7QUFDQTtBQUNBO0VBQ0lMLFdBQVdBLENBQUNNLFlBQVksRUFBRTtBQXhEMUI7SUFBQSxJQUNBQyxDQUFBQSxXQUFXLEdBQUcsS0FBSyxDQUFBO0FBRW5CO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFKSSxJQUFBLElBQUEsQ0FLQUMsR0FBRyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBRUg7SUFBQSxJQUNBQyxDQUFBQSxnQkFBZ0IsR0FBRyxFQUFFLENBQUE7QUFFckI7QUFDSjtBQUNBO0FBQ0E7QUFISSxJQUFBLElBQUEsQ0FJQUMsV0FBVyxHQUFBLEtBQUEsQ0FBQSxDQUFB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
