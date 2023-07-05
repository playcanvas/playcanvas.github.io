/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../core/debug.js';
import { PIXELFORMAT_SRGBA, PIXELFORMAT_SRGB, PIXELFORMAT_111110F, PIXELFORMAT_DEPTHSTENCIL, PIXELFORMAT_DEPTH, PIXELFORMAT_R32F, PIXELFORMAT_RGBA32F, PIXELFORMAT_RGB32F, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGB16F, PIXELFORMAT_ATC_RGBA, PIXELFORMAT_ATC_RGB, PIXELFORMAT_ASTC_4x4, PIXELFORMAT_ETC2_RGBA, PIXELFORMAT_ETC2_RGB, PIXELFORMAT_PVRTC_4BPP_RGBA_1, PIXELFORMAT_PVRTC_4BPP_RGB_1, PIXELFORMAT_PVRTC_2BPP_RGBA_1, PIXELFORMAT_PVRTC_2BPP_RGB_1, PIXELFORMAT_ETC1, PIXELFORMAT_DXT5, PIXELFORMAT_DXT3, PIXELFORMAT_DXT1, PIXELFORMAT_R8_G8_B8_A8, PIXELFORMAT_R8_G8_B8, PIXELFORMAT_R4_G4_B4_A4, PIXELFORMAT_R5_G5_B5_A1, PIXELFORMAT_R5_G6_B5, PIXELFORMAT_L8_A8, PIXELFORMAT_L8, PIXELFORMAT_A8 } from '../constants.js';

function downsampleImage(image, size) {
  const srcW = image.width;
  const srcH = image.height;

  if (srcW > size || srcH > size) {
    const scale = size / Math.max(srcW, srcH);
    const dstW = Math.floor(srcW * scale);
    const dstH = Math.floor(srcH * scale);
    Debug.warn(`Image dimensions larger than max supported texture size of ${size}. Resizing from ${srcW}, ${srcH} to ${dstW}, ${dstH}.`);
    const canvas = document.createElement('canvas');
    canvas.width = dstW;
    canvas.height = dstH;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0, srcW, srcH, 0, 0, dstW, dstH);
    return canvas;
  }

  return image;
}

class WebglTexture {
  constructor() {
    this._glTexture = null;
    this._glTarget = void 0;
    this._glFormat = void 0;
    this._glInternalFormat = void 0;
    this._glPixelType = void 0;
  }

  destroy(device) {
    if (this._glTexture) {
      for (let i = 0; i < device.textureUnits.length; i++) {
        const textureUnit = device.textureUnits[i];

        for (let j = 0; j < textureUnit.length; j++) {
          if (textureUnit[j] === this._glTexture) {
            textureUnit[j] = null;
          }
        }
      }

      device.gl.deleteTexture(this._glTexture);
      this._glTexture = null;
    }
  }

  loseContext() {
    this._glTexture = null;
  }

  initialize(device, texture) {
    const gl = device.gl;
    this._glTexture = gl.createTexture();
    this._glTarget = texture._cubemap ? gl.TEXTURE_CUBE_MAP : texture._volume ? gl.TEXTURE_3D : gl.TEXTURE_2D;

    switch (texture._format) {
      case PIXELFORMAT_A8:
        this._glFormat = gl.ALPHA;
        this._glInternalFormat = gl.ALPHA;
        this._glPixelType = gl.UNSIGNED_BYTE;
        break;

      case PIXELFORMAT_L8:
        this._glFormat = gl.LUMINANCE;
        this._glInternalFormat = gl.LUMINANCE;
        this._glPixelType = gl.UNSIGNED_BYTE;
        break;

      case PIXELFORMAT_L8_A8:
        this._glFormat = gl.LUMINANCE_ALPHA;
        this._glInternalFormat = gl.LUMINANCE_ALPHA;
        this._glPixelType = gl.UNSIGNED_BYTE;
        break;

      case PIXELFORMAT_R5_G6_B5:
        this._glFormat = gl.RGB;
        this._glInternalFormat = gl.RGB;
        this._glPixelType = gl.UNSIGNED_SHORT_5_6_5;
        break;

      case PIXELFORMAT_R5_G5_B5_A1:
        this._glFormat = gl.RGBA;
        this._glInternalFormat = gl.RGBA;
        this._glPixelType = gl.UNSIGNED_SHORT_5_5_5_1;
        break;

      case PIXELFORMAT_R4_G4_B4_A4:
        this._glFormat = gl.RGBA;
        this._glInternalFormat = gl.RGBA;
        this._glPixelType = gl.UNSIGNED_SHORT_4_4_4_4;
        break;

      case PIXELFORMAT_R8_G8_B8:
        this._glFormat = gl.RGB;
        this._glInternalFormat = device.webgl2 ? gl.RGB8 : gl.RGB;
        this._glPixelType = gl.UNSIGNED_BYTE;
        break;

      case PIXELFORMAT_R8_G8_B8_A8:
        this._glFormat = gl.RGBA;
        this._glInternalFormat = device.webgl2 ? gl.RGBA8 : gl.RGBA;
        this._glPixelType = gl.UNSIGNED_BYTE;
        break;

      case PIXELFORMAT_DXT1:
        this._glFormat = gl.RGB;
        this._glInternalFormat = device.extCompressedTextureS3TC.COMPRESSED_RGB_S3TC_DXT1_EXT;
        break;

      case PIXELFORMAT_DXT3:
        this._glFormat = gl.RGBA;
        this._glInternalFormat = device.extCompressedTextureS3TC.COMPRESSED_RGBA_S3TC_DXT3_EXT;
        break;

      case PIXELFORMAT_DXT5:
        this._glFormat = gl.RGBA;
        this._glInternalFormat = device.extCompressedTextureS3TC.COMPRESSED_RGBA_S3TC_DXT5_EXT;
        break;

      case PIXELFORMAT_ETC1:
        this._glFormat = gl.RGB;
        this._glInternalFormat = device.extCompressedTextureETC1.COMPRESSED_RGB_ETC1_WEBGL;
        break;

      case PIXELFORMAT_PVRTC_2BPP_RGB_1:
        this._glFormat = gl.RGB;
        this._glInternalFormat = device.extCompressedTexturePVRTC.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;
        break;

      case PIXELFORMAT_PVRTC_2BPP_RGBA_1:
        this._glFormat = gl.RGBA;
        this._glInternalFormat = device.extCompressedTexturePVRTC.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG;
        break;

      case PIXELFORMAT_PVRTC_4BPP_RGB_1:
        this._glFormat = gl.RGB;
        this._glInternalFormat = device.extCompressedTexturePVRTC.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;
        break;

      case PIXELFORMAT_PVRTC_4BPP_RGBA_1:
        this._glFormat = gl.RGBA;
        this._glInternalFormat = device.extCompressedTexturePVRTC.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;
        break;

      case PIXELFORMAT_ETC2_RGB:
        this._glFormat = gl.RGB;
        this._glInternalFormat = device.extCompressedTextureETC.COMPRESSED_RGB8_ETC2;
        break;

      case PIXELFORMAT_ETC2_RGBA:
        this._glFormat = gl.RGBA;
        this._glInternalFormat = device.extCompressedTextureETC.COMPRESSED_RGBA8_ETC2_EAC;
        break;

      case PIXELFORMAT_ASTC_4x4:
        this._glFormat = gl.RGBA;
        this._glInternalFormat = device.extCompressedTextureASTC.COMPRESSED_RGBA_ASTC_4x4_KHR;
        break;

      case PIXELFORMAT_ATC_RGB:
        this._glFormat = gl.RGB;
        this._glInternalFormat = device.extCompressedTextureATC.COMPRESSED_RGB_ATC_WEBGL;
        break;

      case PIXELFORMAT_ATC_RGBA:
        this._glFormat = gl.RGBA;
        this._glInternalFormat = device.extCompressedTextureATC.COMPRESSED_RGBA_ATC_INTERPOLATED_ALPHA_WEBGL;
        break;

      case PIXELFORMAT_RGB16F:
        this._glFormat = gl.RGB;

        if (device.webgl2) {
          this._glInternalFormat = gl.RGB16F;
          this._glPixelType = gl.HALF_FLOAT;
        } else {
          this._glInternalFormat = gl.RGB;
          this._glPixelType = device.extTextureHalfFloat.HALF_FLOAT_OES;
        }

        break;

      case PIXELFORMAT_RGBA16F:
        this._glFormat = gl.RGBA;

        if (device.webgl2) {
          this._glInternalFormat = gl.RGBA16F;
          this._glPixelType = gl.HALF_FLOAT;
        } else {
          this._glInternalFormat = gl.RGBA;
          this._glPixelType = device.extTextureHalfFloat.HALF_FLOAT_OES;
        }

        break;

      case PIXELFORMAT_RGB32F:
        this._glFormat = gl.RGB;

        if (device.webgl2) {
          this._glInternalFormat = gl.RGB32F;
        } else {
          this._glInternalFormat = gl.RGB;
        }

        this._glPixelType = gl.FLOAT;
        break;

      case PIXELFORMAT_RGBA32F:
        this._glFormat = gl.RGBA;

        if (device.webgl2) {
          this._glInternalFormat = gl.RGBA32F;
        } else {
          this._glInternalFormat = gl.RGBA;
        }

        this._glPixelType = gl.FLOAT;
        break;

      case PIXELFORMAT_R32F:
        this._glFormat = gl.RED;
        this._glInternalFormat = gl.R32F;
        this._glPixelType = gl.FLOAT;
        break;

      case PIXELFORMAT_DEPTH:
        if (device.webgl2) {
          this._glFormat = gl.DEPTH_COMPONENT;
          this._glInternalFormat = gl.DEPTH_COMPONENT32F;
          this._glPixelType = gl.FLOAT;
        } else {
          this._glFormat = gl.DEPTH_COMPONENT;
          this._glInternalFormat = gl.DEPTH_COMPONENT;
          this._glPixelType = gl.UNSIGNED_SHORT;
        }

        break;

      case PIXELFORMAT_DEPTHSTENCIL:
        this._glFormat = gl.DEPTH_STENCIL;

        if (device.webgl2) {
          this._glInternalFormat = gl.DEPTH24_STENCIL8;
          this._glPixelType = gl.UNSIGNED_INT_24_8;
        } else {
          this._glInternalFormat = gl.DEPTH_STENCIL;
          this._glPixelType = device.extDepthTexture.UNSIGNED_INT_24_8_WEBGL;
        }

        break;

      case PIXELFORMAT_111110F:
        this._glFormat = gl.RGB;
        this._glInternalFormat = gl.R11F_G11F_B10F;
        this._glPixelType = gl.UNSIGNED_INT_10F_11F_11F_REV;
        break;

      case PIXELFORMAT_SRGB:
        this._glFormat = gl.RGB;
        this._glInternalFormat = gl.SRGB8;
        this._glPixelType = gl.UNSIGNED_BYTE;
        break;

      case PIXELFORMAT_SRGBA:
        this._glFormat = gl.RGBA;
        this._glInternalFormat = gl.SRGB8_ALPHA8;
        this._glPixelType = gl.UNSIGNED_BYTE;
        break;
    }
  }

