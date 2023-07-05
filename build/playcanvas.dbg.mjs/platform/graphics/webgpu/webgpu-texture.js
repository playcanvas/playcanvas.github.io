import { TRACEID_RENDER_QUEUE } from '../../../core/constants.js';
import { Debug, DebugHelper } from '../../../core/debug.js';
import { math } from '../../../core/math/math.js';
import { PIXELFORMAT_DEPTHSTENCIL, SAMPLETYPE_DEPTH, SAMPLETYPE_UNFILTERABLE_FLOAT, PIXELFORMAT_RGBA32F, PIXELFORMAT_RGBA16F, pixelFormatInfo, PIXELFORMAT_A8, PIXELFORMAT_L8, PIXELFORMAT_LA8, PIXELFORMAT_RGB565, PIXELFORMAT_RGBA5551, PIXELFORMAT_RGBA4, PIXELFORMAT_RGB8, PIXELFORMAT_RGBA8, PIXELFORMAT_DXT1, PIXELFORMAT_DXT3, PIXELFORMAT_DXT5, PIXELFORMAT_RGB16F, PIXELFORMAT_RGB32F, PIXELFORMAT_R32F, PIXELFORMAT_DEPTH, PIXELFORMAT_111110F, PIXELFORMAT_SRGB, PIXELFORMAT_SRGBA, PIXELFORMAT_ETC1, PIXELFORMAT_ETC2_RGB, PIXELFORMAT_ETC2_RGBA, PIXELFORMAT_PVRTC_2BPP_RGB_1, PIXELFORMAT_PVRTC_2BPP_RGBA_1, PIXELFORMAT_PVRTC_4BPP_RGB_1, PIXELFORMAT_PVRTC_4BPP_RGBA_1, PIXELFORMAT_ASTC_4x4, PIXELFORMAT_ATC_RGB, PIXELFORMAT_ATC_RGBA, PIXELFORMAT_BGRA8, ADDRESS_REPEAT, ADDRESS_CLAMP_TO_EDGE, ADDRESS_MIRRORED_REPEAT, FILTER_NEAREST, FILTER_LINEAR, FILTER_NEAREST_MIPMAP_NEAREST, FILTER_NEAREST_MIPMAP_LINEAR, FILTER_LINEAR_MIPMAP_NEAREST, FILTER_LINEAR_MIPMAP_LINEAR } from '../constants.js';
import { TextureUtils } from '../texture-utils.js';
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
gpuTextureFormats[PIXELFORMAT_DXT1] = 'bc1-rgba-unorm';
gpuTextureFormats[PIXELFORMAT_DXT3] = 'bc2-rgba-unorm';
gpuTextureFormats[PIXELFORMAT_DXT5] = 'bc3-rgba-unorm';
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
gpuTextureFormats[PIXELFORMAT_ETC2_RGB] = 'etc2-rgb8unorm';
gpuTextureFormats[PIXELFORMAT_ETC2_RGBA] = 'etc2-rgba8unorm';
gpuTextureFormats[PIXELFORMAT_PVRTC_2BPP_RGB_1] = '';
gpuTextureFormats[PIXELFORMAT_PVRTC_2BPP_RGBA_1] = '';
gpuTextureFormats[PIXELFORMAT_PVRTC_4BPP_RGB_1] = '';
gpuTextureFormats[PIXELFORMAT_PVRTC_4BPP_RGBA_1] = '';
gpuTextureFormats[PIXELFORMAT_ASTC_4x4] = 'astc-4x4-unorm';
gpuTextureFormats[PIXELFORMAT_ATC_RGB] = '';
gpuTextureFormats[PIXELFORMAT_ATC_RGBA] = '';
gpuTextureFormats[PIXELFORMAT_BGRA8] = 'bgra8unorm';

// map of ADDRESS_*** to GPUAddressMode
const gpuAddressModes = [];
gpuAddressModes[ADDRESS_REPEAT] = 'repeat';
gpuAddressModes[ADDRESS_CLAMP_TO_EDGE] = 'clamp-to-edge';
gpuAddressModes[ADDRESS_MIRRORED_REPEAT] = 'mirror-repeat';

// map of FILTER_*** to GPUFilterMode for level and mip sampling
const gpuFilterModes = [];
gpuFilterModes[FILTER_NEAREST] = {
  level: 'nearest',
  mip: 'nearest'
};
gpuFilterModes[FILTER_LINEAR] = {
  level: 'linear',
  mip: 'nearest'
};
gpuFilterModes[FILTER_NEAREST_MIPMAP_NEAREST] = {
  level: 'nearest',
  mip: 'nearest'
};
gpuFilterModes[FILTER_NEAREST_MIPMAP_LINEAR] = {
  level: 'nearest',
  mip: 'linear'
};
gpuFilterModes[FILTER_LINEAR_MIPMAP_NEAREST] = {
  level: 'linear',
  mip: 'nearest'
};
gpuFilterModes[FILTER_LINEAR_MIPMAP_LINEAR] = {
  level: 'linear',
  mip: 'linear'
};

/**
 * A WebGPU implementation of the Texture.
 *
 * @ignore
 */
class WebgpuTexture {
  constructor(texture) {
    /**
     * @type {GPUTexture}
     * @private
     */
    this.gpuTexture = void 0;
    /**
     * @type {GPUTextureView}
     * @private
     */
    this.view = void 0;
    /**
     * An array of samplers, addressed by SAMPLETYPE_*** constant, allowing texture to be sampled
     * using different samplers. Most textures are sampled as interpolated floats, but some can
     * additionally be sampled using non-interpolated floats (raw data) or compare sampling
     * (shadow maps).
     *
     * @type {GPUSampler[]}
     * @private
     */
    this.samplers = [];
    /**
     * @type {GPUTextureDescriptor}
     * @private
     */
    this.descr = void 0;
    /**
     * @type {GPUTextureFormat}
     * @private
     */
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
  propertyChanged(flag) {
    // samplers need to be recreated
    this.samplers.length = 0;
  }

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
        addressModeW: gpuAddressModes[texture.addressW],
        maxAnisotropy: math.clamp(Math.round(texture._anisotropy), 1, device.maxTextureAnisotropy)
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
          descr.magFilter = gpuFilterModes[texture.magFilter].level;
          descr.minFilter = gpuFilterModes[texture.minFilter].level;
          descr.mipmapFilter = gpuFilterModes[texture.minFilter].mip;
          Debug.call(() => {
            label = `Texture:${texture.magFilter}-${texture.minFilter}-${descr.mipmapFilter}`;
          });
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
                } else if (ArrayBuffer.isView(faceSource)) {
                  // typed array

                  this.uploadTypedArrayData(device, faceSource, mipLevel, face);
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

              this.uploadTypedArrayData(device, mipObject, mipLevel, 0);
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

    // submit existing scheduled commands to the queue before copying to preserve the order
    device.submit();
    Debug.trace(TRACEID_RENDER_QUEUE, `IMAGE-TO-TEX: mip:${mipLevel} face:${face} ${this.texture.name}`);
    device.wgpu.queue.copyExternalImageToTexture(src, dst, copySize);
  }
  uploadTypedArrayData(device, data, mipLevel, face) {
    var _formatInfo$size;
    const texture = this.texture;
    const wgpu = device.wgpu;

    /** @type {GPUImageCopyTexture} */
    const dest = {
      texture: this.gpuTexture,
      origin: [0, 0, face],
      mipLevel: mipLevel
    };

    // texture dimensions at the specified mip level
    const width = TextureUtils.calcLevelDimension(texture.width, mipLevel);
    const height = TextureUtils.calcLevelDimension(texture.height, mipLevel);

    // data sizes
    const byteSize = TextureUtils.calcLevelGpuSize(width, height, texture.format);
    Debug.assert(byteSize === data.byteLength, `Error uploading data to texture, the data byte size of ${data.byteLength} does not match required ${byteSize}`, texture);

    // this does not handle compressed formats
    const formatInfo = pixelFormatInfo.get(texture.format);
    Debug.assert(formatInfo);
    const pixelSize = (_formatInfo$size = formatInfo.size) != null ? _formatInfo$size : 0;
    Debug.assert(pixelSize, `WebGPU does not yet support texture format ${formatInfo.name} for texture ${texture.name}`, texture);
    const bytesPerRow = pixelSize * width;

    /** @type {GPUImageDataLayout} */
    const dataLayout = {
      offset: 0,
      bytesPerRow: bytesPerRow,
      rowsPerImage: height
    };
    const size = {
      width: width,
      height: height,
      depthOrArrayLayers: 1
    };

    // submit existing scheduled commands to the queue before copying to preserve the order
    device.submit();
    Debug.trace(TRACEID_RENDER_QUEUE, `WRITE-TEX: mip:${mipLevel} face:${face} ${this.texture.name}`);
    wgpu.queue.writeTexture(dest, data, dataLayout, size);
  }
}

