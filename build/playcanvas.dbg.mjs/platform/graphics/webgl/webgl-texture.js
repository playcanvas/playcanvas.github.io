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
    this.dirtyParameterFlags = 0;
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
  propertyChanged(flag) {
    this.dirtyParameterFlags |= flag;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViZ2wtdGV4dHVyZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL3BsYXRmb3JtL2dyYXBoaWNzL3dlYmdsL3dlYmdsLXRleHR1cmUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi8uLi9jb3JlL2RlYnVnLmpzJztcblxuaW1wb3J0IHtcbiAgICBQSVhFTEZPUk1BVF9BOCwgUElYRUxGT1JNQVRfTDgsIFBJWEVMRk9STUFUX0xBOCwgUElYRUxGT1JNQVRfUkdCNTY1LCBQSVhFTEZPUk1BVF9SR0JBNTU1MSwgUElYRUxGT1JNQVRfUkdCQTQsXG4gICAgUElYRUxGT1JNQVRfUkdCOCwgUElYRUxGT1JNQVRfUkdCQTgsIFBJWEVMRk9STUFUX0RYVDEsIFBJWEVMRk9STUFUX0RYVDMsIFBJWEVMRk9STUFUX0RYVDUsXG4gICAgUElYRUxGT1JNQVRfUkdCMTZGLCBQSVhFTEZPUk1BVF9SR0JBMTZGLCBQSVhFTEZPUk1BVF9SR0IzMkYsIFBJWEVMRk9STUFUX1JHQkEzMkYsIFBJWEVMRk9STUFUX1IzMkYsIFBJWEVMRk9STUFUX0RFUFRILFxuICAgIFBJWEVMRk9STUFUX0RFUFRIU1RFTkNJTCwgUElYRUxGT1JNQVRfMTExMTEwRiwgUElYRUxGT1JNQVRfU1JHQiwgUElYRUxGT1JNQVRfU1JHQkEsIFBJWEVMRk9STUFUX0VUQzEsXG4gICAgUElYRUxGT1JNQVRfRVRDMl9SR0IsIFBJWEVMRk9STUFUX0VUQzJfUkdCQSwgUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JfMSwgUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JBXzEsXG4gICAgUElYRUxGT1JNQVRfUFZSVENfNEJQUF9SR0JfMSwgUElYRUxGT1JNQVRfUFZSVENfNEJQUF9SR0JBXzEsIFBJWEVMRk9STUFUX0FTVENfNHg0LCBQSVhFTEZPUk1BVF9BVENfUkdCLFxuICAgIFBJWEVMRk9STUFUX0FUQ19SR0JBLCBQSVhFTEZPUk1BVF9CR1JBOFxufSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuXG4vKipcbiAqIENoZWNrcyB0aGF0IGFuIGltYWdlJ3Mgd2lkdGggYW5kIGhlaWdodCBkbyBub3QgZXhjZWVkIHRoZSBtYXggdGV4dHVyZSBzaXplLiBJZiB0aGV5IGRvLCBpdCB3aWxsXG4gKiBiZSBzY2FsZWQgZG93biB0byB0aGF0IG1heGltdW0gc2l6ZSBhbmQgcmV0dXJuZWQgYXMgYSBjYW52YXMgZWxlbWVudC5cbiAqXG4gKiBAcGFyYW0ge0hUTUxJbWFnZUVsZW1lbnR9IGltYWdlIC0gVGhlIGltYWdlIHRvIGRvd25zYW1wbGUuXG4gKiBAcGFyYW0ge251bWJlcn0gc2l6ZSAtIFRoZSBtYXhpbXVtIGFsbG93ZWQgc2l6ZSBvZiB0aGUgaW1hZ2UuXG4gKiBAcmV0dXJucyB7SFRNTEltYWdlRWxlbWVudHxIVE1MQ2FudmFzRWxlbWVudH0gVGhlIGRvd25zYW1wbGVkIGltYWdlLlxuICogQGlnbm9yZVxuICovXG5mdW5jdGlvbiBkb3duc2FtcGxlSW1hZ2UoaW1hZ2UsIHNpemUpIHtcbiAgICBjb25zdCBzcmNXID0gaW1hZ2Uud2lkdGg7XG4gICAgY29uc3Qgc3JjSCA9IGltYWdlLmhlaWdodDtcblxuICAgIGlmICgoc3JjVyA+IHNpemUpIHx8IChzcmNIID4gc2l6ZSkpIHtcbiAgICAgICAgY29uc3Qgc2NhbGUgPSBzaXplIC8gTWF0aC5tYXgoc3JjVywgc3JjSCk7XG4gICAgICAgIGNvbnN0IGRzdFcgPSBNYXRoLmZsb29yKHNyY1cgKiBzY2FsZSk7XG4gICAgICAgIGNvbnN0IGRzdEggPSBNYXRoLmZsb29yKHNyY0ggKiBzY2FsZSk7XG5cbiAgICAgICAgRGVidWcud2FybihgSW1hZ2UgZGltZW5zaW9ucyBsYXJnZXIgdGhhbiBtYXggc3VwcG9ydGVkIHRleHR1cmUgc2l6ZSBvZiAke3NpemV9LiBSZXNpemluZyBmcm9tICR7c3JjV30sICR7c3JjSH0gdG8gJHtkc3RXfSwgJHtkc3RIfS5gKTtcblxuICAgICAgICBjb25zdCBjYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTtcbiAgICAgICAgY2FudmFzLndpZHRoID0gZHN0VztcbiAgICAgICAgY2FudmFzLmhlaWdodCA9IGRzdEg7XG5cbiAgICAgICAgY29uc3QgY29udGV4dCA9IGNhbnZhcy5nZXRDb250ZXh0KCcyZCcpO1xuICAgICAgICBjb250ZXh0LmRyYXdJbWFnZShpbWFnZSwgMCwgMCwgc3JjVywgc3JjSCwgMCwgMCwgZHN0VywgZHN0SCk7XG5cbiAgICAgICAgcmV0dXJuIGNhbnZhcztcbiAgICB9XG5cbiAgICByZXR1cm4gaW1hZ2U7XG59XG5cbi8qKlxuICogQSBXZWJHTCBpbXBsZW1lbnRhdGlvbiBvZiB0aGUgVGV4dHVyZS5cbiAqXG4gKiBAaWdub3JlXG4gKi9cbmNsYXNzIFdlYmdsVGV4dHVyZSB7XG4gICAgX2dsVGV4dHVyZSA9IG51bGw7XG5cbiAgICBfZ2xUYXJnZXQ7XG5cbiAgICBfZ2xGb3JtYXQ7XG5cbiAgICBfZ2xJbnRlcm5hbEZvcm1hdDtcblxuICAgIF9nbFBpeGVsVHlwZTtcblxuICAgIGRpcnR5UGFyYW1ldGVyRmxhZ3MgPSAwO1xuXG4gICAgZGVzdHJveShkZXZpY2UpIHtcbiAgICAgICAgaWYgKHRoaXMuX2dsVGV4dHVyZSkge1xuXG4gICAgICAgICAgICAvLyBVcGRhdGUgc2hhZG93ZWQgdGV4dHVyZSB1bml0IHN0YXRlIHRvIHJlbW92ZSB0ZXh0dXJlIGZyb20gYW55IHVuaXRzXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRldmljZS50ZXh0dXJlVW5pdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCB0ZXh0dXJlVW5pdCA9IGRldmljZS50ZXh0dXJlVW5pdHNbaV07XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCB0ZXh0dXJlVW5pdC5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgICAgICBpZiAodGV4dHVyZVVuaXRbal0gPT09IHRoaXMuX2dsVGV4dHVyZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGV4dHVyZVVuaXRbal0gPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyByZWxlYXNlIFdlYkdMIHRleHR1cmUgcmVzb3VyY2VcbiAgICAgICAgICAgIGRldmljZS5nbC5kZWxldGVUZXh0dXJlKHRoaXMuX2dsVGV4dHVyZSk7XG4gICAgICAgICAgICB0aGlzLl9nbFRleHR1cmUgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgbG9zZUNvbnRleHQoKSB7XG4gICAgICAgIHRoaXMuX2dsVGV4dHVyZSA9IG51bGw7XG4gICAgfVxuXG4gICAgcHJvcGVydHlDaGFuZ2VkKGZsYWcpIHtcbiAgICAgICAgdGhpcy5kaXJ0eVBhcmFtZXRlckZsYWdzIHw9IGZsYWc7XG4gICAgfVxuXG4gICAgaW5pdGlhbGl6ZShkZXZpY2UsIHRleHR1cmUpIHtcblxuICAgICAgICBjb25zdCBnbCA9IGRldmljZS5nbDtcblxuICAgICAgICB0aGlzLl9nbFRleHR1cmUgPSBnbC5jcmVhdGVUZXh0dXJlKCk7XG5cbiAgICAgICAgdGhpcy5fZ2xUYXJnZXQgPSB0ZXh0dXJlLl9jdWJlbWFwID8gZ2wuVEVYVFVSRV9DVUJFX01BUCA6XG4gICAgICAgICAgICAodGV4dHVyZS5fdm9sdW1lID8gZ2wuVEVYVFVSRV8zRCA6IGdsLlRFWFRVUkVfMkQpO1xuXG4gICAgICAgIHN3aXRjaCAodGV4dHVyZS5fZm9ybWF0KSB7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX0E4OlxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuQUxQSEE7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLkFMUEhBO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuVU5TSUdORURfQllURTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfTDg6XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5MVU1JTkFOQ0U7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLkxVTUlOQU5DRTtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbFBpeGVsVHlwZSA9IGdsLlVOU0lHTkVEX0JZVEU7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX0xBODpcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLkxVTUlOQU5DRV9BTFBIQTtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZ2wuTFVNSU5BTkNFX0FMUEhBO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuVU5TSUdORURfQllURTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUkdCNTY1OlxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuUkdCO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBnbC5SR0I7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUgPSBnbC5VTlNJR05FRF9TSE9SVF81XzZfNTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUkdCQTU1NTE6XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0JBO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBnbC5SR0JBO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuVU5TSUdORURfU0hPUlRfNV81XzVfMTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUkdCQTQ6XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0JBO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBnbC5SR0JBO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuVU5TSUdORURfU0hPUlRfNF80XzRfNDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUkdCODpcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQjtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZGV2aWNlLndlYmdsMiA/IGdsLlJHQjggOiBnbC5SR0I7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUgPSBnbC5VTlNJR05FRF9CWVRFO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9SR0JBODpcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQkE7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGRldmljZS53ZWJnbDIgPyBnbC5SR0JBOCA6IGdsLlJHQkE7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUgPSBnbC5VTlNJR05FRF9CWVRFO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9EWFQxOlxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuUkdCO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBkZXZpY2UuZXh0Q29tcHJlc3NlZFRleHR1cmVTM1RDLkNPTVBSRVNTRURfUkdCX1MzVENfRFhUMV9FWFQ7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX0RYVDM6XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0JBO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBkZXZpY2UuZXh0Q29tcHJlc3NlZFRleHR1cmVTM1RDLkNPTVBSRVNTRURfUkdCQV9TM1RDX0RYVDNfRVhUO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9EWFQ1OlxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuUkdCQTtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZGV2aWNlLmV4dENvbXByZXNzZWRUZXh0dXJlUzNUQy5DT01QUkVTU0VEX1JHQkFfUzNUQ19EWFQ1X0VYVDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfRVRDMTpcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQjtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZGV2aWNlLmV4dENvbXByZXNzZWRUZXh0dXJlRVRDMS5DT01QUkVTU0VEX1JHQl9FVEMxX1dFQkdMO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQl8xOlxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuUkdCO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBkZXZpY2UuZXh0Q29tcHJlc3NlZFRleHR1cmVQVlJUQy5DT01QUkVTU0VEX1JHQl9QVlJUQ18yQlBQVjFfSU1HO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQkFfMTpcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQkE7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGRldmljZS5leHRDb21wcmVzc2VkVGV4dHVyZVBWUlRDLkNPTVBSRVNTRURfUkdCQV9QVlJUQ18yQlBQVjFfSU1HO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9QVlJUQ180QlBQX1JHQl8xOlxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuUkdCO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBkZXZpY2UuZXh0Q29tcHJlc3NlZFRleHR1cmVQVlJUQy5DT01QUkVTU0VEX1JHQl9QVlJUQ180QlBQVjFfSU1HO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9QVlJUQ180QlBQX1JHQkFfMTpcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQkE7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGRldmljZS5leHRDb21wcmVzc2VkVGV4dHVyZVBWUlRDLkNPTVBSRVNTRURfUkdCQV9QVlJUQ180QlBQVjFfSU1HO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9FVEMyX1JHQjpcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQjtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZGV2aWNlLmV4dENvbXByZXNzZWRUZXh0dXJlRVRDLkNPTVBSRVNTRURfUkdCOF9FVEMyO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9FVEMyX1JHQkE6XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0JBO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBkZXZpY2UuZXh0Q29tcHJlc3NlZFRleHR1cmVFVEMuQ09NUFJFU1NFRF9SR0JBOF9FVEMyX0VBQztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfQVNUQ180eDQ6XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0JBO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBkZXZpY2UuZXh0Q29tcHJlc3NlZFRleHR1cmVBU1RDLkNPTVBSRVNTRURfUkdCQV9BU1RDXzR4NF9LSFI7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX0FUQ19SR0I6XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xGb3JtYXQgPSBnbC5SR0I7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGRldmljZS5leHRDb21wcmVzc2VkVGV4dHVyZUFUQy5DT01QUkVTU0VEX1JHQl9BVENfV0VCR0w7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX0FUQ19SR0JBOlxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuUkdCQTtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZGV2aWNlLmV4dENvbXByZXNzZWRUZXh0dXJlQVRDLkNPTVBSRVNTRURfUkdCQV9BVENfSU5URVJQT0xBVEVEX0FMUEhBX1dFQkdMO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9SR0IxNkY6XG4gICAgICAgICAgICAgICAgLy8gZGVmaW5pdGlvbiB2YXJpZXMgYmV0d2VlbiBXZWJHTDEgYW5kIDJcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQjtcbiAgICAgICAgICAgICAgICBpZiAoZGV2aWNlLndlYmdsMikge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZ2wuUkdCMTZGO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbFBpeGVsVHlwZSA9IGdsLkhBTEZfRkxPQVQ7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLlJHQjtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUgPSBkZXZpY2UuZXh0VGV4dHVyZUhhbGZGbG9hdC5IQUxGX0ZMT0FUX09FUztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1JHQkExNkY6XG4gICAgICAgICAgICAgICAgLy8gZGVmaW5pdGlvbiB2YXJpZXMgYmV0d2VlbiBXZWJHTDEgYW5kIDJcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQkE7XG4gICAgICAgICAgICAgICAgaWYgKGRldmljZS53ZWJnbDIpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLlJHQkExNkY7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuSEFMRl9GTE9BVDtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZ2wuUkdCQTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUgPSBkZXZpY2UuZXh0VGV4dHVyZUhhbGZGbG9hdC5IQUxGX0ZMT0FUX09FUztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1JHQjMyRjpcbiAgICAgICAgICAgICAgICAvLyBkZWZpbml0aW9uIHZhcmllcyBiZXR3ZWVuIFdlYkdMMSBhbmQgMlxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuUkdCO1xuICAgICAgICAgICAgICAgIGlmIChkZXZpY2Uud2ViZ2wyKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBnbC5SR0IzMkY7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCA9IGdsLlJHQjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUgPSBnbC5GTE9BVDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUkdCQTMyRjpcbiAgICAgICAgICAgICAgICAvLyBkZWZpbml0aW9uIHZhcmllcyBiZXR3ZWVuIFdlYkdMMSBhbmQgMlxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuUkdCQTtcbiAgICAgICAgICAgICAgICBpZiAoZGV2aWNlLndlYmdsMikge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZ2wuUkdCQTMyRjtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZ2wuUkdCQTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUgPSBnbC5GTE9BVDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUjMyRjogLy8gV2ViR0wyIG9ubHlcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJFRDtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZ2wuUjMyRjtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbFBpeGVsVHlwZSA9IGdsLkZMT0FUO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9ERVBUSDpcbiAgICAgICAgICAgICAgICBpZiAoZGV2aWNlLndlYmdsMikge1xuICAgICAgICAgICAgICAgICAgICAvLyBuYXRpdmUgV2ViR0wyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuREVQVEhfQ09NUE9ORU5UO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZ2wuREVQVEhfQ09NUE9ORU5UMzJGOyAvLyBzaG91bGQgYWxsb3cgMTYvMjQgYml0cz9cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUgPSBnbC5GTE9BVDtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyB1c2luZyBXZWJHTDEgZXh0ZW5zaW9uXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuREVQVEhfQ09NUE9ORU5UO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZ2wuREVQVEhfQ09NUE9ORU5UO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbFBpeGVsVHlwZSA9IGdsLlVOU0lHTkVEX1NIT1JUOyAvLyB0aGUgb25seSBhY2NlcHRhYmxlIHZhbHVlP1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfREVQVEhTVEVOQ0lMOlxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuREVQVEhfU1RFTkNJTDtcbiAgICAgICAgICAgICAgICBpZiAoZGV2aWNlLndlYmdsMikge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZ2wuREVQVEgyNF9TVEVOQ0lMODtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUgPSBnbC5VTlNJR05FRF9JTlRfMjRfODtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZ2wuREVQVEhfU1RFTkNJTDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUgPSBkZXZpY2UuZXh0RGVwdGhUZXh0dXJlLlVOU0lHTkVEX0lOVF8yNF84X1dFQkdMO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfMTExMTEwRjogLy8gV2ViR0wyIG9ubHlcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCA9IGdsLlJHQjtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZ2wuUjExRl9HMTFGX0IxMEY7XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUgPSBnbC5VTlNJR05FRF9JTlRfMTBGXzExRl8xMUZfUkVWO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9TUkdCOiAvLyBXZWJHTDIgb25seVxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuUkdCO1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQgPSBnbC5TUkdCODtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbFBpeGVsVHlwZSA9IGdsLlVOU0lHTkVEX0JZVEU7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1NSR0JBOiAvLyBXZWJHTDIgb25seVxuICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0ID0gZ2wuUkdCQTtcbiAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0ID0gZ2wuU1JHQjhfQUxQSEE4O1xuICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlID0gZ2wuVU5TSUdORURfQllURTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfQkdSQTg6XG4gICAgICAgICAgICAgICAgRGVidWcuZXJyb3IoXCJCR1JBOCB0ZXh0dXJlIGZvcm1hdCBpcyBub3Qgc3VwcG9ydGVkIGJ5IFdlYkdMLlwiKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVwbG9hZChkZXZpY2UsIHRleHR1cmUpIHtcblxuICAgICAgICBEZWJ1Zy5hc3NlcnQodGV4dHVyZS5kZXZpY2UsIFwiQXR0ZW1wdGluZyB0byB1c2UgYSB0ZXh0dXJlIHRoYXQgaGFzIGJlZW4gZGVzdHJveWVkLlwiLCB0ZXh0dXJlKTtcbiAgICAgICAgY29uc3QgZ2wgPSBkZXZpY2UuZ2w7XG5cbiAgICAgICAgaWYgKCF0ZXh0dXJlLl9uZWVkc1VwbG9hZCAmJiAoKHRleHR1cmUuX25lZWRzTWlwbWFwc1VwbG9hZCAmJiB0ZXh0dXJlLl9taXBtYXBzVXBsb2FkZWQpIHx8ICF0ZXh0dXJlLnBvdCkpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgbGV0IG1pcExldmVsID0gMDtcbiAgICAgICAgbGV0IG1pcE9iamVjdDtcbiAgICAgICAgbGV0IHJlc011bHQ7XG5cbiAgICAgICAgY29uc3QgcmVxdWlyZWRNaXBMZXZlbHMgPSB0ZXh0dXJlLnJlcXVpcmVkTWlwTGV2ZWxzO1xuXG4gICAgICAgIC8vIFVwbG9hZCBhbGwgZXhpc3RpbmcgbWlwIGxldmVscy4gSW5pdGlhbGl6ZSAwIG1pcCBhbnl3YXkuXG4gICAgICAgIHdoaWxlICh0ZXh0dXJlLl9sZXZlbHNbbWlwTGV2ZWxdIHx8IG1pcExldmVsID09PSAwKSB7XG5cbiAgICAgICAgICAgIGlmICghdGV4dHVyZS5fbmVlZHNVcGxvYWQgJiYgbWlwTGV2ZWwgPT09IDApIHtcbiAgICAgICAgICAgICAgICBtaXBMZXZlbCsrO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChtaXBMZXZlbCAmJiAoIXRleHR1cmUuX25lZWRzTWlwbWFwc1VwbG9hZCB8fCAhdGV4dHVyZS5fbWlwbWFwcykpIHtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbWlwT2JqZWN0ID0gdGV4dHVyZS5fbGV2ZWxzW21pcExldmVsXTtcblxuICAgICAgICAgICAgaWYgKG1pcExldmVsID09PSAxICYmICF0ZXh0dXJlLl9jb21wcmVzc2VkICYmIHRleHR1cmUuX2xldmVscy5sZW5ndGggPCByZXF1aXJlZE1pcExldmVscykge1xuICAgICAgICAgICAgICAgIC8vIFdlIGhhdmUgbW9yZSB0aGFuIG9uZSBtaXAgbGV2ZWxzIHdlIHdhbnQgdG8gYXNzaWduLCBidXQgd2UgbmVlZCBhbGwgbWlwcyB0byBtYWtlXG4gICAgICAgICAgICAgICAgLy8gdGhlIHRleHR1cmUgY29tcGxldGUuIFRoZXJlZm9yZSBmaXJzdCBnZW5lcmF0ZSBhbGwgbWlwIGNoYWluIGZyb20gMCwgdGhlbiBhc3NpZ24gY3VzdG9tIG1pcHMuXG4gICAgICAgICAgICAgICAgLy8gKHRoaXMgaW1wbGllcyB0aGUgY2FsbCB0byBfY29tcGxldGVQYXJ0aWFsTWlwTGV2ZWxzIGFib3ZlIHdhcyB1bnN1Y2Nlc3NmdWwpXG4gICAgICAgICAgICAgICAgZ2wuZ2VuZXJhdGVNaXBtYXAodGhpcy5fZ2xUYXJnZXQpO1xuICAgICAgICAgICAgICAgIHRleHR1cmUuX21pcG1hcHNVcGxvYWRlZCA9IHRydWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0ZXh0dXJlLl9jdWJlbWFwKSB7XG4gICAgICAgICAgICAgICAgLy8gLS0tLS0gQ1VCRU1BUCAtLS0tLVxuICAgICAgICAgICAgICAgIGxldCBmYWNlO1xuXG4gICAgICAgICAgICAgICAgaWYgKGRldmljZS5faXNCcm93c2VySW50ZXJmYWNlKG1pcE9iamVjdFswXSkpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gVXBsb2FkIHRoZSBpbWFnZSwgY2FudmFzIG9yIHZpZGVvXG4gICAgICAgICAgICAgICAgICAgIGZvciAoZmFjZSA9IDA7IGZhY2UgPCA2OyBmYWNlKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghdGV4dHVyZS5fbGV2ZWxzVXBkYXRlZFswXVtmYWNlXSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHNyYyA9IG1pcE9iamVjdFtmYWNlXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIERvd25zaXplIGltYWdlcyB0aGF0IGFyZSB0b28gbGFyZ2UgdG8gYmUgdXNlZCBhcyBjdWJlIG1hcHNcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkZXZpY2UuX2lzSW1hZ2VCcm93c2VySW50ZXJmYWNlKHNyYykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3JjLndpZHRoID4gZGV2aWNlLm1heEN1YmVNYXBTaXplIHx8IHNyYy5oZWlnaHQgPiBkZXZpY2UubWF4Q3ViZU1hcFNpemUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3JjID0gZG93bnNhbXBsZUltYWdlKHNyYywgZGV2aWNlLm1heEN1YmVNYXBTaXplKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG1pcExldmVsID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0ZXh0dXJlLl93aWR0aCA9IHNyYy53aWR0aDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRleHR1cmUuX2hlaWdodCA9IHNyYy5oZWlnaHQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRVbnBhY2tGbGlwWShmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0VW5wYWNrUHJlbXVsdGlwbHlBbHBoYSh0ZXh0dXJlLl9wcmVtdWx0aXBseUFscGhhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGdsLnRleEltYWdlMkQoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZ2wuVEVYVFVSRV9DVUJFX01BUF9QT1NJVElWRV9YICsgZmFjZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtaXBMZXZlbCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsUGl4ZWxUeXBlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNyY1xuICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFVwbG9hZCB0aGUgYnl0ZSBhcnJheVxuICAgICAgICAgICAgICAgICAgICByZXNNdWx0ID0gMSAvIE1hdGgucG93KDIsIG1pcExldmVsKTtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChmYWNlID0gMDsgZmFjZSA8IDY7IGZhY2UrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCF0ZXh0dXJlLl9sZXZlbHNVcGRhdGVkWzBdW2ZhY2VdKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0ZXhEYXRhID0gbWlwT2JqZWN0W2ZhY2VdO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRleHR1cmUuX2NvbXByZXNzZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBnbC5jb21wcmVzc2VkVGV4SW1hZ2UyRChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZ2wuVEVYVFVSRV9DVUJFX01BUF9QT1NJVElWRV9YICsgZmFjZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWlwTGV2ZWwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1hdGgubWF4KHRleHR1cmUuX3dpZHRoICogcmVzTXVsdCwgMSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1hdGgubWF4KHRleHR1cmUuX2hlaWdodCAqIHJlc011bHQsIDEpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0ZXhEYXRhXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlLnNldFVucGFja0ZsaXBZKGZhbHNlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0VW5wYWNrUHJlbXVsdGlwbHlBbHBoYSh0ZXh0dXJlLl9wcmVtdWx0aXBseUFscGhhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBnbC50ZXhJbWFnZTJEKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBnbC5URVhUVVJFX0NVQkVfTUFQX1BPU0lUSVZFX1ggKyBmYWNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtaXBMZXZlbCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgTWF0aC5tYXgodGV4dHVyZS5fd2lkdGggKiByZXNNdWx0LCAxKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgTWF0aC5tYXgodGV4dHVyZS5faGVpZ2h0ICogcmVzTXVsdCwgMSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbFBpeGVsVHlwZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGV4RGF0YVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRleHR1cmUuX3ZvbHVtZSkge1xuICAgICAgICAgICAgICAgIC8vIC0tLS0tIDNEIC0tLS0tXG4gICAgICAgICAgICAgICAgLy8gSW1hZ2UvY2FudmFzL3ZpZGVvIG5vdCBzdXBwb3J0ZWQgKHlldD8pXG4gICAgICAgICAgICAgICAgLy8gVXBsb2FkIHRoZSBieXRlIGFycmF5XG4gICAgICAgICAgICAgICAgcmVzTXVsdCA9IDEgLyBNYXRoLnBvdygyLCBtaXBMZXZlbCk7XG4gICAgICAgICAgICAgICAgaWYgKHRleHR1cmUuX2NvbXByZXNzZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgZ2wuY29tcHJlc3NlZFRleEltYWdlM0QoZ2wuVEVYVFVSRV8zRCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWlwTGV2ZWwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1hdGgubWF4KHRleHR1cmUuX3dpZHRoICogcmVzTXVsdCwgMSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1hdGgubWF4KHRleHR1cmUuX2hlaWdodCAqIHJlc011bHQsIDEpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLm1heCh0ZXh0dXJlLl9kZXB0aCAqIHJlc011bHQsIDEpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtaXBPYmplY3QpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRVbnBhY2tGbGlwWShmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRVbnBhY2tQcmVtdWx0aXBseUFscGhhKHRleHR1cmUuX3ByZW11bHRpcGx5QWxwaGEpO1xuICAgICAgICAgICAgICAgICAgICBnbC50ZXhJbWFnZTNEKGdsLlRFWFRVUkVfM0QsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWlwTGV2ZWwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLm1heCh0ZXh0dXJlLl93aWR0aCAqIHJlc011bHQsIDEpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1hdGgubWF4KHRleHR1cmUuX2hlaWdodCAqIHJlc011bHQsIDEpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1hdGgubWF4KHRleHR1cmUuX2RlcHRoICogcmVzTXVsdCwgMSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbFBpeGVsVHlwZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtaXBPYmplY3QpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gLS0tLS0gMkQgLS0tLS1cbiAgICAgICAgICAgICAgICBpZiAoZGV2aWNlLl9pc0Jyb3dzZXJJbnRlcmZhY2UobWlwT2JqZWN0KSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBEb3duc2l6ZSBpbWFnZXMgdGhhdCBhcmUgdG9vIGxhcmdlIHRvIGJlIHVzZWQgYXMgdGV4dHVyZXNcbiAgICAgICAgICAgICAgICAgICAgaWYgKGRldmljZS5faXNJbWFnZUJyb3dzZXJJbnRlcmZhY2UobWlwT2JqZWN0KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG1pcE9iamVjdC53aWR0aCA+IGRldmljZS5tYXhUZXh0dXJlU2l6ZSB8fCBtaXBPYmplY3QuaGVpZ2h0ID4gZGV2aWNlLm1heFRleHR1cmVTaXplKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWlwT2JqZWN0ID0gZG93bnNhbXBsZUltYWdlKG1pcE9iamVjdCwgZGV2aWNlLm1heFRleHR1cmVTaXplKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobWlwTGV2ZWwgPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGV4dHVyZS5fd2lkdGggPSBtaXBPYmplY3Qud2lkdGg7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRleHR1cmUuX2hlaWdodCA9IG1pcE9iamVjdC5oZWlnaHQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gVXBsb2FkIHRoZSBpbWFnZSwgY2FudmFzIG9yIHZpZGVvXG4gICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRVbnBhY2tGbGlwWSh0ZXh0dXJlLl9mbGlwWSk7XG4gICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRVbnBhY2tQcmVtdWx0aXBseUFscGhhKHRleHR1cmUuX3ByZW11bHRpcGx5QWxwaGEpO1xuICAgICAgICAgICAgICAgICAgICBnbC50ZXhJbWFnZTJEKFxuICAgICAgICAgICAgICAgICAgICAgICAgZ2wuVEVYVFVSRV8yRCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1pcExldmVsLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xJbnRlcm5hbEZvcm1hdCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsRm9ybWF0LFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2xQaXhlbFR5cGUsXG4gICAgICAgICAgICAgICAgICAgICAgICBtaXBPYmplY3RcbiAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBVcGxvYWQgdGhlIGJ5dGUgYXJyYXlcbiAgICAgICAgICAgICAgICAgICAgcmVzTXVsdCA9IDEgLyBNYXRoLnBvdygyLCBtaXBMZXZlbCk7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0ZXh0dXJlLl9jb21wcmVzc2VkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBnbC5jb21wcmVzc2VkVGV4SW1hZ2UyRChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBnbC5URVhUVVJFXzJELFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1pcExldmVsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2dsSW50ZXJuYWxGb3JtYXQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgTWF0aC5tYXgoTWF0aC5mbG9vcih0ZXh0dXJlLl93aWR0aCAqIHJlc011bHQpLCAxKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLm1heChNYXRoLmZsb29yKHRleHR1cmUuX2hlaWdodCAqIHJlc011bHQpLCAxKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1pcE9iamVjdFxuICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5zZXRVbnBhY2tGbGlwWShmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0VW5wYWNrUHJlbXVsdGlwbHlBbHBoYSh0ZXh0dXJlLl9wcmVtdWx0aXBseUFscGhhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGdsLnRleEltYWdlMkQoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZ2wuVEVYVFVSRV8yRCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtaXBMZXZlbCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEludGVybmFsRm9ybWF0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1hdGgubWF4KHRleHR1cmUuX3dpZHRoICogcmVzTXVsdCwgMSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgTWF0aC5tYXgodGV4dHVyZS5faGVpZ2h0ICogcmVzTXVsdCwgMSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbEZvcm1hdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9nbFBpeGVsVHlwZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtaXBPYmplY3RcbiAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAobWlwTGV2ZWwgPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgdGV4dHVyZS5fbWlwbWFwc1VwbG9hZGVkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGV4dHVyZS5fbWlwbWFwc1VwbG9hZGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBtaXBMZXZlbCsrO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRleHR1cmUuX25lZWRzVXBsb2FkKSB7XG4gICAgICAgICAgICBpZiAodGV4dHVyZS5fY3ViZW1hcCkge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgNjsgaSsrKVxuICAgICAgICAgICAgICAgICAgICB0ZXh0dXJlLl9sZXZlbHNVcGRhdGVkWzBdW2ldID0gZmFsc2U7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRleHR1cmUuX2xldmVsc1VwZGF0ZWRbMF0gPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGV4dHVyZS5fY29tcHJlc3NlZCAmJiB0ZXh0dXJlLl9taXBtYXBzICYmIHRleHR1cmUuX25lZWRzTWlwbWFwc1VwbG9hZCAmJiAodGV4dHVyZS5wb3QgfHwgZGV2aWNlLndlYmdsMikgJiYgdGV4dHVyZS5fbGV2ZWxzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgZ2wuZ2VuZXJhdGVNaXBtYXAodGhpcy5fZ2xUYXJnZXQpO1xuICAgICAgICAgICAgdGV4dHVyZS5fbWlwbWFwc1VwbG9hZGVkID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHVwZGF0ZSB2cmFtIHN0YXRzXG4gICAgICAgIGlmICh0ZXh0dXJlLl9ncHVTaXplKSB7XG4gICAgICAgICAgICB0ZXh0dXJlLmFkanVzdFZyYW1TaXplVHJhY2tpbmcoZGV2aWNlLl92cmFtLCAtdGV4dHVyZS5fZ3B1U2l6ZSk7XG4gICAgICAgIH1cblxuICAgICAgICB0ZXh0dXJlLl9ncHVTaXplID0gdGV4dHVyZS5ncHVTaXplO1xuICAgICAgICB0ZXh0dXJlLmFkanVzdFZyYW1TaXplVHJhY2tpbmcoZGV2aWNlLl92cmFtLCB0ZXh0dXJlLl9ncHVTaXplKTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFdlYmdsVGV4dHVyZSB9O1xuIl0sIm5hbWVzIjpbImRvd25zYW1wbGVJbWFnZSIsImltYWdlIiwic2l6ZSIsInNyY1ciLCJ3aWR0aCIsInNyY0giLCJoZWlnaHQiLCJzY2FsZSIsIk1hdGgiLCJtYXgiLCJkc3RXIiwiZmxvb3IiLCJkc3RIIiwiRGVidWciLCJ3YXJuIiwiY2FudmFzIiwiZG9jdW1lbnQiLCJjcmVhdGVFbGVtZW50IiwiY29udGV4dCIsImdldENvbnRleHQiLCJkcmF3SW1hZ2UiLCJXZWJnbFRleHR1cmUiLCJjb25zdHJ1Y3RvciIsIl9nbFRleHR1cmUiLCJfZ2xUYXJnZXQiLCJfZ2xGb3JtYXQiLCJfZ2xJbnRlcm5hbEZvcm1hdCIsIl9nbFBpeGVsVHlwZSIsImRpcnR5UGFyYW1ldGVyRmxhZ3MiLCJkZXN0cm95IiwiZGV2aWNlIiwiaSIsInRleHR1cmVVbml0cyIsImxlbmd0aCIsInRleHR1cmVVbml0IiwiaiIsImdsIiwiZGVsZXRlVGV4dHVyZSIsImxvc2VDb250ZXh0IiwicHJvcGVydHlDaGFuZ2VkIiwiZmxhZyIsImluaXRpYWxpemUiLCJ0ZXh0dXJlIiwiY3JlYXRlVGV4dHVyZSIsIl9jdWJlbWFwIiwiVEVYVFVSRV9DVUJFX01BUCIsIl92b2x1bWUiLCJURVhUVVJFXzNEIiwiVEVYVFVSRV8yRCIsIl9mb3JtYXQiLCJQSVhFTEZPUk1BVF9BOCIsIkFMUEhBIiwiVU5TSUdORURfQllURSIsIlBJWEVMRk9STUFUX0w4IiwiTFVNSU5BTkNFIiwiUElYRUxGT1JNQVRfTEE4IiwiTFVNSU5BTkNFX0FMUEhBIiwiUElYRUxGT1JNQVRfUkdCNTY1IiwiUkdCIiwiVU5TSUdORURfU0hPUlRfNV82XzUiLCJQSVhFTEZPUk1BVF9SR0JBNTU1MSIsIlJHQkEiLCJVTlNJR05FRF9TSE9SVF81XzVfNV8xIiwiUElYRUxGT1JNQVRfUkdCQTQiLCJVTlNJR05FRF9TSE9SVF80XzRfNF80IiwiUElYRUxGT1JNQVRfUkdCOCIsIndlYmdsMiIsIlJHQjgiLCJQSVhFTEZPUk1BVF9SR0JBOCIsIlJHQkE4IiwiUElYRUxGT1JNQVRfRFhUMSIsImV4dENvbXByZXNzZWRUZXh0dXJlUzNUQyIsIkNPTVBSRVNTRURfUkdCX1MzVENfRFhUMV9FWFQiLCJQSVhFTEZPUk1BVF9EWFQzIiwiQ09NUFJFU1NFRF9SR0JBX1MzVENfRFhUM19FWFQiLCJQSVhFTEZPUk1BVF9EWFQ1IiwiQ09NUFJFU1NFRF9SR0JBX1MzVENfRFhUNV9FWFQiLCJQSVhFTEZPUk1BVF9FVEMxIiwiZXh0Q29tcHJlc3NlZFRleHR1cmVFVEMxIiwiQ09NUFJFU1NFRF9SR0JfRVRDMV9XRUJHTCIsIlBJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCXzEiLCJleHRDb21wcmVzc2VkVGV4dHVyZVBWUlRDIiwiQ09NUFJFU1NFRF9SR0JfUFZSVENfMkJQUFYxX0lNRyIsIlBJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCQV8xIiwiQ09NUFJFU1NFRF9SR0JBX1BWUlRDXzJCUFBWMV9JTUciLCJQSVhFTEZPUk1BVF9QVlJUQ180QlBQX1JHQl8xIiwiQ09NUFJFU1NFRF9SR0JfUFZSVENfNEJQUFYxX0lNRyIsIlBJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCQV8xIiwiQ09NUFJFU1NFRF9SR0JBX1BWUlRDXzRCUFBWMV9JTUciLCJQSVhFTEZPUk1BVF9FVEMyX1JHQiIsImV4dENvbXByZXNzZWRUZXh0dXJlRVRDIiwiQ09NUFJFU1NFRF9SR0I4X0VUQzIiLCJQSVhFTEZPUk1BVF9FVEMyX1JHQkEiLCJDT01QUkVTU0VEX1JHQkE4X0VUQzJfRUFDIiwiUElYRUxGT1JNQVRfQVNUQ180eDQiLCJleHRDb21wcmVzc2VkVGV4dHVyZUFTVEMiLCJDT01QUkVTU0VEX1JHQkFfQVNUQ180eDRfS0hSIiwiUElYRUxGT1JNQVRfQVRDX1JHQiIsImV4dENvbXByZXNzZWRUZXh0dXJlQVRDIiwiQ09NUFJFU1NFRF9SR0JfQVRDX1dFQkdMIiwiUElYRUxGT1JNQVRfQVRDX1JHQkEiLCJDT01QUkVTU0VEX1JHQkFfQVRDX0lOVEVSUE9MQVRFRF9BTFBIQV9XRUJHTCIsIlBJWEVMRk9STUFUX1JHQjE2RiIsIlJHQjE2RiIsIkhBTEZfRkxPQVQiLCJleHRUZXh0dXJlSGFsZkZsb2F0IiwiSEFMRl9GTE9BVF9PRVMiLCJQSVhFTEZPUk1BVF9SR0JBMTZGIiwiUkdCQTE2RiIsIlBJWEVMRk9STUFUX1JHQjMyRiIsIlJHQjMyRiIsIkZMT0FUIiwiUElYRUxGT1JNQVRfUkdCQTMyRiIsIlJHQkEzMkYiLCJQSVhFTEZPUk1BVF9SMzJGIiwiUkVEIiwiUjMyRiIsIlBJWEVMRk9STUFUX0RFUFRIIiwiREVQVEhfQ09NUE9ORU5UIiwiREVQVEhfQ09NUE9ORU5UMzJGIiwiVU5TSUdORURfU0hPUlQiLCJQSVhFTEZPUk1BVF9ERVBUSFNURU5DSUwiLCJERVBUSF9TVEVOQ0lMIiwiREVQVEgyNF9TVEVOQ0lMOCIsIlVOU0lHTkVEX0lOVF8yNF84IiwiZXh0RGVwdGhUZXh0dXJlIiwiVU5TSUdORURfSU5UXzI0XzhfV0VCR0wiLCJQSVhFTEZPUk1BVF8xMTExMTBGIiwiUjExRl9HMTFGX0IxMEYiLCJVTlNJR05FRF9JTlRfMTBGXzExRl8xMUZfUkVWIiwiUElYRUxGT1JNQVRfU1JHQiIsIlNSR0I4IiwiUElYRUxGT1JNQVRfU1JHQkEiLCJTUkdCOF9BTFBIQTgiLCJQSVhFTEZPUk1BVF9CR1JBOCIsImVycm9yIiwidXBsb2FkIiwiYXNzZXJ0IiwiX25lZWRzVXBsb2FkIiwiX25lZWRzTWlwbWFwc1VwbG9hZCIsIl9taXBtYXBzVXBsb2FkZWQiLCJwb3QiLCJtaXBMZXZlbCIsIm1pcE9iamVjdCIsInJlc011bHQiLCJyZXF1aXJlZE1pcExldmVscyIsIl9sZXZlbHMiLCJfbWlwbWFwcyIsIl9jb21wcmVzc2VkIiwiZ2VuZXJhdGVNaXBtYXAiLCJmYWNlIiwiX2lzQnJvd3NlckludGVyZmFjZSIsIl9sZXZlbHNVcGRhdGVkIiwic3JjIiwiX2lzSW1hZ2VCcm93c2VySW50ZXJmYWNlIiwibWF4Q3ViZU1hcFNpemUiLCJfd2lkdGgiLCJfaGVpZ2h0Iiwic2V0VW5wYWNrRmxpcFkiLCJzZXRVbnBhY2tQcmVtdWx0aXBseUFscGhhIiwiX3ByZW11bHRpcGx5QWxwaGEiLCJ0ZXhJbWFnZTJEIiwiVEVYVFVSRV9DVUJFX01BUF9QT1NJVElWRV9YIiwicG93IiwidGV4RGF0YSIsImNvbXByZXNzZWRUZXhJbWFnZTJEIiwiY29tcHJlc3NlZFRleEltYWdlM0QiLCJfZGVwdGgiLCJ0ZXhJbWFnZTNEIiwibWF4VGV4dHVyZVNpemUiLCJfZmxpcFkiLCJfZ3B1U2l6ZSIsImFkanVzdFZyYW1TaXplVHJhY2tpbmciLCJfdnJhbSIsImdwdVNpemUiXSwibWFwcGluZ3MiOiI7OztBQVlBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVNBLGVBQWVBLENBQUNDLEtBQUssRUFBRUMsSUFBSSxFQUFFO0FBQ2xDLEVBQUEsTUFBTUMsSUFBSSxHQUFHRixLQUFLLENBQUNHLEtBQUssQ0FBQTtBQUN4QixFQUFBLE1BQU1DLElBQUksR0FBR0osS0FBSyxDQUFDSyxNQUFNLENBQUE7QUFFekIsRUFBQSxJQUFLSCxJQUFJLEdBQUdELElBQUksSUFBTUcsSUFBSSxHQUFHSCxJQUFLLEVBQUU7SUFDaEMsTUFBTUssS0FBSyxHQUFHTCxJQUFJLEdBQUdNLElBQUksQ0FBQ0Ms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
