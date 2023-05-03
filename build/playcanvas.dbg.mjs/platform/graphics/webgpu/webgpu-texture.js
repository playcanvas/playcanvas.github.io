import { Debug, DebugHelper } from '../../../core/debug.js';
import { PIXELFORMAT_DEPTHSTENCIL, SAMPLETYPE_DEPTH, SAMPLETYPE_UNFILTERABLE_FLOAT, PIXELFORMAT_RGBA32F, PIXELFORMAT_RGBA16F, pixelFormatByteSizes, PIXELFORMAT_A8, PIXELFORMAT_L8, PIXELFORMAT_LA8, PIXELFORMAT_RGB565, PIXELFORMAT_RGBA5551, PIXELFORMAT_RGBA4, PIXELFORMAT_RGB8, PIXELFORMAT_RGBA8, PIXELFORMAT_DXT1, PIXELFORMAT_DXT3, PIXELFORMAT_DXT5, PIXELFORMAT_RGB16F, PIXELFORMAT_RGB32F, PIXELFORMAT_R32F, PIXELFORMAT_DEPTH, PIXELFORMAT_111110F, PIXELFORMAT_SRGB, PIXELFORMAT_SRGBA, PIXELFORMAT_ETC1, PIXELFORMAT_ETC2_RGB, PIXELFORMAT_ETC2_RGBA, PIXELFORMAT_PVRTC_2BPP_RGB_1, PIXELFORMAT_PVRTC_2BPP_RGBA_1, PIXELFORMAT_PVRTC_4BPP_RGB_1, PIXELFORMAT_PVRTC_4BPP_RGBA_1, PIXELFORMAT_ASTC_4x4, PIXELFORMAT_ATC_RGB, PIXELFORMAT_ATC_RGBA, PIXELFORMAT_BGRA8, ADDRESS_REPEAT, ADDRESS_CLAMP_TO_EDGE, ADDRESS_MIRRORED_REPEAT } from '../constants.js';
import { WebgpuDebug } from './webgpu-debug.js';

// map of PIXELFORMAT_*** to GPUTextureFormat
const gpuTextureFormats = [];
gpuTextureFormats[PIXELFORMAT_A8] = '';
gpuTextureFormats[PIXELFORMAT_L8] = 'r8unorm';
gpuTextureFormats[PIXELFORMAT_LA8] = 'rg8unorm';
gpuTextureFormats[PIXELFORMAT_RGB565] = '';
gpuTextureFormats[PIXELFORMAT_RGBA5551] = '';
gpuTextureFormats[PIXELFORMAT_RGBA4] = '';
gpuTextureFormats[PIXELFORMAT_RGB8] = 'rgba8unorm';
gpuTextureFormats[PIXELFORMAT_RGBA8] = 'rgba8unorm';
gpuTextureFormats[PIXELFORMAT_DXT1] = '';
gpuTextureFormats[PIXELFORMAT_DXT3] = '';
gpuTextureFormats[PIXELFORMAT_DXT5] = '';
gpuTextureFormats[PIXELFORMAT_RGB16F] = '';
gpuTextureFormats[PIXELFORMAT_RGBA16F] = 'rgba16float';
gpuTextureFormats[PIXELFORMAT_RGB32F] = '';
gpuTextureFormats[PIXELFORMAT_RGBA32F] = 'rgba32float';
gpuTextureFormats[PIXELFORMAT_R32F] = 'r32float';
gpuTextureFormats[PIXELFORMAT_DEPTH] = 'depth32float';
gpuTextureFormats[PIXELFORMAT_DEPTHSTENCIL] = 'depth24plus-stencil8';
gpuTextureFormats[PIXELFORMAT_111110F] = 'rg11b10ufloat';
gpuTextureFormats[PIXELFORMAT_SRGB] = '';
gpuTextureFormats[PIXELFORMAT_SRGBA] = '';
gpuTextureFormats[PIXELFORMAT_ETC1] = '';
gpuTextureFormats[PIXELFORMAT_ETC2_RGB] = '';
gpuTextureFormats[PIXELFORMAT_ETC2_RGBA] = '';
gpuTextureFormats[PIXELFORMAT_PVRTC_2BPP_RGB_1] = '';
gpuTextureFormats[PIXELFORMAT_PVRTC_2BPP_RGBA_1] = '';
gpuTextureFormats[PIXELFORMAT_PVRTC_4BPP_RGB_1] = '';
gpuTextureFormats[PIXELFORMAT_PVRTC_4BPP_RGBA_1] = '';
gpuTextureFormats[PIXELFORMAT_ASTC_4x4] = '';
gpuTextureFormats[PIXELFORMAT_ATC_RGB] = '';
gpuTextureFormats[PIXELFORMAT_ATC_RGBA] = '';
gpuTextureFormats[PIXELFORMAT_BGRA8] = 'bgra8unorm';

// map of ADDRESS_*** to GPUAddressMode
const gpuAddressModes = [];
gpuAddressModes[ADDRESS_REPEAT] = 'repeat';
gpuAddressModes[ADDRESS_CLAMP_TO_EDGE] = 'clamp-to-edge';
gpuAddressModes[ADDRESS_MIRRORED_REPEAT] = 'mirror-repeat';

/**
 * A WebGPU implementation of the Texture.
 *
 * @ignore
 */
class WebgpuTexture {
  /**
   * @type {GPUTexture}
   * @private
   */

  /**
   * @type {GPUTextureView}
   * @private
   */

  /**
   * An array of samplers, addressed by SAMPLETYPE_*** constant, allowing texture to be sampled
   * using different samplers. Most textures are sampled as interpolated floats, but some can
   * additionally be sampled using non-interpolated floats (raw data) or compare sampling
   * (shadow maps).
   *
   * @type {GPUSampler[]}
   * @private
   */

  /**
   * @type {GPUTextureDescriptor}
   * @private
   */

  /**
   * @type {GPUTextureFormat}
   * @private
   */

  constructor(texture) {
    this.gpuTexture = void 0;
    this.view = void 0;
    this.samplers = [];
    this.descr = void 0;
    this.format = void 0;
    /** @type {import('../texture.js').Texture} */
    this.texture = texture;
    this.format = gpuTextureFormats[texture.format];
    Debug.assert(this.format !== '', `WebGPU does not support texture format ${texture.format} for texture ${texture.name}`, texture);
    this.create(texture.device);
  }
  create(device) {
    const texture = this.texture;
    const wgpu = device.wgpu;
    const mipLevelCount = texture.requiredMipLevels;
    this.descr = {
      size: {
        width: texture.width,
        height: texture.height,
        depthOrArrayLayers: texture.cubemap ? 6 : 1
      },
      format: this.format,
      mipLevelCount: mipLevelCount,
      sampleCount: 1,
      dimension: texture.volume ? '3d' : '2d',
      // TODO: use only required usage flags
      // COPY_SRC - probably only needed on render target textures, to support copyRenderTarget (grab pass needs it)
      // RENDER_ATTACHMENT - needed for mipmap generation
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
    };
    WebgpuDebug.validate(device);
    this.gpuTexture = wgpu.createTexture(this.descr);
    DebugHelper.setLabel(this.gpuTexture, `${texture.name}${texture.cubemap ? '[cubemap]' : ''}${texture.volume ? '[3d]' : ''}`);
    WebgpuDebug.end(device, {
      descr: this.descr,
      texture
    });

    // default texture view descriptor
    let viewDescr;

    // some format require custom default texture view
    if (this.texture.format === PIXELFORMAT_DEPTHSTENCIL) {
      // we expose the depth part of the format
      viewDescr = {
        format: 'depth24plus',
        aspect: 'depth-only'
      };
    }
    this.view = this.createView(viewDescr);
  }
  destroy(device) {}