  upload(device, texture) {
    Debug.assert(texture.device, "Attempting to use a texture that has been destroyed.");
    const gl = device.gl;
    if (!texture._needsUpload && (texture._needsMipmapsUpload && texture._mipmapsUploaded || !texture.pot)) return;
    let mipLevel = 0;
    let mipObject;
    let resMult;
    const requiredMipLevels = Math.log2(Math.max(texture._width, texture._height)) + 1;

    while (texture._levels[mipLevel] || mipLevel === 0) {
      if (!texture._needsUpload && mipLevel === 0) {
        mipLevel++;
        continue;
      } else if (mipLevel && (!texture._needsMipmapsUpload || !texture._mipmaps)) {
        break;
      }

      mipObject = texture._levels[mipLevel];

      if (mipLevel === 1 && !texture._compressed && texture._levels.length < requiredMipLevels) {
        gl.generateMipmap(this._glTarget);
        texture._mipmapsUploaded = true;
      }

      if (texture._cubemap) {
        let face;

        if (device._isBrowserInterface(mipObject[0])) {
          for (face = 0; face < 6; face++) {
            if (!texture._levelsUpdated[0][face]) continue;
            let src = mipObject[face];

            if (src instanceof HTMLImageElement) {
              if (src.width > device.maxCubeMapSize || src.height > device.maxCubeMapSize) {
                src = downsampleImage(src, device.maxCubeMapSize);

                if (mipLevel === 0) {
                  texture._width = src.width;
                  texture._height = src.height;
                }
              }
            }

            device.setUnpackFlipY(false);
            device.setUnpackPremultiplyAlpha(texture._premultiplyAlpha);
            gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + face, mipLevel, this._glInternalFormat, this._glFormat, this._glPixelType, src);
          }
        } else {
          resMult = 1 / Math.pow(2, mipLevel);

          for (face = 0; face < 6; face++) {
            if (!texture._levelsUpdated[0][face]) continue;
            const texData = mipObject[face];

            if (texture._compressed) {
              gl.compressedTexImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + face, mipLevel, this._glInternalFormat, Math.max(texture._width * resMult, 1), Math.max(texture._height * resMult, 1), 0, texData);
            } else {
              device.setUnpackFlipY(false);
              device.setUnpackPremultiplyAlpha(texture._premultiplyAlpha);
              gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + face, mipLevel, this._glInternalFormat, Math.max(texture._width * resMult, 1), Math.max(texture._height * resMult, 1), 0, this._glFormat, this._glPixelType, texData);
            }
          }
        }
      } else if (texture._volume) {
        resMult = 1 / Math.pow(2, mipLevel);

        if (texture._compressed) {
          gl.compressedTexImage3D(gl.TEXTURE_3D, mipLevel, this._glInternalFormat, Math.max(texture._width * resMult, 1), Math.max(texture._height * resMult, 1), Math.max(texture._depth * resMult, 1), 0, mipObject);
        } else {
          device.setUnpackFlipY(false);
          device.setUnpackPremultiplyAlpha(texture._premultiplyAlpha);
          gl.texImage3D(gl.TEXTURE_3D, mipLevel, this._glInternalFormat, Math.max(texture._width * resMult, 1), Math.max(texture._height * resMult, 1), Math.max(texture._depth * resMult, 1), 0, this._glFormat, this._glPixelType, mipObject);
        }
      } else {
        if (device._isBrowserInterface(mipObject)) {
          if (mipObject instanceof HTMLImageElement) {
            if (mipObject.width > device.maxTextureSize || mipObject.height > device.maxTextureSize) {
              mipObject = downsampleImage(mipObject, device.maxTextureSize);

              if (mipLevel === 0) {
                texture._width = mipObject.width;
                texture._height = mipObject.height;
              }
            }
          }

          device.setUnpackFlipY(texture._flipY);
          device.setUnpackPremultiplyAlpha(texture._premultiplyAlpha);
          gl.texImage2D(gl.TEXTURE_2D, mipLevel, this._glInternalFormat, this._glFormat, this._glPixelType, mipObject);
        } else {
          resMult = 1 / Math.pow(2, mipLevel);

          if (texture._compressed) {
            gl.compressedTexImage2D(gl.TEXTURE_2D, mipLevel, this._glInternalFormat, Math.max(Math.floor(texture._width * resMult), 1), Math.max(Math.floor(texture._height * resMult), 1), 0, mipObject);
          } else {
            device.setUnpackFlipY(false);
            device.setUnpackPremultiplyAlpha(texture._premultiplyAlpha);
            gl.texImage2D(gl.TEXTURE_2D, mipLevel, this._glInternalFormat, Math.max(texture._width * resMult, 1), Math.max(texture._height * resMult, 1), 0, this._glFormat, this._glPixelType, mipObject);
          }
        }

        if (mipLevel === 0) {
          texture._mipmapsUploaded = false;
        } else {
          texture._mipmapsUploaded = true;
        }
      }

      mipLevel++;
    }

    if (texture._needsUpload) {
      if (texture._cubemap) {
        for (let i = 0; i < 6; i++) texture._levelsUpdated[0][i] = false;
      } else {
        texture._levelsUpdated[0] = false;
      }
    }

    if (!texture._compressed && texture._mipmaps && texture._needsMipmapsUpload && (texture.pot || device.webgl2) && texture._levels.length === 1) {
      gl.generateMipmap(this._glTarget);
      texture._mipmapsUploaded = true;
    }

    if (texture._gpuSize) {
      texture.adjustVramSizeTracking(device._vram, -texture._gpuSize);
    }

    texture._gpuSize = texture.gpuSize;
    texture.adjustVramSizeTracking(device._vram, texture._gpuSize);
  }

}

