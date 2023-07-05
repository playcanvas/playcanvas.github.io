import { extends as _extends } from '../../../_virtual/_rollupPluginBabelHelpers.js';
import '../../../core/debug.js';
import { ADDRESS_CLAMP_TO_EDGE, ADDRESS_REPEAT, PIXELFORMAT_DXT1, PIXELFORMAT_DXT3, PIXELFORMAT_DXT5, PIXELFORMAT_ETC1, PIXELFORMAT_ETC2_RGB, PIXELFORMAT_ETC2_RGBA, PIXELFORMAT_PVRTC_4BPP_RGB_1, PIXELFORMAT_PVRTC_2BPP_RGB_1, PIXELFORMAT_PVRTC_4BPP_RGBA_1, PIXELFORMAT_PVRTC_2BPP_RGBA_1, PIXELFORMAT_RGB8, PIXELFORMAT_RGBA8, PIXELFORMAT_SRGB, PIXELFORMAT_SRGBA, PIXELFORMAT_111110F, PIXELFORMAT_RGB16F, PIXELFORMAT_RGBA16F } from '../../../platform/graphics/constants.js';
import { Texture } from '../../../platform/graphics/texture.js';
import { Asset } from '../../asset/asset.js';

const IDENTIFIER = [0x58544BAB, 0xBB313120, 0x0A1A0A0D];
const KNOWN_FORMATS = {
	0x83F0: PIXELFORMAT_DXT1,
	0x83F2: PIXELFORMAT_DXT3,
	0x83F3: PIXELFORMAT_DXT5,
	0x8D64: PIXELFORMAT_ETC1,
	0x9274: PIXELFORMAT_ETC2_RGB,
	0x9278: PIXELFORMAT_ETC2_RGBA,
	0x8C00: PIXELFORMAT_PVRTC_4BPP_RGB_1,
	0x8C01: PIXELFORMAT_PVRTC_2BPP_RGB_1,
	0x8C02: PIXELFORMAT_PVRTC_4BPP_RGBA_1,
	0x8C03: PIXELFORMAT_PVRTC_2BPP_RGBA_1,
	0x8051: PIXELFORMAT_RGB8,
	0x8058: PIXELFORMAT_RGBA8,
	0x8C41: PIXELFORMAT_SRGB,
	0x8C43: PIXELFORMAT_SRGBA,
	0x8C3A: PIXELFORMAT_111110F,
	0x881B: PIXELFORMAT_RGB16F,
	0x881A: PIXELFORMAT_RGBA16F
};
function createContainer(pixelFormat, buffer, byteOffset, byteSize) {
	return pixelFormat === PIXELFORMAT_111110F ? new Uint32Array(buffer, byteOffset, byteSize / 4) : new Uint8Array(buffer, byteOffset, byteSize);
}
class KtxParser {
	constructor(registry) {
		this.maxRetries = 0;
	}
	load(url, callback, asset) {
		Asset.fetchArrayBuffer(url.load, callback, asset, this.maxRetries);
	}
	open(url, data, device, textureOptions = {}) {
		const textureData = this.parse(data);
		if (!textureData) {
			return null;
		}
		const texture = new Texture(device, _extends({
			name: url,
			addressU: textureData.cubemap ? ADDRESS_CLAMP_TO_EDGE : ADDRESS_REPEAT,
			addressV: textureData.cubemap ? ADDRESS_CLAMP_TO_EDGE : ADDRESS_REPEAT,
			width: textureData.width,
			height: textureData.height,
			format: textureData.format,
			cubemap: textureData.cubemap,
			levels: textureData.levels
		}, textureOptions));
		texture.upload();
		return texture;
	}
	parse(data) {
		const dataU32 = new Uint32Array(data);
		if (IDENTIFIER[0] !== dataU32[0] || IDENTIFIER[1] !== dataU32[1] || IDENTIFIER[2] !== dataU32[2]) {
			return null;
		}
		const header = {
			endianness: dataU32[3],
			glType: dataU32[4],
			glTypeSize: dataU32[5],
			glFormat: dataU32[6],
			glInternalFormat: dataU32[7],
			glBaseInternalFormat: dataU32[8],
			pixelWidth: dataU32[9],
			pixelHeight: dataU32[10],
			pixelDepth: dataU32[11],
			numberOfArrayElements: dataU32[12],
			numberOfFaces: dataU32[13],
			numberOfMipmapLevels: dataU32[14],
			bytesOfKeyValueData: dataU32[15]
		};
		if (header.pixelDepth > 1) {
			return null;
		}
		if (header.numberOfArrayElements !== 0) {
			return null;
		}
		const format = KNOWN_FORMATS[header.glInternalFormat];
		if (format === undefined) {
			return null;
		}
		let offset = 16 + header.bytesOfKeyValueData / 4;
		const isCubemap = header.numberOfFaces > 1;
		const levels = [];
		for (let mipmapLevel = 0; mipmapLevel < (header.numberOfMipmapLevels || 1); mipmapLevel++) {
			const imageSizeInBytes = dataU32[offset++];
			if (isCubemap) {
				levels.push([]);
			}
			const target = isCubemap ? levels[mipmapLevel] : levels;
			for (let face = 0; face < (isCubemap ? 6 : 1); ++face) {
				target.push(createContainer(format, data, offset * 4, imageSizeInBytes));
				offset += imageSizeInBytes + 3 >> 2;
			}
		}
		return {
			format: format,
			width: header.pixelWidth,
			height: header.pixelHeight,
			levels: levels,
			cubemap: isCubemap
		};
	}
}

export { KtxParser };
