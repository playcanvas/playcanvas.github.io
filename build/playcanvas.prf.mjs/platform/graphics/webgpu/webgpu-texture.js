/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import '../../../core/tracing.js';
import { PIXELFORMAT_DEPTHSTENCIL, SAMPLETYPE_DEPTH, SAMPLETYPE_UNFILTERABLE_FLOAT, PIXELFORMAT_RGBA32F, PIXELFORMAT_RGBA16F, pixelFormatByteSizes, PIXELFORMAT_A8, PIXELFORMAT_L8, PIXELFORMAT_LA8, PIXELFORMAT_RGB565, PIXELFORMAT_RGBA5551, PIXELFORMAT_RGBA4, PIXELFORMAT_RGB8, PIXELFORMAT_RGBA8, PIXELFORMAT_DXT1, PIXELFORMAT_DXT3, PIXELFORMAT_DXT5, PIXELFORMAT_RGB16F, PIXELFORMAT_RGB32F, PIXELFORMAT_R32F, PIXELFORMAT_DEPTH, PIXELFORMAT_111110F, PIXELFORMAT_SRGB, PIXELFORMAT_SRGBA, PIXELFORMAT_ETC1, PIXELFORMAT_ETC2_RGB, PIXELFORMAT_ETC2_RGBA, PIXELFORMAT_PVRTC_2BPP_RGB_1, PIXELFORMAT_PVRTC_2BPP_RGBA_1, PIXELFORMAT_PVRTC_4BPP_RGB_1, PIXELFORMAT_PVRTC_4BPP_RGBA_1, PIXELFORMAT_ASTC_4x4, PIXELFORMAT_ATC_RGB, PIXELFORMAT_ATC_RGBA, PIXELFORMAT_BGRA8, ADDRESS_REPEAT, ADDRESS_CLAMP_TO_EDGE, ADDRESS_MIRRORED_REPEAT } from '../constants.js';

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
const gpuAddressModes = [];
gpuAddressModes[ADDRESS_REPEAT] = 'repeat';
gpuAddressModes[ADDRESS_CLAMP_TO_EDGE] = 'clamp-to-edge';
gpuAddressModes[ADDRESS_MIRRORED_REPEAT] = 'mirror-repeat';
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
		this.descr = {
			size: {
				width: texture.width,
				height: texture.height,
				depthOrArrayLayers: texture.cubemap ? 6 : 1
			},
			format: this.format,
			mipLevelCount: 1,
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
				addressModeW: gpuAddressModes[texture.addressW]
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
					descr.magFilter = 'linear';
					descr.minFilter = 'linear';
					descr.mipmapFilter = 'linear';
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
		const wgpu = device.wgpu;
		if (this.texture.cubemap) {
			return;
		}
		const mipLevel = 0;
		const mipObject = texture._levels[mipLevel];
		if (mipObject) {
			if (mipObject instanceof ImageBitmap) {
				wgpu.queue.copyExternalImageToTexture({
					source: mipObject
				}, {
					texture: this.gpuTexture
				}, this.descr.size);
			} else if (ArrayBuffer.isView(mipObject)) {
				this.uploadTypedArrayData(wgpu, mipObject);
			} else ;
		}
	}
	uploadTypedArrayData(wgpu, data) {
		var _pixelFormatByteSizes;
		const texture = this.texture;
		const dest = {
			texture: this.gpuTexture,
			mipLevel: 0
		};
		const pixelSize = (_pixelFormatByteSizes = pixelFormatByteSizes[texture.format]) != null ? _pixelFormatByteSizes : 0;
		const bytesPerRow = texture.width * pixelSize;
		bytesPerRow * texture.height;
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