export { WebglTexture };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViZ2wtdGV4dHVyZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2dyYXBoaWNzL3dlYmdsL3dlYmdsLXRleHR1cmUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcblxuaW1wb3J0IHtcbiAgICBQSVhFTEZPUk1BVF9BOCwgUElYRUxGT1JNQVRfTDgsIFBJWEVMRk9STUFUX0w4X0E4LCBQSVhFTEZPUk1BVF9SNV9HNl9CNSwgUElYRUxGT1JNQVRfUjVfRzVfQjVfQTEsIFBJWEVMRk9STUFUX1I0X0c0X0I0X0E0LFxuICAgIFBJWEVMRk9STUFUX1I4X0c4X0I4LCBQSVhFTEZPUk1BVF9SOF9HOF9COF9BOCwgUElYRUxGT1JNQVRfRFhUMSwgUElYRUxGT1JNQVRfRFhUMywgUElYRUxGT1JNQVRfRFhUNSxcbiAgICBQSVhFTEZPUk1BVF9SR0IxNkYsIFBJWEVMRk9STUFUX1JHQkExNkYsIFBJWEVMRk9STUFUX1JHQjMyRiwgUElYRUxGT1JNQVRfUkdCQTMyRiwgUElYRUxGT1JNQVRfUjMyRiwgUElYRUxGT1JNQVRfREVQVEgsXG4gICAgUElYRUxGT1JNQVRfREVQVEhTVEVOQ0lMLCBQSVhFTEZPUk1BVF8xMTExMTBGLCBQSVhFTEZPUk1BVF9TUkdCLCBQSVhFTEZPUk1BVF9TUkdCQSwgUElYRUxGT1JNQVRfRVRDMSxcbiAgICBQSVhFTEZPUk1BVF9FVEMyX1JHQiwgUElYRUxGT1JNQVRfRVRDMl9SR0JBLCBQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQl8xLCBQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQkFfMSxcbiAgICBQSVhFTEZPUk1BVF9QVlJUQ180QlBQX1JHQl8xLCBQSVhFTEZPUk1BVF9QVlJUQ180QlBQX1JHQkFfMSwgUElYRUxGT1JNQVRfQVNUQ180eDQsIFBJWEVMRk9STUFUX0FUQ19SR0IsXG4gICAgUElYRUxGT1JNQVRfQVRDX1JHQkFcbn0gZnJvbSAnLi4vY29uc3RhbnRzLmpzJztcblxuLyoqXG4gKiBDaGVja3MgdGhhdCBhbiBpbWFnZSdzIHdpZHRoIGFuZCBoZWlnaHQgZG8gbm90IGV4Y2VlZCB0aGUgbWF4IHRleHR1cmUgc2l6ZS4gSWYgdGhleSBkbywgaXQgd2lsbFxuICogYmUgc2NhbGVkIGRvd24gdG8gdGhhdCBtYXhpbXVtIHNpemUgYW5kIHJldHVybmVkIGFzIGEgY2FudmFzIGVsZW1lbnQuXG4gKlxuICogQHBhcmFtIHtIVE1MSW1hZ2VFbGVtZW50fSBpbWFnZSAtIFRoZSBpbWFnZSB0byBkb3duc2FtcGxlLlxuICogQHBhcmFtIHtudW1iZXJ9IHNpemUgLSBUaGUgbWF4aW11bSBhbGxvd2VkIHNpemUgb2YgdGhlIGltYWdlLlxuICogQHJldHVybnMge0hUTUxJbWFnZUVsZW1lbnR8SFRNTENhbnZhc0VsZW1lbnR9IFRoZSBkb3duc2FtcGxlZCBpbWFnZS5cbiAqIEBpZ25vcmVcbiAqL1xuZnVuY3Rpb24gZG93bnNhbXBsZUltYWdlKGltYWdlLCBzaXplKSB7XG4gICAgY29uc3Qgc3JjVyA9IGltYWdlLndpZHRoO1xuICAgIGNvbnN0IHNyY0ggPSBpbWFnZS5oZWlnaHQ7XG5cbiAgICBpZiAoKHNyY1cgPiBzaXplKSB8fCAoc3JjSCA+IHNpemUpKSB7XG4gICAgICAgIGNvbnN0IHNjYWxlID0gc2l6ZSAvIE1hdGgubWF4KHNyY1csIHNyY0gpO1xuICAgICAgICBjb25zdCBkc3RXID0gTWF0aC5mbG9vcihzcmNXICogc2NhbGUpO1xuICAgICAgICBjb25zdCBkc3RIID0gTWF0aC5mbG9vcihzcmNIICogc2NhbGUpO1xuXG4gICAgICAgIERlYnVnLndhcm4oYEltYWdlIGRpbWVuc2lvbnMgbGFyZ2VyIHRoYW4gbWF4IHN1cHBvcnRlZCB0ZXh0dXJlIHNpemUgb2YgJHtzaXplfS4gUmVzaXppbmcgZnJvbSAke3NyY1d9LCAke3NyY0h9IHRvICR7ZHN0V30sICR7ZHN0SH0uYCk7XG5cbiAgICAgICAgY29uc3QgY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY2FudmFzJyk7XG4gICAgICAgIGNhbnZhcy53aWR0aCA9IGRzdFc7XG4gICAgICAgIGNhbnZhcy5oZWlnaHQgPSBkc3RIO1xuXG4gICAgICAgIGNvbnN0IGNvbnRleHQgPSBjYW52YXMuZ2V0Q29udGV4dCgnMmQnKTtcbiAgICAgICAgY29udGV4dC5kcmF3SW1hZ2UoaW1hZ2UsIDAsIDAsIHNyY1csIHNyY0gsIDAsIDAsIGRzdFcsIGRzdEgpO1xuXG4gICAgICAgIHJldHVybiBjYW52YXM7XG4gICAgfVxuXG4gICAgcmV0dXJuIGltYWdlO1xufVxuXG4vKipcbiAqIEEgV2ViR0wgaW1wbGVtZW50YXRpb24gb2YgdGhlIFRleHR1cmUuXG4gKlxuICogQGlnbm9yZVxuICovXG5jbGFzcyBXZWJnbFRleHR1cmUge1xuICAgIF9nbFRleHR1cmUgPSBudWxsO1xuXG4gICAgX2dsVGFyZ2V0O1xuXG4gICAgX2dsRm9ybWF0O1xuXG4gICAgX2dsSW50ZXJuYWxGb3JtYXQ7XG5cbiAgICBfZ2xQaXhlbFR5cGU7XG5cbiAgICBkZXN0cm95KGRldmljZSkge1xuICAgICAgICBpZiAodGhpcy5fZ2xUZXh0dXJlKSB7XG5cbiAgICAgICAgICAgIC8vIFVwZGF0ZSBzaGFkb3dlZCB0ZXh0dXJlIHVuaXQgc3RhdGUgdG8gcmVtb3ZlIHRleHR1cmUgZnJvbSBhbnkgdW5pdHNcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZGV2aWNlLnRleHR1cmVVbml0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHRleHR1cmVVbml0ID0gZGV2aWNlLnRleHR1cmVVbml0c1tpXTtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHRleHR1cmVVbml0Lmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0ZXh0dXJlVW5pdFtqXSA9PT0gdGhpcy5fZ2xUZXh0dXJlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0ZXh0dXJlVW5pdFtqXSA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHJlbGVhc2UgV2ViR0wgdGV4dHVyZSByZXNvdXJjZVxuICAgICAgICAgICAgZGV2aWNlLmdsLmRlbGV0ZVRleHR1cmUodGhpcy5fZ2xUZXh0dXJlKTtcbiAgICAgICAgICAgIHRoaXMuX2dsVGV4dHVyZSA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBsb3NlQ29udGV4dCgpIHtcbiAgICAgICAgdGhpcy5fZ2xUZXh0dXJlID0gbnVsbDtcbiAgICB9XG5cbiAgICBpbml0aWFsaXplKGRldmljZSwgdGV4dHVyZSkge1xuXG4gICAgICAgIGNvbnN0IGdsID0gZGV2aWNlLmdsO1xuXG4gICAgICAgIHRoaXMuX2dsVGV4dHVyZSA9IGdsLmNyZWF0ZVRleHR1cmUoKTtcblxuICAgICAgICB0aGlzLl9nbFRhcmdldCA9IHRleHR1cmUuX2N1YmVtYXAgPyBnbC5URVhUVVJFX0NVQkVfTUFQIDpcbiAgICAgICAgICAgICh0ZXh0dXJlLl92b2x1bWUgPyBnbC5URVhUVVJFXzNEIDogZ2wuVEVYVFVSRV8yRCk7XG5cbiAgICAgICAgc3dpdGNoICh0ZXh0dXJlLl9mb3JtYXQpIHtcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfQTg6XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5BTFBIQTtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZ2wuQUxQSEE7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUgPSBnbC5VTlNJR05FRF9CWVRFO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9MODpcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLkxVTUlOQU5DRTtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZ2wuTFVNSU5BTkNFO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuVU5TSUdORURfQllURTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfTDhfQTg6XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5MVU1JTkFOQ0VfQUxQSEE7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLkxVTUlOQU5DRV9BTFBIQTtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbFBpeGVsVHlwZSA9IGdsLlVOU0lHTkVEX0JZVEU7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1I1X0c2X0I1OlxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuUkdCO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBnbC5SR0I7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUgPSBnbC5VTlNJR05FRF9TSE9SVF81XzZfNTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUjVfRzVfQjVfQTE6XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0JBO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBnbC5SR0JBO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuVU5TSUdORURfU0hPUlRfNV81XzVfMTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUjRfRzRfQjRfQTQ6XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0JBO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBnbC5SR0JBO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuVU5TSUdORURfU0hPUlRfNF80XzRfNDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUjhfRzhfQjg6XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0I7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGRldmljZS53ZWJnbDIgPyBnbC5SR0I4IDogZ2wuUkdCO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuVU5TSUdORURfQllURTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUjhfRzhfQjhfQTg6XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0JBO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBkZXZpY2Uud2ViZ2wyID8gZ2wuUkdCQTggOiBnbC5SR0JBO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuVU5TSUdORURfQllURTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfRFhUMTpcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQjtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZGV2aWNlLmV4dENvbXByZXNzZWRUZXh0dXJlUzNUQy5DT01QUkVTU0VEX1JHQl9TM1RDX0RYVDFfRVhUO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9EWFQzOlxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuUkdCQTtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZGV2aWNlLmV4dENvbXByZXNzZWRUZXh0dXJlUzNUQy5DT01QUkVTU0VEX1JHQkFfUzNUQ19EWFQzX0VYVDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfRFhUNTpcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQkE7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGRldmljZS5leHRDb21wcmVzc2VkVGV4dHVyZVMzVEMuQ09NUFJFU1NFRF9SR0JBX1MzVENfRFhUNV9FWFQ7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX0VUQzE6XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0I7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGRldmljZS5leHRDb21wcmVzc2VkVGV4dHVyZUVUQzEuQ09NUFJFU1NFRF9SR0JfRVRDMV9XRUJHTDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JfMTpcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQjtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZGV2aWNlLmV4dENvbXByZXNzZWRUZXh0dXJlUFZSVEMuQ09NUFJFU1NFRF9SR0JfUFZSVENfMkJQUFYxX0lNRztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JBXzE6XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0JBO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBkZXZpY2UuZXh0Q29tcHJlc3NlZFRleHR1cmVQVlJUQy5DT01QUkVTU0VEX1JHQkFfUFZSVENfMkJQUFYxX0lNRztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUFZSVENfNEJQUF9SR0JfMTpcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQjtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZGV2aWNlLmV4dENvbXByZXNzZWRUZXh0dXJlUFZSVEMuQ09NUFJFU1NFRF9SR0JfUFZSVENfNEJQUFYxX0lNRztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUFZSVENfNEJQUF9SR0JBXzE6XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0JBO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBkZXZpY2UuZXh0Q29tcHJlc3NlZFRleHR1cmVQVlJUQy5DT01QUkVTU0VEX1JHQkFfUFZSVENfNEJQUFYxX0lNRztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfRVRDMl9SR0I6XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0I7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGRldmljZS5leHRDb21wcmVzc2VkVGV4dHVyZUVUQy5DT01QUkVTU0VEX1JHQjhfRVRDMjtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfRVRDMl9SR0JBOlxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuUkdCQTtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZGV2aWNlLmV4dENvbXByZXNzZWRUZXh0dXJlRVRDLkNPTVBSRVNTRURfUkdCQThfRVRDMl9FQUM7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX0FTVENfNHg0OlxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuUkdCQTtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZGV2aWNlLmV4dENvbXByZXNzZWRUZXh0dXJlQVNUQy5DT01QUkVTU0VEX1JHQkFfQVNUQ180eDRfS0hSO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9BVENfUkdCOlxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuUkdCO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBkZXZpY2UuZXh0Q29tcHJlc3NlZFRleHR1cmVBVEMuQ09NUFJFU1NFRF9SR0JfQVRDX1dFQkdMO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9BVENfUkdCQTpcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQkE7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGRldmljZS5leHRDb21wcmVzc2VkVGV4dHVyZUFUQy5DT01QUkVTU0VEX1JHQkFfQVRDX0lOVEVSUE9MQVRFRF9BTFBIQV9XRUJHTDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUkdCMTZGOlxuICAgICAgICAgICAgICAgIC8vIGRlZmluaXRpb24gdmFyaWVzIGJldHdlZW4gV2ViR0wxIGFuZCAyXG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0I7XG4gICAgICAgICAgICAgICAgaWYgKGRldmljZS53ZWJnbDIpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLlJHQjE2RjtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUgPSBnbC5IQUxGX0ZMT0FUO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBnbC5SR0I7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZGV2aWNlLmV4dFRleHR1cmVIYWxmRmxvYXQuSEFMRl9GTE9BVF9PRVM7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9SR0JBMTZGOlxuICAgICAgICAgICAgICAgIC8vIGRlZmluaXRpb24gdmFyaWVzIGJldHdlZW4gV2ViR0wxIGFuZCAyXG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0JBO1xuICAgICAgICAgICAgICAgIGlmIChkZXZpY2Uud2ViZ2wyKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBnbC5SR0JBMTZGO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbFBpeGVsVHlwZSA9IGdsLkhBTEZfRkxPQVQ7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLlJHQkE7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZGV2aWNlLmV4dFRleHR1cmVIYWxmRmxvYXQuSEFMRl9GTE9BVF9PRVM7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9SR0IzMkY6XG4gICAgICAgICAgICAgICAgLy8gZGVmaW5pdGlvbiB2YXJpZXMgYmV0d2VlbiBXZWJHTDEgYW5kIDJcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQjtcbiAgICAgICAgICAgICAgICBpZiAoZGV2aWNlLndlYmdsMikge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZ2wuUkdCMzJGO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBnbC5SR0I7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuRkxPQVQ7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1JHQkEzMkY6XG4gICAgICAgICAgICAgICAgLy8gZGVmaW5pdGlvbiB2YXJpZXMgYmV0d2VlbiBXZWJHTDEgYW5kIDJcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQkE7XG4gICAgICAgICAgICAgICAgaWYgKGRldmljZS53ZWJnbDIpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLlJHQkEzMkY7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLlJHQkE7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuRkxPQVQ7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1IzMkY6IC8vIFdlYkdMMiBvbmx5XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SRUQ7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLlIzMkY7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUgPSBnbC5GTE9BVDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfREVQVEg6XG4gICAgICAgICAgICAgICAgaWYgKGRldmljZS53ZWJnbDIpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gbmF0aXZlIFdlYkdMMlxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLkRFUFRIX0NPTVBPTkVOVDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLkRFUFRIX0NPTVBPTkVOVDMyRjsgLy8gc2hvdWxkIGFsbG93IDE2LzI0IGJpdHM/XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuRkxPQVQ7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gdXNpbmcgV2ViR0wxIGV4dGVuc2lvblxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLkRFUFRIX0NPTVBPTkVOVDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLkRFUFRIX0NPTVBPTkVOVDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUgPSBnbC5VTlNJR05FRF9TSE9SVDsgLy8gdGhlIG9ubHkgYWNjZXB0YWJsZSB2YWx1ZT9cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX0RFUFRIU1RFTkNJTDpcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLkRFUFRIX1NURU5DSUw7XG4gICAgICAgICAgICAgICAgaWYgKGRldmljZS53ZWJnbDIpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLkRFUFRIMjRfU1RFTkNJTDg7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuVU5TSUdORURfSU5UXzI0Xzg7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLkRFUFRIX1NURU5DSUw7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZGV2aWNlLmV4dERlcHRoVGV4dHVyZS5VTlNJR05FRF9JTlRfMjRfOF9XRUJHTDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUXzExMTExMEY6IC8vIFdlYkdMMiBvbmx5XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0I7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLlIxMUZfRzExRl9CMTBGO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuVU5TSUdORURfSU5UXzEwRl8xMUZfMTFGX1JFVjtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfU1JHQjogLy8gV2ViR0wyIG9ubHlcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQjtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZ2wuU1JHQjg7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUgPSBnbC5VTlNJR05FRF9CWVRFO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9TUkdCQTogLy8gV2ViR0wyIG9ubHlcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQkE7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLlNSR0I4X0FMUEhBODtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbFBpeGVsVHlwZSA9IGdsLlVOU0lHTkVEX0JZVEU7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB1cGxvYWQoZGV2aWNlLCB0ZXh0dXJlKSB7XG5cbiAgICAgICAgRGVidWcuYXNzZXJ0KHRleHR1cmUuZGV2aWNlLCBcIkF0dGVtcHRpbmcgdG8gdXNlIGEgdGV4dHVyZSB0aGF0IGhhcyBiZWVuIGRlc3Ryb3llZC5cIik7XG4gICAgICAgIGNvbnN0IGdsID0gZGV2aWNlLmdsO1xuXG4gICAgICAgIGlmICghdGV4dHVyZS5fbmVlZHNVcGxvYWQgJiYgKCh0ZXh0dXJlLl9uZWVkc01pcG1hcHNVcGxvYWQgJiYgdGV4dHVyZS5fbWlwbWFwc1VwbG9hZGVkKSB8fCAhdGV4dHVyZS5wb3QpKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGxldCBtaXBMZXZlbCA9IDA7XG4gICAgICAgIGxldCBtaXBPYmplY3Q7XG4gICAgICAgIGxldCByZXNNdWx0O1xuXG4gICAgICAgIGNvbnN0IHJlcXVpcmVkTWlwTGV2ZWxzID0gTWF0aC5sb2cyKE1hdGgubWF4KHRleHR1cmUuX3dpZHRoLCB0ZXh0dXJlLl9oZWlnaHQpKSArIDE7XG5cbiAgICAgICAgd2hpbGUgKHRleHR1cmUuX2xldmVsc1ttaXBMZXZlbF0gfHwgbWlwTGV2ZWwgPT09IDApIHtcbiAgICAgICAgICAgIC8vIFVwbG9hZCBhbGwgZXhpc3RpbmcgbWlwIGxldmVscy4gSW5pdGlhbGl6ZSAwIG1pcCBhbnl3YXkuXG5cbiAgICAgICAgICAgIGlmICghdGV4dHVyZS5fbmVlZHNVcGxvYWQgJiYgbWlwTGV2ZWwgPT09IDApIHtcbiAgICAgICAgICAgICAgICBtaXBMZXZlbCsrO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChtaXBMZXZlbCAmJiAoIXRleHR1cmUuX25lZWRzTWlwbWFwc1VwbG9hZCB8fCAhdGV4dHVyZS5fbWlwbWFwcykpIHtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbWlwT2JqZWN0ID0gdGV4dHVyZS5fbGV2ZWxzW21pcExldmVsXTtcblxuICAgICAgICAgICAgaWYgKG1pcExldmVsID09PSAxICYmICF0ZXh0dXJlLl9jb21wcmVzc2VkICYmIHRleHR1cmUuX2xldmVscy5sZW5ndGggPCByZXF1aXJlZE1pcExldmVscykge1xuICAgICAgICAgICAgICAgIC8vIFdlIGhhdmUgbW9yZSB0aGFuIG9uZSBtaXAgbGV2ZWxzIHdlIHdhbnQgdG8gYXNzaWduLCBidXQgd2UgbmVlZCBhbGwgbWlwcyB0byBtYWtlXG4gICAgICAgICAgICAgICAgLy8gdGhlIHRleHR1cmUgY29tcGxldGUuIFRoZXJlZm9yZSBmaXJzdCBnZW5lcmF0ZSBhbGwgbWlwIGNoYWluIGZyb20gMCwgdGhlbiBhc3NpZ24gY3VzdG9tIG1pcHMuXG4gICAgICAgICAgICAgICAgLy8gKHRoaXMgaW1wbGllcyB0aGUgY2FsbCB0byBfY29tcGxldGVQYXJ0aWFsTWlwTGV2ZWxzIGFib3ZlIHdhcyB1bnN1Y2Nlc3NmdWwpXG4gICAgICAgICAgICAgICAgZ2wuZ2VuZXJhdGVNaXBtYXAodGhpcy5fZ2xUYXJnZXQpO1xuICAgICAgICAgICAgICAgIHRleHR1cmUuX21pcG1hcHNVcGxvYWRlZCA9IHRydWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0ZXh0dXJlLl9jdWJlbWFwKSB7XG4gICAgICAgICAgICAgICAgLy8gLS0tLS0gQ1VCRU1BUCAtLS0tLVxuICAgICAgICAgICAgICAgIGxldCBmYWNlO1xuXG4gICAgICAgICAgICAgICAgaWYgKGRldmljZS5faXNCcm93c2VySW50ZXJmYWNlKG1pcE9iamVjdFswXSkpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gVXBsb2FkIHRoZSBpbWFnZSwgY2FudmFzIG9yIHZpZGVvXG4gICAgICAgICAgICAgICAgICAgIGZvciAoZmFjZSA9IDA7IGZhY2UgPCA2OyBmYWNlKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghdGV4dHVyZS5fbGV2ZWxzVXBkYXRlZFswXVtmYWNlXSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHNyYyA9IG1pcE9iamVjdFtmYWNlXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIERvd25zaXplIGltYWdlcyB0aGF0IGFyZSB0b28gbGFyZ2UgdG8gYmUgdXNlZCBhcyBjdWJlIG1hcHNcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzcmMgaW5zdGFuY2VvZiBIVE1MSW1hZ2VFbGVtZW50KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNyYy53aWR0aCA+IGRldmljZS5tYXhDdWJlTWFwU2l6ZSB8fCBzcmMuaGVpZ2h0ID4gZGV2aWNlLm1heEN1YmVNYXBTaXplKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNyYyA9IGRvd25zYW1wbGVJbWFnZShzcmMsIGRldmljZS5tYXhDdWJlTWFwU2l6ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChtaXBMZXZlbCA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGV4dHVyZS5fd2lkdGggPSBzcmMud2lkdGg7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0ZXh0dXJlLl9oZWlnaHQgPSBzcmMuaGVpZ2h0O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0VW5wYWNrRmxpcFkoZmFsc2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldFVucGFja1ByZW11bHRpcGx5QWxwaGEodGV4dHVyZS5fcHJlbXVsdGlwbHlBbHBoYSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBnbC50ZXhJbWFnZTJEKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdsLlRFWFRVUkVfQ1VCRV9NQVBfUE9TSVRJVkVfWCArIGZhY2UsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWlwTGV2ZWwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbFBpeGVsVHlwZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzcmNcbiAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBVcGxvYWQgdGhlIGJ5dGUgYXJyYXlcbiAgICAgICAgICAgICAgICAgICAgcmVzTXVsdCA9IDEgLyBNYXRoLnBvdygyLCBtaXBMZXZlbCk7XG4gICAgICAgICAgICAgICAgICAgIGZvciAoZmFjZSA9IDA7IGZhY2UgPCA2OyBmYWNlKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghdGV4dHVyZS5fbGV2ZWxzVXBkYXRlZFswXVtmYWNlXSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdGV4RGF0YSA9IG1pcE9iamVjdFtmYWNlXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0ZXh0dXJlLl9jb21wcmVzc2VkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZ2wuY29tcHJlc3NlZFRleEltYWdlMkQoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdsLlRFWFRVUkVfQ1VCRV9NQVBfUE9TSVRJVkVfWCArIGZhY2UsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1pcExldmVsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLm1heCh0ZXh0dXJlLl93aWR0aCAqIHJlc011bHQsIDEpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLm1heCh0ZXh0dXJlLl9oZWlnaHQgKiByZXNNdWx0LCAxKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGV4RGF0YVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRVbnBhY2tGbGlwWShmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldFVucGFja1ByZW11bHRpcGx5QWxwaGEodGV4dHVyZS5fcHJlbXVsdGlwbHlBbHBoYSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZ2wudGV4SW1hZ2UyRChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZ2wuVEVYVFVSRV9DVUJFX01BUF9QT1NJVElWRV9YICsgZmFjZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWlwTGV2ZWwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1hdGgubWF4KHRleHR1cmUuX3dpZHRoICogcmVzTXVsdCwgMSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1hdGgubWF4KHRleHR1cmUuX2hlaWdodCAqIHJlc011bHQsIDEpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRleERhdGFcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmICh0ZXh0dXJlLl92b2x1bWUpIHtcbiAgICAgICAgICAgICAgICAvLyAtLS0tLSAzRCAtLS0tLVxuICAgICAgICAgICAgICAgIC8vIEltYWdlL2NhbnZhcy92aWRlbyBub3Qgc3VwcG9ydGVkICh5ZXQ/KVxuICAgICAgICAgICAgICAgIC8vIFVwbG9hZCB0aGUgYnl0ZSBhcnJheVxuICAgICAgICAgICAgICAgIHJlc011bHQgPSAxIC8gTWF0aC5wb3coMiwgbWlwTGV2ZWwpO1xuICAgICAgICAgICAgICAgIGlmICh0ZXh0dXJlLl9jb21wcmVzc2VkKSB7XG4gICAgICAgICAgICAgICAgICAgIGdsLmNvbXByZXNzZWRUZXhJbWFnZTNEKGdsLlRFWFRVUkVfM0QsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1pcExldmVsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLm1heCh0ZXh0dXJlLl93aWR0aCAqIHJlc011bHQsIDEpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLm1heCh0ZXh0dXJlLl9oZWlnaHQgKiByZXNNdWx0LCAxKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgTWF0aC5tYXgodGV4dHVyZS5fZGVwdGggKiByZXNNdWx0LCAxKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWlwT2JqZWN0KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0VW5wYWNrRmxpcFkoZmFsc2UpO1xuICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0VW5wYWNrUHJlbXVsdGlwbHlBbHBoYSh0ZXh0dXJlLl9wcmVtdWx0aXBseUFscGhhKTtcbiAgICAgICAgICAgICAgICAgICAgZ2wudGV4SW1hZ2UzRChnbC5URVhUVVJFXzNELFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1pcExldmVsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgTWF0aC5tYXgodGV4dHVyZS5fd2lkdGggKiByZXNNdWx0LCAxKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLm1heCh0ZXh0dXJlLl9oZWlnaHQgKiByZXNNdWx0LCAxKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLm1heCh0ZXh0dXJlLl9kZXB0aCAqIHJlc011bHQsIDEpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWlwT2JqZWN0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIC0tLS0tIDJEIC0tLS0tXG4gICAgICAgICAgICAgICAgaWYgKGRldmljZS5faXNCcm93c2VySW50ZXJmYWNlKG1pcE9iamVjdCkpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gRG93bnNpemUgaW1hZ2VzIHRoYXQgYXJlIHRvbyBsYXJnZSB0byBiZSB1c2VkIGFzIHRleHR1cmVzXG4gICAgICAgICAgICAgICAgICAgIGlmIChtaXBPYmplY3QgaW5zdGFuY2VvZiBIVE1MSW1hZ2VFbGVtZW50KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobWlwT2JqZWN0LndpZHRoID4gZGV2aWNlLm1heFRleHR1cmVTaXplIHx8IG1pcE9iamVjdC5oZWlnaHQgPiBkZXZpY2UubWF4VGV4dHVyZVNpemUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtaXBPYmplY3QgPSBkb3duc2FtcGxlSW1hZ2UobWlwT2JqZWN0LCBkZXZpY2UubWF4VGV4dHVyZVNpemUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChtaXBMZXZlbCA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0ZXh0dXJlLl93aWR0aCA9IG1pcE9iamVjdC53aWR0aDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGV4dHVyZS5faGVpZ2h0ID0gbWlwT2JqZWN0LmhlaWdodDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBVcGxvYWQgdGhlIGltYWdlLCBjYW52YXMgb3IgdmlkZW9cbiAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldFVucGFja0ZsaXBZKHRleHR1cmUuX2ZsaXBZKTtcbiAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldFVucGFja1ByZW11bHRpcGx5QWxwaGEodGV4dHVyZS5fcHJlbXVsdGlwbHlBbHBoYSk7XG4gICAgICAgICAgICAgICAgICAgIGdsLnRleEltYWdlMkQoXG4gICAgICAgICAgICAgICAgICAgICAgICBnbC5URVhUVVJFXzJELFxuICAgICAgICAgICAgICAgICAgICAgICAgbWlwTGV2ZWwsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0LFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbFBpeGVsVHlwZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1pcE9iamVjdFxuICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFVwbG9hZCB0aGUgYnl0ZSBhcnJheVxuICAgICAgICAgICAgICAgICAgICByZXNNdWx0ID0gMSAvIE1hdGgucG93KDIsIG1pcExldmVsKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRleHR1cmUuX2NvbXByZXNzZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGdsLmNvbXByZXNzZWRUZXhJbWFnZTJEKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdsLlRFWFRVUkVfMkQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWlwTGV2ZWwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLm1heChNYXRoLmZsb29yKHRleHR1cmUuX3dpZHRoICogcmVzTXVsdCksIDEpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1hdGgubWF4KE1hdGguZmxvb3IodGV4dHVyZS5faGVpZ2h0ICogcmVzTXVsdCksIDEpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWlwT2JqZWN0XG4gICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldFVucGFja0ZsaXBZKGZhbHNlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRVbnBhY2tQcmVtdWx0aXBseUFscGhhKHRleHR1cmUuX3ByZW11bHRpcGx5QWxwaGEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZ2wudGV4SW1hZ2UyRChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBnbC5URVhUVVJFXzJELFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1pcExldmVsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgTWF0aC5tYXgodGV4dHVyZS5fd2lkdGggKiByZXNNdWx0LCAxKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLm1heCh0ZXh0dXJlLl9oZWlnaHQgKiByZXNNdWx0LCAxKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1pcE9iamVjdFxuICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChtaXBMZXZlbCA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICB0ZXh0dXJlLl9taXBtYXBzVXBsb2FkZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0ZXh0dXJlLl9taXBtYXBzVXBsb2FkZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG1pcExldmVsKys7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGV4dHVyZS5fbmVlZHNVcGxvYWQpIHtcbiAgICAgICAgICAgIGlmICh0ZXh0dXJlLl9jdWJlbWFwKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCA2OyBpKyspXG4gICAgICAgICAgICAgICAgICAgIHRleHR1cmUuX2xldmVsc1VwZGF0ZWRbMF1baV0gPSBmYWxzZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGV4dHVyZS5fbGV2ZWxzVXBkYXRlZFswXSA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0ZXh0dXJlLl9jb21wcmVzc2VkICYmIHRleHR1cmUuX21pcG1hcHMgJiYgdGV4dHVyZS5fbmVlZHNNaXBtYXBzVXBsb2FkICYmICh0ZXh0dXJlLnBvdCB8fCBkZXZpY2Uud2ViZ2wyKSAmJiB0ZXh0dXJlLl9sZXZlbHMubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgICBnbC5nZW5lcmF0ZU1pcG1hcCh0aGlzLl9nbFRhcmdldCk7XG4gICAgICAgICAgICB0ZXh0dXJlLl9taXBtYXBzVXBsb2FkZWQgPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gdXBkYXRlIHZyYW0gc3RhdHNcbiAgICAgICAgaWYgKHRleHR1cmUuX2dwdVNpemUpIHtcbiAgICAgICAgICAgIHRleHR1cmUuYWRqdXN0VnJhbVNpemVUcmFja2luZyhkZXZpY2UuX3ZyYW0sIC10ZXh0dXJlLl9ncHVTaXplKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRleHR1cmUuX2dwdVNpemUgPSB0ZXh0dXJlLmdwdVNpemU7XG4gICAgICAgIHRleHR1cmUuYWRqdXN0VnJhbVNpemVUcmFja2luZyhkZXZpY2UuX3ZyYW0sIHRleHR1cmUuX2dwdVNpemUpO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgV2ViZ2xUZXh0dXJlIH07XG4iXSwibmFtZXMiOlsiZG93bnNhbXBsZUltYWdlIiwiaW1hZ2UiLCJzaXplIiwic3JjVyIsIndpZHRoIiwic3JjSCIsImhlaWdodCIsInNjYWxlIiwiTWF0aCIsIm1heCIsImRzdFciLCJmbG9vciIsImRzdEgiLCJEZWJ1ZyIsIndhcm4iLCJjYW52YXMiLCJkb2N1bWVudCIsImNyZWF0ZUVsZW1lbnQiLCJjb250ZXh0IiwiZ2V0Q29udGV4dCIsImRyYXdJbWFnZSIsIldlYmdsVGV4dHVyZSIsIl9nbFRleHR1cmUiLCJfZ2xUYXJnZXQiLCJfZ2xGb3JtYXQiLCJfZ2xJbnRlcm5hbEZvcm1hdCIsIl9nbFBpeGVsVHlwZSIsImRlc3Ryb3kiLCJkZXZpY2UiLCJpIiwidGV4dHVyZVVuaXRzIiwibGVuZ3RoIiwidGV4dHVyZVVuaXQiLCJqIiwiZ2wiLCJkZWxldGVUZXh0dXJlIiwibG9zZUNvbnRleHQiLCJpbml0aWFsaXplIiwidGV4dHVyZSIsImNyZWF0ZVRleHR1cmUiLCJfY3ViZW1hcCIsIlRFWFRVUkVfQ1VCRV9NQVAiLCJfdm9sdW1lIiwiVEVYVFVSRV8zRCIsIlRFWFRVUkVfMkQiLCJfZm9ybWF0IiwiUElYRUxGT1JNQVRfQTgiLCJBTFBIQSIsIlVOU0lHTkVEX0JZVEUiLCJQSVhFTEZPUk1BVF9MOCIsIkxVTUlOQU5DRSIsIlBJWEVMRk9STUFUX0w4X0E4IiwiTFVNSU5BTkNFX0FMUEhBIiwiUElYRUxGT1JNQVRfUjVfRzZfQjUiLCJSR0IiLCJVTlNJR05FRF9TSE9SVF81XzZfNSIsIlBJWEVMRk9STUFUX1I1X0c1X0I1X0ExIiwiUkdCQSIsIlVOU0lHTkVEX1NIT1JUXzVfNV81XzEiLCJQSVhFTEZPUk1BVF9SNF9HNF9CNF9BNCIsIlVOU0lHTkVEX1NIT1JUXzRfNF80XzQiLCJQSVhFTEZPUk1BVF9SOF9HOF9COCIsIndlYmdsMiIsIlJHQjgiLCJQSVhFTEZPUk1BVF9SOF9HOF9COF9BOCIsIlJHQkE4IiwiUElYRUxGT1JNQVRfRFhUMSIsImV4dENvbXByZXNzZWRUZXh0dXJlUzNUQyIsIkNPTVBSRVNTRURfUkdCX1MzVENfRFhUMV9FWFQiLCJQSVhFTEZPUk1BVF9EWFQzIiwiQ09NUFJFU1NFRF9SR0JBX1MzVENfRFhUM19FWFQiLCJQSVhFTEZPUk1BVF9EWFQ1IiwiQ09NUFJFU1NFRF9SR0JBX1MzVENfRFhUNV9FWFQiLCJQSVhFTEZPUk1BVF9FVEMxIiwiZXh0Q29tcHJlc3NlZFRleHR1cmVFVEMxIiwiQ09NUFJFU1NFRF9SR0JfRVRDMV9XRUJHTCIsIlBJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCXzEiLCJleHRDb21wcmVzc2VkVGV4dHVyZVBWUlRDIiwiQ09NUFJFU1NFRF9SR0JfUFZSVENfMkJQUFYxX0lNRyIsIlBJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCQV8xIiwiQ09NUFJFU1NFRF9SR0JBX1BWUlRDXzJCUFBWMV9JTUciLCJQSVhFTEZPUk1BVF9QVlJUQ180QlBQX1JHQl8xIiwiQ09NUFJFU1NFRF9SR0JfUFZSVENfNEJQUFYxX0lNRyIsIlBJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCQV8xIiwiQ09NUFJFU1NFRF9SR0JBX1BWUlRDXzRCUFBWMV9JTUciLCJQSVhFTEZPUk1BVF9FVEMyX1JHQiIsImV4dENvbXByZXNzZWRUZXh0dXJlRVRDIiwiQ09NUFJFU1NFRF9SR0I4X0VUQzIiLCJQSVhFTEZPUk1BVF9FVEMyX1JHQkEiLCJDT01QUkVTU0VEX1JHQkE4X0VUQzJfRUFDIiwiUElYRUxGT1JNQVRfQVNUQ180eDQiLCJleHRDb21wcmVzc2VkVGV4dHVyZUFTVEMiLCJDT01QUkVTU0VEX1JHQkFfQVNUQ180eDRfS0hSIiwiUElYRUxGT1JNQVRfQVRDX1JHQiIsImV4dENvbXByZXNzZWRUZXh0dXJlQVRDIiwiQ09NUFJFU1NFRF9SR0JfQVRDX1dFQkdMIiwiUElYRUxGT1JNQVRfQVRDX1JHQkEiLCJDT01QUkVTU0VEX1JHQkFfQVRDX0lOVEVSUE9MQVRFRF9BTFBIQV9XRUJHTCIsIlBJWEVMRk9STUFUX1JHQjE2RiIsIlJHQjE2RiIsIkhBTEZfRkxPQVQiLCJleHRUZXh0dXJlSGFsZkZsb2F0IiwiSEFMRl9GTE9BVF9PRVMiLCJQSVhFTEZPUk1BVF9SR0JBMTZGIiwiUkdCQTE2RiIsIlBJWEVMRk9STUFUX1JHQjMyRiIsIlJHQjMyRiIsIkZMT0FUIiwiUElYRUxGT1JNQVRfUkdCQTMyRiIsIlJHQkEzMkYiLCJQSVhFTEZPUk1BVF9SMzJGIiwiUkVEIiwiUjMyRiIsIlBJWEVMRk9STUFUX0RFUFRIIiwiREVQVEhfQ09NUE9ORU5UIiwiREVQVEhfQ09NUE9ORU5UMzJGIiwiVU5TSUdORURfU0hPUlQiLCJQSVhFTEZPUk1BVF9ERVBUSFNURU5DSUwiLCJERVBUSF9TVEVOQ0lMIiwiREVQVEgyNF9TVEVOQ0lMOCIsIlVOU0lHTkVEX0lOVF8yNF84IiwiZXh0RGVwdGhUZXh0dXJlIiwiVU5TSUdORURfSU5UXzI0XzhfV0VCR0wiLCJQSVhFTEZPUk1BVF8xMTExMTBGIiwiUjExRl9HMTFGX0IxMEYiLCJVTlNJR05FRF9JTlRfMTBGXzExRl8xMUZfUkVWIiwiUElYRUxGT1JNQVRfU1JHQiIsIlNSR0I4IiwiUElYRUxGT1JNQVRfU1JHQkEiLCJTUkdCOF9BTFBIQTgiLCJ1cGxvYWQiLCJhc3NlcnQiLCJfbmVlZHNVcGxvYWQiLCJfbmVlZHNNaXBtYXBzVXBsb2FkIiwiX21pcG1hcHNVcGxvYWRlZCIsInBvdCIsIm1pcExldmVsIiwibWlwT2JqZWN0IiwicmVzTXVsdCIsInJlcXVpcmVkTWlwTGV2ZWxzIiwibG9nMiIsIl93aWR0aCIsIl9oZWlnaHQiLCJfbGV2ZWxzIiwiX21pcG1hcHMiLCJfY29tcHJlc3NlZCIsImdlbmVyYXRlTWlwbWFwIiwiZmFjZSIsIl9pc0Jyb3dzZXJJbnRlcmZhY2UiLCJfbGV2ZWxzVXBkYXRlZCIsInNyYyIsIkhUTUxJbWFnZUVsZW1lbnQiLCJtYXhDdWJlTWFwU2l6ZSIsInNldFVucGFja0ZsaXBZIiwic2V0VW5wYWNrUHJlbXVsdGlwbHlBbHBoYSIsIl9wcmVtdWx0aXBseUFscGhhIiwidGV4SW1hZ2UyRCIsIlRFWFRVUkVfQ1VCRV9NQVBfUE9TSVRJVkVfWCIsInBvdyIsInRleERhdGEiLCJjb21wcmVzc2VkVGV4SW1hZ2UyRCIsImNvbXByZXNzZWRUZXhJbWFnZTNEIiwiX2RlcHRoIiwidGV4SW1hZ2UzRCIsIm1heFRleHR1cmVTaXplIiwiX2ZsaXBZIiwiX2dwdVNpemUiLCJhZGp1c3RWcmFtU2l6ZVRyYWNraW5nIiwiX3ZyYW0iLCJncHVTaXplIl0sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQXFCQSxTQUFTQSxlQUFULENBQXlCQyxLQUF6QixFQUFnQ0MsSUFBaEMsRUFBc0M7QUFDbEMsRUFBQSxNQUFNQyxJQUFJLEdBQUdGLEtBQUssQ0FBQ0csS0FBbkIsQ0FBQTtBQUNBLEVBQUEsTUFBTUMsSUFBSSxHQUFHSixLQUFLLENBQUNLLE1BQW5CLENBQUE7O0FBRUEsRUFBQSxJQUFLSCxJQUFJLEdBQUdELElBQVIsSUFBa0JHLElBQUksR0FBR0gsSUFBN0IsRUFBb0M7SUFDaEMsTUFBTUssS0FBSyxHQUFHTCxJQUFJLEdBQUdNLElBQUksQ0FBQ0MsR0FBTCxDQUFTTixJQUFULEVBQWVFLElBQWYsQ0FBckIsQ0FBQTtJQUNBLE1BQU1LLElBQUksR0FBR0YsSUFBSSxDQUFDRyxLQUFMLENBQVdSLElBQUksR0FBR0ksS0FBbEIsQ0FBYixDQUFBO0lBQ0EsTUFBTUssSUFBSSxHQUFHSixJQUFJLENBQUNHLEtBQUwsQ0FBV04sSUFBSSxHQUFHRSxLQUFsQixDQUFiLENBQUE7QUFFQU0sSUFBQUEsS0FBSyxDQUFDQyxJQUFOLENBQVksQ0FBQSwyREFBQSxFQUE2RFosSUFBSyxDQUFBLGdCQUFBLEVBQWtCQyxJQUFLLENBQUEsRUFBQSxFQUFJRSxJQUFLLENBQUEsSUFBQSxFQUFNSyxJQUFLLENBQUEsRUFBQSxFQUFJRSxJQUFLLENBQWxJ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