  /**
   * @param {any} device - The Graphics Device.
   * @returns {any} - Returns the view.
   */
  getView(device) {
    this.uploadImmediate(device, this.texture);
    Debug.assert(this.view);
    return this.view;
  }
  createView(viewDescr) {
    var _options$format, _options$dimension, _options$aspect, _options$baseMipLevel, _options$mipLevelCoun, _options$baseArrayLay, _options$arrayLayerCo;
    const options = viewDescr != null ? viewDescr : {};
    const textureDescr = this.descr;
    const texture = this.texture;

    // '1d', '2d', '2d-array', 'cube', 'cube-array', '3d'
    const defaultViewDimension = () => {
      if (texture.cubemap) return 'cube';
      if (texture.volume) return '3d';
      return '2d';
    };

    /** @type {GPUTextureViewDescriptor} */
    const descr = {
      format: (_options$format = options.format) != null ? _options$format : textureDescr.format,
      dimension: (_options$dimension = options.dimension) != null ? _options$dimension : defaultViewDimension(),
      aspect: (_options$aspect = options.aspect) != null ? _options$aspect : 'all',
      baseMipLevel: (_options$baseMipLevel = options.baseMipLevel) != null ? _options$baseMipLevel : 0,
      mipLevelCount: (_options$mipLevelCoun = options.mipLevelCount) != null ? _options$mipLevelCoun : textureDescr.mipLevelCount,
      baseArrayLayer: (_options$baseArrayLay = options.baseArrayLayer) != null ? _options$baseArrayLay : 0,
      arrayLayerCount: (_options$arrayLayerCo = options.arrayLayerCount) != null ? _options$arrayLayerCo : textureDescr.depthOrArrayLayers
    };
    const view = this.gpuTexture.createView(descr);
    DebugHelper.setLabel(view, `${viewDescr ? `CustomView${JSON.stringify(viewDescr)}` : 'DefaultView'}:${this.texture.name}`);
    return view;
  }

  // TODO: handle the case where those properties get changed
  // TODO: share a global map of samplers. Possibly even use shared samplers for bind group,
  // or maybe even have some attached in view bind group and use globally

  /**
   * @param {any} device - The Graphics Device.
   * @param {number} [sampleType] - A sample type for the sampler, SAMPLETYPE_*** constant. If not
   * specified, the sampler type is based on the texture format / texture sampling type.
   * @returns {any} - Returns the sampler.
   */
  getSampler(device, sampleType) {
    let sampler = this.samplers[sampleType];
    if (!sampler) {
      const texture = this.texture;
      let label;

      /** @type GPUSamplerDescriptor */
      const descr = {
        addressModeU: gpuAddressModes[texture.addressU],
        addressModeV: gpuAddressModes[texture.addressV],
        addressModeW: gpuAddressModes[texture.addressW]
      };

      // default for compare sampling of texture
      if (!sampleType && texture.compareOnRead) {
        sampleType = SAMPLETYPE_DEPTH;
      }
      if (sampleType === SAMPLETYPE_DEPTH) {
        // depth compare sampling
        descr.compare = 'less';
        descr.magFilter = 'linear';
        descr.minFilter = 'linear';
        label = 'Compare';
      } else if (sampleType === SAMPLETYPE_UNFILTERABLE_FLOAT) {
        // webgpu cannot currently filter float / half float textures
        descr.magFilter = 'nearest';
        descr.minFilter = 'nearest';
        descr.mipmapFilter = 'nearest';
        label = 'Unfilterable';
      } else {
        // TODO: this is temporary and needs to be made generic
        if (this.texture.format === PIXELFORMAT_RGBA32F || this.texture.format === PIXELFORMAT_DEPTHSTENCIL || this.texture.format === PIXELFORMAT_RGBA16F) {
          descr.magFilter = 'nearest';
          descr.minFilter = 'nearest';
          descr.mipmapFilter = 'nearest';
          label = 'Nearest';
        } else {
          descr.magFilter = 'linear';
          descr.minFilter = 'linear';
          descr.mipmapFilter = 'linear';
          label = 'Linear';
        }
      }
      sampler = device.wgpu.createSampler(descr);
      DebugHelper.setLabel(sampler, label);
      this.samplers[sampleType] = sampler;
    }
    return sampler;
  }
  loseContext() {}

  /**
   * @param {import('./webgpu-graphics-device.js').WebgpuGraphicsDevice} device - The graphics
   * device.
   * @param {import('../texture.js').Texture} texture - The texture.
   */
  uploadImmediate(device, texture) {
    if (texture._needsUpload || texture._needsMipmapsUpload) {
      this.uploadData(device);
      texture._needsUpload = false;
      texture._needsMipmapsUpload = false;
    }
  }

  /**
   * @param {import('./webgpu-graphics-device.js').WebgpuGraphicsDevice} device - The graphics
   * device.
   */
  uploadData(device) {
    const texture = this.texture;
    if (texture._levels) {
      const wgpu = device.wgpu;

      // upload texture data if any
      let anyUploads = false;
      const requiredMipLevels = texture.requiredMipLevels;
      for (let mipLevel = 0; mipLevel < requiredMipLevels; mipLevel++) {
        const mipObject = texture._levels[mipLevel];
        if (mipObject) {
          if (texture.cubemap) {
            for (let face = 0; face < 6; face++) {
              const faceSource = mipObject[face];
              if (faceSource) {
                if (this.isExternalImage(faceSource)) {
                  this.uploadExternalImage(device, faceSource, mipLevel, face);
                  anyUploads = true;
                } else {
                  Debug.error('Unsupported texture source data for cubemap face', faceSource);
                }
              }
            }
          } else if (texture._volume) {
            Debug.warn('Volume texture data upload is not supported yet', this.texture);
          } else {
            // 2d texture

            if (this.isExternalImage(mipObject)) {
              this.uploadExternalImage(device, mipObject, mipLevel, 0);
              anyUploads = true;
            } else if (ArrayBuffer.isView(mipObject)) {
              // typed array

              this.uploadTypedArrayData(wgpu, mipObject);
              anyUploads = true;
            } else {
              Debug.error('Unsupported texture source data', mipObject);
            }
          }
        }
      }
      if (anyUploads && texture.mipmaps) {
        device.mipmapRenderer.generate(this);
      }
    }
  }

  // image types supported by copyExternalImageToTexture
  isExternalImage(image) {
    return image instanceof ImageBitmap || image instanceof HTMLVideoElement || image instanceof HTMLCanvasElement || image instanceof OffscreenCanvas;
  }
  uploadExternalImage(device, image, mipLevel, face) {
    Debug.assert(mipLevel < this.descr.mipLevelCount, `Accessing mip level ${mipLevel} of texture with ${this.descr.mipLevelCount} mip levels`, this);
    const src = {
      source: image,
      origin: [0, 0],
      flipY: false
    };
    const dst = {
      texture: this.gpuTexture,
      mipLevel: mipLevel,
      origin: [0, 0, face],
      aspect: 'all' // can be: "all", "stencil-only", "depth-only"
    };

    const copySize = {
      width: this.descr.size.width,
      height: this.descr.size.height,
      depthOrArrayLayers: 1 // single layer
    };

    device.wgpu.queue.copyExternalImageToTexture(src, dst, copySize);
  }
  uploadTypedArrayData(wgpu, data) {
    var _pixelFormatByteSizes;
    const texture = this.texture;

    /** @type {GPUImageCopyTexture} */
    const dest = {
      texture: this.gpuTexture,
      mipLevel: 0
    };

    // TODO: handle update to mipmap levels other than 0
    const pixelSize = (_pixelFormatByteSizes = pixelFormatByteSizes[texture.format]) != null ? _pixelFormatByteSizes : 0;
    Debug.assert(pixelSize);
    const bytesPerRow = texture.width * pixelSize;
    const byteSize = bytesPerRow * texture.height;
    Debug.assert(byteSize === data.byteLength, `Error uploading data to texture, the data byte size of ${data.byteLength} does not match required ${byteSize}`, texture);

    /** @type {GPUImageDataLayout} */
    const dataLayout = {
      offset: 0,
      bytesPerRow: bytesPerRow,
      rowsPerImage: texture.height
    };
    const size = {
      width: texture.width,
      height: texture.height,
      depthOrArrayLayers: 1
    };
    wgpu.queue.writeTexture(dest, data, dataLayout, size);
  }
}

