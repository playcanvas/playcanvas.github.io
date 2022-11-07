/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../../core/debug.js';
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
            if (device._isImageBrowserInterface(src)) {
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
          if (device._isImageBrowserInterface(mipObject)) {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViZ2wtdGV4dHVyZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL3BsYXRmb3JtL2dyYXBoaWNzL3dlYmdsL3dlYmdsLXRleHR1cmUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi8uLi9jb3JlL2RlYnVnLmpzJztcblxuaW1wb3J0IHtcbiAgICBQSVhFTEZPUk1BVF9BOCwgUElYRUxGT1JNQVRfTDgsIFBJWEVMRk9STUFUX0w4X0E4LCBQSVhFTEZPUk1BVF9SNV9HNl9CNSwgUElYRUxGT1JNQVRfUjVfRzVfQjVfQTEsIFBJWEVMRk9STUFUX1I0X0c0X0I0X0E0LFxuICAgIFBJWEVMRk9STUFUX1I4X0c4X0I4LCBQSVhFTEZPUk1BVF9SOF9HOF9COF9BOCwgUElYRUxGT1JNQVRfRFhUMSwgUElYRUxGT1JNQVRfRFhUMywgUElYRUxGT1JNQVRfRFhUNSxcbiAgICBQSVhFTEZPUk1BVF9SR0IxNkYsIFBJWEVMRk9STUFUX1JHQkExNkYsIFBJWEVMRk9STUFUX1JHQjMyRiwgUElYRUxGT1JNQVRfUkdCQTMyRiwgUElYRUxGT1JNQVRfUjMyRiwgUElYRUxGT1JNQVRfREVQVEgsXG4gICAgUElYRUxGT1JNQVRfREVQVEhTVEVOQ0lMLCBQSVhFTEZPUk1BVF8xMTExMTBGLCBQSVhFTEZPUk1BVF9TUkdCLCBQSVhFTEZPUk1BVF9TUkdCQSwgUElYRUxGT1JNQVRfRVRDMSxcbiAgICBQSVhFTEZPUk1BVF9FVEMyX1JHQiwgUElYRUxGT1JNQVRfRVRDMl9SR0JBLCBQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQl8xLCBQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQkFfMSxcbiAgICBQSVhFTEZPUk1BVF9QVlJUQ180QlBQX1JHQl8xLCBQSVhFTEZPUk1BVF9QVlJUQ180QlBQX1JHQkFfMSwgUElYRUxGT1JNQVRfQVNUQ180eDQsIFBJWEVMRk9STUFUX0FUQ19SR0IsXG4gICAgUElYRUxGT1JNQVRfQVRDX1JHQkFcbn0gZnJvbSAnLi4vY29uc3RhbnRzLmpzJztcblxuLyoqXG4gKiBDaGVja3MgdGhhdCBhbiBpbWFnZSdzIHdpZHRoIGFuZCBoZWlnaHQgZG8gbm90IGV4Y2VlZCB0aGUgbWF4IHRleHR1cmUgc2l6ZS4gSWYgdGhleSBkbywgaXQgd2lsbFxuICogYmUgc2NhbGVkIGRvd24gdG8gdGhhdCBtYXhpbXVtIHNpemUgYW5kIHJldHVybmVkIGFzIGEgY2FudmFzIGVsZW1lbnQuXG4gKlxuICogQHBhcmFtIHtIVE1MSW1hZ2VFbGVtZW50fSBpbWFnZSAtIFRoZSBpbWFnZSB0byBkb3duc2FtcGxlLlxuICogQHBhcmFtIHtudW1iZXJ9IHNpemUgLSBUaGUgbWF4aW11bSBhbGxvd2VkIHNpemUgb2YgdGhlIGltYWdlLlxuICogQHJldHVybnMge0hUTUxJbWFnZUVsZW1lbnR8SFRNTENhbnZhc0VsZW1lbnR9IFRoZSBkb3duc2FtcGxlZCBpbWFnZS5cbiAqIEBpZ25vcmVcbiAqL1xuZnVuY3Rpb24gZG93bnNhbXBsZUltYWdlKGltYWdlLCBzaXplKSB7XG4gICAgY29uc3Qgc3JjVyA9IGltYWdlLndpZHRoO1xuICAgIGNvbnN0IHNyY0ggPSBpbWFnZS5oZWlnaHQ7XG5cbiAgICBpZiAoKHNyY1cgPiBzaXplKSB8fCAoc3JjSCA+IHNpemUpKSB7XG4gICAgICAgIGNvbnN0IHNjYWxlID0gc2l6ZSAvIE1hdGgubWF4KHNyY1csIHNyY0gpO1xuICAgICAgICBjb25zdCBkc3RXID0gTWF0aC5mbG9vcihzcmNXICogc2NhbGUpO1xuICAgICAgICBjb25zdCBkc3RIID0gTWF0aC5mbG9vcihzcmNIICogc2NhbGUpO1xuXG4gICAgICAgIERlYnVnLndhcm4oYEltYWdlIGRpbWVuc2lvbnMgbGFyZ2VyIHRoYW4gbWF4IHN1cHBvcnRlZCB0ZXh0dXJlIHNpemUgb2YgJHtzaXplfS4gUmVzaXppbmcgZnJvbSAke3NyY1d9LCAke3NyY0h9IHRvICR7ZHN0V30sICR7ZHN0SH0uYCk7XG5cbiAgICAgICAgY29uc3QgY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY2FudmFzJyk7XG4gICAgICAgIGNhbnZhcy53aWR0aCA9IGRzdFc7XG4gICAgICAgIGNhbnZhcy5oZWlnaHQgPSBkc3RIO1xuXG4gICAgICAgIGNvbnN0IGNvbnRleHQgPSBjYW52YXMuZ2V0Q29udGV4dCgnMmQnKTtcbiAgICAgICAgY29udGV4dC5kcmF3SW1hZ2UoaW1hZ2UsIDAsIDAsIHNyY1csIHNyY0gsIDAsIDAsIGRzdFcsIGRzdEgpO1xuXG4gICAgICAgIHJldHVybiBjYW52YXM7XG4gICAgfVxuXG4gICAgcmV0dXJuIGltYWdlO1xufVxuXG4vKipcbiAqIEEgV2ViR0wgaW1wbGVtZW50YXRpb24gb2YgdGhlIFRleHR1cmUuXG4gKlxuICogQGlnbm9yZVxuICovXG5jbGFzcyBXZWJnbFRleHR1cmUge1xuICAgIF9nbFRleHR1cmUgPSBudWxsO1xuXG4gICAgX2dsVGFyZ2V0O1xuXG4gICAgX2dsRm9ybWF0O1xuXG4gICAgX2dsSW50ZXJuYWxGb3JtYXQ7XG5cbiAgICBfZ2xQaXhlbFR5cGU7XG5cbiAgICBkZXN0cm95KGRldmljZSkge1xuICAgICAgICBpZiAodGhpcy5fZ2xUZXh0dXJlKSB7XG5cbiAgICAgICAgICAgIC8vIFVwZGF0ZSBzaGFkb3dlZCB0ZXh0dXJlIHVuaXQgc3RhdGUgdG8gcmVtb3ZlIHRleHR1cmUgZnJvbSBhbnkgdW5pdHNcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZGV2aWNlLnRleHR1cmVVbml0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHRleHR1cmVVbml0ID0gZGV2aWNlLnRleHR1cmVVbml0c1tpXTtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHRleHR1cmVVbml0Lmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0ZXh0dXJlVW5pdFtqXSA9PT0gdGhpcy5fZ2xUZXh0dXJlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0ZXh0dXJlVW5pdFtqXSA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHJlbGVhc2UgV2ViR0wgdGV4dHVyZSByZXNvdXJjZVxuICAgICAgICAgICAgZGV2aWNlLmdsLmRlbGV0ZVRleHR1cmUodGhpcy5fZ2xUZXh0dXJlKTtcbiAgICAgICAgICAgIHRoaXMuX2dsVGV4dHVyZSA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBsb3NlQ29udGV4dCgpIHtcbiAgICAgICAgdGhpcy5fZ2xUZXh0dXJlID0gbnVsbDtcbiAgICB9XG5cbiAgICBpbml0aWFsaXplKGRldmljZSwgdGV4dHVyZSkge1xuXG4gICAgICAgIGNvbnN0IGdsID0gZGV2aWNlLmdsO1xuXG4gICAgICAgIHRoaXMuX2dsVGV4dHVyZSA9IGdsLmNyZWF0ZVRleHR1cmUoKTtcblxuICAgICAgICB0aGlzLl9nbFRhcmdldCA9IHRleHR1cmUuX2N1YmVtYXAgPyBnbC5URVhUVVJFX0NVQkVfTUFQIDpcbiAgICAgICAgICAgICh0ZXh0dXJlLl92b2x1bWUgPyBnbC5URVhUVVJFXzNEIDogZ2wuVEVYVFVSRV8yRCk7XG5cbiAgICAgICAgc3dpdGNoICh0ZXh0dXJlLl9mb3JtYXQpIHtcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfQTg6XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5BTFBIQTtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZ2wuQUxQSEE7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUgPSBnbC5VTlNJR05FRF9CWVRFO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9MODpcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLkxVTUlOQU5DRTtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZ2wuTFVNSU5BTkNFO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuVU5TSUdORURfQllURTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfTDhfQTg6XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5MVU1JTkFOQ0VfQUxQSEE7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLkxVTUlOQU5DRV9BTFBIQTtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbFBpeGVsVHlwZSA9IGdsLlVOU0lHTkVEX0JZVEU7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1I1X0c2X0I1OlxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuUkdCO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBnbC5SR0I7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUgPSBnbC5VTlNJR05FRF9TSE9SVF81XzZfNTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUjVfRzVfQjVfQTE6XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0JBO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBnbC5SR0JBO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuVU5TSUdORURfU0hPUlRfNV81XzVfMTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUjRfRzRfQjRfQTQ6XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0JBO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBnbC5SR0JBO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuVU5TSUdORURfU0hPUlRfNF80XzRfNDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUjhfRzhfQjg6XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0I7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGRldmljZS53ZWJnbDIgPyBnbC5SR0I4IDogZ2wuUkdCO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuVU5TSUdORURfQllURTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUjhfRzhfQjhfQTg6XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0JBO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBkZXZpY2Uud2ViZ2wyID8gZ2wuUkdCQTggOiBnbC5SR0JBO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuVU5TSUdORURfQllURTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfRFhUMTpcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQjtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZGV2aWNlLmV4dENvbXByZXNzZWRUZXh0dXJlUzNUQy5DT01QUkVTU0VEX1JHQl9TM1RDX0RYVDFfRVhUO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9EWFQzOlxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuUkdCQTtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZGV2aWNlLmV4dENvbXByZXNzZWRUZXh0dXJlUzNUQy5DT01QUkVTU0VEX1JHQkFfUzNUQ19EWFQzX0VYVDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfRFhUNTpcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQkE7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGRldmljZS5leHRDb21wcmVzc2VkVGV4dHVyZVMzVEMuQ09NUFJFU1NFRF9SR0JBX1MzVENfRFhUNV9FWFQ7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX0VUQzE6XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0I7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGRldmljZS5leHRDb21wcmVzc2VkVGV4dHVyZUVUQzEuQ09NUFJFU1NFRF9SR0JfRVRDMV9XRUJHTDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JfMTpcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQjtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZGV2aWNlLmV4dENvbXByZXNzZWRUZXh0dXJlUFZSVEMuQ09NUFJFU1NFRF9SR0JfUFZSVENfMkJQUFYxX0lNRztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JBXzE6XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0JBO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBkZXZpY2UuZXh0Q29tcHJlc3NlZFRleHR1cmVQVlJUQy5DT01QUkVTU0VEX1JHQkFfUFZSVENfMkJQUFYxX0lNRztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUFZSVENfNEJQUF9SR0JfMTpcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQjtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZGV2aWNlLmV4dENvbXByZXNzZWRUZXh0dXJlUFZSVEMuQ09NUFJFU1NFRF9SR0JfUFZSVENfNEJQUFYxX0lNRztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUFZSVENfNEJQUF9SR0JBXzE6XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0JBO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBkZXZpY2UuZXh0Q29tcHJlc3NlZFRleHR1cmVQVlJUQy5DT01QUkVTU0VEX1JHQkFfUFZSVENfNEJQUFYxX0lNRztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfRVRDMl9SR0I6XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0I7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGRldmljZS5leHRDb21wcmVzc2VkVGV4dHVyZUVUQy5DT01QUkVTU0VEX1JHQjhfRVRDMjtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfRVRDMl9SR0JBOlxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuUkdCQTtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZGV2aWNlLmV4dENvbXByZXNzZWRUZXh0dXJlRVRDLkNPTVBSRVNTRURfUkdCQThfRVRDMl9FQUM7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX0FTVENfNHg0OlxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuUkdCQTtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZGV2aWNlLmV4dENvbXByZXNzZWRUZXh0dXJlQVNUQy5DT01QUkVTU0VEX1JHQkFfQVNUQ180eDRfS0hSO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9BVENfUkdCOlxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuUkdCO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBkZXZpY2UuZXh0Q29tcHJlc3NlZFRleHR1cmVBVEMuQ09NUFJFU1NFRF9SR0JfQVRDX1dFQkdMO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9BVENfUkdCQTpcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQkE7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGRldmljZS5leHRDb21wcmVzc2VkVGV4dHVyZUFUQy5DT01QUkVTU0VEX1JHQkFfQVRDX0lOVEVSUE9MQVRFRF9BTFBIQV9XRUJHTDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUkdCMTZGOlxuICAgICAgICAgICAgICAgIC8vIGRlZmluaXRpb24gdmFyaWVzIGJldHdlZW4gV2ViR0wxIGFuZCAyXG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0I7XG4gICAgICAgICAgICAgICAgaWYgKGRldmljZS53ZWJnbDIpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLlJHQjE2RjtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUgPSBnbC5IQUxGX0ZMT0FUO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBnbC5SR0I7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZGV2aWNlLmV4dFRleHR1cmVIYWxmRmxvYXQuSEFMRl9GTE9BVF9PRVM7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9SR0JBMTZGOlxuICAgICAgICAgICAgICAgIC8vIGRlZmluaXRpb24gdmFyaWVzIGJldHdlZW4gV2ViR0wxIGFuZCAyXG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0JBO1xuICAgICAgICAgICAgICAgIGlmIChkZXZpY2Uud2ViZ2wyKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBnbC5SR0JBMTZGO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbFBpeGVsVHlwZSA9IGdsLkhBTEZfRkxPQVQ7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLlJHQkE7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZGV2aWNlLmV4dFRleHR1cmVIYWxmRmxvYXQuSEFMRl9GTE9BVF9PRVM7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9SR0IzMkY6XG4gICAgICAgICAgICAgICAgLy8gZGVmaW5pdGlvbiB2YXJpZXMgYmV0d2VlbiBXZWJHTDEgYW5kIDJcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQjtcbiAgICAgICAgICAgICAgICBpZiAoZGV2aWNlLndlYmdsMikge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZ2wuUkdCMzJGO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBnbC5SR0I7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuRkxPQVQ7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1JHQkEzMkY6XG4gICAgICAgICAgICAgICAgLy8gZGVmaW5pdGlvbiB2YXJpZXMgYmV0d2VlbiBXZWJHTDEgYW5kIDJcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQkE7XG4gICAgICAgICAgICAgICAgaWYgKGRldmljZS53ZWJnbDIpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLlJHQkEzMkY7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLlJHQkE7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuRkxPQVQ7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1IzMkY6IC8vIFdlYkdMMiBvbmx5XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SRUQ7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLlIzMkY7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUgPSBnbC5GTE9BVDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfREVQVEg6XG4gICAgICAgICAgICAgICAgaWYgKGRldmljZS53ZWJnbDIpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gbmF0aXZlIFdlYkdMMlxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLkRFUFRIX0NPTVBPTkVOVDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLkRFUFRIX0NPTVBPTkVOVDMyRjsgLy8gc2hvdWxkIGFsbG93IDE2LzI0IGJpdHM/XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuRkxPQVQ7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gdXNpbmcgV2ViR0wxIGV4dGVuc2lvblxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLkRFUFRIX0NPTVBPTkVOVDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLkRFUFRIX0NPTVBPTkVOVDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUgPSBnbC5VTlNJR05FRF9TSE9SVDsgLy8gdGhlIG9ubHkgYWNjZXB0YWJsZSB2YWx1ZT9cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX0RFUFRIU1RFTkNJTDpcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLkRFUFRIX1NURU5DSUw7XG4gICAgICAgICAgICAgICAgaWYgKGRldmljZS53ZWJnbDIpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLkRFUFRIMjRfU1RFTkNJTDg7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuVU5TSUdORURfSU5UXzI0Xzg7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLkRFUFRIX1NURU5DSUw7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZGV2aWNlLmV4dERlcHRoVGV4dHVyZS5VTlNJR05FRF9JTlRfMjRfOF9XRUJHTDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUXzExMTExMEY6IC8vIFdlYkdMMiBvbmx5XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0I7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLlIxMUZfRzExRl9CMTBGO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuVU5TSUdORURfSU5UXzEwRl8xMUZfMTFGX1JFVjtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfU1JHQjogLy8gV2ViR0wyIG9ubHlcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQjtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZ2wuU1JHQjg7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUgPSBnbC5VTlNJR05FRF9CWVRFO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9TUkdCQTogLy8gV2ViR0wyIG9ubHlcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQkE7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLlNSR0I4X0FMUEhBODtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbFBpeGVsVHlwZSA9IGdsLlVOU0lHTkVEX0JZVEU7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB1cGxvYWQoZGV2aWNlLCB0ZXh0dXJlKSB7XG5cbiAgICAgICAgRGVidWcuYXNzZXJ0KHRleHR1cmUuZGV2aWNlLCBcIkF0dGVtcHRpbmcgdG8gdXNlIGEgdGV4dHVyZSB0aGF0IGhhcyBiZWVuIGRlc3Ryb3llZC5cIik7XG4gICAgICAgIGNvbnN0IGdsID0gZGV2aWNlLmdsO1xuXG4gICAgICAgIGlmICghdGV4dHVyZS5fbmVlZHNVcGxvYWQgJiYgKCh0ZXh0dXJlLl9uZWVkc01pcG1hcHNVcGxvYWQgJiYgdGV4dHVyZS5fbWlwbWFwc1VwbG9hZGVkKSB8fCAhdGV4dHVyZS5wb3QpKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGxldCBtaXBMZXZlbCA9IDA7XG4gICAgICAgIGxldCBtaXBPYmplY3Q7XG4gICAgICAgIGxldCByZXNNdWx0O1xuXG4gICAgICAgIGNvbnN0IHJlcXVpcmVkTWlwTGV2ZWxzID0gTWF0aC5sb2cyKE1hdGgubWF4KHRleHR1cmUuX3dpZHRoLCB0ZXh0dXJlLl9oZWlnaHQpKSArIDE7XG5cbiAgICAgICAgd2hpbGUgKHRleHR1cmUuX2xldmVsc1ttaXBMZXZlbF0gfHwgbWlwTGV2ZWwgPT09IDApIHtcbiAgICAgICAgICAgIC8vIFVwbG9hZCBhbGwgZXhpc3RpbmcgbWlwIGxldmVscy4gSW5pdGlhbGl6ZSAwIG1pcCBhbnl3YXkuXG5cbiAgICAgICAgICAgIGlmICghdGV4dHVyZS5fbmVlZHNVcGxvYWQgJiYgbWlwTGV2ZWwgPT09IDApIHtcbiAgICAgICAgICAgICAgICBtaXBMZXZlbCsrO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChtaXBMZXZlbCAmJiAoIXRleHR1cmUuX25lZWRzTWlwbWFwc1VwbG9hZCB8fCAhdGV4dHVyZS5fbWlwbWFwcykpIHtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbWlwT2JqZWN0ID0gdGV4dHVyZS5fbGV2ZWxzW21pcExldmVsXTtcblxuICAgICAgICAgICAgaWYgKG1pcExldmVsID09PSAxICYmICF0ZXh0dXJlLl9jb21wcmVzc2VkICYmIHRleHR1cmUuX2xldmVscy5sZW5ndGggPCByZXF1aXJlZE1pcExldmVscykge1xuICAgICAgICAgICAgICAgIC8vIFdlIGhhdmUgbW9yZSB0aGFuIG9uZSBtaXAgbGV2ZWxzIHdlIHdhbnQgdG8gYXNzaWduLCBidXQgd2UgbmVlZCBhbGwgbWlwcyB0byBtYWtlXG4gICAgICAgICAgICAgICAgLy8gdGhlIHRleHR1cmUgY29tcGxldGUuIFRoZXJlZm9yZSBmaXJzdCBnZW5lcmF0ZSBhbGwgbWlwIGNoYWluIGZyb20gMCwgdGhlbiBhc3NpZ24gY3VzdG9tIG1pcHMuXG4gICAgICAgICAgICAgICAgLy8gKHRoaXMgaW1wbGllcyB0aGUgY2FsbCB0byBfY29tcGxldGVQYXJ0aWFsTWlwTGV2ZWxzIGFib3ZlIHdhcyB1bnN1Y2Nlc3NmdWwpXG4gICAgICAgICAgICAgICAgZ2wuZ2VuZXJhdGVNaXBtYXAodGhpcy5fZ2xUYXJnZXQpO1xuICAgICAgICAgICAgICAgIHRleHR1cmUuX21pcG1hcHNVcGxvYWRlZCA9IHRydWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0ZXh0dXJlLl9jdWJlbWFwKSB7XG4gICAgICAgICAgICAgICAgLy8gLS0tLS0gQ1VCRU1BUCAtLS0tLVxuICAgICAgICAgICAgICAgIGxldCBmYWNlO1xuXG4gICAgICAgICAgICAgICAgaWYgKGRldmljZS5faXNCcm93c2VySW50ZXJmYWNlKG1pcE9iamVjdFswXSkpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gVXBsb2FkIHRoZSBpbWFnZSwgY2FudmFzIG9yIHZpZGVvXG4gICAgICAgICAgICAgICAgICAgIGZvciAoZmFjZSA9IDA7IGZhY2UgPCA2OyBmYWNlKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghdGV4dHVyZS5fbGV2ZWxzVXBkYXRlZFswXVtmYWNlXSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHNyYyA9IG1pcE9iamVjdFtmYWNlXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIERvd25zaXplIGltYWdlcyB0aGF0IGFyZSB0b28gbGFyZ2UgdG8gYmUgdXNlZCBhcyBjdWJlIG1hcHNcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkZXZpY2UuX2lzSW1hZ2VCcm93c2VySW50ZXJmYWNlKHNyYykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3JjLndpZHRoID4gZGV2aWNlLm1heEN1YmVNYXBTaXplIHx8IHNyYy5oZWlnaHQgPiBkZXZpY2UubWF4Q3ViZU1hcFNpemUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3JjID0gZG93bnNhbXBsZUltYWdlKHNyYywgZGV2aWNlLm1heEN1YmVNYXBTaXplKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG1pcExldmVsID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0ZXh0dXJlLl93aWR0aCA9IHNyYy53aWR0aDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRleHR1cmUuX2hlaWdodCA9IHNyYy5oZWlnaHQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRVbnBhY2tGbGlwWShmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0VW5wYWNrUHJlbXVsdGlwbHlBbHBoYSh0ZXh0dXJlLl9wcmVtdWx0aXBseUFscGhhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGdsLnRleEltYWdlMkQoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZ2wuVEVYVFVSRV9DVUJFX01BUF9QT1NJVElWRV9YICsgZmFjZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtaXBMZXZlbCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNyY1xuICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFVwbG9hZCB0aGUgYnl0ZSBhcnJheVxuICAgICAgICAgICAgICAgICAgICByZXNNdWx0ID0gMSAvIE1hdGgucG93KDIsIG1pcExldmVsKTtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChmYWNlID0gMDsgZmFjZSA8IDY7IGZhY2UrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCF0ZXh0dXJlLl9sZXZlbHNVcGRhdGVkWzBdW2ZhY2VdKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0ZXhEYXRhID0gbWlwT2JqZWN0W2ZhY2VdO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRleHR1cmUuX2NvbXByZXNzZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBnbC5jb21wcmVzc2VkVGV4SW1hZ2UyRChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZ2wuVEVYVFVSRV9DVUJFX01BUF9QT1NJVElWRV9YICsgZmFjZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWlwTGV2ZWwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1hdGgubWF4KHRleHR1cmUuX3dpZHRoICogcmVzTXVsdCwgMSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1hdGgubWF4KHRleHR1cmUuX2hlaWdodCAqIHJlc011bHQsIDEpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0ZXhEYXRhXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldFVucGFja0ZsaXBZKGZhbHNlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0VW5wYWNrUHJlbXVsdGlwbHlBbHBoYSh0ZXh0dXJlLl9wcmVtdWx0aXBseUFscGhhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBnbC50ZXhJbWFnZTJEKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBnbC5URVhUVVJFX0NVQkVfTUFQX1BPU0lUSVZFX1ggKyBmYWNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtaXBMZXZlbCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgTWF0aC5tYXgodGV4dHVyZS5fd2lkdGggKiByZXNNdWx0LCAxKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgTWF0aC5tYXgodGV4dHVyZS5faGVpZ2h0ICogcmVzTXVsdCwgMSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbFBpeGVsVHlwZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGV4RGF0YVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRleHR1cmUuX3ZvbHVtZSkge1xuICAgICAgICAgICAgICAgIC8vIC0tLS0tIDNEIC0tLS0tXG4gICAgICAgICAgICAgICAgLy8gSW1hZ2UvY2FudmFzL3ZpZGVvIG5vdCBzdXBwb3J0ZWQgKHlldD8pXG4gICAgICAgICAgICAgICAgLy8gVXBsb2FkIHRoZSBieXRlIGFycmF5XG4gICAgICAgICAgICAgICAgcmVzTXVsdCA9IDEgLyBNYXRoLnBvdygyLCBtaXBMZXZlbCk7XG4gICAgICAgICAgICAgICAgaWYgKHRleHR1cmUuX2NvbXByZXNzZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgZ2wuY29tcHJlc3NlZFRleEltYWdlM0QoZ2wuVEVYVFVSRV8zRCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWlwTGV2ZWwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1hdGgubWF4KHRleHR1cmUuX3dpZHRoICogcmVzTXVsdCwgMSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1hdGgubWF4KHRleHR1cmUuX2hlaWdodCAqIHJlc011bHQsIDEpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLm1heCh0ZXh0dXJlLl9kZXB0aCAqIHJlc011bHQsIDEpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtaXBPYmplY3QpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRVbnBhY2tGbGlwWShmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRVbnBhY2tQcmVtdWx0aXBseUFscGhhKHRleHR1cmUuX3ByZW11bHRpcGx5QWxwaGEpO1xuICAgICAgICAgICAgICAgICAgICBnbC50ZXhJbWFnZTNEKGdsLlRFWFRVUkVfM0QsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWlwTGV2ZWwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLm1heCh0ZXh0dXJlLl93aWR0aCAqIHJlc011bHQsIDEpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1hdGgubWF4KHRleHR1cmUuX2hlaWdodCAqIHJlc011bHQsIDEpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1hdGgubWF4KHRleHR1cmUuX2RlcHRoICogcmVzTXVsdCwgMSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbFBpeGVsVHlwZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtaXBPYmplY3QpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gLS0tLS0gMkQgLS0tLS1cbiAgICAgICAgICAgICAgICBpZiAoZGV2aWNlLl9pc0Jyb3dzZXJJbnRlcmZhY2UobWlwT2JqZWN0KSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBEb3duc2l6ZSBpbWFnZXMgdGhhdCBhcmUgdG9vIGxhcmdlIHRvIGJlIHVzZWQgYXMgdGV4dHVyZXNcbiAgICAgICAgICAgICAgICAgICAgaWYgKGRldmljZS5faXNJbWFnZUJyb3dzZXJJbnRlcmZhY2UobWlwT2JqZWN0KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG1pcE9iamVjdC53aWR0aCA+IGRldmljZS5tYXhUZXh0dXJlU2l6ZSB8fCBtaXBPYmplY3QuaGVpZ2h0ID4gZGV2aWNlLm1heFRleHR1cmVTaXplKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWlwT2JqZWN0ID0gZG93bnNhbXBsZUltYWdlKG1pcE9iamVjdCwgZGV2aWNlLm1heFRleHR1cmVTaXplKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobWlwTGV2ZWwgPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGV4dHVyZS5fd2lkdGggPSBtaXBPYmplY3Qud2lkdGg7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRleHR1cmUuX2hlaWdodCA9IG1pcE9iamVjdC5oZWlnaHQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gVXBsb2FkIHRoZSBpbWFnZSwgY2FudmFzIG9yIHZpZGVvXG4gICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRVbnBhY2tGbGlwWSh0ZXh0dXJlLl9mbGlwWSk7XG4gICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRVbnBhY2tQcmVtdWx0aXBseUFscGhhKHRleHR1cmUuX3ByZW11bHRpcGx5QWxwaGEpO1xuICAgICAgICAgICAgICAgICAgICBnbC50ZXhJbWFnZTJEKFxuICAgICAgICAgICAgICAgICAgICAgICAgZ2wuVEVYVFVSRV8yRCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1pcExldmVsLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0LFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUsXG4gICAgICAgICAgICAgICAgICAgICAgICBtaXBPYmplY3RcbiAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBVcGxvYWQgdGhlIGJ5dGUgYXJyYXlcbiAgICAgICAgICAgICAgICAgICAgcmVzTXVsdCA9IDEgLyBNYXRoLnBvdygyLCBtaXBMZXZlbCk7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0ZXh0dXJlLl9jb21wcmVzc2VkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBnbC5jb21wcmVzc2VkVGV4SW1hZ2UyRChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBnbC5URVhUVVJFXzJELFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1pcExldmVsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgTWF0aC5tYXgoTWF0aC5mbG9vcih0ZXh0dXJlLl93aWR0aCAqIHJlc011bHQpLCAxKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLm1heChNYXRoLmZsb29yKHRleHR1cmUuX2hlaWdodCAqIHJlc011bHQpLCAxKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1pcE9iamVjdFxuICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRVbnBhY2tGbGlwWShmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0VW5wYWNrUHJlbXVsdGlwbHlBbHBoYSh0ZXh0dXJlLl9wcmVtdWx0aXBseUFscGhhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGdsLnRleEltYWdlMkQoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZ2wuVEVYVFVSRV8yRCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtaXBMZXZlbCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1hdGgubWF4KHRleHR1cmUuX3dpZHRoICogcmVzTXVsdCwgMSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgTWF0aC5tYXgodGV4dHVyZS5faGVpZ2h0ICogcmVzTXVsdCwgMSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbFBpeGVsVHlwZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtaXBPYmplY3RcbiAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAobWlwTGV2ZWwgPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgdGV4dHVyZS5fbWlwbWFwc1VwbG9hZGVkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGV4dHVyZS5fbWlwbWFwc1VwbG9hZGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBtaXBMZXZlbCsrO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRleHR1cmUuX25lZWRzVXBsb2FkKSB7XG4gICAgICAgICAgICBpZiAodGV4dHVyZS5fY3ViZW1hcCkge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgNjsgaSsrKVxuICAgICAgICAgICAgICAgICAgICB0ZXh0dXJlLl9sZXZlbHNVcGRhdGVkWzBdW2ldID0gZmFsc2U7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRleHR1cmUuX2xldmVsc1VwZGF0ZWRbMF0gPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGV4dHVyZS5fY29tcHJlc3NlZCAmJiB0ZXh0dXJlLl9taXBtYXBzICYmIHRleHR1cmUuX25lZWRzTWlwbWFwc1VwbG9hZCAmJiAodGV4dHVyZS5wb3QgfHwgZGV2aWNlLndlYmdsMikgJiYgdGV4dHVyZS5fbGV2ZWxzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgZ2wuZ2VuZXJhdGVNaXBtYXAodGhpcy5fZ2xUYXJnZXQpO1xuICAgICAgICAgICAgdGV4dHVyZS5fbWlwbWFwc1VwbG9hZGVkID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHVwZGF0ZSB2cmFtIHN0YXRzXG4gICAgICAgIGlmICh0ZXh0dXJlLl9ncHVTaXplKSB7XG4gICAgICAgICAgICB0ZXh0dXJlLmFkanVzdFZyYW1TaXplVHJhY2tpbmcoZGV2aWNlLl92cmFtLCAtdGV4dHVyZS5fZ3B1U2l6ZSk7XG4gICAgICAgIH1cblxuICAgICAgICB0ZXh0dXJlLl9ncHVTaXplID0gdGV4dHVyZS5ncHVTaXplO1xuICAgICAgICB0ZXh0dXJlLmFkanVzdFZyYW1TaXplVHJhY2tpbmcoZGV2aWNlLl92cmFtLCB0ZXh0dXJlLl9ncHVTaXplKTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFdlYmdsVGV4dHVyZSB9O1xuIl0sIm5hbWVzIjpbImRvd25zYW1wbGVJbWFnZSIsImltYWdlIiwic2l6ZSIsInNyY1ciLCJ3aWR0aCIsInNyY0giLCJoZWlnaHQiLCJzY2FsZSIsIk1hdGgiLCJtYXgiLCJkc3RXIiwiZmxvb3IiLCJkc3RIIiwiRGVidWciLCJ3YXJuIiwiY2FudmFzIiwiZG9jdW1lbnQiLCJjcmVhdGVFbGVtZW50IiwiY29udGV4dCIsImdldENvbnRleHQiLCJkcmF3SW1hZ2UiLCJXZWJnbFRleHR1cmUiLCJfZ2xUZXh0dXJlIiwiX2dsVGFyZ2V0IiwiX2dsRm9ybWF0IiwiX2dsSW50ZXJuYWxGb3JtYXQiLCJfZ2xQaXhlbFR5cGUiLCJkZXN0cm95IiwiZGV2aWNlIiwiaSIsInRleHR1cmVVbml0cyIsImxlbmd0aCIsInRleHR1cmVVbml0IiwiaiIsImdsIiwiZGVsZXRlVGV4dHVyZSIsImxvc2VDb250ZXh0IiwiaW5pdGlhbGl6ZSIsInRleHR1cmUiLCJjcmVhdGVUZXh0dXJlIiwiX2N1YmVtYXAiLCJURVhUVVJFX0NVQkVfTUFQIiwiX3ZvbHVtZSIsIlRFWFRVUkVfM0QiLCJURVhUVVJFXzJEIiwiX2Zvcm1hdCIsIlBJWEVMRk9STUFUX0E4IiwiQUxQSEEiLCJVTlNJR05FRF9CWVRFIiwiUElYRUxGT1JNQVRfTDgiLCJMVU1JTkFOQ0UiLCJQSVhFTEZPUk1BVF9MOF9BOCIsIkxVTUlOQU5DRV9BTFBIQSIsIlBJWEVMRk9STUFUX1I1X0c2X0I1IiwiUkdCIiwiVU5TSUdORURfU0hPUlRfNV82XzUiLCJQSVhFTEZPUk1BVF9SNV9HNV9CNV9BMSIsIlJHQkEiLCJVTlNJR05FRF9TSE9SVF81XzVfNV8xIiwiUElYRUxGT1JNQVRfUjRfRzRfQjRfQTQiLCJVTlNJR05FRF9TSE9SVF80XzRfNF80IiwiUElYRUxGT1JNQVRfUjhfRzhfQjgiLCJ3ZWJnbDIiLCJSR0I4IiwiUElYRUxGT1JNQVRfUjhfRzhfQjhfQTgiLCJSR0JBOCIsIlBJWEVMRk9STUFUX0RYVDEiLCJleHRDb21wcmVzc2VkVGV4dHVyZVMzVEMiLCJDT01QUkVTU0VEX1JHQl9TM1RDX0RYVDFfRVhUIiwiUElYRUxGT1JNQVRfRFhUMyIsIkNPTVBSRVNTRURfUkdCQV9TM1RDX0RYVDNfRVhUIiwiUElYRUxGT1JNQVRfRFhUNSIsIkNPTVBSRVNTRURfUkdCQV9TM1RDX0RYVDVfRVhUIiwiUElYRUxGT1JNQVRfRVRDMSIsImV4dENvbXByZXNzZWRUZXh0dXJlRVRDMSIsIkNPTVBSRVNTRURfUkdCX0VUQzFfV0VCR0wiLCJQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQl8xIiwiZXh0Q29tcHJlc3NlZFRleHR1cmVQVlJUQyIsIkNPTVBSRVNTRURfUkdCX1BWUlRDXzJCUFBWMV9JTUciLCJQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQkFfMSIsIkNPTVBSRVNTRURfUkdCQV9QVlJUQ18yQlBQVjFfSU1HIiwiUElYRUxGT1JNQVRfUFZSVENfNEJQUF9SR0JfMSIsIkNPTVBSRVNTRURfUkdCX1BWUlRDXzRCUFBWMV9JTUciLCJQSVhFTEZPUk1BVF9QVlJUQ180QlBQX1JHQkFfMSIsIkNPTVBSRVNTRURfUkdCQV9QVlJUQ180QlBQVjFfSU1HIiwiUElYRUxGT1JNQVRfRVRDMl9SR0IiLCJleHRDb21wcmVzc2VkVGV4dHVyZUVUQyIsIkNPTVBSRVNTRURfUkdCOF9FVEMyIiwiUElYRUxGT1JNQVRfRVRDMl9SR0JBIiwiQ09NUFJFU1NFRF9SR0JBOF9FVEMyX0VBQyIsIlBJWEVMRk9STUFUX0FTVENfNHg0IiwiZXh0Q29tcHJlc3NlZFRleHR1cmVBU1RDIiwiQ09NUFJFU1NFRF9SR0JBX0FTVENfNHg0X0tIUiIsIlBJWEVMRk9STUFUX0FUQ19SR0IiLCJleHRDb21wcmVzc2VkVGV4dHVyZUFUQyIsIkNPTVBSRVNTRURfUkdCX0FUQ19XRUJHTCIsIlBJWEVMRk9STUFUX0FUQ19SR0JBIiwiQ09NUFJFU1NFRF9SR0JBX0FUQ19JTlRFUlBPTEFURURfQUxQSEFfV0VCR0wiLCJQSVhFTEZPUk1BVF9SR0IxNkYiLCJSR0IxNkYiLCJIQUxGX0ZMT0FUIiwiZXh0VGV4dHVyZUhhbGZGbG9hdCIsIkhBTEZfRkxPQVRfT0VTIiwiUElYRUxGT1JNQVRfUkdCQTE2RiIsIlJHQkExNkYiLCJQSVhFTEZPUk1BVF9SR0IzMkYiLCJSR0IzMkYiLCJGTE9BVCIsIlBJWEVMRk9STUFUX1JHQkEzMkYiLCJSR0JBMzJGIiwiUElYRUxGT1JNQVRfUjMyRiIsIlJFRCIsIlIzMkYiLCJQSVhFTEZPUk1BVF9ERVBUSCIsIkRFUFRIX0NPTVBPTkVOVCIsIkRFUFRIX0NPTVBPTkVOVDMyRiIsIlVOU0lHTkVEX1NIT1JUIiwiUElYRUxGT1JNQVRfREVQVEhTVEVOQ0lMIiwiREVQVEhfU1RFTkNJTCIsIkRFUFRIMjRfU1RFTkNJTDgiLCJVTlNJR05FRF9JTlRfMjRfOCIsImV4dERlcHRoVGV4dHVyZSIsIlVOU0lHTkVEX0lOVF8yNF84X1dFQkdMIiwiUElYRUxGT1JNQVRfMTExMTEwRiIsIlIxMUZfRzExRl9CMTBGIiwiVU5TSUdORURfSU5UXzEwRl8xMUZfMTFGX1JFViIsIlBJWEVMRk9STUFUX1NSR0IiLCJTUkdCOCIsIlBJWEVMRk9STUFUX1NSR0JBIiwiU1JHQjhfQUxQSEE4IiwidXBsb2FkIiwiYXNzZXJ0IiwiX25lZWRzVXBsb2FkIiwiX25lZWRzTWlwbWFwc1VwbG9hZCIsIl9taXBtYXBzVXBsb2FkZWQiLCJwb3QiLCJtaXBMZXZlbCIsIm1pcE9iamVjdCIsInJlc011bHQiLCJyZXF1aXJlZE1pcExldmVscyIsImxvZzIiLCJfd2lkdGgiLCJfaGVpZ2h0IiwiX2xldmVscyIsIl9taXBtYXBzIiwiX2NvbXByZXNzZWQiLCJnZW5lcmF0ZU1pcG1hcCIsImZhY2UiLCJfaXNCcm93c2VySW50ZXJmYWNlIiwiX2xldmVsc1VwZGF0ZWQiLCJzcmMiLCJfaXNJbWFnZUJyb3dzZXJJbnRlcmZhY2UiLCJtYXhDdWJlTWFwU2l6ZSIsInNldFVucGFja0ZsaXBZIiwic2V0VW5wYWNrUHJlbXVsdGlwbHlBbHBoYSIsIl9wcmVtdWx0aXBseUFscGhhIiwidGV4SW1hZ2UyRCIsIlRFWFRVUkVfQ1VCRV9NQVBfUE9TSVRJVkVfWCIsInBvdyIsInRleERhdGEiLCJjb21wcmVzc2VkVGV4SW1hZ2UyRCIsImNvbXByZXNzZWRUZXhJbWFnZTNEIiwiX2RlcHRoIiwidGV4SW1hZ2UzRCIsIm1heFRleHR1cmVTaXplIiwiX2ZsaXBZIiwiX2dwdVNpemUiLCJhZGp1c3RWcmFtU2l6ZVRyYWNraW5nIiwiX3ZyYW0iLCJncHVTaXplIl0sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQXFCQSxTQUFTQSxlQUFlLENBQUNDLEtBQUssRUFBRUMsSUFBSSxFQUFFO0FBQ2xDLEVBQUEsTUFBTUMsSUFBSSxHQUFHRixLQUFLLENBQUNHLEtBQUssQ0FBQTtBQUN4QixFQUFBLE1BQU1DLElBQUksR0FBR0osS0FBSyxDQUFDSyxNQUFNLENBQUE7QUFFekIsRUFBQSxJQUFLSCxJQUFJLEdBQUdELElBQUksSUFBTUcsSUFBSSxHQUFHSCxJQUFLLEVBQUU7SUFDaEMsTUFBTUssS0FBSyxHQUFHTCxJQUFJLEdBQUdNLElBQUksQ0FBQ0MsR0FBRyxDQUFDTixJQUFJLEVBQUVFLElBQUksQ0FBQyxDQUFBO0lBQ3pDLE1BQU1LLElBQUksR0FBR0YsSUFBSSxDQUFDRyxLQUFLLENBQUNSLElBQUksR0FBR0ksS0FBSyxDQUFDLENBQUE7SUFDckMsTUFBTUssSUFBSSxHQUFHSixJQUFJLENBQUNHLEtBQUssQ0FBQ04sSUFBSSxHQUFHRSxLQUFLLENBQUMsQ0FBQTtBQUVyQ00sSUFBQUEsS0FBSyxDQUFDQyxJQUFJLENBQUUsQ0FBQSwyREFBQSxFQUE2RFosSUFBSyxDQUFrQkMsZ0JBQUFBLEVBQUFBLElBQUssQ0FBSUUsRUFBQUEsRUFBQUEsSUFBSyxDQUFNSyxJQUFBQSxFQUFBQSxJ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
