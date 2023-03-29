/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import '../../../core/tracing.js';
import { PIXELFORMAT_SRGBA, PIXELFORMAT_SRGB, PIXELFORMAT_111110F, PIXELFORMAT_DEPTHSTENCIL, PIXELFORMAT_DEPTH, PIXELFORMAT_R32F, PIXELFORMAT_RGBA32F, PIXELFORMAT_RGB32F, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGB16F, PIXELFORMAT_ATC_RGBA, PIXELFORMAT_ATC_RGB, PIXELFORMAT_ASTC_4x4, PIXELFORMAT_ETC2_RGBA, PIXELFORMAT_ETC2_RGB, PIXELFORMAT_PVRTC_4BPP_RGBA_1, PIXELFORMAT_PVRTC_4BPP_RGB_1, PIXELFORMAT_PVRTC_2BPP_RGBA_1, PIXELFORMAT_PVRTC_2BPP_RGB_1, PIXELFORMAT_ETC1, PIXELFORMAT_DXT5, PIXELFORMAT_DXT3, PIXELFORMAT_DXT1, PIXELFORMAT_RGBA8, PIXELFORMAT_RGB8, PIXELFORMAT_RGBA4, PIXELFORMAT_RGBA5551, PIXELFORMAT_RGB565, PIXELFORMAT_LA8, PIXELFORMAT_L8, PIXELFORMAT_A8 } from '../constants.js';

function downsampleImage(image, size) {
	const srcW = image.width;
	const srcH = image.height;
	if (srcW > size || srcH > size) {
		const scale = size / Math.max(srcW, srcH);
		const dstW = Math.floor(srcW * scale);
		const dstH = Math.floor(srcH * scale);
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
		}
	}
	upload(device, texture) {
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
