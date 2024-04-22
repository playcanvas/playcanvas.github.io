import { math } from '../../../core/math/math.js';
import { isCompressedPixelFormat, PIXELFORMAT_DEPTHSTENCIL, SAMPLETYPE_DEPTH, SAMPLETYPE_INT, SAMPLETYPE_UINT, SAMPLETYPE_UNFILTERABLE_FLOAT, PIXELFORMAT_RGBA32F, PIXELFORMAT_RGBA16F, isIntegerPixelFormat, pixelFormatInfo, ADDRESS_REPEAT, ADDRESS_CLAMP_TO_EDGE, ADDRESS_MIRRORED_REPEAT, FILTER_NEAREST, FILTER_LINEAR, FILTER_NEAREST_MIPMAP_NEAREST, FILTER_NEAREST_MIPMAP_LINEAR, FILTER_LINEAR_MIPMAP_NEAREST, FILTER_LINEAR_MIPMAP_LINEAR } from '../constants.js';
import { TextureUtils } from '../texture-utils.js';
import { gpuTextureFormats } from './constants.js';

const gpuAddressModes = [];
gpuAddressModes[ADDRESS_REPEAT] = 'repeat';
gpuAddressModes[ADDRESS_CLAMP_TO_EDGE] = 'clamp-to-edge';
gpuAddressModes[ADDRESS_MIRRORED_REPEAT] = 'mirror-repeat';
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
const dummyUse = thingOne => {};
class WebgpuTexture {
  constructor(texture) {
    this.gpuTexture = void 0;
    this.view = void 0;
    this.samplers = [];
    this.descr = void 0;
    this.format = void 0;
    this.texture = texture;
    this.format = gpuTextureFormats[texture.format];
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
        depthOrArrayLayers: texture.cubemap ? 6 : texture.array ? texture.arrayLength : 1
      },
      format: this.format,
      mipLevelCount: mipLevelCount,
      sampleCount: 1,
      dimension: texture.volume ? '3d' : '2d',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC | (isCompressedPixelFormat(texture.format) ? 0 : GPUTextureUsage.RENDER_ATTACHMENT) | (texture.storage ? GPUTextureUsage.STORAGE_BINDING : 0)
    };
    this.gpuTexture = wgpu.createTexture(this.descr);
    let viewDescr;
    if (this.texture.format === PIXELFORMAT_DEPTHSTENCIL) {
      viewDescr = {
        format: 'depth24plus',
        aspect: 'depth-only'
      };
    }
    this.view = this.createView(viewDescr);
  }
  destroy(device) {}
  propertyChanged(flag) {
    this.samplers.length = 0;
  }
  getView(device) {
    this.uploadImmediate(device, this.texture);
    return this.view;
  }
  createView(viewDescr) {
    var _options$format, _options$dimension, _options$aspect, _options$baseMipLevel, _options$mipLevelCoun, _options$baseArrayLay, _options$arrayLayerCo;
    const options = viewDescr != null ? viewDescr : {};
    const textureDescr = this.descr;
    const texture = this.texture;
    const defaultViewDimension = () => {
      if (texture.cubemap) return 'cube';
      if (texture.volume) return '3d';
      if (texture.array) return '2d-array';
      return '2d';
    };
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
    return view;
  }
  getSampler(device, sampleType) {
    let sampler = this.samplers[sampleType];
    if (!sampler) {
      const texture = this.texture;
      const descr = {
        addressModeU: gpuAddressModes[texture.addressU],
        addressModeV: gpuAddressModes[texture.addressV],
        addressModeW: gpuAddressModes[texture.addressW]
      };
      if (!sampleType && texture.compareOnRead) {
        sampleType = SAMPLETYPE_DEPTH;
      }
      if (sampleType === SAMPLETYPE_DEPTH || sampleType === SAMPLETYPE_INT || sampleType === SAMPLETYPE_UINT) {
        descr.compare = 'less';
        descr.magFilter = 'linear';
        descr.minFilter = 'linear';
      } else if (sampleType === SAMPLETYPE_UNFILTERABLE_FLOAT) {
        descr.magFilter = 'nearest';
        descr.minFilter = 'nearest';
        descr.mipmapFilter = 'nearest';
      } else {
        if (this.texture.format === PIXELFORMAT_RGBA32F || this.texture.format === PIXELFORMAT_DEPTHSTENCIL || this.texture.format === PIXELFORMAT_RGBA16F || isIntegerPixelFormat(this.texture.format)) {
          descr.magFilter = 'nearest';
          descr.minFilter = 'nearest';
          descr.mipmapFilter = 'nearest';
        } else {
          descr.magFilter = gpuFilterModes[texture.magFilter].level;
          descr.minFilter = gpuFilterModes[texture.minFilter].level;
          descr.mipmapFilter = gpuFilterModes[texture.minFilter].mip;
        }
      }
      const allLinear = descr.minFilter === 'linear' && descr.magFilter === 'linear' && descr.mipmapFilter === 'linear';
      descr.maxAnisotropy = allLinear ? math.clamp(Math.round(texture._anisotropy), 1, device.maxTextureAnisotropy) : 1;
      sampler = device.wgpu.createSampler(descr);
      this.samplers[sampleType] = sampler;
    }
    return sampler;
  }
  loseContext() {}
  uploadImmediate(device, texture) {
    if (texture._needsUpload || texture._needsMipmapsUpload) {
      this.uploadData(device);
      texture._needsUpload = false;
      texture._needsMipmapsUpload = false;
    }
  }
  uploadData(device) {
    const texture = this.texture;
    if (texture._levels) {
      let anyUploads = false;
      let anyLevelMissing = false;
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
                  this.uploadTypedArrayData(device, faceSource, mipLevel, face);
                  anyUploads = true;
                } else ;
              } else {
                anyLevelMissing = true;
              }
            }
          } else if (texture._volume) ; else if (texture.array) {
            if (texture.arrayLength === mipObject.length) {
              for (let index = 0; index < texture._arrayLength; index++) {
                const arraySource = mipObject[index];
                if (this.isExternalImage(arraySource)) {
                  this.uploadExternalImage(device, arraySource, mipLevel, index);
                  anyUploads = true;
                } else if (ArrayBuffer.isView(arraySource)) {
                  this.uploadTypedArrayData(device, arraySource, mipLevel, index);
                  anyUploads = true;
                } else ;
              }
            } else {
              anyLevelMissing = true;
            }
          } else {
            if (this.isExternalImage(mipObject)) {
              this.uploadExternalImage(device, mipObject, mipLevel, 0);
              anyUploads = true;
            } else if (ArrayBuffer.isView(mipObject)) {
              this.uploadTypedArrayData(device, mipObject, mipLevel, 0);
              anyUploads = true;
            } else ;
          }
        } else {
          anyLevelMissing = true;
        }
      }
      if (anyUploads && anyLevelMissing && texture.mipmaps && !isCompressedPixelFormat(texture.format)) {
        device.mipmapRenderer.generate(this);
      }
      if (texture._gpuSize) {
        texture.adjustVramSizeTracking(device._vram, -texture._gpuSize);
      }
      texture._gpuSize = texture.gpuSize;
      texture.adjustVramSizeTracking(device._vram, texture._gpuSize);
    }
  }
  isExternalImage(image) {
    return image instanceof ImageBitmap || image instanceof HTMLVideoElement || image instanceof HTMLCanvasElement || image instanceof OffscreenCanvas;
  }
  uploadExternalImage(device, image, mipLevel, index) {
    const src = {
      source: image,
      origin: [0, 0],
      flipY: false
    };
    const dst = {
      texture: this.gpuTexture,
      mipLevel: mipLevel,
      origin: [0, 0, index],
      aspect: 'all'
    };
    const copySize = {
      width: this.descr.size.width,
      height: this.descr.size.height,
      depthOrArrayLayers: 1
    };
    device.submit();
    dummyUse(image instanceof HTMLCanvasElement && image.getContext('2d'));
    device.wgpu.queue.copyExternalImageToTexture(src, dst, copySize);
  }
  uploadTypedArrayData(device, data, mipLevel, index) {
    const texture = this.texture;
    const wgpu = device.wgpu;
    const dest = {
      texture: this.gpuTexture,
      origin: [0, 0, index],
      mipLevel: mipLevel
    };
    const width = TextureUtils.calcLevelDimension(texture.width, mipLevel);
    const height = TextureUtils.calcLevelDimension(texture.height, mipLevel);
    TextureUtils.calcLevelGpuSize(width, height, 1, texture.format);
    const formatInfo = pixelFormatInfo.get(texture.format);
    let dataLayout;
    let size;
    if (formatInfo.size) {
      dataLayout = {
        offset: 0,
        bytesPerRow: formatInfo.size * width,
        rowsPerImage: height
      };
      size = {
        width: width,
        height: height
      };
    } else if (formatInfo.blockSize) {
      const blockDim = size => {
        return Math.floor((size + 3) / 4);
      };
      dataLayout = {
        offset: 0,
        bytesPerRow: formatInfo.blockSize * blockDim(width),
        rowsPerImage: blockDim(height)
      };
      size = {
        width: Math.max(4, width),
        height: Math.max(4, height)
      };
    } else ;
    device.submit();
    wgpu.queue.writeTexture(dest, data, dataLayout, size);
  }
}

export { WebgpuTexture };
