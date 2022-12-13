/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../../core/debug.js';
import { PIXELFORMAT_BGRA8, PIXELFORMAT_SRGBA, PIXELFORMAT_SRGB, PIXELFORMAT_111110F, PIXELFORMAT_DEPTHSTENCIL, PIXELFORMAT_DEPTH, PIXELFORMAT_R32F, PIXELFORMAT_RGBA32F, PIXELFORMAT_RGB32F, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGB16F, PIXELFORMAT_ATC_RGBA, PIXELFORMAT_ATC_RGB, PIXELFORMAT_ASTC_4x4, PIXELFORMAT_ETC2_RGBA, PIXELFORMAT_ETC2_RGB, PIXELFORMAT_PVRTC_4BPP_RGBA_1, PIXELFORMAT_PVRTC_4BPP_RGB_1, PIXELFORMAT_PVRTC_2BPP_RGBA_1, PIXELFORMAT_PVRTC_2BPP_RGB_1, PIXELFORMAT_ETC1, PIXELFORMAT_DXT5, PIXELFORMAT_DXT3, PIXELFORMAT_DXT1, PIXELFORMAT_RGBA8, PIXELFORMAT_RGB8, PIXELFORMAT_RGBA4, PIXELFORMAT_RGBA5551, PIXELFORMAT_RGB565, PIXELFORMAT_LA8, PIXELFORMAT_L8, PIXELFORMAT_A8 } from '../constants.js';

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
      case PIXELFORMAT_LA8:
        this._glFormat = gl.LUMINANCE_ALPHA;
        this._glInternalFormat = gl.LUMINANCE_ALPHA;
        this._glPixelType = gl.UNSIGNED_BYTE;
        break;
      case PIXELFORMAT_RGB565:
        this._glFormat = gl.RGB;
        this._glInternalFormat = gl.RGB;
        this._glPixelType = gl.UNSIGNED_SHORT_5_6_5;
        break;
      case PIXELFORMAT_RGBA5551:
        this._glFormat = gl.RGBA;
        this._glInternalFormat = gl.RGBA;
        this._glPixelType = gl.UNSIGNED_SHORT_5_5_5_1;
        break;
      case PIXELFORMAT_RGBA4:
        this._glFormat = gl.RGBA;
        this._glInternalFormat = gl.RGBA;
        this._glPixelType = gl.UNSIGNED_SHORT_4_4_4_4;
        break;
      case PIXELFORMAT_RGB8:
        this._glFormat = gl.RGB;
        this._glInternalFormat = device.webgl2 ? gl.RGB8 : gl.RGB;
        this._glPixelType = gl.UNSIGNED_BYTE;
        break;
      case PIXELFORMAT_RGBA8:
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
      case PIXELFORMAT_BGRA8:
        Debug.error("BGRA8 texture format is not supported by WebGL.");
        break;
    }
  }
  upload(device, texture) {
    Debug.assert(texture.device, "Attempting to use a texture that has been destroyed.", texture);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViZ2wtdGV4dHVyZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL3BsYXRmb3JtL2dyYXBoaWNzL3dlYmdsL3dlYmdsLXRleHR1cmUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi8uLi9jb3JlL2RlYnVnLmpzJztcblxuaW1wb3J0IHtcbiAgICBQSVhFTEZPUk1BVF9BOCwgUElYRUxGT1JNQVRfTDgsIFBJWEVMRk9STUFUX0xBOCwgUElYRUxGT1JNQVRfUkdCNTY1LCBQSVhFTEZPUk1BVF9SR0JBNTU1MSwgUElYRUxGT1JNQVRfUkdCQTQsXG4gICAgUElYRUxGT1JNQVRfUkdCOCwgUElYRUxGT1JNQVRfUkdCQTgsIFBJWEVMRk9STUFUX0RYVDEsIFBJWEVMRk9STUFUX0RYVDMsIFBJWEVMRk9STUFUX0RYVDUsXG4gICAgUElYRUxGT1JNQVRfUkdCMTZGLCBQSVhFTEZPUk1BVF9SR0JBMTZGLCBQSVhFTEZPUk1BVF9SR0IzMkYsIFBJWEVMRk9STUFUX1JHQkEzMkYsIFBJWEVMRk9STUFUX1IzMkYsIFBJWEVMRk9STUFUX0RFUFRILFxuICAgIFBJWEVMRk9STUFUX0RFUFRIU1RFTkNJTCwgUElYRUxGT1JNQVRfMTExMTEwRiwgUElYRUxGT1JNQVRfU1JHQiwgUElYRUxGT1JNQVRfU1JHQkEsIFBJWEVMRk9STUFUX0VUQzEsXG4gICAgUElYRUxGT1JNQVRfRVRDMl9SR0IsIFBJWEVMRk9STUFUX0VUQzJfUkdCQSwgUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JfMSwgUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JBXzEsXG4gICAgUElYRUxGT1JNQVRfUFZSVENfNEJQUF9SR0JfMSwgUElYRUxGT1JNQVRfUFZSVENfNEJQUF9SR0JBXzEsIFBJWEVMRk9STUFUX0FTVENfNHg0LCBQSVhFTEZPUk1BVF9BVENfUkdCLFxuICAgIFBJWEVMRk9STUFUX0FUQ19SR0JBLCBQSVhFTEZPUk1BVF9CR1JBOFxufSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuXG4vKipcbiAqIENoZWNrcyB0aGF0IGFuIGltYWdlJ3Mgd2lkdGggYW5kIGhlaWdodCBkbyBub3QgZXhjZWVkIHRoZSBtYXggdGV4dHVyZSBzaXplLiBJZiB0aGV5IGRvLCBpdCB3aWxsXG4gKiBiZSBzY2FsZWQgZG93biB0byB0aGF0IG1heGltdW0gc2l6ZSBhbmQgcmV0dXJuZWQgYXMgYSBjYW52YXMgZWxlbWVudC5cbiAqXG4gKiBAcGFyYW0ge0hUTUxJbWFnZUVsZW1lbnR9IGltYWdlIC0gVGhlIGltYWdlIHRvIGRvd25zYW1wbGUuXG4gKiBAcGFyYW0ge251bWJlcn0gc2l6ZSAtIFRoZSBtYXhpbXVtIGFsbG93ZWQgc2l6ZSBvZiB0aGUgaW1hZ2UuXG4gKiBAcmV0dXJucyB7SFRNTEltYWdlRWxlbWVudHxIVE1MQ2FudmFzRWxlbWVudH0gVGhlIGRvd25zYW1wbGVkIGltYWdlLlxuICogQGlnbm9yZVxuICovXG5mdW5jdGlvbiBkb3duc2FtcGxlSW1hZ2UoaW1hZ2UsIHNpemUpIHtcbiAgICBjb25zdCBzcmNXID0gaW1hZ2Uud2lkdGg7XG4gICAgY29uc3Qgc3JjSCA9IGltYWdlLmhlaWdodDtcblxuICAgIGlmICgoc3JjVyA+IHNpemUpIHx8IChzcmNIID4gc2l6ZSkpIHtcbiAgICAgICAgY29uc3Qgc2NhbGUgPSBzaXplIC8gTWF0aC5tYXgoc3JjVywgc3JjSCk7XG4gICAgICAgIGNvbnN0IGRzdFcgPSBNYXRoLmZsb29yKHNyY1cgKiBzY2FsZSk7XG4gICAgICAgIGNvbnN0IGRzdEggPSBNYXRoLmZsb29yKHNyY0ggKiBzY2FsZSk7XG5cbiAgICAgICAgRGVidWcud2FybihgSW1hZ2UgZGltZW5zaW9ucyBsYXJnZXIgdGhhbiBtYXggc3VwcG9ydGVkIHRleHR1cmUgc2l6ZSBvZiAke3NpemV9LiBSZXNpemluZyBmcm9tICR7c3JjV30sICR7c3JjSH0gdG8gJHtkc3RXfSwgJHtkc3RIfS5gKTtcblxuICAgICAgICBjb25zdCBjYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTtcbiAgICAgICAgY2FudmFzLndpZHRoID0gZHN0VztcbiAgICAgICAgY2FudmFzLmhlaWdodCA9IGRzdEg7XG5cbiAgICAgICAgY29uc3QgY29udGV4dCA9IGNhbnZhcy5nZXRDb250ZXh0KCcyZCcpO1xuICAgICAgICBjb250ZXh0LmRyYXdJbWFnZShpbWFnZSwgMCwgMCwgc3JjVywgc3JjSCwgMCwgMCwgZHN0VywgZHN0SCk7XG5cbiAgICAgICAgcmV0dXJuIGNhbnZhcztcbiAgICB9XG5cbiAgICByZXR1cm4gaW1hZ2U7XG59XG5cbi8qKlxuICogQSBXZWJHTCBpbXBsZW1lbnRhdGlvbiBvZiB0aGUgVGV4dHVyZS5cbiAqXG4gKiBAaWdub3JlXG4gKi9cbmNsYXNzIFdlYmdsVGV4dHVyZSB7XG4gICAgX2dsVGV4dHVyZSA9IG51bGw7XG5cbiAgICBfZ2xUYXJnZXQ7XG5cbiAgICBfZ2xGb3JtYXQ7XG5cbiAgICBfZ2xJbnRlcm5hbEZvcm1hdDtcblxuICAgIF9nbFBpeGVsVHlwZTtcblxuICAgIGRlc3Ryb3koZGV2aWNlKSB7XG4gICAgICAgIGlmICh0aGlzLl9nbFRleHR1cmUpIHtcblxuICAgICAgICAgICAgLy8gVXBkYXRlIHNoYWRvd2VkIHRleHR1cmUgdW5pdCBzdGF0ZSB0byByZW1vdmUgdGV4dHVyZSBmcm9tIGFueSB1bml0c1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkZXZpY2UudGV4dHVyZVVuaXRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdGV4dHVyZVVuaXQgPSBkZXZpY2UudGV4dHVyZVVuaXRzW2ldO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgdGV4dHVyZVVuaXQubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRleHR1cmVVbml0W2pdID09PSB0aGlzLl9nbFRleHR1cmUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRleHR1cmVVbml0W2pdID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gcmVsZWFzZSBXZWJHTCB0ZXh0dXJlIHJlc291cmNlXG4gICAgICAgICAgICBkZXZpY2UuZ2wuZGVsZXRlVGV4dHVyZSh0aGlzLl9nbFRleHR1cmUpO1xuICAgICAgICAgICAgdGhpcy5fZ2xUZXh0dXJlID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGxvc2VDb250ZXh0KCkge1xuICAgICAgICB0aGlzLl9nbFRleHR1cmUgPSBudWxsO1xuICAgIH1cblxuICAgIGluaXRpYWxpemUoZGV2aWNlLCB0ZXh0dXJlKSB7XG5cbiAgICAgICAgY29uc3QgZ2wgPSBkZXZpY2UuZ2w7XG5cbiAgICAgICAgdGhpcy5fZ2xUZXh0dXJlID0gZ2wuY3JlYXRlVGV4dHVyZSgpO1xuXG4gICAgICAgIHRoaXMuX2dsVGFyZ2V0ID0gdGV4dHVyZS5fY3ViZW1hcCA/IGdsLlRFWFRVUkVfQ1VCRV9NQVAgOlxuICAgICAgICAgICAgKHRleHR1cmUuX3ZvbHVtZSA/IGdsLlRFWFRVUkVfM0QgOiBnbC5URVhUVVJFXzJEKTtcblxuICAgICAgICBzd2l0Y2ggKHRleHR1cmUuX2Zvcm1hdCkge1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9BODpcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLkFMUEhBO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBnbC5BTFBIQTtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbFBpeGVsVHlwZSA9IGdsLlVOU0lHTkVEX0JZVEU7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX0w4OlxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuTFVNSU5BTkNFO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBnbC5MVU1JTkFOQ0U7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUgPSBnbC5VTlNJR05FRF9CWVRFO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9MQTg6XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5MVU1JTkFOQ0VfQUxQSEE7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLkxVTUlOQU5DRV9BTFBIQTtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbFBpeGVsVHlwZSA9IGdsLlVOU0lHTkVEX0JZVEU7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1JHQjU2NTpcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQjtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZ2wuUkdCO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuVU5TSUdORURfU0hPUlRfNV82XzU7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1JHQkE1NTUxOlxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuUkdCQTtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZ2wuUkdCQTtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbFBpeGVsVHlwZSA9IGdsLlVOU0lHTkVEX1NIT1JUXzVfNV81XzE7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1JHQkE0OlxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuUkdCQTtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZ2wuUkdCQTtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbFBpeGVsVHlwZSA9IGdsLlVOU0lHTkVEX1NIT1JUXzRfNF80XzQ7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1JHQjg6XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0I7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGRldmljZS53ZWJnbDIgPyBnbC5SR0I4IDogZ2wuUkdCO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuVU5TSUdORURfQllURTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUkdCQTg6XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0JBO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBkZXZpY2Uud2ViZ2wyID8gZ2wuUkdCQTggOiBnbC5SR0JBO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuVU5TSUdORURfQllURTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfRFhUMTpcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQjtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZGV2aWNlLmV4dENvbXByZXNzZWRUZXh0dXJlUzNUQy5DT01QUkVTU0VEX1JHQl9TM1RDX0RYVDFfRVhUO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9EWFQzOlxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuUkdCQTtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZGV2aWNlLmV4dENvbXByZXNzZWRUZXh0dXJlUzNUQy5DT01QUkVTU0VEX1JHQkFfUzNUQ19EWFQzX0VYVDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfRFhUNTpcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQkE7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGRldmljZS5leHRDb21wcmVzc2VkVGV4dHVyZVMzVEMuQ09NUFJFU1NFRF9SR0JBX1MzVENfRFhUNV9FWFQ7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX0VUQzE6XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0I7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGRldmljZS5leHRDb21wcmVzc2VkVGV4dHVyZUVUQzEuQ09NUFJFU1NFRF9SR0JfRVRDMV9XRUJHTDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JfMTpcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQjtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZGV2aWNlLmV4dENvbXByZXNzZWRUZXh0dXJlUFZSVEMuQ09NUFJFU1NFRF9SR0JfUFZSVENfMkJQUFYxX0lNRztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JBXzE6XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0JBO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBkZXZpY2UuZXh0Q29tcHJlc3NlZFRleHR1cmVQVlJUQy5DT01QUkVTU0VEX1JHQkFfUFZSVENfMkJQUFYxX0lNRztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUFZSVENfNEJQUF9SR0JfMTpcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQjtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZGV2aWNlLmV4dENvbXByZXNzZWRUZXh0dXJlUFZSVEMuQ09NUFJFU1NFRF9SR0JfUFZSVENfNEJQUFYxX0lNRztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUFZSVENfNEJQUF9SR0JBXzE6XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0JBO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBkZXZpY2UuZXh0Q29tcHJlc3NlZFRleHR1cmVQVlJUQy5DT01QUkVTU0VEX1JHQkFfUFZSVENfNEJQUFYxX0lNRztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfRVRDMl9SR0I6XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0I7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGRldmljZS5leHRDb21wcmVzc2VkVGV4dHVyZUVUQy5DT01QUkVTU0VEX1JHQjhfRVRDMjtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfRVRDMl9SR0JBOlxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuUkdCQTtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZGV2aWNlLmV4dENvbXByZXNzZWRUZXh0dXJlRVRDLkNPTVBSRVNTRURfUkdCQThfRVRDMl9FQUM7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX0FTVENfNHg0OlxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuUkdCQTtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZGV2aWNlLmV4dENvbXByZXNzZWRUZXh0dXJlQVNUQy5DT01QUkVTU0VEX1JHQkFfQVNUQ180eDRfS0hSO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9BVENfUkdCOlxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuUkdCO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBkZXZpY2UuZXh0Q29tcHJlc3NlZFRleHR1cmVBVEMuQ09NUFJFU1NFRF9SR0JfQVRDX1dFQkdMO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9BVENfUkdCQTpcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQkE7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGRldmljZS5leHRDb21wcmVzc2VkVGV4dHVyZUFUQy5DT01QUkVTU0VEX1JHQkFfQVRDX0lOVEVSUE9MQVRFRF9BTFBIQV9XRUJHTDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUkdCMTZGOlxuICAgICAgICAgICAgICAgIC8vIGRlZmluaXRpb24gdmFyaWVzIGJldHdlZW4gV2ViR0wxIGFuZCAyXG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0I7XG4gICAgICAgICAgICAgICAgaWYgKGRldmljZS53ZWJnbDIpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLlJHQjE2RjtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUgPSBnbC5IQUxGX0ZMT0FUO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBnbC5SR0I7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZGV2aWNlLmV4dFRleHR1cmVIYWxmRmxvYXQuSEFMRl9GTE9BVF9PRVM7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9SR0JBMTZGOlxuICAgICAgICAgICAgICAgIC8vIGRlZmluaXRpb24gdmFyaWVzIGJldHdlZW4gV2ViR0wxIGFuZCAyXG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0JBO1xuICAgICAgICAgICAgICAgIGlmIChkZXZpY2Uud2ViZ2wyKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBnbC5SR0JBMTZGO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbFBpeGVsVHlwZSA9IGdsLkhBTEZfRkxPQVQ7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLlJHQkE7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZGV2aWNlLmV4dFRleHR1cmVIYWxmRmxvYXQuSEFMRl9GTE9BVF9PRVM7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9SR0IzMkY6XG4gICAgICAgICAgICAgICAgLy8gZGVmaW5pdGlvbiB2YXJpZXMgYmV0d2VlbiBXZWJHTDEgYW5kIDJcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQjtcbiAgICAgICAgICAgICAgICBpZiAoZGV2aWNlLndlYmdsMikge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZ2wuUkdCMzJGO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBnbC5SR0I7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuRkxPQVQ7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1JHQkEzMkY6XG4gICAgICAgICAgICAgICAgLy8gZGVmaW5pdGlvbiB2YXJpZXMgYmV0d2VlbiBXZWJHTDEgYW5kIDJcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQkE7XG4gICAgICAgICAgICAgICAgaWYgKGRldmljZS53ZWJnbDIpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLlJHQkEzMkY7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLlJHQkE7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuRkxPQVQ7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1IzMkY6IC8vIFdlYkdMMiBvbmx5XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SRUQ7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLlIzMkY7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUgPSBnbC5GTE9BVDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfREVQVEg6XG4gICAgICAgICAgICAgICAgaWYgKGRldmljZS53ZWJnbDIpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gbmF0aXZlIFdlYkdMMlxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLkRFUFRIX0NPTVBPTkVOVDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLkRFUFRIX0NPTVBPTkVOVDMyRjsgLy8gc2hvdWxkIGFsbG93IDE2LzI0IGJpdHM/XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuRkxPQVQ7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gdXNpbmcgV2ViR0wxIGV4dGVuc2lvblxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLkRFUFRIX0NPTVBPTkVOVDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLkRFUFRIX0NPTVBPTkVOVDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUgPSBnbC5VTlNJR05FRF9TSE9SVDsgLy8gdGhlIG9ubHkgYWNjZXB0YWJsZSB2YWx1ZT9cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX0RFUFRIU1RFTkNJTDpcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLkRFUFRIX1NURU5DSUw7XG4gICAgICAgICAgICAgICAgaWYgKGRldmljZS53ZWJnbDIpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLkRFUFRIMjRfU1RFTkNJTDg7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuVU5TSUdORURfSU5UXzI0Xzg7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLkRFUFRIX1NURU5DSUw7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZGV2aWNlLmV4dERlcHRoVGV4dHVyZS5VTlNJR05FRF9JTlRfMjRfOF9XRUJHTDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUXzExMTExMEY6IC8vIFdlYkdMMiBvbmx5XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0I7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLlIxMUZfRzExRl9CMTBGO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuVU5TSUdORURfSU5UXzEwRl8xMUZfMTFGX1JFVjtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfU1JHQjogLy8gV2ViR0wyIG9ubHlcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQjtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZ2wuU1JHQjg7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUgPSBnbC5VTlNJR05FRF9CWVRFO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9TUkdCQTogLy8gV2ViR0wyIG9ubHlcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQkE7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLlNSR0I4X0FMUEhBODtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbFBpeGVsVHlwZSA9IGdsLlVOU0lHTkVEX0JZVEU7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX0JHUkE4OlxuICAgICAgICAgICAgICAgIERlYnVnLmVycm9yKFwiQkdSQTggdGV4dHVyZSBmb3JtYXQgaXMgbm90IHN1cHBvcnRlZCBieSBXZWJHTC5cIik7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB1cGxvYWQoZGV2aWNlLCB0ZXh0dXJlKSB7XG5cbiAgICAgICAgRGVidWcuYXNzZXJ0KHRleHR1cmUuZGV2aWNlLCBcIkF0dGVtcHRpbmcgdG8gdXNlIGEgdGV4dHVyZSB0aGF0IGhhcyBiZWVuIGRlc3Ryb3llZC5cIiwgdGV4dHVyZSk7XG4gICAgICAgIGNvbnN0IGdsID0gZGV2aWNlLmdsO1xuXG4gICAgICAgIGlmICghdGV4dHVyZS5fbmVlZHNVcGxvYWQgJiYgKCh0ZXh0dXJlLl9uZWVkc01pcG1hcHNVcGxvYWQgJiYgdGV4dHVyZS5fbWlwbWFwc1VwbG9hZGVkKSB8fCAhdGV4dHVyZS5wb3QpKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGxldCBtaXBMZXZlbCA9IDA7XG4gICAgICAgIGxldCBtaXBPYmplY3Q7XG4gICAgICAgIGxldCByZXNNdWx0O1xuXG4gICAgICAgIGNvbnN0IHJlcXVpcmVkTWlwTGV2ZWxzID0gTWF0aC5sb2cyKE1hdGgubWF4KHRleHR1cmUuX3dpZHRoLCB0ZXh0dXJlLl9oZWlnaHQpKSArIDE7XG5cbiAgICAgICAgd2hpbGUgKHRleHR1cmUuX2xldmVsc1ttaXBMZXZlbF0gfHwgbWlwTGV2ZWwgPT09IDApIHtcbiAgICAgICAgICAgIC8vIFVwbG9hZCBhbGwgZXhpc3RpbmcgbWlwIGxldmVscy4gSW5pdGlhbGl6ZSAwIG1pcCBhbnl3YXkuXG5cbiAgICAgICAgICAgIGlmICghdGV4dHVyZS5fbmVlZHNVcGxvYWQgJiYgbWlwTGV2ZWwgPT09IDApIHtcbiAgICAgICAgICAgICAgICBtaXBMZXZlbCsrO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChtaXBMZXZlbCAmJiAoIXRleHR1cmUuX25lZWRzTWlwbWFwc1VwbG9hZCB8fCAhdGV4dHVyZS5fbWlwbWFwcykpIHtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbWlwT2JqZWN0ID0gdGV4dHVyZS5fbGV2ZWxzW21pcExldmVsXTtcblxuICAgICAgICAgICAgaWYgKG1pcExldmVsID09PSAxICYmICF0ZXh0dXJlLl9jb21wcmVzc2VkICYmIHRleHR1cmUuX2xldmVscy5sZW5ndGggPCByZXF1aXJlZE1pcExldmVscykge1xuICAgICAgICAgICAgICAgIC8vIFdlIGhhdmUgbW9yZSB0aGFuIG9uZSBtaXAgbGV2ZWxzIHdlIHdhbnQgdG8gYXNzaWduLCBidXQgd2UgbmVlZCBhbGwgbWlwcyB0byBtYWtlXG4gICAgICAgICAgICAgICAgLy8gdGhlIHRleHR1cmUgY29tcGxldGUuIFRoZXJlZm9yZSBmaXJzdCBnZW5lcmF0ZSBhbGwgbWlwIGNoYWluIGZyb20gMCwgdGhlbiBhc3NpZ24gY3VzdG9tIG1pcHMuXG4gICAgICAgICAgICAgICAgLy8gKHRoaXMgaW1wbGllcyB0aGUgY2FsbCB0byBfY29tcGxldGVQYXJ0aWFsTWlwTGV2ZWxzIGFib3ZlIHdhcyB1bnN1Y2Nlc3NmdWwpXG4gICAgICAgICAgICAgICAgZ2wuZ2VuZXJhdGVNaXBtYXAodGhpcy5fZ2xUYXJnZXQpO1xuICAgICAgICAgICAgICAgIHRleHR1cmUuX21pcG1hcHNVcGxvYWRlZCA9IHRydWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0ZXh0dXJlLl9jdWJlbWFwKSB7XG4gICAgICAgICAgICAgICAgLy8gLS0tLS0gQ1VCRU1BUCAtLS0tLVxuICAgICAgICAgICAgICAgIGxldCBmYWNlO1xuXG4gICAgICAgICAgICAgICAgaWYgKGRldmljZS5faXNCcm93c2VySW50ZXJmYWNlKG1pcE9iamVjdFswXSkpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gVXBsb2FkIHRoZSBpbWFnZSwgY2FudmFzIG9yIHZpZGVvXG4gICAgICAgICAgICAgICAgICAgIGZvciAoZmFjZSA9IDA7IGZhY2UgPCA2OyBmYWNlKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghdGV4dHVyZS5fbGV2ZWxzVXBkYXRlZFswXVtmYWNlXSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHNyYyA9IG1pcE9iamVjdFtmYWNlXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIERvd25zaXplIGltYWdlcyB0aGF0IGFyZSB0b28gbGFyZ2UgdG8gYmUgdXNlZCBhcyBjdWJlIG1hcHNcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkZXZpY2UuX2lzSW1hZ2VCcm93c2VySW50ZXJmYWNlKHNyYykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3JjLndpZHRoID4gZGV2aWNlLm1heEN1YmVNYXBTaXplIHx8IHNyYy5oZWlnaHQgPiBkZXZpY2UubWF4Q3ViZU1hcFNpemUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3JjID0gZG93bnNhbXBsZUltYWdlKHNyYywgZGV2aWNlLm1heEN1YmVNYXBTaXplKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG1pcExldmVsID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0ZXh0dXJlLl93aWR0aCA9IHNyYy53aWR0aDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRleHR1cmUuX2hlaWdodCA9IHNyYy5oZWlnaHQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRVbnBhY2tGbGlwWShmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0VW5wYWNrUHJlbXVsdGlwbHlBbHBoYSh0ZXh0dXJlLl9wcmVtdWx0aXBseUFscGhhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGdsLnRleEltYWdlMkQoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZ2wuVEVYVFVSRV9DVUJFX01BUF9QT1NJVElWRV9YICsgZmFjZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtaXBMZXZlbCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNyY1xuICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFVwbG9hZCB0aGUgYnl0ZSBhcnJheVxuICAgICAgICAgICAgICAgICAgICByZXNNdWx0ID0gMSAvIE1hdGgucG93KDIsIG1pcExldmVsKTtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChmYWNlID0gMDsgZmFjZSA8IDY7IGZhY2UrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCF0ZXh0dXJlLl9sZXZlbHNVcGRhdGVkWzBdW2ZhY2VdKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0ZXhEYXRhID0gbWlwT2JqZWN0W2ZhY2VdO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRleHR1cmUuX2NvbXByZXNzZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBnbC5jb21wcmVzc2VkVGV4SW1hZ2UyRChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZ2wuVEVYVFVSRV9DVUJFX01BUF9QT1NJVElWRV9YICsgZmFjZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWlwTGV2ZWwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1hdGgubWF4KHRleHR1cmUuX3dpZHRoICogcmVzTXVsdCwgMSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1hdGgubWF4KHRleHR1cmUuX2hlaWdodCAqIHJlc011bHQsIDEpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0ZXhEYXRhXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldFVucGFja0ZsaXBZKGZhbHNlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0VW5wYWNrUHJlbXVsdGlwbHlBbHBoYSh0ZXh0dXJlLl9wcmVtdWx0aXBseUFscGhhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBnbC50ZXhJbWFnZTJEKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBnbC5URVhUVVJFX0NVQkVfTUFQX1BPU0lUSVZFX1ggKyBmYWNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtaXBMZXZlbCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgTWF0aC5tYXgodGV4dHVyZS5fd2lkdGggKiByZXNNdWx0LCAxKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgTWF0aC5tYXgodGV4dHVyZS5faGVpZ2h0ICogcmVzTXVsdCwgMSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbFBpeGVsVHlwZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGV4RGF0YVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRleHR1cmUuX3ZvbHVtZSkge1xuICAgICAgICAgICAgICAgIC8vIC0tLS0tIDNEIC0tLS0tXG4gICAgICAgICAgICAgICAgLy8gSW1hZ2UvY2FudmFzL3ZpZGVvIG5vdCBzdXBwb3J0ZWQgKHlldD8pXG4gICAgICAgICAgICAgICAgLy8gVXBsb2FkIHRoZSBieXRlIGFycmF5XG4gICAgICAgICAgICAgICAgcmVzTXVsdCA9IDEgLyBNYXRoLnBvdygyLCBtaXBMZXZlbCk7XG4gICAgICAgICAgICAgICAgaWYgKHRleHR1cmUuX2NvbXByZXNzZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgZ2wuY29tcHJlc3NlZFRleEltYWdlM0QoZ2wuVEVYVFVSRV8zRCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWlwTGV2ZWwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1hdGgubWF4KHRleHR1cmUuX3dpZHRoICogcmVzTXVsdCwgMSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1hdGgubWF4KHRleHR1cmUuX2hlaWdodCAqIHJlc011bHQsIDEpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLm1heCh0ZXh0dXJlLl9kZXB0aCAqIHJlc011bHQsIDEpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtaXBPYmplY3QpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRVbnBhY2tGbGlwWShmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRVbnBhY2tQcmVtdWx0aXBseUFscGhhKHRleHR1cmUuX3ByZW11bHRpcGx5QWxwaGEpO1xuICAgICAgICAgICAgICAgICAgICBnbC50ZXhJbWFnZTNEKGdsLlRFWFRVUkVfM0QsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWlwTGV2ZWwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLm1heCh0ZXh0dXJlLl93aWR0aCAqIHJlc011bHQsIDEpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1hdGgubWF4KHRleHR1cmUuX2hlaWdodCAqIHJlc011bHQsIDEpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1hdGgubWF4KHRleHR1cmUuX2RlcHRoICogcmVzTXVsdCwgMSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbFBpeGVsVHlwZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtaXBPYmplY3QpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gLS0tLS0gMkQgLS0tLS1cbiAgICAgICAgICAgICAgICBpZiAoZGV2aWNlLl9pc0Jyb3dzZXJJbnRlcmZhY2UobWlwT2JqZWN0KSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBEb3duc2l6ZSBpbWFnZXMgdGhhdCBhcmUgdG9vIGxhcmdlIHRvIGJlIHVzZWQgYXMgdGV4dHVyZXNcbiAgICAgICAgICAgICAgICAgICAgaWYgKGRldmljZS5faXNJbWFnZUJyb3dzZXJJbnRlcmZhY2UobWlwT2JqZWN0KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG1pcE9iamVjdC53aWR0aCA+IGRldmljZS5tYXhUZXh0dXJlU2l6ZSB8fCBtaXBPYmplY3QuaGVpZ2h0ID4gZGV2aWNlLm1heFRleHR1cmVTaXplKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWlwT2JqZWN0ID0gZG93bnNhbXBsZUltYWdlKG1pcE9iamVjdCwgZGV2aWNlLm1heFRleHR1cmVTaXplKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobWlwTGV2ZWwgPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGV4dHVyZS5fd2lkdGggPSBtaXBPYmplY3Qud2lkdGg7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRleHR1cmUuX2hlaWdodCA9IG1pcE9iamVjdC5oZWlnaHQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gVXBsb2FkIHRoZSBpbWFnZSwgY2FudmFzIG9yIHZpZGVvXG4gICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRVbnBhY2tGbGlwWSh0ZXh0dXJlLl9mbGlwWSk7XG4gICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRVbnBhY2tQcmVtdWx0aXBseUFscGhhKHRleHR1cmUuX3ByZW11bHRpcGx5QWxwaGEpO1xuICAgICAgICAgICAgICAgICAgICBnbC50ZXhJbWFnZTJEKFxuICAgICAgICAgICAgICAgICAgICAgICAgZ2wuVEVYVFVSRV8yRCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1pcExldmVsLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0LFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUsXG4gICAgICAgICAgICAgICAgICAgICAgICBtaXBPYmplY3RcbiAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBVcGxvYWQgdGhlIGJ5dGUgYXJyYXlcbiAgICAgICAgICAgICAgICAgICAgcmVzTXVsdCA9IDEgLyBNYXRoLnBvdygyLCBtaXBMZXZlbCk7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0ZXh0dXJlLl9jb21wcmVzc2VkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBnbC5jb21wcmVzc2VkVGV4SW1hZ2UyRChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBnbC5URVhUVVJFXzJELFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1pcExldmVsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgTWF0aC5tYXgoTWF0aC5mbG9vcih0ZXh0dXJlLl93aWR0aCAqIHJlc011bHQpLCAxKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLm1heChNYXRoLmZsb29yKHRleHR1cmUuX2hlaWdodCAqIHJlc011bHQpLCAxKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1pcE9iamVjdFxuICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRVbnBhY2tGbGlwWShmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0VW5wYWNrUHJlbXVsdGlwbHlBbHBoYSh0ZXh0dXJlLl9wcmVtdWx0aXBseUFscGhhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGdsLnRleEltYWdlMkQoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZ2wuVEVYVFVSRV8yRCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtaXBMZXZlbCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1hdGgubWF4KHRleHR1cmUuX3dpZHRoICogcmVzTXVsdCwgMSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgTWF0aC5tYXgodGV4dHVyZS5faGVpZ2h0ICogcmVzTXVsdCwgMSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbFBpeGVsVHlwZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtaXBPYmplY3RcbiAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAobWlwTGV2ZWwgPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgdGV4dHVyZS5fbWlwbWFwc1VwbG9hZGVkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGV4dHVyZS5fbWlwbWFwc1VwbG9hZGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBtaXBMZXZlbCsrO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRleHR1cmUuX25lZWRzVXBsb2FkKSB7XG4gICAgICAgICAgICBpZiAodGV4dHVyZS5fY3ViZW1hcCkge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgNjsgaSsrKVxuICAgICAgICAgICAgICAgICAgICB0ZXh0dXJlLl9sZXZlbHNVcGRhdGVkWzBdW2ldID0gZmFsc2U7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRleHR1cmUuX2xldmVsc1VwZGF0ZWRbMF0gPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGV4dHVyZS5fY29tcHJlc3NlZCAmJiB0ZXh0dXJlLl9taXBtYXBzICYmIHRleHR1cmUuX25lZWRzTWlwbWFwc1VwbG9hZCAmJiAodGV4dHVyZS5wb3QgfHwgZGV2aWNlLndlYmdsMikgJiYgdGV4dHVyZS5fbGV2ZWxzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgZ2wuZ2VuZXJhdGVNaXBtYXAodGhpcy5fZ2xUYXJnZXQpO1xuICAgICAgICAgICAgdGV4dHVyZS5fbWlwbWFwc1VwbG9hZGVkID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHVwZGF0ZSB2cmFtIHN0YXRzXG4gICAgICAgIGlmICh0ZXh0dXJlLl9ncHVTaXplKSB7XG4gICAgICAgICAgICB0ZXh0dXJlLmFkanVzdFZyYW1TaXplVHJhY2tpbmcoZGV2aWNlLl92cmFtLCAtdGV4dHVyZS5fZ3B1U2l6ZSk7XG4gICAgICAgIH1cblxuICAgICAgICB0ZXh0dXJlLl9ncHVTaXplID0gdGV4dHVyZS5ncHVTaXplO1xuICAgICAgICB0ZXh0dXJlLmFkanVzdFZyYW1TaXplVHJhY2tpbmcoZGV2aWNlLl92cmFtLCB0ZXh0dXJlLl9ncHVTaXplKTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFdlYmdsVGV4dHVyZSB9O1xuIl0sIm5hbWVzIjpbImRvd25zYW1wbGVJbWFnZSIsImltYWdlIiwic2l6ZSIsInNyY1ciLCJ3aWR0aCIsInNyY0giLCJoZWlnaHQiLCJzY2FsZSIsIk1hdGgiLCJtYXgiLCJkc3RXIiwiZmxvb3IiLCJkc3RIIiwiRGVidWciLCJ3YXJuIiwiY2FudmFzIiwiZG9jdW1lbnQiLCJjcmVhdGVFbGVtZW50IiwiY29udGV4dCIsImdldENvbnRleHQiLCJkcmF3SW1hZ2UiLCJXZWJnbFRleHR1cmUiLCJfZ2xUZXh0dXJlIiwiX2dsVGFyZ2V0IiwiX2dsRm9ybWF0IiwiX2dsSW50ZXJuYWxGb3JtYXQiLCJfZ2xQaXhlbFR5cGUiLCJkZXN0cm95IiwiZGV2aWNlIiwiaSIsInRleHR1cmVVbml0cyIsImxlbmd0aCIsInRleHR1cmVVbml0IiwiaiIsImdsIiwiZGVsZXRlVGV4dHVyZSIsImxvc2VDb250ZXh0IiwiaW5pdGlhbGl6ZSIsInRleHR1cmUiLCJjcmVhdGVUZXh0dXJlIiwiX2N1YmVtYXAiLCJURVhUVVJFX0NVQkVfTUFQIiwiX3ZvbHVtZSIsIlRFWFRVUkVfM0QiLCJURVhUVVJFXzJEIiwiX2Zvcm1hdCIsIlBJWEVMRk9STUFUX0E4IiwiQUxQSEEiLCJVTlNJR05FRF9CWVRFIiwiUElYRUxGT1JNQVRfTDgiLCJMVU1JTkFOQ0UiLCJQSVhFTEZPUk1BVF9MQTgiLCJMVU1JTkFOQ0VfQUxQSEEiLCJQSVhFTEZPUk1BVF9SR0I1NjUiLCJSR0IiLCJVTlNJR05FRF9TSE9SVF81XzZfNSIsIlBJWEVMRk9STUFUX1JHQkE1NTUxIiwiUkdCQSIsIlVOU0lHTkVEX1NIT1JUXzVfNV81XzEiLCJQSVhFTEZPUk1BVF9SR0JBNCIsIlVOU0lHTkVEX1NIT1JUXzRfNF80XzQiLCJQSVhFTEZPUk1BVF9SR0I4Iiwid2ViZ2wyIiwiUkdCOCIsIlBJWEVMRk9STUFUX1JHQkE4IiwiUkdCQTgiLCJQSVhFTEZPUk1BVF9EWFQxIiwiZXh0Q29tcHJlc3NlZFRleHR1cmVTM1RDIiwiQ09NUFJFU1NFRF9SR0JfUzNUQ19EWFQxX0VYVCIsIlBJWEVMRk9STUFUX0RYVDMiLCJDT01QUkVTU0VEX1JHQkFfUzNUQ19EWFQzX0VYVCIsIlBJWEVMRk9STUFUX0RYVDUiLCJDT01QUkVTU0VEX1JHQkFfUzNUQ19EWFQ1X0VYVCIsIlBJWEVMRk9STUFUX0VUQzEiLCJleHRDb21wcmVzc2VkVGV4dHVyZUVUQzEiLCJDT01QUkVTU0VEX1JHQl9FVEMxX1dFQkdMIiwiUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JfMSIsImV4dENvbXByZXNzZWRUZXh0dXJlUFZSVEMiLCJDT01QUkVTU0VEX1JHQl9QVlJUQ18yQlBQVjFfSU1HIiwiUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JBXzEiLCJDT01QUkVTU0VEX1JHQkFfUFZSVENfMkJQUFYxX0lNRyIsIlBJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCXzEiLCJDT01QUkVTU0VEX1JHQl9QVlJUQ180QlBQVjFfSU1HIiwiUElYRUxGT1JNQVRfUFZSVENfNEJQUF9SR0JBXzEiLCJDT01QUkVTU0VEX1JHQkFfUFZSVENfNEJQUFYxX0lNRyIsIlBJWEVMRk9STUFUX0VUQzJfUkdCIiwiZXh0Q29tcHJlc3NlZFRleHR1cmVFVEMiLCJDT01QUkVTU0VEX1JHQjhfRVRDMiIsIlBJWEVMRk9STUFUX0VUQzJfUkdCQSIsIkNPTVBSRVNTRURfUkdCQThfRVRDMl9FQUMiLCJQSVhFTEZPUk1BVF9BU1RDXzR4NCIsImV4dENvbXByZXNzZWRUZXh0dXJlQVNUQyIsIkNPTVBSRVNTRURfUkdCQV9BU1RDXzR4NF9LSFIiLCJQSVhFTEZPUk1BVF9BVENfUkdCIiwiZXh0Q29tcHJlc3NlZFRleHR1cmVBVEMiLCJDT01QUkVTU0VEX1JHQl9BVENfV0VCR0wiLCJQSVhFTEZPUk1BVF9BVENfUkdCQSIsIkNPTVBSRVNTRURfUkdCQV9BVENfSU5URVJQT0xBVEVEX0FMUEhBX1dFQkdMIiwiUElYRUxGT1JNQVRfUkdCMTZGIiwiUkdCMTZGIiwiSEFMRl9GTE9BVCIsImV4dFRleHR1cmVIYWxmRmxvYXQiLCJIQUxGX0ZMT0FUX09FUyIsIlBJWEVMRk9STUFUX1JHQkExNkYiLCJSR0JBMTZGIiwiUElYRUxGT1JNQVRfUkdCMzJGIiwiUkdCMzJGIiwiRkxPQVQiLCJQSVhFTEZPUk1BVF9SR0JBMzJGIiwiUkdCQTMyRiIsIlBJWEVMRk9STUFUX1IzMkYiLCJSRUQiLCJSMzJGIiwiUElYRUxGT1JNQVRfREVQVEgiLCJERVBUSF9DT01QT05FTlQiLCJERVBUSF9DT01QT05FTlQzMkYiLCJVTlNJR05FRF9TSE9SVCIsIlBJWEVMRk9STUFUX0RFUFRIU1RFTkNJTCIsIkRFUFRIX1NURU5DSUwiLCJERVBUSDI0X1NURU5DSUw4IiwiVU5TSUdORURfSU5UXzI0XzgiLCJleHREZXB0aFRleHR1cmUiLCJVTlNJR05FRF9JTlRfMjRfOF9XRUJHTCIsIlBJWEVMRk9STUFUXzExMTExMEYiLCJSMTFGX0cxMUZfQjEwRiIsIlVOU0lHTkVEX0lOVF8xMEZfMTFGXzExRl9SRVYiLCJQSVhFTEZPUk1BVF9TUkdCIiwiU1JHQjgiLCJQSVhFTEZPUk1BVF9TUkdCQSIsIlNSR0I4X0FMUEhBOCIsIlBJWEVMRk9STUFUX0JHUkE4IiwiZXJyb3IiLCJ1cGxvYWQiLCJhc3NlcnQiLCJfbmVlZHNVcGxvYWQiLCJfbmVlZHNNaXBtYXBzVXBsb2FkIiwiX21pcG1hcHNVcGxvYWRlZCIsInBvdCIsIm1pcExldmVsIiwibWlwT2JqZWN0IiwicmVzTXVsdCIsInJlcXVpcmVkTWlwTGV2ZWxzIiwibG9nMiIsIl93aWR0aCIsIl9oZWlnaHQiLCJfbGV2ZWxzIiwiX21pcG1hcHMiLCJfY29tcHJlc3NlZCIsImdlbmVyYXRlTWlwbWFwIiwiZmFjZSIsIl9pc0Jyb3dzZXJJbnRlcmZhY2UiLCJfbGV2ZWxzVXBkYXRlZCIsInNyYyIsIl9pc0ltYWdlQnJvd3NlckludGVyZmFjZSIsIm1heEN1YmVNYXBTaXplIiwic2V0VW5wYWNrRmxpcFkiLCJzZXRVbnBhY2tQcmVtdWx0aXBseUFscGhhIiwiX3ByZW11bHRpcGx5QWxwaGEiLCJ0ZXhJbWFnZTJEIiwiVEVYVFVSRV9DVUJFX01BUF9QT1NJVElWRV9YIiwicG93IiwidGV4RGF0YSIsImNvbXByZXNzZWRUZXhJbWFnZTJEIiwiY29tcHJlc3NlZFRleEltYWdlM0QiLCJfZGVwdGgiLCJ0ZXhJbWFnZTNEIiwibWF4VGV4dHVyZVNpemUiLCJfZmxpcFkiLCJfZ3B1U2l6ZSIsImFkanVzdFZyYW1TaXplVHJhY2tpbmciLCJfdnJhbSIsImdwdVNpemUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBcUJBLFNBQVNBLGVBQWUsQ0FBQ0MsS0FBSyxFQUFFQyxJQUFJLEVBQUU7QUFDbEMsRUFBQSxNQUFNQyxJQUFJLEdBQUdGLEtBQUssQ0FBQ0csS0FBSyxDQUFBO0FBQ3hCLEVBQUEsTUFBTUMsSUFBSSxHQUFHSixLQUFLLENBQUNLLE1BQU0sQ0FBQTtBQUV6QixFQUFBLElBQUtILElBQUksR0FBR0QsSUFBSSxJQUFNRyxJQUFJLEdBQUdILElBQUssRUFBRTtJQUNoQyxNQUFNSyxLQUFLLEdBQUdMLElBQUksR0FBR00sSUFBSSxDQUFDQyxHQUFHLENBQUNOLElBQUksRUFBRUUsSUFBSSxDQUFDLENBQUE7SUFDekMsTUFBTUssSUFBSSxHQUFHRixJQUFJLENBQUNHLEtBQUssQ0FBQ1IsSUFBSSxHQUFHSSxLQUFLLENBQUMsQ0FBQTtJQUNyQyxNQUFNSyxJQUFJLEdBQUdKLElBQUksQ0FBQ0csS0FBSyxDQUFDTixJQUFJLEdBQUdFLEtBQUssQ0FB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
