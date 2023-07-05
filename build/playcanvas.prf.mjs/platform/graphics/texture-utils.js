import '../../core/debug.js';
import { pixelFormatInfo, PIXELFORMAT_PVRTC_2BPP_RGB_1, PIXELFORMAT_PVRTC_2BPP_RGBA_1 } from './constants.js';

class TextureUtils {
	static calcLevelDimension(dimension, mipLevel) {
		return Math.max(dimension >> mipLevel, 1);
	}
	static calcLevelGpuSize(width, height, format) {
		var _pixelFormatInfo$get$, _pixelFormatInfo$get, _formatInfo$blockSize;
		const formatInfo = pixelFormatInfo.get(format);
		const pixelSize = (_pixelFormatInfo$get$ = (_pixelFormatInfo$get = pixelFormatInfo.get(format)) == null ? void 0 : _pixelFormatInfo$get.size) != null ? _pixelFormatInfo$get$ : 0;
		if (pixelSize > 0) {
			return width * height * pixelSize;
		}
		const blockSize = (_formatInfo$blockSize = formatInfo.blockSize) != null ? _formatInfo$blockSize : 0;
		let blockWidth = Math.floor((width + 3) / 4);
		const blockHeight = Math.floor((height + 3) / 4);
		if (format === PIXELFORMAT_PVRTC_2BPP_RGB_1 || format === PIXELFORMAT_PVRTC_2BPP_RGBA_1) {
			blockWidth = Math.max(Math.floor(blockWidth / 2), 1);
		}
		return blockWidth * blockHeight * blockSize;
	}
	static calcGpuSize(width, height, depth, format, mipmaps, cubemap) {
		let result = 0;
		while (1) {
			result += TextureUtils.calcLevelGpuSize(width, height, format);
			if (!mipmaps || width === 1 && height === 1 && depth === 1) {
				break;
			}
			width = Math.max(width >> 1, 1);
			height = Math.max(height >> 1, 1);
			depth = Math.max(depth >> 1, 1);
		}
		return result * (cubemap ? 6 : 1);
	}
}

export { TextureUtils };
