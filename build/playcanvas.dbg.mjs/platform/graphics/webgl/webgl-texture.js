import { Debug } from '../../../core/debug.js';
import { PIXELFORMAT_BGRA8, PIXELFORMAT_SRGBA, PIXELFORMAT_SRGB, PIXELFORMAT_111110F, PIXELFORMAT_DEPTHSTENCIL, PIXELFORMAT_DEPTH, PIXELFORMAT_R32F, PIXELFORMAT_RGBA32F, PIXELFORMAT_RGB32F, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGB16F, PIXELFORMAT_ATC_RGBA, PIXELFORMAT_ATC_RGB, PIXELFORMAT_ASTC_4x4, PIXELFORMAT_ETC2_RGBA, PIXELFORMAT_ETC2_RGB, PIXELFORMAT_PVRTC_4BPP_RGBA_1, PIXELFORMAT_PVRTC_4BPP_RGB_1, PIXELFORMAT_PVRTC_2BPP_RGBA_1, PIXELFORMAT_PVRTC_2BPP_RGB_1, PIXELFORMAT_ETC1, PIXELFORMAT_DXT5, PIXELFORMAT_DXT3, PIXELFORMAT_DXT1, PIXELFORMAT_RGBA8, PIXELFORMAT_RGB8, PIXELFORMAT_RGBA4, PIXELFORMAT_RGBA5551, PIXELFORMAT_RGB565, PIXELFORMAT_LA8, PIXELFORMAT_L8, PIXELFORMAT_A8 } from '../constants.js';

/**
 * Checks that an image's width and height do not exceed the max texture size. If they do, it will
 * be scaled down to that maximum size and returned as a canvas element.
 *
 * @param {HTMLImageElement} image - The image to downsample.
 * @param {number} size - The maximum allowed size of the image.
 * @returns {HTMLImageElement|HTMLCanvasElement} The downsampled image.
 * @ignore
 */
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