export { WebgpuTexture };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViZ3B1LXRleHR1cmUuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9wbGF0Zm9ybS9ncmFwaGljcy93ZWJncHUvd2ViZ3B1LXRleHR1cmUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcsIERlYnVnSGVscGVyIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbmltcG9ydCB7XG4gICAgcGl4ZWxGb3JtYXRCeXRlU2l6ZXMsXG4gICAgQUREUkVTU19SRVBFQVQsIEFERFJFU1NfQ0xBTVBfVE9fRURHRSwgQUREUkVTU19NSVJST1JFRF9SRVBFQVQsXG4gICAgUElYRUxGT1JNQVRfQTgsIFBJWEVMRk9STUFUX0w4LCBQSVhFTEZPUk1BVF9MQTgsIFBJWEVMRk9STUFUX1JHQjU2NSwgUElYRUxGT1JNQVRfUkdCQTU1NTEsIFBJWEVMRk9STUFUX1JHQkE0LFxuICAgIFBJWEVMRk9STUFUX1JHQjgsIFBJWEVMRk9STUFUX1JHQkE4LCBQSVhFTEZPUk1BVF9EWFQxLCBQSVhFTEZPUk1BVF9EWFQzLCBQSVhFTEZPUk1BVF9EWFQ1LFxuICAgIFBJWEVMRk9STUFUX1JHQjE2RiwgUElYRUxGT1JNQVRfUkdCQTE2RiwgUElYRUxGT1JNQVRfUkdCMzJGLCBQSVhFTEZPUk1BVF9SR0JBMzJGLCBQSVhFTEZPUk1BVF9SMzJGLCBQSVhFTEZPUk1BVF9ERVBUSCxcbiAgICBQSVhFTEZPUk1BVF9ERVBUSFNURU5DSUwsIFBJWEVMRk9STUFUXzExMTExMEYsIFBJWEVMRk9STUFUX1NSR0IsIFBJWEVMRk9STUFUX1NSR0JBLCBQSVhFTEZPUk1BVF9FVEMxLFxuICAgIFBJWEVMRk9STUFUX0VUQzJfUkdCLCBQSVhFTEZPUk1BVF9FVEMyX1JHQkEsIFBJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCXzEsIFBJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCQV8xLFxuICAgIFBJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCXzEsIFBJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCQV8xLCBQSVhFTEZPUk1BVF9BU1RDXzR4NCwgUElYRUxGT1JNQVRfQVRDX1JHQixcbiAgICBQSVhFTEZPUk1BVF9BVENfUkdCQSwgUElYRUxGT1JNQVRfQkdSQTgsIFNBTVBMRVRZUEVfVU5GSUxURVJBQkxFX0ZMT0FULCBTQU1QTEVUWVBFX0RFUFRIXG59IGZyb20gJy4uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBXZWJncHVEZWJ1ZyB9IGZyb20gJy4vd2ViZ3B1LWRlYnVnLmpzJztcblxuLy8gbWFwIG9mIFBJWEVMRk9STUFUXyoqKiB0byBHUFVUZXh0dXJlRm9ybWF0XG5jb25zdCBncHVUZXh0dXJlRm9ybWF0cyA9IFtdO1xuZ3B1VGV4dHVyZUZvcm1hdHNbUElYRUxGT1JNQVRfQThdID0gJyc7XG5ncHVUZXh0dXJlRm9ybWF0c1tQSVhFTEZPUk1BVF9MOF0gPSAncjh1bm9ybSc7XG5ncHVUZXh0dXJlRm9ybWF0c1tQSVhFTEZPUk1BVF9MQThdID0gJ3JnOHVub3JtJztcbmdwdVRleHR1cmVGb3JtYXRzW1BJWEVMRk9STUFUX1JHQjU2NV0gPSAnJztcbmdwdVRleHR1cmVGb3JtYXRzW1BJWEVMRk9STUFUX1JHQkE1NTUxXSA9ICcnO1xuZ3B1VGV4dHVyZUZvcm1hdHNbUElYRUxGT1JNQVRfUkdCQTRdID0gJyc7XG5ncHVUZXh0dXJlRm9ybWF0c1tQSVhFTEZPUk1BVF9SR0I4XSA9ICdyZ2JhOHVub3JtJztcbmdwdVRleHR1cmVGb3JtYXRzW1BJWEVMRk9STUFUX1JHQkE4XSA9ICdyZ2JhOHVub3JtJztcbmdwdVRleHR1cmVGb3JtYXRzW1BJWEVMRk9STUFUX0RYVDFdID0gJyc7XG5ncHVUZXh0dXJlRm9ybWF0c1tQSVhFTEZPUk1BVF9EWFQzXSA9ICcnO1xuZ3B1VGV4dHVyZUZvcm1hdHNbUElYRUxGT1JNQVRfRFhUNV0gPSAnJztcbmdwdVRleHR1cmVGb3JtYXRzW1BJWEVMRk9STUFUX1JHQjE2Rl0gPSAnJztcbmdwdVRleHR1cmVGb3JtYXRzW1BJWEVMRk9STUFUX1JHQkExNkZdID0gJ3JnYmExNmZsb2F0JztcbmdwdVRleHR1cmVGb3JtYXRzW1BJWEVMRk9STUFUX1JHQjMyRl0gPSAnJztcbmdwdVRleHR1cmVGb3JtYXRzW1BJWEVMRk9STUFUX1JHQkEzMkZdID0gJ3JnYmEzMmZsb2F0JztcbmdwdVRleHR1cmVGb3JtYXRzW1BJWEVMRk9STUFUX1IzMkZdID0gJ3IzMmZsb2F0JztcbmdwdVRleHR1cmVGb3JtYXRzW1BJWEVMRk9STUFUX0RFUFRIXSA9ICdkZXB0aDMyZmxvYXQnO1xuZ3B1VGV4dHVyZUZvcm1hdHNbUElYRUxGT1JNQVRfREVQVEhTVEVOQ0lMXSA9ICdkZXB0aDI0cGx1cy1zdGVuY2lsOCc7XG5ncHVUZXh0dXJlRm9ybWF0c1tQSVhFTEZPUk1BVF8xMTExMTBGXSA9ICdyZzExYjEwdWZsb2F0JztcbmdwdVRleHR1cmVGb3JtYXRzW1BJWEVMRk9STUFUX1NSR0JdID0gJyc7XG5ncHVUZXh0dXJlRm9ybWF0c1tQSVhFTEZPUk1BVF9TUkdCQV0gPSAnJztcbmdwdVRleHR1cmVGb3JtYXRzW1BJWEVMRk9STUFUX0VUQzFdID0gJyc7XG5ncHVUZXh0dXJlRm9ybWF0c1tQSVhFTEZPUk1BVF9FVEMyX1JHQl0gPSAnJztcbmdwdVRleHR1cmVGb3JtYXRzW1BJWEVMRk9STUFUX0VUQzJfUkdCQV0gPSAnJztcbmdwdVRleHR1cmVGb3JtYXRzW1BJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCXzFdID0gJyc7XG5ncHVUZXh0dXJlRm9ybWF0c1tQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQkFfMV0gPSAnJztcbmdwdVRleHR1cmVGb3JtYXRzW1BJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCXzFdID0gJyc7XG5ncHVUZXh0dXJlRm9ybWF0c1tQSVhFTEZPUk1BVF9QVlJUQ180QlBQX1JHQkFfMV0gPSAnJztcbmdwdVRleHR1cmVGb3JtYXRzW1BJWEVMRk9STUFUX0FTVENfNHg0XSA9ICcnO1xuZ3B1VGV4dHVyZUZvcm1hdHNbUElYRUxGT1JNQVRfQVRDX1JHQl0gPSAnJztcbmdwdVRleHR1cmVGb3JtYXRzW1BJWEVMRk9STUFUX0FUQ19SR0JBXSA9ICcnO1xuZ3B1VGV4dHVyZUZvcm1hdHNbUElYRUxGT1JNQVRfQkdSQThdID0gJ2JncmE4dW5vcm0nO1xuXG4vLyBtYXAgb2YgQUREUkVTU18qKiogdG8gR1BVQWRkcmVzc01vZGVcbmNvbnN0IGdwdUFkZHJlc3NNb2RlcyA9IFtdO1xuZ3B1QWRkcmVzc01vZGVzW0FERFJFU1NfUkVQRUFUXSA9ICdyZXBlYXQnO1xuZ3B1QWRkcmVzc01vZGVzW0FERFJFU1NfQ0xBTVBfVE9fRURHRV0gPSAnY2xhbXAtdG8tZWRnZSc7XG5ncHVBZGRyZXNzTW9kZXNbQUREUkVTU19NSVJST1JFRF9SRVBFQVRdID0gJ21pcnJvci1yZXBlYXQnO1xuXG4vKipcbiAqIEEgV2ViR1BVIGltcGxlbWVudGF0aW9uIG9mIHRoZSBUZXh0dXJlLlxuICpcbiAqIEBpZ25vcmVcbiAqL1xuY2xhc3MgV2ViZ3B1VGV4dHVyZSB7XG4gICAgLyoqXG4gICAgICogQHR5cGUge0dQVVRleHR1cmV9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBncHVUZXh0dXJlO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0dQVVRleHR1cmVWaWV3fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgdmlldztcblxuICAgIC8qKlxuICAgICAqIEFuIGFycmF5IG9mIHNhbXBsZXJzLCBhZGRyZXNzZWQgYnkgU0FNUExFVFlQRV8qKiogY29uc3RhbnQsIGFsbG93aW5nIHRleHR1cmUgdG8gYmUgc2FtcGxlZFxuICAgICAqIHVzaW5nIGRpZmZlcmVudCBzYW1wbGVycy4gTW9zdCB0ZXh0dXJlcyBhcmUgc2FtcGxlZCBhcyBpbnRlcnBvbGF0ZWQgZmxvYXRzLCBidXQgc29tZSBjYW5cbiAgICAgKiBhZGRpdGlvbmFsbHkgYmUgc2FtcGxlZCB1c2luZyBub24taW50ZXJwb2xhdGVkIGZsb2F0cyAocmF3IGRhdGEpIG9yIGNvbXBhcmUgc2FtcGxpbmdcbiAgICAgKiAoc2hhZG93IG1hcHMpLlxuICAgICAqXG4gICAgICogQHR5cGUge0dQVVNhbXBsZXJbXX1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHNhbXBsZXJzID0gW107XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7R1BVVGV4dHVyZURlc2NyaXB0b3J9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBkZXNjcjtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtHUFVUZXh0dXJlRm9ybWF0fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgZm9ybWF0O1xuXG4gICAgY29uc3RydWN0b3IodGV4dHVyZSkge1xuICAgICAgICAvKiogQHR5cGUge2ltcG9ydCgnLi4vdGV4dHVyZS5qcycpLlRleHR1cmV9ICovXG4gICAgICAgIHRoaXMudGV4dHVyZSA9IHRleHR1cmU7XG5cbiAgICAgICAgdGhpcy5mb3JtYXQgPSBncHVUZXh0dXJlRm9ybWF0c1t0ZXh0dXJlLmZvcm1hdF07XG4gICAgICAgIERlYnVnLmFzc2VydCh0aGlzLmZvcm1hdCAhPT0gJycsIGBXZWJHUFUgZG9lcyBub3Qgc3VwcG9ydCB0ZXh0dXJlIGZvcm1hdCAke3RleHR1cmUuZm9ybWF0fSBmb3IgdGV4dHVyZSAke3RleHR1cmUubmFtZX1gLCB0ZXh0dXJlKTtcblxuICAgICAgICB0aGlzLmNyZWF0ZSh0ZXh0dXJlLmRldmljZSk7XG4gICAgfVxuXG4gICAgY3JlYXRlKGRldmljZSkge1xuXG4gICAgICAgIGNvbnN0IHRleHR1cmUgPSB0aGlzLnRleHR1cmU7XG4gICAgICAgIGNvbnN0IHdncHUgPSBkZXZpY2Uud2dwdTtcbiAgICAgICAgY29uc3QgbWlwTGV2ZWxDb3VudCA9IHRleHR1cmUucmVxdWlyZWRNaXBMZXZlbHM7XG5cbiAgICAgICAgdGhpcy5kZXNjciA9IHtcbiAgICAgICAgICAgIHNpemU6IHtcbiAgICAgICAgICAgICAgICB3aWR0aDogdGV4dHVyZS53aWR0aCxcbiAgICAgICAgICAgICAgICBoZWlnaHQ6IHRleHR1cmUuaGVpZ2h0LFxuICAgICAgICAgICAgICAgIGRlcHRoT3JBcnJheUxheWVyczogdGV4dHVyZS5jdWJlbWFwID8gNiA6IDFcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBmb3JtYXQ6IHRoaXMuZm9ybWF0LFxuICAgICAgICAgICAgbWlwTGV2ZWxDb3VudDogbWlwTGV2ZWxDb3VudCxcbiAgICAgICAgICAgIHNhbXBsZUNvdW50OiAxLFxuICAgICAgICAgICAgZGltZW5zaW9uOiB0ZXh0dXJlLnZvbHVtZSA/ICczZCcgOiAnMmQnLFxuXG4gICAgICAgICAgICAvLyBUT0RPOiB1c2Ugb25seSByZXF1aXJlZCB1c2FnZSBmbGFnc1xuICAgICAgICAgICAgLy8gQ09QWV9TUkMgLSBwcm9iYWJseSBvbmx5IG5lZWRlZCBvbiByZW5kZXIgdGFyZ2V0IHRleHR1cmVzLCB0byBzdXBwb3J0IGNvcHlSZW5kZXJUYXJnZXQgKGdyYWIgcGFzcyBuZWVkcyBpdClcbiAgICAgICAgICAgIC8vIFJFTkRFUl9BVFRBQ0hNRU5UIC0gbmVlZGVkIGZvciBtaXBtYXAgZ2VuZXJhdGlvblxuICAgICAgICAgICAgdXNhZ2U6IEdQVVRleHR1cmVVc2FnZS5URVhUVVJFX0JJTkRJTkcgfCBHUFVUZXh0dXJlVXNhZ2UuQ09QWV9EU1QgfCBHUFVUZXh0dXJlVXNhZ2UuUkVOREVSX0FUVEFDSE1FTlQgfCBHUFVUZXh0dXJlVXNhZ2UuQ09QWV9TUkNcbiAgICAgICAgfTtcblxuICAgICAgICBXZWJncHVEZWJ1Zy52YWxpZGF0ZShkZXZpY2UpO1xuXG4gICAgICAgIHRoaXMuZ3B1VGV4dHVyZSA9IHdncHUuY3JlYXRlVGV4dHVyZSh0aGlzLmRlc2NyKTtcbiAgICAgICAgRGVidWdIZWxwZXIuc2V0TGFiZWwodGhpcy5ncHVUZXh0dXJlLCBgJHt0ZXh0dXJlLm5hbWV9JHt0ZXh0dXJlLmN1YmVtYXAgPyAnW2N1YmVtYXBdJyA6ICcnfSR7dGV4dHVyZS52b2x1bWUgPyAnWzNkXScgOiAnJ31gKTtcblxuICAgICAgICBXZWJncHVEZWJ1Zy5lbmQoZGV2aWNlLCB7XG4gICAgICAgICAgICBkZXNjcjogdGhpcy5kZXNjcixcbiAgICAgICAgICAgIHRleHR1cmVcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gZGVmYXVsdCB0ZXh0dXJlIHZpZXcgZGVzY3JpcHRvclxuICAgICAgICBsZXQgdmlld0Rlc2NyO1xuXG4gICAgICAgIC8vIHNvbWUgZm9ybWF0IHJlcXVpcmUgY3VzdG9tIGRlZmF1bHQgdGV4dHVyZSB2aWV3XG4gICAgICAgIGlmICh0aGlzLnRleHR1cmUuZm9ybWF0ID09PSBQSVhFTEZPUk1BVF9ERVBUSFNURU5DSUwpIHtcbiAgICAgICAgICAgIC8vIHdlIGV4cG9zZSB0aGUgZGVwdGggcGFydCBvZiB0aGUgZm9ybWF0XG4gICAgICAgICAgICB2aWV3RGVzY3IgPSB7XG4gICAgICAgICAgICAgICAgZm9ybWF0OiAnZGVwdGgyNHBsdXMnLFxuICAgICAgICAgICAgICAgIGFzcGVjdDogJ2RlcHRoLW9ubHknXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy52aWV3ID0gdGhpcy5jcmVhdGVWaWV3KHZpZXdEZXNjcik7XG4gICAgfVxuXG4gICAgZGVzdHJveShkZXZpY2UpIHtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge2FueX0gZGV2aWNlIC0gVGhlIEdyYXBoaWNzIERldmljZS5cbiAgICAgKiBAcmV0dXJucyB7YW55fSAtIFJldHVybnMgdGhlIHZpZXcuXG4gICAgICovXG4gICAgZ2V0VmlldyhkZXZpY2UpIHtcblxuICAgICAgICB0aGlzLnVwbG9hZEltbWVkaWF0ZShkZXZpY2UsIHRoaXMudGV4dHVyZSk7XG5cbiAgICAgICAgRGVidWcuYXNzZXJ0KHRoaXMudmlldyk7XG4gICAgICAgIHJldHVybiB0aGlzLnZpZXc7XG4gICAgfVxuXG4gICAgY3JlYXRlVmlldyh2aWV3RGVzY3IpIHtcblxuICAgICAgICBjb25zdCBvcHRpb25zID0gdmlld0Rlc2NyID8/IHt9O1xuICAgICAgICBjb25zdCB0ZXh0dXJlRGVzY3IgPSB0aGlzLmRlc2NyO1xuICAgICAgICBjb25zdCB0ZXh0dXJlID0gdGhpcy50ZXh0dXJlO1xuXG4gICAgICAgIC8vICcxZCcsICcyZCcsICcyZC1hcnJheScsICdjdWJlJywgJ2N1YmUtYXJyYXknLCAnM2QnXG4gICAgICAgIGNvbnN0IGRlZmF1bHRWaWV3RGltZW5zaW9uID0gKCkgPT4ge1xuICAgICAgICAgICAgaWYgKHRleHR1cmUuY3ViZW1hcCkgcmV0dXJuICdjdWJlJztcbiAgICAgICAgICAgIGlmICh0ZXh0dXJlLnZvbHVtZSkgcmV0dXJuICczZCc7XG4gICAgICAgICAgICByZXR1cm4gJzJkJztcbiAgICAgICAgfTtcblxuICAgICAgICAvKiogQHR5cGUge0dQVVRleHR1cmVWaWV3RGVzY3JpcHRvcn0gKi9cbiAgICAgICAgY29uc3QgZGVzY3IgPSB7XG4gICAgICAgICAgICBmb3JtYXQ6IG9wdGlvbnMuZm9ybWF0ID8/IHRleHR1cmVEZXNjci5mb3JtYXQsXG4gICAgICAgICAgICBkaW1lbnNpb246IG9wdGlvbnMuZGltZW5zaW9uID8/IGRlZmF1bHRWaWV3RGltZW5zaW9uKCksXG4gICAgICAgICAgICBhc3BlY3Q6IG9wdGlvbnMuYXNwZWN0ID8/ICdhbGwnLFxuICAgICAgICAgICAgYmFzZU1pcExldmVsOiBvcHRpb25zLmJhc2VNaXBMZXZlbCA/PyAwLFxuICAgICAgICAgICAgbWlwTGV2ZWxDb3VudDogb3B0aW9ucy5taXBMZXZlbENvdW50ID8/IHRleHR1cmVEZXNjci5taXBMZXZlbENvdW50LFxuICAgICAgICAgICAgYmFzZUFycmF5TGF5ZXI6IG9wdGlvbnMuYmFzZUFycmF5TGF5ZXIgPz8gMCxcbiAgICAgICAgICAgIGFycmF5TGF5ZXJDb3VudDogb3B0aW9ucy5hcnJheUxheWVyQ291bnQgPz8gdGV4dHVyZURlc2NyLmRlcHRoT3JBcnJheUxheWVyc1xuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IHZpZXcgPSB0aGlzLmdwdVRleHR1cmUuY3JlYXRlVmlldyhkZXNjcik7XG4gICAgICAgIERlYnVnSGVscGVyLnNldExhYmVsKHZpZXcsIGAke3ZpZXdEZXNjciA/IGBDdXN0b21WaWV3JHtKU09OLnN0cmluZ2lmeSh2aWV3RGVzY3IpfWAgOiAnRGVmYXVsdFZpZXcnfToke3RoaXMudGV4dHVyZS5uYW1lfWApO1xuXG4gICAgICAgIHJldHVybiB2aWV3O1xuICAgIH1cblxuICAgIC8vIFRPRE86IGhhbmRsZSB0aGUgY2FzZSB3aGVyZSB0aG9zZSBwcm9wZXJ0aWVzIGdldCBjaGFuZ2VkXG4gICAgLy8gVE9ETzogc2hhcmUgYSBnbG9iYWwgbWFwIG9mIHNhbXBsZXJzLiBQb3NzaWJseSBldmVuIHVzZSBzaGFyZWQgc2FtcGxlcnMgZm9yIGJpbmQgZ3JvdXAsXG4gICAgLy8gb3IgbWF5YmUgZXZlbiBoYXZlIHNvbWUgYXR0YWNoZWQgaW4gdmlldyBiaW5kIGdyb3VwIGFuZCB1c2UgZ2xvYmFsbHlcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7YW55fSBkZXZpY2UgLSBUaGUgR3JhcGhpY3MgRGV2aWNlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbc2FtcGxlVHlwZV0gLSBBIHNhbXBsZSB0eXBlIGZvciB0aGUgc2FtcGxlciwgU0FNUExFVFlQRV8qKiogY29uc3RhbnQuIElmIG5vdFxuICAgICAqIHNwZWNpZmllZCwgdGhlIHNhbXBsZXIgdHlwZSBpcyBiYXNlZCBvbiB0aGUgdGV4dHVyZSBmb3JtYXQgLyB0ZXh0dXJlIHNhbXBsaW5nIHR5cGUuXG4gICAgICogQHJldHVybnMge2FueX0gLSBSZXR1cm5zIHRoZSBzYW1wbGVyLlxuICAgICAqL1xuICAgIGdldFNhbXBsZXIoZGV2aWNlLCBzYW1wbGVUeXBlKSB7XG4gICAgICAgIGxldCBzYW1wbGVyID0gdGhpcy5zYW1wbGVyc1tzYW1wbGVUeXBlXTtcbiAgICAgICAgaWYgKCFzYW1wbGVyKSB7XG5cbiAgICAgICAgICAgIGNvbnN0IHRleHR1cmUgPSB0aGlzLnRleHR1cmU7XG4gICAgICAgICAgICBsZXQgbGFiZWw7XG5cbiAgICAgICAgICAgIC8qKiBAdHlwZSBHUFVTYW1wbGVyRGVzY3JpcHRvciAqL1xuICAgICAgICAgICAgY29uc3QgZGVzY3IgPSB7XG4gICAgICAgICAgICAgICAgYWRkcmVzc01vZGVVOiBncHVBZGRyZXNzTW9kZXNbdGV4dHVyZS5hZGRyZXNzVV0sXG4gICAgICAgICAgICAgICAgYWRkcmVzc01vZGVWOiBncHVBZGRyZXNzTW9kZXNbdGV4dHVyZS5hZGRyZXNzVl0sXG4gICAgICAgICAgICAgICAgYWRkcmVzc01vZGVXOiBncHVBZGRyZXNzTW9kZXNbdGV4dHVyZS5hZGRyZXNzV11cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIC8vIGRlZmF1bHQgZm9yIGNvbXBhcmUgc2FtcGxpbmcgb2YgdGV4dHVyZVxuICAgICAgICAgICAgaWYgKCFzYW1wbGVUeXBlICYmIHRleHR1cmUuY29tcGFyZU9uUmVhZCkge1xuICAgICAgICAgICAgICAgIHNhbXBsZVR5cGUgPSBTQU1QTEVUWVBFX0RFUFRIO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoc2FtcGxlVHlwZSA9PT0gU0FNUExFVFlQRV9ERVBUSCkge1xuXG4gICAgICAgICAgICAgICAgLy8gZGVwdGggY29tcGFyZSBzYW1wbGluZ1xuICAgICAgICAgICAgICAgIGRlc2NyLmNvbXBhcmUgPSAnbGVzcyc7XG4gICAgICAgICAgICAgICAgZGVzY3IubWFnRmlsdGVyID0gJ2xpbmVhcic7XG4gICAgICAgICAgICAgICAgZGVzY3IubWluRmlsdGVyID0gJ2xpbmVhcic7XG4gICAgICAgICAgICAgICAgbGFiZWwgPSAnQ29tcGFyZSc7XG5cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoc2FtcGxlVHlwZSA9PT0gU0FNUExFVFlQRV9VTkZJTFRFUkFCTEVfRkxPQVQpIHtcblxuICAgICAgICAgICAgICAgIC8vIHdlYmdwdSBjYW5ub3QgY3VycmVudGx5IGZpbHRlciBmbG9hdCAvIGhhbGYgZmxvYXQgdGV4dHVyZXNcbiAgICAgICAgICAgICAgICBkZXNjci5tYWdGaWx0ZXIgPSAnbmVhcmVzdCc7XG4gICAgICAgICAgICAgICAgZGVzY3IubWluRmlsdGVyID0gJ25lYXJlc3QnO1xuICAgICAgICAgICAgICAgIGRlc2NyLm1pcG1hcEZpbHRlciA9ICduZWFyZXN0JztcbiAgICAgICAgICAgICAgICBsYWJlbCA9ICdVbmZpbHRlcmFibGUnO1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgLy8gVE9ETzogdGhpcyBpcyB0ZW1wb3JhcnkgYW5kIG5lZWRzIHRvIGJlIG1hZGUgZ2VuZXJpY1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLnRleHR1cmUuZm9ybWF0ID09PSBQSVhFTEZPUk1BVF9SR0JBMzJGIHx8XG4gICAgICAgICAgICAgICAgICAgIHRoaXMudGV4dHVyZS5mb3JtYXQgPT09IFBJWEVMRk9STUFUX0RFUFRIU1RFTkNJTCB8fFxuICAgICAgICAgICAgICAgICAgICB0aGlzLnRleHR1cmUuZm9ybWF0ID09PSBQSVhFTEZPUk1BVF9SR0JBMTZGKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlc2NyLm1hZ0ZpbHRlciA9ICduZWFyZXN0JztcbiAgICAgICAgICAgICAgICAgICAgZGVzY3IubWluRmlsdGVyID0gJ25lYXJlc3QnO1xuICAgICAgICAgICAgICAgICAgICBkZXNjci5taXBtYXBGaWx0ZXIgPSAnbmVhcmVzdCc7XG4gICAgICAgICAgICAgICAgICAgIGxhYmVsID0gJ05lYXJlc3QnO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGRlc2NyLm1hZ0ZpbHRlciA9ICdsaW5lYXInO1xuICAgICAgICAgICAgICAgICAgICBkZXNjci5taW5GaWx0ZXIgPSAnbGluZWFyJztcbiAgICAgICAgICAgICAgICAgICAgZGVzY3IubWlwbWFwRmlsdGVyID0gJ2xpbmVhcic7XG4gICAgICAgICAgICAgICAgICAgIGxhYmVsID0gJ0xpbmVhcic7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBzYW1wbGVyID0gZGV2aWNlLndncHUuY3JlYXRlU2FtcGxlcihkZXNjcik7XG4gICAgICAgICAgICBEZWJ1Z0hlbHBlci5zZXRMYWJlbChzYW1wbGVyLCBsYWJlbCk7XG4gICAgICAgICAgICB0aGlzLnNhbXBsZXJzW3NhbXBsZVR5cGVdID0gc2FtcGxlcjtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBzYW1wbGVyO1xuICAgIH1cblxuICAgIGxvc2VDb250ZXh0KCkge1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3dlYmdwdS1ncmFwaGljcy1kZXZpY2UuanMnKS5XZWJncHVHcmFwaGljc0RldmljZX0gZGV2aWNlIC0gVGhlIGdyYXBoaWNzXG4gICAgICogZGV2aWNlLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi90ZXh0dXJlLmpzJykuVGV4dHVyZX0gdGV4dHVyZSAtIFRoZSB0ZXh0dXJlLlxuICAgICAqL1xuICAgIHVwbG9hZEltbWVkaWF0ZShkZXZpY2UsIHRleHR1cmUpIHtcblxuICAgICAgICBpZiAodGV4dHVyZS5fbmVlZHNVcGxvYWQgfHwgdGV4dHVyZS5fbmVlZHNNaXBtYXBzVXBsb2FkKSB7XG4gICAgICAgICAgICB0aGlzLnVwbG9hZERhdGEoZGV2aWNlKTtcblxuICAgICAgICAgICAgdGV4dHVyZS5fbmVlZHNVcGxvYWQgPSBmYWxzZTtcbiAgICAgICAgICAgIHRleHR1cmUuX25lZWRzTWlwbWFwc1VwbG9hZCA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vd2ViZ3B1LWdyYXBoaWNzLWRldmljZS5qcycpLldlYmdwdUdyYXBoaWNzRGV2aWNlfSBkZXZpY2UgLSBUaGUgZ3JhcGhpY3NcbiAgICAgKiBkZXZpY2UuXG4gICAgICovXG4gICAgdXBsb2FkRGF0YShkZXZpY2UpIHtcblxuICAgICAgICBjb25zdCB0ZXh0dXJlID0gdGhpcy50ZXh0dXJlO1xuICAgICAgICBpZiAodGV4dHVyZS5fbGV2ZWxzKSB7XG4gICAgICAgICAgICBjb25zdCB3Z3B1ID0gZGV2aWNlLndncHU7XG5cbiAgICAgICAgICAgIC8vIHVwbG9hZCB0ZXh0dXJlIGRhdGEgaWYgYW55XG4gICAgICAgICAgICBsZXQgYW55VXBsb2FkcyA9IGZhbHNlO1xuICAgICAgICAgICAgY29uc3QgcmVxdWlyZWRNaXBMZXZlbHMgPSB0ZXh0dXJlLnJlcXVpcmVkTWlwTGV2ZWxzO1xuICAgICAgICAgICAgZm9yIChsZXQgbWlwTGV2ZWwgPSAwOyBtaXBMZXZlbCA8IHJlcXVpcmVkTWlwTGV2ZWxzOyBtaXBMZXZlbCsrKSB7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBtaXBPYmplY3QgPSB0ZXh0dXJlLl9sZXZlbHNbbWlwTGV2ZWxdO1xuICAgICAgICAgICAgICAgIGlmIChtaXBPYmplY3QpIHtcblxuICAgICAgICAgICAgICAgICAgICBpZiAodGV4dHVyZS5jdWJlbWFwKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGZhY2UgPSAwOyBmYWNlIDwgNjsgZmFjZSsrKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBmYWNlU291cmNlID0gbWlwT2JqZWN0W2ZhY2VdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChmYWNlU291cmNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLmlzRXh0ZXJuYWxJbWFnZShmYWNlU291cmNlKSkge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnVwbG9hZEV4dGVybmFsSW1hZ2UoZGV2aWNlLCBmYWNlU291cmNlLCBtaXBMZXZlbCwgZmFjZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhbnlVcGxvYWRzID0gdHJ1ZTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcignVW5zdXBwb3J0ZWQgdGV4dHVyZSBzb3VyY2UgZGF0YSBmb3IgY3ViZW1hcCBmYWNlJywgZmFjZVNvdXJjZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICh0ZXh0dXJlLl92b2x1bWUpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgRGVidWcud2FybignVm9sdW1lIHRleHR1cmUgZGF0YSB1cGxvYWQgaXMgbm90IHN1cHBvcnRlZCB5ZXQnLCB0aGlzLnRleHR1cmUpO1xuXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7IC8vIDJkIHRleHR1cmVcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuaXNFeHRlcm5hbEltYWdlKG1pcE9iamVjdCkpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudXBsb2FkRXh0ZXJuYWxJbWFnZShkZXZpY2UsIG1pcE9iamVjdCwgbWlwTGV2ZWwsIDApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFueVVwbG9hZHMgPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKEFycmF5QnVmZmVyLmlzVmlldyhtaXBPYmplY3QpKSB7IC8vIHR5cGVkIGFycmF5XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnVwbG9hZFR5cGVkQXJyYXlEYXRhKHdncHUsIG1pcE9iamVjdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYW55VXBsb2FkcyA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcignVW5zdXBwb3J0ZWQgdGV4dHVyZSBzb3VyY2UgZGF0YScsIG1pcE9iamVjdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChhbnlVcGxvYWRzICYmIHRleHR1cmUubWlwbWFwcykge1xuICAgICAgICAgICAgICAgIGRldmljZS5taXBtYXBSZW5kZXJlci5nZW5lcmF0ZSh0aGlzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGltYWdlIHR5cGVzIHN1cHBvcnRlZCBieSBjb3B5RXh0ZXJuYWxJbWFnZVRvVGV4dHVyZVxuICAgIGlzRXh0ZXJuYWxJbWFnZShpbWFnZSkge1xuICAgICAgICByZXR1cm4gKGltYWdlIGluc3RhbmNlb2YgSW1hZ2VCaXRtYXApIHx8XG4gICAgICAgICAgICAoaW1hZ2UgaW5zdGFuY2VvZiBIVE1MVmlkZW9FbGVtZW50KSB8fFxuICAgICAgICAgICAgKGltYWdlIGluc3RhbmNlb2YgSFRNTENhbnZhc0VsZW1lbnQpIHx8XG4gICAgICAgICAgICAoaW1hZ2UgaW5zdGFuY2VvZiBPZmZzY3JlZW5DYW52YXMpO1xuICAgIH1cblxuICAgIHVwbG9hZEV4dGVybmFsSW1hZ2UoZGV2aWNlLCBpbWFnZSwgbWlwTGV2ZWwsIGZhY2UpIHtcblxuICAgICAgICBEZWJ1Zy5hc3NlcnQobWlwTGV2ZWwgPCB0aGlzLmRlc2NyLm1pcExldmVsQ291bnQsIGBBY2Nlc3NpbmcgbWlwIGxldmVsICR7bWlwTGV2ZWx9IG9mIHRleHR1cmUgd2l0aCAke3RoaXMuZGVzY3IubWlwTGV2ZWxDb3VudH0gbWlwIGxldmVsc2AsIHRoaXMpO1xuXG4gICAgICAgIGNvbnN0IHNyYyA9IHtcbiAgICAgICAgICAgIHNvdXJjZTogaW1hZ2UsXG4gICAgICAgICAgICBvcmlnaW46IFswLCAwXSxcbiAgICAgICAgICAgIGZsaXBZOiBmYWxzZVxuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IGRzdCA9IHtcbiAgICAgICAgICAgIHRleHR1cmU6IHRoaXMuZ3B1VGV4dHVyZSxcbiAgICAgICAgICAgIG1pcExldmVsOiBtaXBMZXZlbCxcbiAgICAgICAgICAgIG9yaWdpbjogWzAsIDAsIGZhY2VdLFxuICAgICAgICAgICAgYXNwZWN0OiAnYWxsJyAgLy8gY2FuIGJlOiBcImFsbFwiLCBcInN0ZW5jaWwtb25seVwiLCBcImRlcHRoLW9ubHlcIlxuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IGNvcHlTaXplID0ge1xuICAgICAgICAgICAgd2lkdGg6IHRoaXMuZGVzY3Iuc2l6ZS53aWR0aCxcbiAgICAgICAgICAgIGhlaWdodDogdGhpcy5kZXNjci5zaXplLmhlaWdodCxcbiAgICAgICAgICAgIGRlcHRoT3JBcnJheUxheWVyczogMSAgIC8vIHNpbmdsZSBsYXllclxuICAgICAgICB9O1xuXG4gICAgICAgIGRldmljZS53Z3B1LnF1ZXVlLmNvcHlFeHRlcm5hbEltYWdlVG9UZXh0dXJlKHNyYywgZHN0LCBjb3B5U2l6ZSk7XG4gICAgfVxuXG4gICAgdXBsb2FkVHlwZWRBcnJheURhdGEod2dwdSwgZGF0YSkge1xuXG4gICAgICAgIGNvbnN0IHRleHR1cmUgPSB0aGlzLnRleHR1cmU7XG5cbiAgICAgICAgLyoqIEB0eXBlIHtHUFVJbWFnZUNvcHlUZXh0dXJlfSAqL1xuICAgICAgICBjb25zdCBkZXN0ID0ge1xuICAgICAgICAgICAgdGV4dHVyZTogdGhpcy5ncHVUZXh0dXJlLFxuICAgICAgICAgICAgbWlwTGV2ZWw6IDBcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBUT0RPOiBoYW5kbGUgdXBkYXRlIHRvIG1pcG1hcCBsZXZlbHMgb3RoZXIgdGhhbiAwXG4gICAgICAgIGNvbnN0IHBpeGVsU2l6ZSA9IHBpeGVsRm9ybWF0Qnl0ZVNpemVzW3RleHR1cmUuZm9ybWF0XSA/PyAwO1xuICAgICAgICBEZWJ1Zy5hc3NlcnQocGl4ZWxTaXplKTtcbiAgICAgICAgY29uc3QgYnl0ZXNQZXJSb3cgPSB0ZXh0dXJlLndpZHRoICogcGl4ZWxTaXplO1xuICAgICAgICBjb25zdCBieXRlU2l6ZSA9IGJ5dGVzUGVyUm93ICogdGV4dHVyZS5oZWlnaHQ7XG5cbiAgICAgICAgRGVidWcuYXNzZXJ0KGJ5dGVTaXplID09PSBkYXRhLmJ5dGVMZW5ndGgsXG4gICAgICAgICAgICAgICAgICAgICBgRXJyb3IgdXBsb2FkaW5nIGRhdGEgdG8gdGV4dHVyZSwgdGhlIGRhdGEgYnl0ZSBzaXplIG9mICR7ZGF0YS5ieXRlTGVuZ3RofSBkb2VzIG5vdCBtYXRjaCByZXF1aXJlZCAke2J5dGVTaXplfWAsIHRleHR1cmUpO1xuXG4gICAgICAgIC8qKiBAdHlwZSB7R1BVSW1hZ2VEYXRhTGF5b3V0fSAqL1xuICAgICAgICBjb25zdCBkYXRhTGF5b3V0ID0ge1xuICAgICAgICAgICAgb2Zmc2V0OiAwLFxuICAgICAgICAgICAgYnl0ZXNQZXJSb3c6IGJ5dGVzUGVyUm93LFxuICAgICAgICAgICAgcm93c1BlckltYWdlOiB0ZXh0dXJlLmhlaWdodFxuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IHNpemUgPSB7XG4gICAgICAgICAgICB3aWR0aDogdGV4dHVyZS53aWR0aCxcbiAgICAgICAgICAgIGhlaWdodDogdGV4dHVyZS5oZWlnaHQsXG4gICAgICAgICAgICBkZXB0aE9yQXJyYXlMYXllcnM6IDFcbiAgICAgICAgfTtcblxuICAgICAgICB3Z3B1LnF1ZXVlLndyaXRlVGV4dHVyZShkZXN0LCBkYXRhLCBkYXRhTGF5b3V0LCBzaXplKTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFdlYmdwdVRleHR1cmUgfTtcbiJdLCJuYW1lcyI6WyJncHVUZXh0dXJlRm9ybWF0cyIsIlBJWEVMRk9STUFUX0E4IiwiUElYRUxGT1JNQVRfTDgiLCJQSVhFTEZPUk1BVF9MQTgiLCJQSVhFTEZPUk1BVF9SR0I1NjUiLCJQSVhFTEZPUk1BVF9SR0JBNTU1MSIsIlBJWEVMRk9STUFUX1JHQkE0IiwiUElYRUxGT1JNQVRfUkdCOCIsIlBJWEVMRk9STUFUX1JHQkE4IiwiUElYRUxGT1JNQVRfRFhUMSIsIlBJWEVMRk9STUFUX0RYVDMiLCJQSVhFTEZPUk1BVF9EWFQ1IiwiUElYRUxGT1JNQVRfUkdCMTZGIiwiUElYRUxGT1JNQVRfUkdCQTE2RiIsIlBJWEVMRk9STUFUX1JHQjMyRiIsIlBJWEVMRk9STUFUX1JHQkEzMkYiLCJQSVhFTEZPUk1BVF9SMzJGIiwiUElYRUxGT1JNQVRfREVQVEgiLCJQSVhFTEZPUk1BVF9ERVBUSFNURU5DSUwiLCJQSVhFTEZPUk1BVF8xMTExMTBGIiwiUElYRUxGT1JNQVRfU1JHQiIsIlBJWEVMRk9STUFUX1NSR0JBIiwiUElYRUxGT1JNQVRfRVRDMSIsIlBJWEVMRk9STUFUX0VUQzJfUkdCIiwiUElYRUxGT1JNQVRfRVRDMl9SR0JBIiwiUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JfMSIsIlBJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCQV8xIiwiUElYRUxGT1JNQVRfUFZSVENfNEJQUF9SR0JfMSIsIlBJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCQV8xIiwiUElYRUxGT1JNQVRfQVNUQ180eDQiLCJQSVhFTEZPUk1BVF9BVENfUkdCIiwiUElYRUxGT1JNQVRfQVRDX1JHQkEiLCJQSVhFTEZPUk1BVF9CR1JBOCIsImdwdUFkZHJlc3NNb2RlcyIsIkFERFJFU1NfUkVQRUFUIiwiQUREUkVTU19DTEFNUF9UT19FREdFIiwiQUREUkVTU19NSVJST1JFRF9SRVBFQVQiLCJXZWJncHVUZXh0dXJlIiwiY29uc3RydWN0b3IiLCJ0ZXh0dXJlIiwiZ3B1VGV4dHVyZSIsInZpZXciLCJzYW1wbGVycyIsImRlc2NyIiwiZm9ybWF0IiwiRGVidWciLCJhc3NlcnQiLCJuYW1lIiwiY3JlYXRlIiwiZGV2aWNlIiwid2dwdSIsIm1pcExldmVsQ291bnQiLCJyZXF1aXJlZE1pcExldmVscyIsInNpemUiLCJ3aWR0aCIsImhlaWdodCIsImRlcHRoT3JBcnJheUxheWVycyIsImN1YmVtYXAiLCJzYW1wbGVDb3VudCIsImRpbWVuc2lvbiIsInZvbHVtZSIsInVzYWdlIiwiR1BVVGV4dHVyZVVzYWdlIiwiVEVYVFVSRV9CSU5ESU5HIiwiQ09QWV9EU1QiLCJSRU5ERVJfQVRUQUNITUVOVCIsIkNPUFlfU1JDIiwiV2ViZ3B1RGVidWciLCJ2YWxpZGF0ZSIsImNyZWF0ZVRleHR1cmUiLCJEZWJ1Z0hlbHBlciIsInNldExhYmVsIiwiZW5kIiwidmlld0Rlc2NyIiwiYXNwZWN0IiwiY3JlYXRlVmlldyIsImRlc3Ryb3kiLCJnZXRWaWV3IiwidXBsb2FkSW1tZWRpYXRlIiwiX29wdGlvbnMkZm9ybWF0IiwiX29wdGlvbnMkZGltZW5zaW9uIiwiX29wdGlvbnMkYXNwZWN0IiwiX29wdGlvbnMkYmFzZU1pcExldmVsIiwiX29wdGlvbnMkbWlwTGV2ZWxDb3VuIiwiX29wdGlvbnMkYmFzZUFycmF5TGF5IiwiX29wdGlvbnMkYXJyYXlMYXllckNvIiwib3B0aW9ucyIsInRleHR1cmVEZXNjciIsImRlZmF1bHRWaWV3RGltZW5zaW9uIiwiYmFzZU1pcExldmVsIiwiYmFzZUFycmF5TGF5ZXIiLCJhcnJheUxheWVyQ291bnQiLCJKU09OIiwic3RyaW5naWZ5IiwiZ2V0U2FtcGxlciIsInNhbXBsZVR5cGUiLCJzYW1wbGVyIiwibGFiZWwiLCJhZGRyZXNzTW9kZVUiLCJhZGRyZXNzVSIsImFkZHJlc3NNb2RlViIsImFkZHJlc3NWIiwiYWRkcmVzc01vZGVXIiwiYWRkcmVzc1ciLCJjb21wYXJlT25SZWFkIiwiU0FNUExFVFlQRV9ERVBUSCIsImNvbXBhcmUiLCJtYWdGaWx0ZXIiLCJtaW5GaWx0ZXIiLCJTQU1QTEVUWVBFX1VORklMVEVSQUJMRV9GTE9BVCIsIm1pcG1hcEZpbHRlciIsImNyZWF0ZVNhbXBsZXIiLCJsb3NlQ29udGV4dCIsIl9uZWVkc1VwbG9hZCIsIl9uZWVkc01pcG1hcHNVcGxvYWQiLCJ1cGxvYWREYXRhIiwiX2xldmVscyIsImFueVVwbG9hZHMiLCJtaXBMZXZlbCIsIm1pcE9iamVjdCIsImZhY2UiLCJmYWNlU291cmNlIiwiaXNFeHRlcm5hbEltYWdlIiwidXBsb2FkRXh0ZXJuYWxJbWFnZSIsImVycm9yIiwiX3ZvbHVtZSIsIndhcm4iLCJBcnJheUJ1ZmZlciIsImlzVmlldyIsInVwbG9hZFR5cGVkQXJyYXlEYXRhIiwibWlwbWFwcyIsIm1pcG1hcFJlbmRlcmVyIiwiZ2VuZXJhdGUiLCJpbWFnZSIsIkltYWdlQml0bWFwIiwiSFRNTFZpZGVvRWxlbWVudCIsIkhUTUxDYW52YXNFbGVtZW50IiwiT2Zmc2NyZWVuQ2FudmFzIiwic3JjIiwic291cmNlIiwib3JpZ2luIiwiZmxpcFkiLCJkc3QiLCJjb3B5U2l6ZSIsInF1ZXVlIiwiY29weUV4dGVybmFsSW1hZ2VUb1RleHR1cmUiLCJkYXRhIiwiX3BpeGVsRm9ybWF0Qnl0ZVNpemVzIiwiZGVzdCIsInBpeGVsU2l6ZSIsInBpeGVsRm9ybWF0Qnl0ZVNpemVzIiwiYnl0ZXNQZXJSb3ciLCJieXRlU2l6ZSIsImJ5dGVMZW5ndGgiLCJkYXRhTGF5b3V0Iiwib2Zmc2V0Iiwicm93c1BlckltYWdlIiwid3JpdGVUZXh0dXJlIl0sIm1hcHBpbmdzIjoiOzs7O0FBZUE7QUFDQSxNQUFNQSxpQkFBaUIsR0FBRyxFQUFFLENBQUE7QUFDNUJBLGlCQUFpQixDQUFDQyxjQUFjLENBQUMsR0FBRyxFQUFFLENBQUE7QUFDdENELGlCQUFpQixDQUFDRSxjQUFjLENBQUMsR0FBRyxTQUFTLENBQUE7QUFDN0NGLGlCQUFpQixDQUFDRyxlQUFlLENBQUMsR0FBRyxVQUFVLENBQUE7QUFDL0NILGlCQUFpQixDQUFDSSxrQkFBa0IsQ0FBQyxHQUFHLEVBQUUsQ0FBQTtBQUMxQ0osaUJBQWlCLENBQUNLLG9CQUFvQixDQUFDLEdBQUcsRUFBRSxDQUFBO0FBQzVDTCxpQkFBaUIsQ0FBQ00saUJBQWlCLENBQUMsR0FBRyxFQUFFLENBQUE7QUFDekNO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
