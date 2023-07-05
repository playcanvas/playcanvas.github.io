import '../../../core/debug.js';
import { math } from '../../../core/math/math.js';
import { PIXELFORMAT_DEPTHSTENCIL, SAMPLETYPE_DEPTH, SAMPLETYPE_UNFILTERABLE_FLOAT, PIXELFORMAT_RGBA32F, PIXELFORMAT_RGBA16F, pixelFormatInfo, PIXELFORMAT_A8, PIXELFORMAT_L8, PIXELFORMAT_LA8, PIXELFORMAT_RGB565, PIXELFORMAT_RGBA5551, PIXELFORMAT_RGBA4, PIXELFORMAT_RGB8, PIXELFORMAT_RGBA8, PIXELFORMAT_DXT1, PIXELFORMAT_DXT3, PIXELFORMAT_DXT5, PIXELFORMAT_RGB16F, PIXELFORMAT_RGB32F, PIXELFORMAT_R32F, PIXELFORMAT_DEPTH, PIXELFORMAT_111110F, PIXELFORMAT_SRGB, PIXELFORMAT_SRGBA, PIXELFORMAT_ETC1, PIXELFORMAT_ETC2_RGB, PIXELFORMAT_ETC2_RGBA, PIXELFORMAT_PVRTC_2BPP_RGB_1, PIXELFORMAT_PVRTC_2BPP_RGBA_1, PIXELFORMAT_PVRTC_4BPP_RGB_1, PIXELFORMAT_PVRTC_4BPP_RGBA_1, PIXELFORMAT_ASTC_4x4, PIXELFORMAT_ATC_RGB, PIXELFORMAT_ATC_RGBA, PIXELFORMAT_BGRA8, ADDRESS_REPEAT, ADDRESS_CLAMP_TO_EDGE, ADDRESS_MIRRORED_REPEAT, FILTER_NEAREST, FILTER_LINEAR, FILTER_NEAREST_MIPMAP_NEAREST, FILTER_NEAREST_MIPMAP_LINEAR, FILTER_LINEAR_MIPMAP_NEAREST, FILTER_LINEAR_MIPMAP_LINEAR } from '../constants.js';
import { TextureUtils } from '../texture-utils.js';
import './webgpu-debug.js';

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
				depthOrArrayLayers: texture.cubemap ? 6 : 1
			},
			format: this.format,
			mipLevelCount: mipLevelCount,
			sampleCount: 1,
			dimension: texture.volume ? '3d' : '2d',
			usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
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
				addressModeW: gpuAddressModes[texture.addressW],
				maxAnisotropy: math.clamp(Math.round(texture._anisotropy), 1, device.maxTextureAnisotropy)
			};
			if (!sampleType && texture.compareOnRead) {
				sampleType = SAMPLETYPE_DEPTH;
			}
			if (sampleType === SAMPLETYPE_DEPTH) {
				descr.compare = 'less';
				descr.magFilter = 'linear';
				descr.minFilter = 'linear';
			} else if (sampleType === SAMPLETYPE_UNFILTERABLE_FLOAT) {
				descr.magFilter = 'nearest';
				descr.minFilter = 'nearest';
				descr.mipmapFilter = 'nearest';
			} else {
				if (this.texture.format === PIXELFORMAT_RGBA32F || this.texture.format === PIXELFORMAT_DEPTHSTENCIL || this.texture.format === PIXELFORMAT_RGBA16F) {
					descr.magFilter = 'nearest';
					descr.minFilter = 'nearest';
					descr.mipmapFilter = 'nearest';
				} else {
					descr.magFilter = gpuFilterModes[texture.magFilter].level;
					descr.minFilter = gpuFilterModes[texture.minFilter].level;
					descr.mipmapFilter = gpuFilterModes[texture.minFilter].mip;
				}
			}
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
							}
						}
					} else if (texture._volume) ; else {
						if (this.isExternalImage(mipObject)) {
							this.uploadExternalImage(device, mipObject, mipLevel, 0);
							anyUploads = true;
						} else if (ArrayBuffer.isView(mipObject)) {
							this.uploadTypedArrayData(device, mipObject, mipLevel, 0);
							anyUploads = true;
						} else ;
					}
				}
			}
			if (anyUploads && texture.mipmaps) {
				device.mipmapRenderer.generate(this);
			}
		}
	}
	isExternalImage(image) {
		return image instanceof ImageBitmap || image instanceof HTMLVideoElement || image instanceof HTMLCanvasElement || image instanceof OffscreenCanvas;
	}
	uploadExternalImage(device, image, mipLevel, face) {
		const src = {
			source: image,
			origin: [0, 0],
			flipY: false
		};
		const dst = {
			texture: this.gpuTexture,
			mipLevel: mipLevel,
			origin: [0, 0, face],
			aspect: 'all'
		};
		const copySize = {
			width: this.descr.size.width,
			height: this.descr.size.height,
			depthOrArrayLayers: 1
		};
		device.submit();
		device.wgpu.queue.copyExternalImageToTexture(src, dst, copySize);
	}
	uploadTypedArrayData(device, data, mipLevel, face) {
		var _formatInfo$size;
		const texture = this.texture;
		const wgpu = device.wgpu;
		const dest = {
			texture: this.gpuTexture,
			origin: [0, 0, face],
			mipLevel: mipLevel
		};
		const width = TextureUtils.calcLevelDimension(texture.width, mipLevel);
		const height = TextureUtils.calcLevelDimension(texture.height, mipLevel);
		TextureUtils.calcLevelGpuSize(width, height, texture.format);
		const formatInfo = pixelFormatInfo.get(texture.format);
		const pixelSize = (_formatInfo$size = formatInfo.size) != null ? _formatInfo$size : 0;
		const bytesPerRow = pixelSize * width;
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
		device.submit();
		wgpu.queue.writeTexture(dest, data, dataLayout, size);
	}
}

export { WebgpuTexture };