export { WebgpuTexture };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViZ3B1LXRleHR1cmUuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9wbGF0Zm9ybS9ncmFwaGljcy93ZWJncHUvd2ViZ3B1LXRleHR1cmUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgVFJBQ0VJRF9SRU5ERVJfUVVFVUUgfSBmcm9tICcuLi8uLi8uLi9jb3JlL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBEZWJ1ZywgRGVidWdIZWxwZXIgfSBmcm9tICcuLi8uLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IG1hdGggfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvbWF0aC5qcyc7XG5cbmltcG9ydCB7XG4gICAgcGl4ZWxGb3JtYXRJbmZvLFxuICAgIEFERFJFU1NfUkVQRUFULCBBRERSRVNTX0NMQU1QX1RPX0VER0UsIEFERFJFU1NfTUlSUk9SRURfUkVQRUFULFxuICAgIFBJWEVMRk9STUFUX0E4LCBQSVhFTEZPUk1BVF9MOCwgUElYRUxGT1JNQVRfTEE4LCBQSVhFTEZPUk1BVF9SR0I1NjUsIFBJWEVMRk9STUFUX1JHQkE1NTUxLCBQSVhFTEZPUk1BVF9SR0JBNCxcbiAgICBQSVhFTEZPUk1BVF9SR0I4LCBQSVhFTEZPUk1BVF9SR0JBOCwgUElYRUxGT1JNQVRfRFhUMSwgUElYRUxGT1JNQVRfRFhUMywgUElYRUxGT1JNQVRfRFhUNSxcbiAgICBQSVhFTEZPUk1BVF9SR0IxNkYsIFBJWEVMRk9STUFUX1JHQkExNkYsIFBJWEVMRk9STUFUX1JHQjMyRiwgUElYRUxGT1JNQVRfUkdCQTMyRiwgUElYRUxGT1JNQVRfUjMyRiwgUElYRUxGT1JNQVRfREVQVEgsXG4gICAgUElYRUxGT1JNQVRfREVQVEhTVEVOQ0lMLCBQSVhFTEZPUk1BVF8xMTExMTBGLCBQSVhFTEZPUk1BVF9TUkdCLCBQSVhFTEZPUk1BVF9TUkdCQSwgUElYRUxGT1JNQVRfRVRDMSxcbiAgICBQSVhFTEZPUk1BVF9FVEMyX1JHQiwgUElYRUxGT1JNQVRfRVRDMl9SR0JBLCBQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQl8xLCBQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQkFfMSxcbiAgICBQSVhFTEZPUk1BVF9QVlJUQ180QlBQX1JHQl8xLCBQSVhFTEZPUk1BVF9QVlJUQ180QlBQX1JHQkFfMSwgUElYRUxGT1JNQVRfQVNUQ180eDQsIFBJWEVMRk9STUFUX0FUQ19SR0IsXG4gICAgUElYRUxGT1JNQVRfQVRDX1JHQkEsIFBJWEVMRk9STUFUX0JHUkE4LCBTQU1QTEVUWVBFX1VORklMVEVSQUJMRV9GTE9BVCwgU0FNUExFVFlQRV9ERVBUSCxcbiAgICBGSUxURVJfTkVBUkVTVCwgRklMVEVSX0xJTkVBUiwgRklMVEVSX05FQVJFU1RfTUlQTUFQX05FQVJFU1QsIEZJTFRFUl9ORUFSRVNUX01JUE1BUF9MSU5FQVIsIEZJTFRFUl9MSU5FQVJfTUlQTUFQX05FQVJFU1QsIEZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUlxufSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgVGV4dHVyZVV0aWxzIH0gZnJvbSAnLi4vdGV4dHVyZS11dGlscy5qcyc7XG5pbXBvcnQgeyBXZWJncHVEZWJ1ZyB9IGZyb20gJy4vd2ViZ3B1LWRlYnVnLmpzJztcblxuLy8gbWFwIG9mIFBJWEVMRk9STUFUXyoqKiB0byBHUFVUZXh0dXJlRm9ybWF0XG5jb25zdCBncHVUZXh0dXJlRm9ybWF0cyA9IFtdO1xuZ3B1VGV4dHVyZUZvcm1hdHNbUElYRUxGT1JNQVRfQThdID0gJyc7XG5ncHVUZXh0dXJlRm9ybWF0c1tQSVhFTEZPUk1BVF9MOF0gPSAncjh1bm9ybSc7XG5ncHVUZXh0dXJlRm9ybWF0c1tQSVhFTEZPUk1BVF9MQThdID0gJ3JnOHVub3JtJztcbmdwdVRleHR1cmVGb3JtYXRzW1BJWEVMRk9STUFUX1JHQjU2NV0gPSAnJztcbmdwdVRleHR1cmVGb3JtYXRzW1BJWEVMRk9STUFUX1JHQkE1NTUxXSA9ICcnO1xuZ3B1VGV4dHVyZUZvcm1hdHNbUElYRUxGT1JNQVRfUkdCQTRdID0gJyc7XG5ncHVUZXh0dXJlRm9ybWF0c1tQSVhFTEZPUk1BVF9SR0I4XSA9ICdyZ2JhOHVub3JtJztcbmdwdVRleHR1cmVGb3JtYXRzW1BJWEVMRk9STUFUX1JHQkE4XSA9ICdyZ2JhOHVub3JtJztcbmdwdVRleHR1cmVGb3JtYXRzW1BJWEVMRk9STUFUX0RYVDFdID0gJ2JjMS1yZ2JhLXVub3JtJztcbmdwdVRleHR1cmVGb3JtYXRzW1BJWEVMRk9STUFUX0RYVDNdID0gJ2JjMi1yZ2JhLXVub3JtJztcbmdwdVRleHR1cmVGb3JtYXRzW1BJWEVMRk9STUFUX0RYVDVdID0gJ2JjMy1yZ2JhLXVub3JtJztcbmdwdVRleHR1cmVGb3JtYXRzW1BJWEVMRk9STUFUX1JHQjE2Rl0gPSAnJztcbmdwdVRleHR1cmVGb3JtYXRzW1BJWEVMRk9STUFUX1JHQkExNkZdID0gJ3JnYmExNmZsb2F0JztcbmdwdVRleHR1cmVGb3JtYXRzW1BJWEVMRk9STUFUX1JHQjMyRl0gPSAnJztcbmdwdVRleHR1cmVGb3JtYXRzW1BJWEVMRk9STUFUX1JHQkEzMkZdID0gJ3JnYmEzMmZsb2F0JztcbmdwdVRleHR1cmVGb3JtYXRzW1BJWEVMRk9STUFUX1IzMkZdID0gJ3IzMmZsb2F0JztcbmdwdVRleHR1cmVGb3JtYXRzW1BJWEVMRk9STUFUX0RFUFRIXSA9ICdkZXB0aDMyZmxvYXQnO1xuZ3B1VGV4dHVyZUZvcm1hdHNbUElYRUxGT1JNQVRfREVQVEhTVEVOQ0lMXSA9ICdkZXB0aDI0cGx1cy1zdGVuY2lsOCc7XG5ncHVUZXh0dXJlRm9ybWF0c1tQSVhFTEZPUk1BVF8xMTExMTBGXSA9ICdyZzExYjEwdWZsb2F0JztcbmdwdVRleHR1cmVGb3JtYXRzW1BJWEVMRk9STUFUX1NSR0JdID0gJyc7XG5ncHVUZXh0dXJlRm9ybWF0c1tQSVhFTEZPUk1BVF9TUkdCQV0gPSAnJztcbmdwdVRleHR1cmVGb3JtYXRzW1BJWEVMRk9STUFUX0VUQzFdID0gJyc7XG5ncHVUZXh0dXJlRm9ybWF0c1tQSVhFTEZPUk1BVF9FVEMyX1JHQl0gPSAnZXRjMi1yZ2I4dW5vcm0nO1xuZ3B1VGV4dHVyZUZvcm1hdHNbUElYRUxGT1JNQVRfRVRDMl9SR0JBXSA9ICdldGMyLXJnYmE4dW5vcm0nO1xuZ3B1VGV4dHVyZUZvcm1hdHNbUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JfMV0gPSAnJztcbmdwdVRleHR1cmVGb3JtYXRzW1BJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCQV8xXSA9ICcnO1xuZ3B1VGV4dHVyZUZvcm1hdHNbUElYRUxGT1JNQVRfUFZSVENfNEJQUF9SR0JfMV0gPSAnJztcbmdwdVRleHR1cmVGb3JtYXRzW1BJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCQV8xXSA9ICcnO1xuZ3B1VGV4dHVyZUZvcm1hdHNbUElYRUxGT1JNQVRfQVNUQ180eDRdID0gJ2FzdGMtNHg0LXVub3JtJztcbmdwdVRleHR1cmVGb3JtYXRzW1BJWEVMRk9STUFUX0FUQ19SR0JdID0gJyc7XG5ncHVUZXh0dXJlRm9ybWF0c1tQSVhFTEZPUk1BVF9BVENfUkdCQV0gPSAnJztcbmdwdVRleHR1cmVGb3JtYXRzW1BJWEVMRk9STUFUX0JHUkE4XSA9ICdiZ3JhOHVub3JtJztcblxuLy8gbWFwIG9mIEFERFJFU1NfKioqIHRvIEdQVUFkZHJlc3NNb2RlXG5jb25zdCBncHVBZGRyZXNzTW9kZXMgPSBbXTtcbmdwdUFkZHJlc3NNb2Rlc1tBRERSRVNTX1JFUEVBVF0gPSAncmVwZWF0JztcbmdwdUFkZHJlc3NNb2Rlc1tBRERSRVNTX0NMQU1QX1RPX0VER0VdID0gJ2NsYW1wLXRvLWVkZ2UnO1xuZ3B1QWRkcmVzc01vZGVzW0FERFJFU1NfTUlSUk9SRURfUkVQRUFUXSA9ICdtaXJyb3ItcmVwZWF0JztcblxuLy8gbWFwIG9mIEZJTFRFUl8qKiogdG8gR1BVRmlsdGVyTW9kZSBmb3IgbGV2ZWwgYW5kIG1pcCBzYW1wbGluZ1xuY29uc3QgZ3B1RmlsdGVyTW9kZXMgPSBbXTtcbmdwdUZpbHRlck1vZGVzW0ZJTFRFUl9ORUFSRVNUXSA9IHsgbGV2ZWw6ICduZWFyZXN0JywgbWlwOiAnbmVhcmVzdCcgfTtcbmdwdUZpbHRlck1vZGVzW0ZJTFRFUl9MSU5FQVJdID0geyBsZXZlbDogJ2xpbmVhcicsIG1pcDogJ25lYXJlc3QnIH07XG5ncHVGaWx0ZXJNb2Rlc1tGSUxURVJfTkVBUkVTVF9NSVBNQVBfTkVBUkVTVF0gPSB7IGxldmVsOiAnbmVhcmVzdCcsIG1pcDogJ25lYXJlc3QnIH07XG5ncHVGaWx0ZXJNb2Rlc1tGSUxURVJfTkVBUkVTVF9NSVBNQVBfTElORUFSXSA9IHsgbGV2ZWw6ICduZWFyZXN0JywgbWlwOiAnbGluZWFyJyB9O1xuZ3B1RmlsdGVyTW9kZXNbRklMVEVSX0xJTkVBUl9NSVBNQVBfTkVBUkVTVF0gPSB7IGxldmVsOiAnbGluZWFyJywgbWlwOiAnbmVhcmVzdCcgfTtcbmdwdUZpbHRlck1vZGVzW0ZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUl0gPSB7IGxldmVsOiAnbGluZWFyJywgbWlwOiAnbGluZWFyJyB9O1xuXG4vKipcbiAqIEEgV2ViR1BVIGltcGxlbWVudGF0aW9uIG9mIHRoZSBUZXh0dXJlLlxuICpcbiAqIEBpZ25vcmVcbiAqL1xuY2xhc3MgV2ViZ3B1VGV4dHVyZSB7XG4gICAgLyoqXG4gICAgICogQHR5cGUge0dQVVRleHR1cmV9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBncHVUZXh0dXJlO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0dQVVRleHR1cmVWaWV3fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgdmlldztcblxuICAgIC8qKlxuICAgICAqIEFuIGFycmF5IG9mIHNhbXBsZXJzLCBhZGRyZXNzZWQgYnkgU0FNUExFVFlQRV8qKiogY29uc3RhbnQsIGFsbG93aW5nIHRleHR1cmUgdG8gYmUgc2FtcGxlZFxuICAgICAqIHVzaW5nIGRpZmZlcmVudCBzYW1wbGVycy4gTW9zdCB0ZXh0dXJlcyBhcmUgc2FtcGxlZCBhcyBpbnRlcnBvbGF0ZWQgZmxvYXRzLCBidXQgc29tZSBjYW5cbiAgICAgKiBhZGRpdGlvbmFsbHkgYmUgc2FtcGxlZCB1c2luZyBub24taW50ZXJwb2xhdGVkIGZsb2F0cyAocmF3IGRhdGEpIG9yIGNvbXBhcmUgc2FtcGxpbmdcbiAgICAgKiAoc2hhZG93IG1hcHMpLlxuICAgICAqXG4gICAgICogQHR5cGUge0dQVVNhbXBsZXJbXX1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHNhbXBsZXJzID0gW107XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7R1BVVGV4dHVyZURlc2NyaXB0b3J9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBkZXNjcjtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtHUFVUZXh0dXJlRm9ybWF0fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgZm9ybWF0O1xuXG4gICAgY29uc3RydWN0b3IodGV4dHVyZSkge1xuICAgICAgICAvKiogQHR5cGUge2ltcG9ydCgnLi4vdGV4dHVyZS5qcycpLlRleHR1cmV9ICovXG4gICAgICAgIHRoaXMudGV4dHVyZSA9IHRleHR1cmU7XG5cbiAgICAgICAgdGhpcy5mb3JtYXQgPSBncHVUZXh0dXJlRm9ybWF0c1t0ZXh0dXJlLmZvcm1hdF07XG4gICAgICAgIERlYnVnLmFzc2VydCh0aGlzLmZvcm1hdCAhPT0gJycsIGBXZWJHUFUgZG9lcyBub3Qgc3VwcG9ydCB0ZXh0dXJlIGZvcm1hdCAke3RleHR1cmUuZm9ybWF0fSBmb3IgdGV4dHVyZSAke3RleHR1cmUubmFtZX1gLCB0ZXh0dXJlKTtcblxuICAgICAgICB0aGlzLmNyZWF0ZSh0ZXh0dXJlLmRldmljZSk7XG4gICAgfVxuXG4gICAgY3JlYXRlKGRldmljZSkge1xuXG4gICAgICAgIGNvbnN0IHRleHR1cmUgPSB0aGlzLnRleHR1cmU7XG4gICAgICAgIGNvbnN0IHdncHUgPSBkZXZpY2Uud2dwdTtcbiAgICAgICAgY29uc3QgbWlwTGV2ZWxDb3VudCA9IHRleHR1cmUucmVxdWlyZWRNaXBMZXZlbHM7XG5cbiAgICAgICAgdGhpcy5kZXNjciA9IHtcbiAgICAgICAgICAgIHNpemU6IHtcbiAgICAgICAgICAgICAgICB3aWR0aDogdGV4dHVyZS53aWR0aCxcbiAgICAgICAgICAgICAgICBoZWlnaHQ6IHRleHR1cmUuaGVpZ2h0LFxuICAgICAgICAgICAgICAgIGRlcHRoT3JBcnJheUxheWVyczogdGV4dHVyZS5jdWJlbWFwID8gNiA6IDFcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBmb3JtYXQ6IHRoaXMuZm9ybWF0LFxuICAgICAgICAgICAgbWlwTGV2ZWxDb3VudDogbWlwTGV2ZWxDb3VudCxcbiAgICAgICAgICAgIHNhbXBsZUNvdW50OiAxLFxuICAgICAgICAgICAgZGltZW5zaW9uOiB0ZXh0dXJlLnZvbHVtZSA/ICczZCcgOiAnMmQnLFxuXG4gICAgICAgICAgICAvLyBUT0RPOiB1c2Ugb25seSByZXF1aXJlZCB1c2FnZSBmbGFnc1xuICAgICAgICAgICAgLy8gQ09QWV9TUkMgLSBwcm9iYWJseSBvbmx5IG5lZWRlZCBvbiByZW5kZXIgdGFyZ2V0IHRleHR1cmVzLCB0byBzdXBwb3J0IGNvcHlSZW5kZXJUYXJnZXQgKGdyYWIgcGFzcyBuZWVkcyBpdClcbiAgICAgICAgICAgIC8vIFJFTkRFUl9BVFRBQ0hNRU5UIC0gbmVlZGVkIGZvciBtaXBtYXAgZ2VuZXJhdGlvblxuICAgICAgICAgICAgdXNhZ2U6IEdQVVRleHR1cmVVc2FnZS5URVhUVVJFX0JJTkRJTkcgfCBHUFVUZXh0dXJlVXNhZ2UuQ09QWV9EU1QgfCBHUFVUZXh0dXJlVXNhZ2UuUkVOREVSX0FUVEFDSE1FTlQgfCBHUFVUZXh0dXJlVXNhZ2UuQ09QWV9TUkNcbiAgICAgICAgfTtcblxuICAgICAgICBXZWJncHVEZWJ1Zy52YWxpZGF0ZShkZXZpY2UpO1xuXG4gICAgICAgIHRoaXMuZ3B1VGV4dHVyZSA9IHdncHUuY3JlYXRlVGV4dHVyZSh0aGlzLmRlc2NyKTtcbiAgICAgICAgRGVidWdIZWxwZXIuc2V0TGFiZWwodGhpcy5ncHVUZXh0dXJlLCBgJHt0ZXh0dXJlLm5hbWV9JHt0ZXh0dXJlLmN1YmVtYXAgPyAnW2N1YmVtYXBdJyA6ICcnfSR7dGV4dHVyZS52b2x1bWUgPyAnWzNkXScgOiAnJ31gKTtcblxuICAgICAgICBXZWJncHVEZWJ1Zy5lbmQoZGV2aWNlLCB7XG4gICAgICAgICAgICBkZXNjcjogdGhpcy5kZXNjcixcbiAgICAgICAgICAgIHRleHR1cmVcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gZGVmYXVsdCB0ZXh0dXJlIHZpZXcgZGVzY3JpcHRvclxuICAgICAgICBsZXQgdmlld0Rlc2NyO1xuXG4gICAgICAgIC8vIHNvbWUgZm9ybWF0IHJlcXVpcmUgY3VzdG9tIGRlZmF1bHQgdGV4dHVyZSB2aWV3XG4gICAgICAgIGlmICh0aGlzLnRleHR1cmUuZm9ybWF0ID09PSBQSVhFTEZPUk1BVF9ERVBUSFNURU5DSUwpIHtcbiAgICAgICAgICAgIC8vIHdlIGV4cG9zZSB0aGUgZGVwdGggcGFydCBvZiB0aGUgZm9ybWF0XG4gICAgICAgICAgICB2aWV3RGVzY3IgPSB7XG4gICAgICAgICAgICAgICAgZm9ybWF0OiAnZGVwdGgyNHBsdXMnLFxuICAgICAgICAgICAgICAgIGFzcGVjdDogJ2RlcHRoLW9ubHknXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy52aWV3ID0gdGhpcy5jcmVhdGVWaWV3KHZpZXdEZXNjcik7XG4gICAgfVxuXG4gICAgZGVzdHJveShkZXZpY2UpIHtcbiAgICB9XG5cbiAgICBwcm9wZXJ0eUNoYW5nZWQoZmxhZykge1xuICAgICAgICAvLyBzYW1wbGVycyBuZWVkIHRvIGJlIHJlY3JlYXRlZFxuICAgICAgICB0aGlzLnNhbXBsZXJzLmxlbmd0aCA9IDA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHthbnl9IGRldmljZSAtIFRoZSBHcmFwaGljcyBEZXZpY2UuXG4gICAgICogQHJldHVybnMge2FueX0gLSBSZXR1cm5zIHRoZSB2aWV3LlxuICAgICAqL1xuICAgIGdldFZpZXcoZGV2aWNlKSB7XG5cbiAgICAgICAgdGhpcy51cGxvYWRJbW1lZGlhdGUoZGV2aWNlLCB0aGlzLnRleHR1cmUpO1xuXG4gICAgICAgIERlYnVnLmFzc2VydCh0aGlzLnZpZXcpO1xuICAgICAgICByZXR1cm4gdGhpcy52aWV3O1xuICAgIH1cblxuICAgIGNyZWF0ZVZpZXcodmlld0Rlc2NyKSB7XG5cbiAgICAgICAgY29uc3Qgb3B0aW9ucyA9IHZpZXdEZXNjciA/PyB7fTtcbiAgICAgICAgY29uc3QgdGV4dHVyZURlc2NyID0gdGhpcy5kZXNjcjtcbiAgICAgICAgY29uc3QgdGV4dHVyZSA9IHRoaXMudGV4dHVyZTtcblxuICAgICAgICAvLyAnMWQnLCAnMmQnLCAnMmQtYXJyYXknLCAnY3ViZScsICdjdWJlLWFycmF5JywgJzNkJ1xuICAgICAgICBjb25zdCBkZWZhdWx0Vmlld0RpbWVuc2lvbiA9ICgpID0+IHtcbiAgICAgICAgICAgIGlmICh0ZXh0dXJlLmN1YmVtYXApIHJldHVybiAnY3ViZSc7XG4gICAgICAgICAgICBpZiAodGV4dHVyZS52b2x1bWUpIHJldHVybiAnM2QnO1xuICAgICAgICAgICAgcmV0dXJuICcyZCc7XG4gICAgICAgIH07XG5cbiAgICAgICAgLyoqIEB0eXBlIHtHUFVUZXh0dXJlVmlld0Rlc2NyaXB0b3J9ICovXG4gICAgICAgIGNvbnN0IGRlc2NyID0ge1xuICAgICAgICAgICAgZm9ybWF0OiBvcHRpb25zLmZvcm1hdCA/PyB0ZXh0dXJlRGVzY3IuZm9ybWF0LFxuICAgICAgICAgICAgZGltZW5zaW9uOiBvcHRpb25zLmRpbWVuc2lvbiA/PyBkZWZhdWx0Vmlld0RpbWVuc2lvbigpLFxuICAgICAgICAgICAgYXNwZWN0OiBvcHRpb25zLmFzcGVjdCA/PyAnYWxsJyxcbiAgICAgICAgICAgIGJhc2VNaXBMZXZlbDogb3B0aW9ucy5iYXNlTWlwTGV2ZWwgPz8gMCxcbiAgICAgICAgICAgIG1pcExldmVsQ291bnQ6IG9wdGlvbnMubWlwTGV2ZWxDb3VudCA/PyB0ZXh0dXJlRGVzY3IubWlwTGV2ZWxDb3VudCxcbiAgICAgICAgICAgIGJhc2VBcnJheUxheWVyOiBvcHRpb25zLmJhc2VBcnJheUxheWVyID8/IDAsXG4gICAgICAgICAgICBhcnJheUxheWVyQ291bnQ6IG9wdGlvbnMuYXJyYXlMYXllckNvdW50ID8/IHRleHR1cmVEZXNjci5kZXB0aE9yQXJyYXlMYXllcnNcbiAgICAgICAgfTtcblxuICAgICAgICBjb25zdCB2aWV3ID0gdGhpcy5ncHVUZXh0dXJlLmNyZWF0ZVZpZXcoZGVzY3IpO1xuICAgICAgICBEZWJ1Z0hlbHBlci5zZXRMYWJlbCh2aWV3LCBgJHt2aWV3RGVzY3IgPyBgQ3VzdG9tVmlldyR7SlNPTi5zdHJpbmdpZnkodmlld0Rlc2NyKX1gIDogJ0RlZmF1bHRWaWV3J306JHt0aGlzLnRleHR1cmUubmFtZX1gKTtcblxuICAgICAgICByZXR1cm4gdmlldztcbiAgICB9XG5cbiAgICAvLyBUT0RPOiBzaGFyZSBhIGdsb2JhbCBtYXAgb2Ygc2FtcGxlcnMuIFBvc3NpYmx5IGV2ZW4gdXNlIHNoYXJlZCBzYW1wbGVycyBmb3IgYmluZCBncm91cCxcbiAgICAvLyBvciBtYXliZSBldmVuIGhhdmUgc29tZSBhdHRhY2hlZCBpbiB2aWV3IGJpbmQgZ3JvdXAgYW5kIHVzZSBnbG9iYWxseVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHthbnl9IGRldmljZSAtIFRoZSBHcmFwaGljcyBEZXZpY2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtzYW1wbGVUeXBlXSAtIEEgc2FtcGxlIHR5cGUgZm9yIHRoZSBzYW1wbGVyLCBTQU1QTEVUWVBFXyoqKiBjb25zdGFudC4gSWYgbm90XG4gICAgICogc3BlY2lmaWVkLCB0aGUgc2FtcGxlciB0eXBlIGlzIGJhc2VkIG9uIHRoZSB0ZXh0dXJlIGZvcm1hdCAvIHRleHR1cmUgc2FtcGxpbmcgdHlwZS5cbiAgICAgKiBAcmV0dXJucyB7YW55fSAtIFJldHVybnMgdGhlIHNhbXBsZXIuXG4gICAgICovXG4gICAgZ2V0U2FtcGxlcihkZXZpY2UsIHNhbXBsZVR5cGUpIHtcbiAgICAgICAgbGV0IHNhbXBsZXIgPSB0aGlzLnNhbXBsZXJzW3NhbXBsZVR5cGVdO1xuICAgICAgICBpZiAoIXNhbXBsZXIpIHtcblxuICAgICAgICAgICAgY29uc3QgdGV4dHVyZSA9IHRoaXMudGV4dHVyZTtcbiAgICAgICAgICAgIGxldCBsYWJlbDtcblxuICAgICAgICAgICAgLyoqIEB0eXBlIEdQVVNhbXBsZXJEZXNjcmlwdG9yICovXG4gICAgICAgICAgICBjb25zdCBkZXNjciA9IHtcbiAgICAgICAgICAgICAgICBhZGRyZXNzTW9kZVU6IGdwdUFkZHJlc3NNb2Rlc1t0ZXh0dXJlLmFkZHJlc3NVXSxcbiAgICAgICAgICAgICAgICBhZGRyZXNzTW9kZVY6IGdwdUFkZHJlc3NNb2Rlc1t0ZXh0dXJlLmFkZHJlc3NWXSxcbiAgICAgICAgICAgICAgICBhZGRyZXNzTW9kZVc6IGdwdUFkZHJlc3NNb2Rlc1t0ZXh0dXJlLmFkZHJlc3NXXSxcbiAgICAgICAgICAgICAgICBtYXhBbmlzb3Ryb3B5OiBtYXRoLmNsYW1wKE1hdGgucm91bmQodGV4dHVyZS5fYW5pc290cm9weSksIDEsIGRldmljZS5tYXhUZXh0dXJlQW5pc290cm9weSlcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIC8vIGRlZmF1bHQgZm9yIGNvbXBhcmUgc2FtcGxpbmcgb2YgdGV4dHVyZVxuICAgICAgICAgICAgaWYgKCFzYW1wbGVUeXBlICYmIHRleHR1cmUuY29tcGFyZU9uUmVhZCkge1xuICAgICAgICAgICAgICAgIHNhbXBsZVR5cGUgPSBTQU1QTEVUWVBFX0RFUFRIO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoc2FtcGxlVHlwZSA9PT0gU0FNUExFVFlQRV9ERVBUSCkge1xuXG4gICAgICAgICAgICAgICAgLy8gZGVwdGggY29tcGFyZSBzYW1wbGluZ1xuICAgICAgICAgICAgICAgIGRlc2NyLmNvbXBhcmUgPSAnbGVzcyc7XG4gICAgICAgICAgICAgICAgZGVzY3IubWFnRmlsdGVyID0gJ2xpbmVhcic7XG4gICAgICAgICAgICAgICAgZGVzY3IubWluRmlsdGVyID0gJ2xpbmVhcic7XG4gICAgICAgICAgICAgICAgbGFiZWwgPSAnQ29tcGFyZSc7XG5cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoc2FtcGxlVHlwZSA9PT0gU0FNUExFVFlQRV9VTkZJTFRFUkFCTEVfRkxPQVQpIHtcblxuICAgICAgICAgICAgICAgIC8vIHdlYmdwdSBjYW5ub3QgY3VycmVudGx5IGZpbHRlciBmbG9hdCAvIGhhbGYgZmxvYXQgdGV4dHVyZXNcbiAgICAgICAgICAgICAgICBkZXNjci5tYWdGaWx0ZXIgPSAnbmVhcmVzdCc7XG4gICAgICAgICAgICAgICAgZGVzY3IubWluRmlsdGVyID0gJ25lYXJlc3QnO1xuICAgICAgICAgICAgICAgIGRlc2NyLm1pcG1hcEZpbHRlciA9ICduZWFyZXN0JztcbiAgICAgICAgICAgICAgICBsYWJlbCA9ICdVbmZpbHRlcmFibGUnO1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgLy8gVE9ETzogdGhpcyBpcyB0ZW1wb3JhcnkgYW5kIG5lZWRzIHRvIGJlIG1hZGUgZ2VuZXJpY1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLnRleHR1cmUuZm9ybWF0ID09PSBQSVhFTEZPUk1BVF9SR0JBMzJGIHx8XG4gICAgICAgICAgICAgICAgICAgIHRoaXMudGV4dHVyZS5mb3JtYXQgPT09IFBJWEVMRk9STUFUX0RFUFRIU1RFTkNJTCB8fFxuICAgICAgICAgICAgICAgICAgICB0aGlzLnRleHR1cmUuZm9ybWF0ID09PSBQSVhFTEZPUk1BVF9SR0JBMTZGKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlc2NyLm1hZ0ZpbHRlciA9ICduZWFyZXN0JztcbiAgICAgICAgICAgICAgICAgICAgZGVzY3IubWluRmlsdGVyID0gJ25lYXJlc3QnO1xuICAgICAgICAgICAgICAgICAgICBkZXNjci5taXBtYXBGaWx0ZXIgPSAnbmVhcmVzdCc7XG4gICAgICAgICAgICAgICAgICAgIGxhYmVsID0gJ05lYXJlc3QnO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGRlc2NyLm1hZ0ZpbHRlciA9IGdwdUZpbHRlck1vZGVzW3RleHR1cmUubWFnRmlsdGVyXS5sZXZlbDtcbiAgICAgICAgICAgICAgICAgICAgZGVzY3IubWluRmlsdGVyID0gZ3B1RmlsdGVyTW9kZXNbdGV4dHVyZS5taW5GaWx0ZXJdLmxldmVsO1xuICAgICAgICAgICAgICAgICAgICBkZXNjci5taXBtYXBGaWx0ZXIgPSBncHVGaWx0ZXJNb2Rlc1t0ZXh0dXJlLm1pbkZpbHRlcl0ubWlwO1xuICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5jYWxsKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxhYmVsID0gYFRleHR1cmU6JHt0ZXh0dXJlLm1hZ0ZpbHRlcn0tJHt0ZXh0dXJlLm1pbkZpbHRlcn0tJHtkZXNjci5taXBtYXBGaWx0ZXJ9YDtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBzYW1wbGVyID0gZGV2aWNlLndncHUuY3JlYXRlU2FtcGxlcihkZXNjcik7XG4gICAgICAgICAgICBEZWJ1Z0hlbHBlci5zZXRMYWJlbChzYW1wbGVyLCBsYWJlbCk7XG4gICAgICAgICAgICB0aGlzLnNhbXBsZXJzW3NhbXBsZVR5cGVdID0gc2FtcGxlcjtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBzYW1wbGVyO1xuICAgIH1cblxuICAgIGxvc2VDb250ZXh0KCkge1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3dlYmdwdS1ncmFwaGljcy1kZXZpY2UuanMnKS5XZWJncHVHcmFwaGljc0RldmljZX0gZGV2aWNlIC0gVGhlIGdyYXBoaWNzXG4gICAgICogZGV2aWNlLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi90ZXh0dXJlLmpzJykuVGV4dHVyZX0gdGV4dHVyZSAtIFRoZSB0ZXh0dXJlLlxuICAgICAqL1xuICAgIHVwbG9hZEltbWVkaWF0ZShkZXZpY2UsIHRleHR1cmUpIHtcblxuICAgICAgICBpZiAodGV4dHVyZS5fbmVlZHNVcGxvYWQgfHwgdGV4dHVyZS5fbmVlZHNNaXBtYXBzVXBsb2FkKSB7XG4gICAgICAgICAgICB0aGlzLnVwbG9hZERhdGEoZGV2aWNlKTtcblxuICAgICAgICAgICAgdGV4dHVyZS5fbmVlZHNVcGxvYWQgPSBmYWxzZTtcbiAgICAgICAgICAgIHRleHR1cmUuX25lZWRzTWlwbWFwc1VwbG9hZCA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vd2ViZ3B1LWdyYXBoaWNzLWRldmljZS5qcycpLldlYmdwdUdyYXBoaWNzRGV2aWNlfSBkZXZpY2UgLSBUaGUgZ3JhcGhpY3NcbiAgICAgKiBkZXZpY2UuXG4gICAgICovXG4gICAgdXBsb2FkRGF0YShkZXZpY2UpIHtcblxuICAgICAgICBjb25zdCB0ZXh0dXJlID0gdGhpcy50ZXh0dXJlO1xuICAgICAgICBpZiAodGV4dHVyZS5fbGV2ZWxzKSB7XG5cbiAgICAgICAgICAgIC8vIHVwbG9hZCB0ZXh0dXJlIGRhdGEgaWYgYW55XG4gICAgICAgICAgICBsZXQgYW55VXBsb2FkcyA9IGZhbHNlO1xuICAgICAgICAgICAgY29uc3QgcmVxdWlyZWRNaXBMZXZlbHMgPSB0ZXh0dXJlLnJlcXVpcmVkTWlwTGV2ZWxzO1xuICAgICAgICAgICAgZm9yIChsZXQgbWlwTGV2ZWwgPSAwOyBtaXBMZXZlbCA8IHJlcXVpcmVkTWlwTGV2ZWxzOyBtaXBMZXZlbCsrKSB7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBtaXBPYmplY3QgPSB0ZXh0dXJlLl9sZXZlbHNbbWlwTGV2ZWxdO1xuICAgICAgICAgICAgICAgIGlmIChtaXBPYmplY3QpIHtcblxuICAgICAgICAgICAgICAgICAgICBpZiAodGV4dHVyZS5jdWJlbWFwKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGZhY2UgPSAwOyBmYWNlIDwgNjsgZmFjZSsrKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBmYWNlU291cmNlID0gbWlwT2JqZWN0W2ZhY2VdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChmYWNlU291cmNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLmlzRXh0ZXJuYWxJbWFnZShmYWNlU291cmNlKSkge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnVwbG9hZEV4dGVybmFsSW1hZ2UoZGV2aWNlLCBmYWNlU291cmNlLCBtaXBMZXZlbCwgZmFjZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhbnlVcGxvYWRzID0gdHJ1ZTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKEFycmF5QnVmZmVyLmlzVmlldyhmYWNlU291cmNlKSkgeyAvLyB0eXBlZCBhcnJheVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnVwbG9hZFR5cGVkQXJyYXlEYXRhKGRldmljZSwgZmFjZVNvdXJjZSwgbWlwTGV2ZWwsIGZhY2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYW55VXBsb2FkcyA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgRGVidWcuZXJyb3IoJ1Vuc3VwcG9ydGVkIHRleHR1cmUgc291cmNlIGRhdGEgZm9yIGN1YmVtYXAgZmFjZScsIGZhY2VTb3VyY2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodGV4dHVyZS5fdm9sdW1lKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIERlYnVnLndhcm4oJ1ZvbHVtZSB0ZXh0dXJlIGRhdGEgdXBsb2FkIGlzIG5vdCBzdXBwb3J0ZWQgeWV0JywgdGhpcy50ZXh0dXJlKTtcblxuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgeyAvLyAyZCB0ZXh0dXJlXG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLmlzRXh0ZXJuYWxJbWFnZShtaXBPYmplY3QpKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnVwbG9hZEV4dGVybmFsSW1hZ2UoZGV2aWNlLCBtaXBPYmplY3QsIG1pcExldmVsLCAwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhbnlVcGxvYWRzID0gdHJ1ZTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChBcnJheUJ1ZmZlci5pc1ZpZXcobWlwT2JqZWN0KSkgeyAvLyB0eXBlZCBhcnJheVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy51cGxvYWRUeXBlZEFycmF5RGF0YShkZXZpY2UsIG1pcE9iamVjdCwgbWlwTGV2ZWwsIDApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFueVVwbG9hZHMgPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgRGVidWcuZXJyb3IoJ1Vuc3VwcG9ydGVkIHRleHR1cmUgc291cmNlIGRhdGEnLCBtaXBPYmplY3QpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoYW55VXBsb2FkcyAmJiB0ZXh0dXJlLm1pcG1hcHMpIHtcbiAgICAgICAgICAgICAgICBkZXZpY2UubWlwbWFwUmVuZGVyZXIuZ2VuZXJhdGUodGhpcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBpbWFnZSB0eXBlcyBzdXBwb3J0ZWQgYnkgY29weUV4dGVybmFsSW1hZ2VUb1RleHR1cmVcbiAgICBpc0V4dGVybmFsSW1hZ2UoaW1hZ2UpIHtcbiAgICAgICAgcmV0dXJuIChpbWFnZSBpbnN0YW5jZW9mIEltYWdlQml0bWFwKSB8fFxuICAgICAgICAgICAgKGltYWdlIGluc3RhbmNlb2YgSFRNTFZpZGVvRWxlbWVudCkgfHxcbiAgICAgICAgICAgIChpbWFnZSBpbnN0YW5jZW9mIEhUTUxDYW52YXNFbGVtZW50KSB8fFxuICAgICAgICAgICAgKGltYWdlIGluc3RhbmNlb2YgT2Zmc2NyZWVuQ2FudmFzKTtcbiAgICB9XG5cbiAgICB1cGxvYWRFeHRlcm5hbEltYWdlKGRldmljZSwgaW1hZ2UsIG1pcExldmVsLCBmYWNlKSB7XG5cbiAgICAgICAgRGVidWcuYXNzZXJ0KG1pcExldmVsIDwgdGhpcy5kZXNjci5taXBMZXZlbENvdW50LCBgQWNjZXNzaW5nIG1pcCBsZXZlbCAke21pcExldmVsfSBvZiB0ZXh0dXJlIHdpdGggJHt0aGlzLmRlc2NyLm1pcExldmVsQ291bnR9IG1pcCBsZXZlbHNgLCB0aGlzKTtcblxuICAgICAgICBjb25zdCBzcmMgPSB7XG4gICAgICAgICAgICBzb3VyY2U6IGltYWdlLFxuICAgICAgICAgICAgb3JpZ2luOiBbMCwgMF0sXG4gICAgICAgICAgICBmbGlwWTogZmFsc2VcbiAgICAgICAgfTtcblxuICAgICAgICBjb25zdCBkc3QgPSB7XG4gICAgICAgICAgICB0ZXh0dXJlOiB0aGlzLmdwdVRleHR1cmUsXG4gICAgICAgICAgICBtaXBMZXZlbDogbWlwTGV2ZWwsXG4gICAgICAgICAgICBvcmlnaW46IFswLCAwLCBmYWNlXSxcbiAgICAgICAgICAgIGFzcGVjdDogJ2FsbCcgIC8vIGNhbiBiZTogXCJhbGxcIiwgXCJzdGVuY2lsLW9ubHlcIiwgXCJkZXB0aC1vbmx5XCJcbiAgICAgICAgfTtcblxuICAgICAgICBjb25zdCBjb3B5U2l6ZSA9IHtcbiAgICAgICAgICAgIHdpZHRoOiB0aGlzLmRlc2NyLnNpemUud2lkdGgsXG4gICAgICAgICAgICBoZWlnaHQ6IHRoaXMuZGVzY3Iuc2l6ZS5oZWlnaHQsXG4gICAgICAgICAgICBkZXB0aE9yQXJyYXlMYXllcnM6IDEgICAvLyBzaW5nbGUgbGF5ZXJcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBzdWJtaXQgZXhpc3Rpbmcgc2NoZWR1bGVkIGNvbW1hbmRzIHRvIHRoZSBxdWV1ZSBiZWZvcmUgY29weWluZyB0byBwcmVzZXJ2ZSB0aGUgb3JkZXJcbiAgICAgICAgZGV2aWNlLnN1Ym1pdCgpO1xuXG4gICAgICAgIERlYnVnLnRyYWNlKFRSQUNFSURfUkVOREVSX1FVRVVFLCBgSU1BR0UtVE8tVEVYOiBtaXA6JHttaXBMZXZlbH0gZmFjZToke2ZhY2V9ICR7dGhpcy50ZXh0dXJlLm5hbWV9YCk7XG4gICAgICAgIGRldmljZS53Z3B1LnF1ZXVlLmNvcHlFeHRlcm5hbEltYWdlVG9UZXh0dXJlKHNyYywgZHN0LCBjb3B5U2l6ZSk7XG4gICAgfVxuXG4gICAgdXBsb2FkVHlwZWRBcnJheURhdGEoZGV2aWNlLCBkYXRhLCBtaXBMZXZlbCwgZmFjZSkge1xuXG4gICAgICAgIGNvbnN0IHRleHR1cmUgPSB0aGlzLnRleHR1cmU7XG4gICAgICAgIGNvbnN0IHdncHUgPSBkZXZpY2Uud2dwdTtcblxuICAgICAgICAvKiogQHR5cGUge0dQVUltYWdlQ29weVRleHR1cmV9ICovXG4gICAgICAgIGNvbnN0IGRlc3QgPSB7XG4gICAgICAgICAgICB0ZXh0dXJlOiB0aGlzLmdwdVRleHR1cmUsXG4gICAgICAgICAgICBvcmlnaW46IFswLCAwLCBmYWNlXSxcbiAgICAgICAgICAgIG1pcExldmVsOiBtaXBMZXZlbFxuICAgICAgICB9O1xuXG4gICAgICAgIC8vIHRleHR1cmUgZGltZW5zaW9ucyBhdCB0aGUgc3BlY2lmaWVkIG1pcCBsZXZlbFxuICAgICAgICBjb25zdCB3aWR0aCA9IFRleHR1cmVVdGlscy5jYWxjTGV2ZWxEaW1lbnNpb24odGV4dHVyZS53aWR0aCwgbWlwTGV2ZWwpO1xuICAgICAgICBjb25zdCBoZWlnaHQgPSBUZXh0dXJlVXRpbHMuY2FsY0xldmVsRGltZW5zaW9uKHRleHR1cmUuaGVpZ2h0LCBtaXBMZXZlbCk7XG5cbiAgICAgICAgLy8gZGF0YSBzaXplc1xuICAgICAgICBjb25zdCBieXRlU2l6ZSA9IFRleHR1cmVVdGlscy5jYWxjTGV2ZWxHcHVTaXplKHdpZHRoLCBoZWlnaHQsIHRleHR1cmUuZm9ybWF0KTtcbiAgICAgICAgRGVidWcuYXNzZXJ0KGJ5dGVTaXplID09PSBkYXRhLmJ5dGVMZW5ndGgsXG4gICAgICAgICAgICAgICAgICAgICBgRXJyb3IgdXBsb2FkaW5nIGRhdGEgdG8gdGV4dHVyZSwgdGhlIGRhdGEgYnl0ZSBzaXplIG9mICR7ZGF0YS5ieXRlTGVuZ3RofSBkb2VzIG5vdCBtYXRjaCByZXF1aXJlZCAke2J5dGVTaXplfWAsIHRleHR1cmUpO1xuXG4gICAgICAgIC8vIHRoaXMgZG9lcyBub3QgaGFuZGxlIGNvbXByZXNzZWQgZm9ybWF0c1xuICAgICAgICBjb25zdCBmb3JtYXRJbmZvID0gcGl4ZWxGb3JtYXRJbmZvLmdldCh0ZXh0dXJlLmZvcm1hdCk7XG4gICAgICAgIERlYnVnLmFzc2VydChmb3JtYXRJbmZvKTtcblxuICAgICAgICBjb25zdCBwaXhlbFNpemUgPSBmb3JtYXRJbmZvLnNpemUgPz8gMDtcbiAgICAgICAgRGVidWcuYXNzZXJ0KHBpeGVsU2l6ZSwgYFdlYkdQVSBkb2VzIG5vdCB5ZXQgc3VwcG9ydCB0ZXh0dXJlIGZvcm1hdCAke2Zvcm1hdEluZm8ubmFtZX0gZm9yIHRleHR1cmUgJHt0ZXh0dXJlLm5hbWV9YCwgdGV4dHVyZSk7XG4gICAgICAgIGNvbnN0IGJ5dGVzUGVyUm93ID0gcGl4ZWxTaXplICogd2lkdGg7XG5cbiAgICAgICAgLyoqIEB0eXBlIHtHUFVJbWFnZURhdGFMYXlvdXR9ICovXG4gICAgICAgIGNvbnN0IGRhdGFMYXlvdXQgPSB7XG4gICAgICAgICAgICBvZmZzZXQ6IDAsXG4gICAgICAgICAgICBieXRlc1BlclJvdzogYnl0ZXNQZXJSb3csXG4gICAgICAgICAgICByb3dzUGVySW1hZ2U6IGhlaWdodFxuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IHNpemUgPSB7XG4gICAgICAgICAgICB3aWR0aDogd2lkdGgsXG4gICAgICAgICAgICBoZWlnaHQ6IGhlaWdodCxcbiAgICAgICAgICAgIGRlcHRoT3JBcnJheUxheWVyczogMVxuICAgICAgICB9O1xuXG4gICAgICAgIC8vIHN1Ym1pdCBleGlzdGluZyBzY2hlZHVsZWQgY29tbWFuZHMgdG8gdGhlIHF1ZXVlIGJlZm9yZSBjb3B5aW5nIHRvIHByZXNlcnZlIHRoZSBvcmRlclxuICAgICAgICBkZXZpY2Uuc3VibWl0KCk7XG5cbiAgICAgICAgRGVidWcudHJhY2UoVFJBQ0VJRF9SRU5ERVJfUVVFVUUsIGBXUklURS1URVg6IG1pcDoke21pcExldmVsfSBmYWNlOiR7ZmFjZX0gJHt0aGlzLnRleHR1cmUubmFtZX1gKTtcbiAgICAgICAgd2dwdS5xdWV1ZS53cml0ZVRleHR1cmUoZGVzdCwgZGF0YSwgZGF0YUxheW91dCwgc2l6ZSk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBXZWJncHVUZXh0dXJlIH07XG4iXSwibmFtZXMiOlsiZ3B1VGV4dHVyZUZvcm1hdHMiLCJQSVhFTEZPUk1BVF9BOCIsIlBJWEVMRk9STUFUX0w4IiwiUElYRUxGT1JNQVRfTEE4IiwiUElYRUxGT1JNQVRfUkdCNTY1IiwiUElYRUxGT1JNQVRfUkdCQTU1NTEiLCJQSVhFTEZPUk1BVF9SR0JBNCIsIlBJWEVMRk9STUFUX1JHQjgiLCJQSVhFTEZPUk1BVF9SR0JBOCIsIlBJWEVMRk9STUFUX0RYVDEiLCJQSVhFTEZPUk1BVF9EWFQzIiwiUElYRUxGT1JNQVRfRFhUNSIsIlBJWEVMRk9STUFUX1JHQjE2RiIsIlBJWEVMRk9STUFUX1JHQkExNkYiLCJQSVhFTEZPUk1BVF9SR0IzMkYiLCJQSVhFTEZPUk1BVF9SR0JBMzJGIiwiUElYRUxGT1JNQVRfUjMyRiIsIlBJWEVMRk9STUFUX0RFUFRIIiwiUElYRUxGT1JNQVRfREVQVEhTVEVOQ0lMIiwiUElYRUxGT1JNQVRfMTExMTEwRiIsIlBJWEVMRk9STUFUX1NSR0IiLCJQSVhFTEZPUk1BVF9TUkdCQSIsIlBJWEVMRk9STUFUX0VUQzEiLCJQSVhFTEZPUk1BVF9FVEMyX1JHQiIsIlBJWEVMRk9STUFUX0VUQzJfUkdCQSIsIlBJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCXzEiLCJQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQkFfMSIsIlBJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCXzEiLCJQSVhFTEZPUk1BVF9QVlJUQ180QlBQX1JHQkFfMSIsIlBJWEVMRk9STUFUX0FTVENfNHg0IiwiUElYRUxGT1JNQVRfQVRDX1JHQiIsIlBJWEVMRk9STUFUX0FUQ19SR0JBIiwiUElYRUxGT1JNQVRfQkdSQTgiLCJncHVBZGRyZXNzTW9kZXMiLCJBRERSRVNTX1JFUEVBVCIsIkFERFJFU1NfQ0xBTVBfVE9fRURHRSIsIkFERFJFU1NfTUlSUk9SRURfUkVQRUFUIiwiZ3B1RmlsdGVyTW9kZXMiLCJGSUxURVJfTkVBUkVTVCIsImxldmVsIiwibWlwIiwiRklMVEVSX0xJTkVBUiIsIkZJTFRFUl9ORUFSRVNUX01JUE1BUF9ORUFSRVNUIiwiRklMVEVSX05FQVJFU1RfTUlQTUFQX0xJTkVBUiIsIkZJTFRFUl9MSU5FQVJfTUlQTUFQX05FQVJFU1QiLCJGSUxURVJfTElORUFSX01JUE1BUF9MSU5FQVIiLCJXZWJncHVUZXh0dXJlIiwiY29uc3RydWN0b3IiLCJ0ZXh0dXJlIiwiZ3B1VGV4dHVyZSIsInZpZXciLCJzYW1wbGVycyIsImRlc2NyIiwiZm9ybWF0IiwiRGVidWciLCJhc3NlcnQiLCJuYW1lIiwiY3JlYXRlIiwiZGV2aWNlIiwid2dwdSIsIm1pcExldmVsQ291bnQiLCJyZXF1aXJlZE1pcExldmVscyIsInNpemUiLCJ3aWR0aCIsImhlaWdodCIsImRlcHRoT3JBcnJheUxheWVycyIsImN1YmVtYXAiLCJzYW1wbGVDb3VudCIsImRpbWVuc2lvbiIsInZvbHVtZSIsInVzYWdlIiwiR1BVVGV4dHVyZVVzYWdlIiwiVEVYVFVSRV9CSU5ESU5HIiwiQ09QWV9EU1QiLCJSRU5ERVJfQVRUQUNITUVOVCIsIkNPUFlfU1JDIiwiV2ViZ3B1RGVidWciLCJ2YWxpZGF0ZSIsImNyZWF0ZVRleHR1cmUiLCJEZWJ1Z0hlbHBlciIsInNldExhYmVsIiwiZW5kIiwidmlld0Rlc2NyIiwiYXNwZWN0IiwiY3JlYXRlVmlldyIsImRlc3Ryb3kiLCJwcm9wZXJ0eUNoYW5nZWQiLCJmbGFnIiwibGVuZ3RoIiwiZ2V0VmlldyIsInVwbG9hZEltbWVkaWF0ZSIsIl9vcHRpb25zJGZvcm1hdCIsIl9vcHRpb25zJGRpbWVuc2lvbiIsIl9vcHRpb25zJGFzcGVjdCIsIl9vcHRpb25zJGJhc2VNaXBMZXZlbCIsIl9vcHRpb25zJG1pcExldmVsQ291biIsIl9vcHRpb25zJGJhc2VBcnJheUxheSIsIl9vcHRpb25zJGFycmF5TGF5ZXJDbyIsIm9wdGlvbnMiLCJ0ZXh0dXJlRGVzY3IiLCJkZWZhdWx0Vmlld0RpbWVuc2lvbiIsImJhc2VNaXBMZXZlbCIsImJhc2VBcnJheUxheWVyIiwiYXJyYXlMYXllckNvdW50IiwiSlNPTiIsInN0cmluZ2lmeSIsImdldFNhbXBsZXIiLCJzYW1wbGVUeXBlIiwic2FtcGxlciIsImxhYmVsIiwiYWRkcmVzc01vZGVVIiwiYWRkcmVzc1UiLCJhZGRyZXNzTW9kZVYiLCJhZGRyZXNzViIsImFkZHJlc3NNb2RlVyIsImFkZHJlc3NXIiwibWF4QW5pc290cm9weSIsIm1hdGgiLCJjbGFtcCIsIk1hdGgiLCJyb3VuZCIsIl9hbmlzb3Ryb3B5IiwibWF4VGV4dHVyZUFuaXNvdHJvcHkiLCJjb21wYXJlT25SZWFkIiwiU0FNUExFVFlQRV9ERVBUSCIsImNvbXBhcmUiLCJtYWdGaWx0ZXIiLCJtaW5GaWx0ZXIiLCJTQU1QTEVUWVBFX1VORklMVEVSQUJMRV9GTE9BVCIsIm1pcG1hcEZpbHRlciIsImNhbGwiLCJjcmVhdGVTYW1wbGVyIiwibG9zZUNvbnRleHQiLCJfbmVlZHNVcGxvYWQiLCJfbmVlZHNNaXBtYXBzVXBsb2FkIiwidXBsb2FkRGF0YSIsIl9sZXZlbHMiLCJhbnlVcGxvYWRzIiwibWlwTGV2ZWwiLCJtaXBPYmplY3QiLCJmYWNlIiwiZmFjZVNvdXJjZSIsImlzRXh0ZXJuYWxJbWFnZSIsInVwbG9hZEV4dGVybmFsSW1hZ2UiLCJBcnJheUJ1ZmZlciIsImlzVmlldyIsInVwbG9hZFR5cGVkQXJyYXlEYXRhIiwiZXJyb3IiLCJfdm9sdW1lIiwid2FybiIsIm1pcG1hcHMiLCJtaXBtYXBSZW5kZXJlciIsImdlbmVyYXRlIiwiaW1hZ2UiLCJJbWFnZUJpdG1hcCIsIkhUTUxWaWRlb0VsZW1lbnQiLCJIVE1MQ2FudmFzRWxlbWVudCIsIk9mZnNjcmVlbkNhbnZhcyIsInNyYyIsInNvdXJjZSIsIm9yaWdpbiIsImZsaXBZIiwiZHN0IiwiY29weVNpemUiLCJzdWJtaXQiLCJ0cmFjZSIsIlRSQUNFSURfUkVOREVSX1FVRVVFIiwicXVldWUiLCJjb3B5RXh0ZXJuYWxJbWFnZVRvVGV4dHVyZSIsImRhdGEiLCJfZm9ybWF0SW5mbyRzaXplIiwiZGVzdCIsIlRleHR1cmVVdGlscyIsImNhbGNMZXZlbERpbWVuc2lvbiIsImJ5dGVTaXplIiwiY2FsY0xldmVsR3B1U2l6ZSIsImJ5dGVMZW5ndGgiLCJmb3JtYXRJbmZvIiwicGl4ZWxGb3JtYXRJbmZvIiwiZ2V0IiwicGl4ZWxTaXplIiwiYnl0ZXNQZXJSb3ciLCJkYXRhTGF5b3V0Iiwib2Zmc2V0Iiwicm93c1BlckltYWdlIiwid3JpdGVUZXh0dXJlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7O0FBbUJBO0FBQ0EsTUFBTUEs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