/**
 * A WebGL implementation of the Texture.
 *
 * @ignore
 */
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
      // Update shadowed texture unit state to remove texture from any units
      for (let i = 0; i < device.textureUnits.length; i++) {
        const textureUnit = device.textureUnits[i];
        for (let j = 0; j < textureUnit.length; j++) {
          if (textureUnit[j] === this._glTexture) {
            textureUnit[j] = null;
          }
        }
      }

      // release WebGL texture resource
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
        // definition varies between WebGL1 and 2
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
        // definition varies between WebGL1 and 2
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
        // definition varies between WebGL1 and 2
        this._glFormat = gl.RGB;
        if (device.webgl2) {
          this._glInternalFormat = gl.RGB32F;
        } else {
          this._glInternalFormat = gl.RGB;
        }
        this._glPixelType = gl.FLOAT;
        break;
      case PIXELFORMAT_RGBA32F:
        // definition varies between WebGL1 and 2
        this._glFormat = gl.RGBA;
        if (device.webgl2) {
          this._glInternalFormat = gl.RGBA32F;
        } else {
          this._glInternalFormat = gl.RGBA;
        }
        this._glPixelType = gl.FLOAT;
        break;
      case PIXELFORMAT_R32F:
        // WebGL2 only
        this._glFormat = gl.RED;
        this._glInternalFormat = gl.R32F;
        this._glPixelType = gl.FLOAT;
        break;
      case PIXELFORMAT_DEPTH:
        if (device.webgl2) {
          // native WebGL2
          this._glFormat = gl.DEPTH_COMPONENT;
          this._glInternalFormat = gl.DEPTH_COMPONENT32F; // should allow 16/24 bits?
          this._glPixelType = gl.FLOAT;
        } else {
          // using WebGL1 extension
          this._glFormat = gl.DEPTH_COMPONENT;
          this._glInternalFormat = gl.DEPTH_COMPONENT;
          this._glPixelType = gl.UNSIGNED_SHORT; // the only acceptable value?
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
        // WebGL2 only
        this._glFormat = gl.RGB;
        this._glInternalFormat = gl.R11F_G11F_B10F;
        this._glPixelType = gl.UNSIGNED_INT_10F_11F_11F_REV;
        break;
      case PIXELFORMAT_SRGB:
        // WebGL2 only
        this._glFormat = gl.RGB;
        this._glInternalFormat = gl.SRGB8;
        this._glPixelType = gl.UNSIGNED_BYTE;
        break;
      case PIXELFORMAT_SRGBA:
        // WebGL2 only
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
    const requiredMipLevels = texture.requiredMipLevels;

    // Upload all existing mip levels. Initialize 0 mip anyway.
    while (texture._levels[mipLevel] || mipLevel === 0) {
      if (!texture._needsUpload && mipLevel === 0) {
        mipLevel++;
        continue;
      } else if (mipLevel && (!texture._needsMipmapsUpload || !texture._mipmaps)) {
        break;
      }
      mipObject = texture._levels[mipLevel];
      if (mipLevel === 1 && !texture._compressed && texture._levels.length < requiredMipLevels) {
        // We have more than one mip levels we want to assign, but we need all mips to make
        // the texture complete. Therefore first generate all mip chain from 0, then assign custom mips.
        // (this implies the call to _completePartialMipLevels above was unsuccessful)
        gl.generateMipmap(this._glTarget);
        texture._mipmapsUploaded = true;
      }
      if (texture._cubemap) {
        // ----- CUBEMAP -----
        let face;
        if (device._isBrowserInterface(mipObject[0])) {
          // Upload the image, canvas or video
          for (face = 0; face < 6; face++) {
            if (!texture._levelsUpdated[0][face]) continue;
            let src = mipObject[face];
            // Downsize images that are too large to be used as cube maps
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
          // Upload the byte array
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
        // ----- 3D -----
        // Image/canvas/video not supported (yet?)
        // Upload the byte array
        resMult = 1 / Math.pow(2, mipLevel);
        if (texture._compressed) {
          gl.compressedTexImage3D(gl.TEXTURE_3D, mipLevel, this._glInternalFormat, Math.max(texture._width * resMult, 1), Math.max(texture._height * resMult, 1), Math.max(texture._depth * resMult, 1), 0, mipObject);
        } else {
          device.setUnpackFlipY(false);
          device.setUnpackPremultiplyAlpha(texture._premultiplyAlpha);
          gl.texImage3D(gl.TEXTURE_3D, mipLevel, this._glInternalFormat, Math.max(texture._width * resMult, 1), Math.max(texture._height * resMult, 1), Math.max(texture._depth * resMult, 1), 0, this._glFormat, this._glPixelType, mipObject);
        }
      } else {
        // ----- 2D -----
        if (device._isBrowserInterface(mipObject)) {
          // Downsize images that are too large to be used as textures
          if (device._isImageBrowserInterface(mipObject)) {
            if (mipObject.width > device.maxTextureSize || mipObject.height > device.maxTextureSize) {
              mipObject = downsampleImage(mipObject, device.maxTextureSize);
              if (mipLevel === 0) {
                texture._width = mipObject.width;
                texture._height = mipObject.height;
              }
            }
          }

          // Upload the image, canvas or video
          device.setUnpackFlipY(texture._flipY);
          device.setUnpackPremultiplyAlpha(texture._premultiplyAlpha);
          gl.texImage2D(gl.TEXTURE_2D, mipLevel, this._glInternalFormat, this._glFormat, this._glPixelType, mipObject);
        } else {
          // Upload the byte array
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

    // update vram stats
    if (texture._gpuSize) {
      texture.adjustVramSizeTracking(device._vram, -texture._gpuSize);
    }
    texture._gpuSize = texture.gpuSize;
    texture.adjustVramSizeTracking(device._vram, texture._gpuSize);
  }
}

export { WebglTexture };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViZ2wtdGV4dHVyZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL3BsYXRmb3JtL2dyYXBoaWNzL3dlYmdsL3dlYmdsLXRleHR1cmUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi8uLi9jb3JlL2RlYnVnLmpzJztcblxuaW1wb3J0IHtcbiAgICBQSVhFTEZPUk1BVF9BOCwgUElYRUxGT1JNQVRfTDgsIFBJWEVMRk9STUFUX0xBOCwgUElYRUxGT1JNQVRfUkdCNTY1LCBQSVhFTEZPUk1BVF9SR0JBNTU1MSwgUElYRUxGT1JNQVRfUkdCQTQsXG4gICAgUElYRUxGT1JNQVRfUkdCOCwgUElYRUxGT1JNQVRfUkdCQTgsIFBJWEVMRk9STUFUX0RYVDEsIFBJWEVMRk9STUFUX0RYVDMsIFBJWEVMRk9STUFUX0RYVDUsXG4gICAgUElYRUxGT1JNQVRfUkdCMTZGLCBQSVhFTEZPUk1BVF9SR0JBMTZGLCBQSVhFTEZPUk1BVF9SR0IzMkYsIFBJWEVMRk9STUFUX1JHQkEzMkYsIFBJWEVMRk9STUFUX1IzMkYsIFBJWEVMRk9STUFUX0RFUFRILFxuICAgIFBJWEVMRk9STUFUX0RFUFRIU1RFTkNJTCwgUElYRUxGT1JNQVRfMTExMTEwRiwgUElYRUxGT1JNQVRfU1JHQiwgUElYRUxGT1JNQVRfU1JHQkEsIFBJWEVMRk9STUFUX0VUQzEsXG4gICAgUElYRUxGT1JNQVRfRVRDMl9SR0IsIFBJWEVMRk9STUFUX0VUQzJfUkdCQSwgUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JfMSwgUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JBXzEsXG4gICAgUElYRUxGT1JNQVRfUFZSVENfNEJQUF9SR0JfMSwgUElYRUxGT1JNQVRfUFZSVENfNEJQUF9SR0JBXzEsIFBJWEVMRk9STUFUX0FTVENfNHg0LCBQSVhFTEZPUk1BVF9BVENfUkdCLFxuICAgIFBJWEVMRk9STUFUX0FUQ19SR0JBLCBQSVhFTEZPUk1BVF9CR1JBOFxufSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuXG4vKipcbiAqIENoZWNrcyB0aGF0IGFuIGltYWdlJ3Mgd2lkdGggYW5kIGhlaWdodCBkbyBub3QgZXhjZWVkIHRoZSBtYXggdGV4dHVyZSBzaXplLiBJZiB0aGV5IGRvLCBpdCB3aWxsXG4gKiBiZSBzY2FsZWQgZG93biB0byB0aGF0IG1heGltdW0gc2l6ZSBhbmQgcmV0dXJuZWQgYXMgYSBjYW52YXMgZWxlbWVudC5cbiAqXG4gKiBAcGFyYW0ge0hUTUxJbWFnZUVsZW1lbnR9IGltYWdlIC0gVGhlIGltYWdlIHRvIGRvd25zYW1wbGUuXG4gKiBAcGFyYW0ge251bWJlcn0gc2l6ZSAtIFRoZSBtYXhpbXVtIGFsbG93ZWQgc2l6ZSBvZiB0aGUgaW1hZ2UuXG4gKiBAcmV0dXJucyB7SFRNTEltYWdlRWxlbWVudHxIVE1MQ2FudmFzRWxlbWVudH0gVGhlIGRvd25zYW1wbGVkIGltYWdlLlxuICogQGlnbm9yZVxuICovXG5mdW5jdGlvbiBkb3duc2FtcGxlSW1hZ2UoaW1hZ2UsIHNpemUpIHtcbiAgICBjb25zdCBzcmNXID0gaW1hZ2Uud2lkdGg7XG4gICAgY29uc3Qgc3JjSCA9IGltYWdlLmhlaWdodDtcblxuICAgIGlmICgoc3JjVyA+IHNpemUpIHx8IChzcmNIID4gc2l6ZSkpIHtcbiAgICAgICAgY29uc3Qgc2NhbGUgPSBzaXplIC8gTWF0aC5tYXgoc3JjVywgc3JjSCk7XG4gICAgICAgIGNvbnN0IGRzdFcgPSBNYXRoLmZsb29yKHNyY1cgKiBzY2FsZSk7XG4gICAgICAgIGNvbnN0IGRzdEggPSBNYXRoLmZsb29yKHNyY0ggKiBzY2FsZSk7XG5cbiAgICAgICAgRGVidWcud2FybihgSW1hZ2UgZGltZW5zaW9ucyBsYXJnZXIgdGhhbiBtYXggc3VwcG9ydGVkIHRleHR1cmUgc2l6ZSBvZiAke3NpemV9LiBSZXNpemluZyBmcm9tICR7c3JjV30sICR7c3JjSH0gdG8gJHtkc3RXfSwgJHtkc3RIfS5gKTtcblxuICAgICAgICBjb25zdCBjYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTtcbiAgICAgICAgY2FudmFzLndpZHRoID0gZHN0VztcbiAgICAgICAgY2FudmFzLmhlaWdodCA9IGRzdEg7XG5cbiAgICAgICAgY29uc3QgY29udGV4dCA9IGNhbnZhcy5nZXRDb250ZXh0KCcyZCcpO1xuICAgICAgICBjb250ZXh0LmRyYXdJbWFnZShpbWFnZSwgMCwgMCwgc3JjVywgc3JjSCwgMCwgMCwgZHN0VywgZHN0SCk7XG5cbiAgICAgICAgcmV0dXJuIGNhbnZhcztcbiAgICB9XG5cbiAgICByZXR1cm4gaW1hZ2U7XG59XG5cbi8qKlxuICogQSBXZWJHTCBpbXBsZW1lbnRhdGlvbiBvZiB0aGUgVGV4dHVyZS5cbiAqXG4gKiBAaWdub3JlXG4gKi9cbmNsYXNzIFdlYmdsVGV4dHVyZSB7XG4gICAgX2dsVGV4dHVyZSA9IG51bGw7XG5cbiAgICBfZ2xUYXJnZXQ7XG5cbiAgICBfZ2xGb3JtYXQ7XG5cbiAgICBfZ2xJbnRlcm5hbEZvcm1hdDtcblxuICAgIF9nbFBpeGVsVHlwZTtcblxuICAgIGRlc3Ryb3koZGV2aWNlKSB7XG4gICAgICAgIGlmICh0aGlzLl9nbFRleHR1cmUpIHtcblxuICAgICAgICAgICAgLy8gVXBkYXRlIHNoYWRvd2VkIHRleHR1cmUgdW5pdCBzdGF0ZSB0byByZW1vdmUgdGV4dHVyZSBmcm9tIGFueSB1bml0c1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkZXZpY2UudGV4dHVyZVVuaXRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdGV4dHVyZVVuaXQgPSBkZXZpY2UudGV4dHVyZVVuaXRzW2ldO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgdGV4dHVyZVVuaXQubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRleHR1cmVVbml0W2pdID09PSB0aGlzLl9nbFRleHR1cmUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRleHR1cmVVbml0W2pdID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gcmVsZWFzZSBXZWJHTCB0ZXh0dXJlIHJlc291cmNlXG4gICAgICAgICAgICBkZXZpY2UuZ2wuZGVsZXRlVGV4dHVyZSh0aGlzLl9nbFRleHR1cmUpO1xuICAgICAgICAgICAgdGhpcy5fZ2xUZXh0dXJlID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGxvc2VDb250ZXh0KCkge1xuICAgICAgICB0aGlzLl9nbFRleHR1cmUgPSBudWxsO1xuICAgIH1cblxuICAgIGluaXRpYWxpemUoZGV2aWNlLCB0ZXh0dXJlKSB7XG5cbiAgICAgICAgY29uc3QgZ2wgPSBkZXZpY2UuZ2w7XG5cbiAgICAgICAgdGhpcy5fZ2xUZXh0dXJlID0gZ2wuY3JlYXRlVGV4dHVyZSgpO1xuXG4gICAgICAgIHRoaXMuX2dsVGFyZ2V0ID0gdGV4dHVyZS5fY3ViZW1hcCA/IGdsLlRFWFRVUkVfQ1VCRV9NQVAgOlxuICAgICAgICAgICAgKHRleHR1cmUuX3ZvbHVtZSA/IGdsLlRFWFRVUkVfM0QgOiBnbC5URVhUVVJFXzJEKTtcblxuICAgICAgICBzd2l0Y2ggKHRleHR1cmUuX2Zvcm1hdCkge1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9BODpcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLkFMUEhBO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBnbC5BTFBIQTtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbFBpeGVsVHlwZSA9IGdsLlVOU0lHTkVEX0JZVEU7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX0w4OlxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuTFVNSU5BTkNFO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBnbC5MVU1JTkFOQ0U7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUgPSBnbC5VTlNJR05FRF9CWVRFO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9MQTg6XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5MVU1JTkFOQ0VfQUxQSEE7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLkxVTUlOQU5DRV9BTFBIQTtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbFBpeGVsVHlwZSA9IGdsLlVOU0lHTkVEX0JZVEU7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1JHQjU2NTpcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQjtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZ2wuUkdCO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuVU5TSUdORURfU0hPUlRfNV82XzU7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1JHQkE1NTUxOlxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuUkdCQTtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZ2wuUkdCQTtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbFBpeGVsVHlwZSA9IGdsLlVOU0lHTkVEX1NIT1JUXzVfNV81XzE7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1JHQkE0OlxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuUkdCQTtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZ2wuUkdCQTtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbFBpeGVsVHlwZSA9IGdsLlVOU0lHTkVEX1NIT1JUXzRfNF80XzQ7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1JHQjg6XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0I7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGRldmljZS53ZWJnbDIgPyBnbC5SR0I4IDogZ2wuUkdCO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuVU5TSUdORURfQllURTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUkdCQTg6XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0JBO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBkZXZpY2Uud2ViZ2wyID8gZ2wuUkdCQTggOiBnbC5SR0JBO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuVU5TSUdORURfQllURTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfRFhUMTpcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQjtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZGV2aWNlLmV4dENvbXByZXNzZWRUZXh0dXJlUzNUQy5DT01QUkVTU0VEX1JHQl9TM1RDX0RYVDFfRVhUO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9EWFQzOlxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuUkdCQTtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZGV2aWNlLmV4dENvbXByZXNzZWRUZXh0dXJlUzNUQy5DT01QUkVTU0VEX1JHQkFfUzNUQ19EWFQzX0VYVDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfRFhUNTpcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQkE7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGRldmljZS5leHRDb21wcmVzc2VkVGV4dHVyZVMzVEMuQ09NUFJFU1NFRF9SR0JBX1MzVENfRFhUNV9FWFQ7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX0VUQzE6XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0I7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGRldmljZS5leHRDb21wcmVzc2VkVGV4dHVyZUVUQzEuQ09NUFJFU1NFRF9SR0JfRVRDMV9XRUJHTDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JfMTpcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQjtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZGV2aWNlLmV4dENvbXByZXNzZWRUZXh0dXJlUFZSVEMuQ09NUFJFU1NFRF9SR0JfUFZSVENfMkJQUFYxX0lNRztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JBXzE6XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0JBO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBkZXZpY2UuZXh0Q29tcHJlc3NlZFRleHR1cmVQVlJUQy5DT01QUkVTU0VEX1JHQkFfUFZSVENfMkJQUFYxX0lNRztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUFZSVENfNEJQUF9SR0JfMTpcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQjtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZGV2aWNlLmV4dENvbXByZXNzZWRUZXh0dXJlUFZSVEMuQ09NUFJFU1NFRF9SR0JfUFZSVENfNEJQUFYxX0lNRztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUFZSVENfNEJQUF9SR0JBXzE6XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0JBO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBkZXZpY2UuZXh0Q29tcHJlc3NlZFRleHR1cmVQVlJUQy5DT01QUkVTU0VEX1JHQkFfUFZSVENfNEJQUFYxX0lNRztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfRVRDMl9SR0I6XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0I7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGRldmljZS5leHRDb21wcmVzc2VkVGV4dHVyZUVUQy5DT01QUkVTU0VEX1JHQjhfRVRDMjtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfRVRDMl9SR0JBOlxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuUkdCQTtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZGV2aWNlLmV4dENvbXByZXNzZWRUZXh0dXJlRVRDLkNPTVBSRVNTRURfUkdCQThfRVRDMl9FQUM7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX0FTVENfNHg0OlxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuUkdCQTtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZGV2aWNlLmV4dENvbXByZXNzZWRUZXh0dXJlQVNUQy5DT01QUkVTU0VEX1JHQkFfQVNUQ180eDRfS0hSO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9BVENfUkdCOlxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuUkdCO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBkZXZpY2UuZXh0Q29tcHJlc3NlZFRleHR1cmVBVEMuQ09NUFJFU1NFRF9SR0JfQVRDX1dFQkdMO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9BVENfUkdCQTpcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQkE7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGRldmljZS5leHRDb21wcmVzc2VkVGV4dHVyZUFUQy5DT01QUkVTU0VEX1JHQkFfQVRDX0lOVEVSUE9MQVRFRF9BTFBIQV9XRUJHTDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUkdCMTZGOlxuICAgICAgICAgICAgICAgIC8vIGRlZmluaXRpb24gdmFyaWVzIGJldHdlZW4gV2ViR0wxIGFuZCAyXG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0I7XG4gICAgICAgICAgICAgICAgaWYgKGRldmljZS53ZWJnbDIpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLlJHQjE2RjtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUgPSBnbC5IQUxGX0ZMT0FUO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBnbC5SR0I7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZGV2aWNlLmV4dFRleHR1cmVIYWxmRmxvYXQuSEFMRl9GTE9BVF9PRVM7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9SR0JBMTZGOlxuICAgICAgICAgICAgICAgIC8vIGRlZmluaXRpb24gdmFyaWVzIGJldHdlZW4gV2ViR0wxIGFuZCAyXG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0JBO1xuICAgICAgICAgICAgICAgIGlmIChkZXZpY2Uud2ViZ2wyKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBnbC5SR0JBMTZGO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbFBpeGVsVHlwZSA9IGdsLkhBTEZfRkxPQVQ7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLlJHQkE7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZGV2aWNlLmV4dFRleHR1cmVIYWxmRmxvYXQuSEFMRl9GTE9BVF9PRVM7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9SR0IzMkY6XG4gICAgICAgICAgICAgICAgLy8gZGVmaW5pdGlvbiB2YXJpZXMgYmV0d2VlbiBXZWJHTDEgYW5kIDJcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQjtcbiAgICAgICAgICAgICAgICBpZiAoZGV2aWNlLndlYmdsMikge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZ2wuUkdCMzJGO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBnbC5SR0I7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuRkxPQVQ7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1JHQkEzMkY6XG4gICAgICAgICAgICAgICAgLy8gZGVmaW5pdGlvbiB2YXJpZXMgYmV0d2VlbiBXZWJHTDEgYW5kIDJcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQkE7XG4gICAgICAgICAgICAgICAgaWYgKGRldmljZS53ZWJnbDIpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLlJHQkEzMkY7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLlJHQkE7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuRkxPQVQ7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1IzMkY6IC8vIFdlYkdMMiBvbmx5XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SRUQ7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLlIzMkY7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUgPSBnbC5GTE9BVDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfREVQVEg6XG4gICAgICAgICAgICAgICAgaWYgKGRldmljZS53ZWJnbDIpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gbmF0aXZlIFdlYkdMMlxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLkRFUFRIX0NPTVBPTkVOVDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLkRFUFRIX0NPTVBPTkVOVDMyRjsgLy8gc2hvdWxkIGFsbG93IDE2LzI0IGJpdHM/XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuRkxPQVQ7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gdXNpbmcgV2ViR0wxIGV4dGVuc2lvblxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLkRFUFRIX0NPTVBPTkVOVDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLkRFUFRIX0NPTVBPTkVOVDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUgPSBnbC5VTlNJR05FRF9TSE9SVDsgLy8gdGhlIG9ubHkgYWNjZXB0YWJsZSB2YWx1ZT9cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX0RFUFRIU1RFTkNJTDpcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLkRFUFRIX1NURU5DSUw7XG4gICAgICAgICAgICAgICAgaWYgKGRldmljZS53ZWJnbDIpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLkRFUFRIMjRfU1RFTkNJTDg7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuVU5TSUdORURfSU5UXzI0Xzg7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLkRFUFRIX1NURU5DSUw7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZGV2aWNlLmV4dERlcHRoVGV4dHVyZS5VTlNJR05FRF9JTlRfMjRfOF9XRUJHTDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUXzExMTExMEY6IC8vIFdlYkdMMiBvbmx5XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0I7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLlIxMUZfRzExRl9CMTBGO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuVU5TSUdORURfSU5UXzEwRl8xMUZfMTFGX1JFVjtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfU1JHQjogLy8gV2ViR0wyIG9ubHlcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQjtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZ2wuU1JHQjg7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUgPSBnbC5VTlNJR05FRF9CWVRFO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9TUkdCQTogLy8gV2ViR0wyIG9ubHlcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQkE7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLlNSR0I4X0FMUEhBODtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbFBpeGVsVHlwZSA9IGdsLlVOU0lHTkVEX0JZVEU7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX0JHUkE4OlxuICAgICAgICAgICAgICAgIERlYnVnLmVycm9yKFwiQkdSQTggdGV4dHVyZSBmb3JtYXQgaXMgbm90IHN1cHBvcnRlZCBieSBXZWJHTC5cIik7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB1cGxvYWQoZGV2aWNlLCB0ZXh0dXJlKSB7XG5cbiAgICAgICAgRGVidWcuYXNzZXJ0KHRleHR1cmUuZGV2aWNlLCBcIkF0dGVtcHRpbmcgdG8gdXNlIGEgdGV4dHVyZSB0aGF0IGhhcyBiZWVuIGRlc3Ryb3llZC5cIiwgdGV4dHVyZSk7XG4gICAgICAgIGNvbnN0IGdsID0gZGV2aWNlLmdsO1xuXG4gICAgICAgIGlmICghdGV4dHVyZS5fbmVlZHNVcGxvYWQgJiYgKCh0ZXh0dXJlLl9uZWVkc01pcG1hcHNVcGxvYWQgJiYgdGV4dHVyZS5fbWlwbWFwc1VwbG9hZGVkKSB8fCAhdGV4dHVyZS5wb3QpKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGxldCBtaXBMZXZlbCA9IDA7XG4gICAgICAgIGxldCBtaXBPYmplY3Q7XG4gICAgICAgIGxldCByZXNNdWx0O1xuXG4gICAgICAgIGNvbnN0IHJlcXVpcmVkTWlwTGV2ZWxzID0gdGV4dHVyZS5yZXF1aXJlZE1pcExldmVscztcblxuICAgICAgICAvLyBVcGxvYWQgYWxsIGV4aXN0aW5nIG1pcCBsZXZlbHMuIEluaXRpYWxpemUgMCBtaXAgYW55d2F5LlxuICAgICAgICB3aGlsZSAodGV4dHVyZS5fbGV2ZWxzW21pcExldmVsXSB8fCBtaXBMZXZlbCA9PT0gMCkge1xuXG4gICAgICAgICAgICBpZiAoIXRleHR1cmUuX25lZWRzVXBsb2FkICYmIG1pcExldmVsID09PSAwKSB7XG4gICAgICAgICAgICAgICAgbWlwTGV2ZWwrKztcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAobWlwTGV2ZWwgJiYgKCF0ZXh0dXJlLl9uZWVkc01pcG1hcHNVcGxvYWQgfHwgIXRleHR1cmUuX21pcG1hcHMpKSB7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG1pcE9iamVjdCA9IHRleHR1cmUuX2xldmVsc1ttaXBMZXZlbF07XG5cbiAgICAgICAgICAgIGlmIChtaXBMZXZlbCA9PT0gMSAmJiAhdGV4dHVyZS5fY29tcHJlc3NlZCAmJiB0ZXh0dXJlLl9sZXZlbHMubGVuZ3RoIDwgcmVxdWlyZWRNaXBMZXZlbHMpIHtcbiAgICAgICAgICAgICAgICAvLyBXZSBoYXZlIG1vcmUgdGhhbiBvbmUgbWlwIGxldmVscyB3ZSB3YW50IHRvIGFzc2lnbiwgYnV0IHdlIG5lZWQgYWxsIG1pcHMgdG8gbWFrZVxuICAgICAgICAgICAgICAgIC8vIHRoZSB0ZXh0dXJlIGNvbXBsZXRlLiBUaGVyZWZvcmUgZmlyc3QgZ2VuZXJhdGUgYWxsIG1pcCBjaGFpbiBmcm9tIDAsIHRoZW4gYXNzaWduIGN1c3RvbSBtaXBzLlxuICAgICAgICAgICAgICAgIC8vICh0aGlzIGltcGxpZXMgdGhlIGNhbGwgdG8gX2NvbXBsZXRlUGFydGlhbE1pcExldmVscyBhYm92ZSB3YXMgdW5zdWNjZXNzZnVsKVxuICAgICAgICAgICAgICAgIGdsLmdlbmVyYXRlTWlwbWFwKHRoaXMuX2dsVGFyZ2V0KTtcbiAgICAgICAgICAgICAgICB0ZXh0dXJlLl9taXBtYXBzVXBsb2FkZWQgPSB0cnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGV4dHVyZS5fY3ViZW1hcCkge1xuICAgICAgICAgICAgICAgIC8vIC0tLS0tIENVQkVNQVAgLS0tLS1cbiAgICAgICAgICAgICAgICBsZXQgZmFjZTtcblxuICAgICAgICAgICAgICAgIGlmIChkZXZpY2UuX2lzQnJvd3NlckludGVyZmFjZShtaXBPYmplY3RbMF0pKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFVwbG9hZCB0aGUgaW1hZ2UsIGNhbnZhcyBvciB2aWRlb1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGZhY2UgPSAwOyBmYWNlIDwgNjsgZmFjZSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXRleHR1cmUuX2xldmVsc1VwZGF0ZWRbMF1bZmFjZV0pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBzcmMgPSBtaXBPYmplY3RbZmFjZV07XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBEb3duc2l6ZSBpbWFnZXMgdGhhdCBhcmUgdG9vIGxhcmdlIHRvIGJlIHVzZWQgYXMgY3ViZSBtYXBzXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZGV2aWNlLl9pc0ltYWdlQnJvd3NlckludGVyZmFjZShzcmMpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNyYy53aWR0aCA+IGRldmljZS5tYXhDdWJlTWFwU2l6ZSB8fCBzcmMuaGVpZ2h0ID4gZGV2aWNlLm1heEN1YmVNYXBTaXplKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNyYyA9IGRvd25zYW1wbGVJbWFnZShzcmMsIGRldmljZS5tYXhDdWJlTWFwU2l6ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChtaXBMZXZlbCA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGV4dHVyZS5fd2lkdGggPSBzcmMud2lkdGg7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0ZXh0dXJlLl9oZWlnaHQgPSBzcmMuaGVpZ2h0O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0VW5wYWNrRmxpcFkoZmFsc2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldFVucGFja1ByZW11bHRpcGx5QWxwaGEodGV4dHVyZS5fcHJlbXVsdGlwbHlBbHBoYSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBnbC50ZXhJbWFnZTJEKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdsLlRFWFRVUkVfQ1VCRV9NQVBfUE9TSVRJVkVfWCArIGZhY2UsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWlwTGV2ZWwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbFBpeGVsVHlwZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzcmNcbiAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBVcGxvYWQgdGhlIGJ5dGUgYXJyYXlcbiAgICAgICAgICAgICAgICAgICAgcmVzTXVsdCA9IDEgLyBNYXRoLnBvdygyLCBtaXBMZXZlbCk7XG4gICAgICAgICAgICAgICAgICAgIGZvciAoZmFjZSA9IDA7IGZhY2UgPCA2OyBmYWNlKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghdGV4dHVyZS5fbGV2ZWxzVXBkYXRlZFswXVtmYWNlXSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdGV4RGF0YSA9IG1pcE9iamVjdFtmYWNlXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0ZXh0dXJlLl9jb21wcmVzc2VkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZ2wuY29tcHJlc3NlZFRleEltYWdlMkQoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdsLlRFWFRVUkVfQ1VCRV9NQVBfUE9TSVRJVkVfWCArIGZhY2UsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1pcExldmVsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLm1heCh0ZXh0dXJlLl93aWR0aCAqIHJlc011bHQsIDEpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLm1heCh0ZXh0dXJlLl9oZWlnaHQgKiByZXNNdWx0LCAxKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGV4RGF0YVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRVbnBhY2tGbGlwWShmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldFVucGFja1ByZW11bHRpcGx5QWxwaGEodGV4dHVyZS5fcHJlbXVsdGlwbHlBbHBoYSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZ2wudGV4SW1hZ2UyRChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZ2wuVEVYVFVSRV9DVUJFX01BUF9QT1NJVElWRV9YICsgZmFjZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWlwTGV2ZWwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1hdGgubWF4KHRleHR1cmUuX3dpZHRoICogcmVzTXVsdCwgMSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1hdGgubWF4KHRleHR1cmUuX2hlaWdodCAqIHJlc011bHQsIDEpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRleERhdGFcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmICh0ZXh0dXJlLl92b2x1bWUpIHtcbiAgICAgICAgICAgICAgICAvLyAtLS0tLSAzRCAtLS0tLVxuICAgICAgICAgICAgICAgIC8vIEltYWdlL2NhbnZhcy92aWRlbyBub3Qgc3VwcG9ydGVkICh5ZXQ/KVxuICAgICAgICAgICAgICAgIC8vIFVwbG9hZCB0aGUgYnl0ZSBhcnJheVxuICAgICAgICAgICAgICAgIHJlc011bHQgPSAxIC8gTWF0aC5wb3coMiwgbWlwTGV2ZWwpO1xuICAgICAgICAgICAgICAgIGlmICh0ZXh0dXJlLl9jb21wcmVzc2VkKSB7XG4gICAgICAgICAgICAgICAgICAgIGdsLmNvbXByZXNzZWRUZXhJbWFnZTNEKGdsLlRFWFRVUkVfM0QsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1pcExldmVsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLm1heCh0ZXh0dXJlLl93aWR0aCAqIHJlc011bHQsIDEpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLm1heCh0ZXh0dXJlLl9oZWlnaHQgKiByZXNNdWx0LCAxKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgTWF0aC5tYXgodGV4dHVyZS5fZGVwdGggKiByZXNNdWx0LCAxKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWlwT2JqZWN0KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0VW5wYWNrRmxpcFkoZmFsc2UpO1xuICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0VW5wYWNrUHJlbXVsdGlwbHlBbHBoYSh0ZXh0dXJlLl9wcmVtdWx0aXBseUFscGhhKTtcbiAgICAgICAgICAgICAgICAgICAgZ2wudGV4SW1hZ2UzRChnbC5URVhUVVJFXzNELFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1pcExldmVsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgTWF0aC5tYXgodGV4dHVyZS5fd2lkdGggKiByZXNNdWx0LCAxKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLm1heCh0ZXh0dXJlLl9oZWlnaHQgKiByZXNNdWx0LCAxKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLm1heCh0ZXh0dXJlLl9kZXB0aCAqIHJlc011bHQsIDEpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWlwT2JqZWN0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIC0tLS0tIDJEIC0tLS0tXG4gICAgICAgICAgICAgICAgaWYgKGRldmljZS5faXNCcm93c2VySW50ZXJmYWNlKG1pcE9iamVjdCkpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gRG93bnNpemUgaW1hZ2VzIHRoYXQgYXJlIHRvbyBsYXJnZSB0byBiZSB1c2VkIGFzIHRleHR1cmVzXG4gICAgICAgICAgICAgICAgICAgIGlmIChkZXZpY2UuX2lzSW1hZ2VCcm93c2VySW50ZXJmYWNlKG1pcE9iamVjdCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChtaXBPYmplY3Qud2lkdGggPiBkZXZpY2UubWF4VGV4dHVyZVNpemUgfHwgbWlwT2JqZWN0LmhlaWdodCA+IGRldmljZS5tYXhUZXh0dXJlU2l6ZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1pcE9iamVjdCA9IGRvd25zYW1wbGVJbWFnZShtaXBPYmplY3QsIGRldmljZS5tYXhUZXh0dXJlU2l6ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG1pcExldmVsID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRleHR1cmUuX3dpZHRoID0gbWlwT2JqZWN0LndpZHRoO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0ZXh0dXJlLl9oZWlnaHQgPSBtaXBPYmplY3QuaGVpZ2h0O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIFVwbG9hZCB0aGUgaW1hZ2UsIGNhbnZhcyBvciB2aWRlb1xuICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0VW5wYWNrRmxpcFkodGV4dHVyZS5fZmxpcFkpO1xuICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0VW5wYWNrUHJlbXVsdGlwbHlBbHBoYSh0ZXh0dXJlLl9wcmVtdWx0aXBseUFscGhhKTtcbiAgICAgICAgICAgICAgICAgICAgZ2wudGV4SW1hZ2UyRChcbiAgICAgICAgICAgICAgICAgICAgICAgIGdsLlRFWFRVUkVfMkQsXG4gICAgICAgICAgICAgICAgICAgICAgICBtaXBMZXZlbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWlwT2JqZWN0XG4gICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gVXBsb2FkIHRoZSBieXRlIGFycmF5XG4gICAgICAgICAgICAgICAgICAgIHJlc011bHQgPSAxIC8gTWF0aC5wb3coMiwgbWlwTGV2ZWwpO1xuICAgICAgICAgICAgICAgICAgICBpZiAodGV4dHVyZS5fY29tcHJlc3NlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZ2wuY29tcHJlc3NlZFRleEltYWdlMkQoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZ2wuVEVYVFVSRV8yRCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtaXBMZXZlbCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1hdGgubWF4KE1hdGguZmxvb3IodGV4dHVyZS5fd2lkdGggKiByZXNNdWx0KSwgMSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgTWF0aC5tYXgoTWF0aC5mbG9vcih0ZXh0dXJlLl9oZWlnaHQgKiByZXNNdWx0KSwgMSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtaXBPYmplY3RcbiAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0VW5wYWNrRmxpcFkoZmFsc2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldFVucGFja1ByZW11bHRpcGx5QWxwaGEodGV4dHVyZS5fcHJlbXVsdGlwbHlBbHBoYSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBnbC50ZXhJbWFnZTJEKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdsLlRFWFRVUkVfMkQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWlwTGV2ZWwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLm1heCh0ZXh0dXJlLl93aWR0aCAqIHJlc011bHQsIDEpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1hdGgubWF4KHRleHR1cmUuX2hlaWdodCAqIHJlc011bHQsIDEpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWlwT2JqZWN0XG4gICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKG1pcExldmVsID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHRleHR1cmUuX21pcG1hcHNVcGxvYWRlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRleHR1cmUuX21pcG1hcHNVcGxvYWRlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbWlwTGV2ZWwrKztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0ZXh0dXJlLl9uZWVkc1VwbG9hZCkge1xuICAgICAgICAgICAgaWYgKHRleHR1cmUuX2N1YmVtYXApIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDY7IGkrKylcbiAgICAgICAgICAgICAgICAgICAgdGV4dHVyZS5fbGV2ZWxzVXBkYXRlZFswXVtpXSA9IGZhbHNlO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0ZXh0dXJlLl9sZXZlbHNVcGRhdGVkWzBdID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRleHR1cmUuX2NvbXByZXNzZWQgJiYgdGV4dHVyZS5fbWlwbWFwcyAmJiB0ZXh0dXJlLl9uZWVkc01pcG1hcHNVcGxvYWQgJiYgKHRleHR1cmUucG90IHx8IGRldmljZS53ZWJnbDIpICYmIHRleHR1cmUuX2xldmVscy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgIGdsLmdlbmVyYXRlTWlwbWFwKHRoaXMuX2dsVGFyZ2V0KTtcbiAgICAgICAgICAgIHRleHR1cmUuX21pcG1hcHNVcGxvYWRlZCA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB1cGRhdGUgdnJhbSBzdGF0c1xuICAgICAgICBpZiAodGV4dHVyZS5fZ3B1U2l6ZSkge1xuICAgICAgICAgICAgdGV4dHVyZS5hZGp1c3RWcmFtU2l6ZVRyYWNraW5nKGRldmljZS5fdnJhbSwgLXRleHR1cmUuX2dwdVNpemUpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGV4dHVyZS5fZ3B1U2l6ZSA9IHRleHR1cmUuZ3B1U2l6ZTtcbiAgICAgICAgdGV4dHVyZS5hZGp1c3RWcmFtU2l6ZVRyYWNraW5nKGRldmljZS5fdnJhbSwgdGV4dHVyZS5fZ3B1U2l6ZSk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBXZWJnbFRleHR1cmUgfTtcbiJdLCJuYW1lcyI6WyJkb3duc2FtcGxlSW1hZ2UiLCJpbWFnZSIsInNpemUiLCJzcmNXIiwid2lkdGgiLCJzcmNIIiwiaGVpZ2h0Iiwic2NhbGUiLCJNYXRoIiwibWF4IiwiZHN0VyIsImZsb29yIiwiZHN0SCIsIkRlYnVnIiwid2FybiIsImNhbnZhcyIsImRvY3VtZW50IiwiY3JlYXRlRWxlbWVudCIsImNvbnRleHQiLCJnZXRDb250ZXh0IiwiZHJhd0ltYWdlIiwiV2ViZ2xUZXh0dXJlIiwiY29uc3RydWN0b3IiLCJfZ2xUZXh0dXJlIiwiX2dsVGFyZ2V0IiwiX2dsRm9ybWF0IiwiX2dsSW50ZXJuYWxGb3JtYXQiLCJfZ2xQaXhlbFR5cGUiLCJkZXN0cm95IiwiZGV2aWNlIiwiaSIsInRleHR1cmVVbml0cyIsImxlbmd0aCIsInRleHR1cmVVbml0IiwiaiIsImdsIiwiZGVsZXRlVGV4dHVyZSIsImxvc2VDb250ZXh0IiwiaW5pdGlhbGl6ZSIsInRleHR1cmUiLCJjcmVhdGVUZXh0dXJlIiwiX2N1YmVtYXAiLCJURVhUVVJFX0NVQkVfTUFQIiwiX3ZvbHVtZSIsIlRFWFRVUkVfM0QiLCJURVhUVVJFXzJEIiwiX2Zvcm1hdCIsIlBJWEVMRk9STUFUX0E4IiwiQUxQSEEiLCJVTlNJR05FRF9CWVRFIiwiUElYRUxGT1JNQVRfTDgiLCJMVU1JTkFOQ0UiLCJQSVhFTEZPUk1BVF9MQTgiLCJMVU1JTkFOQ0VfQUxQSEEiLCJQSVhFTEZPUk1BVF9SR0I1NjUiLCJSR0IiLCJVTlNJR05FRF9TSE9SVF81XzZfNSIsIlBJWEVMRk9STUFUX1JHQkE1NTUxIiwiUkdCQSIsIlVOU0lHTkVEX1NIT1JUXzVfNV81XzEiLCJQSVhFTEZPUk1BVF9SR0JBNCIsIlVOU0lHTkVEX1NIT1JUXzRfNF80XzQiLCJQSVhFTEZPUk1BVF9SR0I4Iiwid2ViZ2wyIiwiUkdCOCIsIlBJWEVMRk9STUFUX1JHQkE4IiwiUkdCQTgiLCJQSVhFTEZPUk1BVF9EWFQxIiwiZXh0Q29tcHJlc3NlZFRleHR1cmVTM1RDIiwiQ09NUFJFU1NFRF9SR0JfUzNUQ19EWFQxX0VYVCIsIlBJWEVMRk9STUFUX0RYVDMiLCJDT01QUkVTU0VEX1JHQkFfUzNUQ19EWFQzX0VYVCIsIlBJWEVMRk9STUFUX0RYVDUiLCJDT01QUkVTU0VEX1JHQkFfUzNUQ19EWFQ1X0VYVCIsIlBJWEVMRk9STUFUX0VUQzEiLCJleHRDb21wcmVzc2VkVGV4dHVyZUVUQzEiLCJDT01QUkVTU0VEX1JHQl9FVEMxX1dFQkdMIiwiUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JfMSIsImV4dENvbXByZXNzZWRUZXh0dXJlUFZSVEMiLCJDT01QUkVTU0VEX1JHQl9QVlJUQ18yQlBQVjFfSU1HIiwiUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JBXzEiLCJDT01QUkVTU0VEX1JHQkFfUFZSVENfMkJQUFYxX0lNRyIsIlBJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCXzEiLCJDT01QUkVTU0VEX1JHQl9QVlJUQ180QlBQVjFfSU1HIiwiUElYRUxGT1JNQVRfUFZSVENfNEJQUF9SR0JBXzEiLCJDT01QUkVTU0VEX1JHQkFfUFZSVENfNEJQUFYxX0lNRyIsIlBJWEVMRk9STUFUX0VUQzJfUkdCIiwiZXh0Q29tcHJlc3NlZFRleHR1cmVFVEMiLCJDT01QUkVTU0VEX1JHQjhfRVRDMiIsIlBJWEVMRk9STUFUX0VUQzJfUkdCQSIsIkNPTVBSRVNTRURfUkdCQThfRVRDMl9FQUMiLCJQSVhFTEZPUk1BVF9BU1RDXzR4NCIsImV4dENvbXByZXNzZWRUZXh0dXJlQVNUQyIsIkNPTVBSRVNTRURfUkdCQV9BU1RDXzR4NF9LSFIiLCJQSVhFTEZPUk1BVF9BVENfUkdCIiwiZXh0Q29tcHJlc3NlZFRleHR1cmVBVEMiLCJDT01QUkVTU0VEX1JHQl9BVENfV0VCR0wiLCJQSVhFTEZPUk1BVF9BVENfUkdCQSIsIkNPTVBSRVNTRURfUkdCQV9BVENfSU5URVJQT0xBVEVEX0FMUEhBX1dFQkdMIiwiUElYRUxGT1JNQVRfUkdCMTZGIiwiUkdCMTZGIiwiSEFMRl9GTE9BVCIsImV4dFRleHR1cmVIYWxmRmxvYXQiLCJIQUxGX0ZMT0FUX09FUyIsIlBJWEVMRk9STUFUX1JHQkExNkYiLCJSR0JBMTZGIiwiUElYRUxGT1JNQVRfUkdCMzJGIiwiUkdCMzJGIiwiRkxPQVQiLCJQSVhFTEZPUk1BVF9SR0JBMzJGIiwiUkdCQTMyRiIsIlBJWEVMRk9STUFUX1IzMkYiLCJSRUQiLCJSMzJGIiwiUElYRUxGT1JNQVRfREVQVEgiLCJERVBUSF9DT01QT05FTlQiLCJERVBUSF9DT01QT05FTlQzMkYiLCJVTlNJR05FRF9TSE9SVCIsIlBJWEVMRk9STUFUX0RFUFRIU1RFTkNJTCIsIkRFUFRIX1NURU5DSUwiLCJERVBUSDI0X1NURU5DSUw4IiwiVU5TSUdORURfSU5UXzI0XzgiLCJleHREZXB0aFRleHR1cmUiLCJVTlNJR05FRF9JTlRfMjRfOF9XRUJHTCIsIlBJWEVMRk9STUFUXzExMTExMEYiLCJSMTFGX0cxMUZfQjEwRiIsIlVOU0lHTkVEX0lOVF8xMEZfMTFGXzExRl9SRVYiLCJQSVhFTEZPUk1BVF9TUkdCIiwiU1JHQjgiLCJQSVhFTEZPUk1BVF9TUkdCQSIsIlNSR0I4X0FMUEhBOCIsIlBJWEVMRk9STUFUX0JHUkE4IiwiZXJyb3IiLCJ1cGxvYWQiLCJhc3NlcnQiLCJfbmVlZHNVcGxvYWQiLCJfbmVlZHNNaXBtYXBzVXBsb2FkIiwiX21pcG1hcHNVcGxvYWRlZCIsInBvdCIsIm1pcExldmVsIiwibWlwT2JqZWN0IiwicmVzTXVsdCIsInJlcXVpcmVkTWlwTGV2ZWxzIiwiX2xldmVscyIsIl9taXBtYXBzIiwiX2NvbXByZXNzZWQiLCJnZW5lcmF0ZU1pcG1hcCIsImZhY2UiLCJfaXNCcm93c2VySW50ZXJmYWNlIiwiX2xldmVsc1VwZGF0ZWQiLCJzcmMiLCJfaXNJbWFnZUJyb3dzZXJJbnRlcmZhY2UiLCJtYXhDdWJlTWFwU2l6ZSIsIl93aWR0aCIsIl9oZWlnaHQiLCJzZXRVbnBhY2tGbGlwWSIsInNldFVucGFja1ByZW11bHRpcGx5QWxwaGEiLCJfcHJlbXVsdGlwbHlBbHBoYSIsInRleEltYWdlMkQiLCJURVhUVVJFX0NVQkVfTUFQX1BPU0lUSVZFX1giLCJwb3ciLCJ0ZXhEYXRhIiwiY29tcHJlc3NlZFRleEltYWdlMkQiLCJjb21wcmVzc2VkVGV4SW1hZ2UzRCIsIl9kZXB0aCIsInRleEltYWdlM0QiLCJtYXhUZXh0dXJlU2l6ZSIsIl9mbGlwWSIsIl9ncHVTaXplIiwiYWRqdXN0VnJhbVNpemVUcmFja2luZyIsIl92cmFtIiwiZ3B1U2l6ZSJdLCJtYXBwaW5ncyI6Ijs7O0FBWUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBU0EsZUFBZUEsQ0FBQ0MsS0FBSyxFQUFFQyxJQUFJLEVBQUU7QUFDbEMsRUFBQSxNQUFNQyxJQUFJLEdBQUdGLEtBQUssQ0FBQ0csS0FBSyxDQUFBO0FBQ3hCLEVBQUEsTUFBTUMsSUFBSSxHQUFHSixLQUFLLENBQUNLLE1BQU0sQ0FBQTtBQUV6QixFQUFBLElBQUtILElBQUksR0FBR0QsSUFBSSxJQUFNRyxJQUFJLEdBQUdILElBQUssRUFBRTtJQUNoQyxNQUFNSyxLQUFLLEdBQUdMLElBQUksR0FBR00sSUFBSSxDQUFDQyxHQUFHLENBQUNOLElBQUksRUFBRUUsSUFBSSxDQUFDLENBQUE7SUFDekMsTUFBTUssSUFBSSxHQUFHRixJQUFJLENBQUNHLEtBQUssQ0FBQ1IsSUFBSSxHQUFHSSxLQUFLLENBQUMsQ0FBQTtJQUNyQyxNQUFNSyxJQUFJLEdBQUdKLElBQUksQ0FBQ0csS0FBSyxDQUFDTixJQUFJLEdB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
