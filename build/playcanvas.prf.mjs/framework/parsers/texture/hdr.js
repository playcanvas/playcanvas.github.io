import { extends as _extends } from '../../../_virtual/_rollupPluginBabelHelpers.js';
import '../../../core/debug.js';
import { ReadStream } from '../../../core/read-stream.js';
import { TEXHINT_ASSET, ADDRESS_REPEAT, ADDRESS_CLAMP_TO_EDGE, FILTER_NEAREST, PIXELFORMAT_RGBA8, TEXTURETYPE_RGBE } from '../../../platform/graphics/constants.js';
import { Texture } from '../../../platform/graphics/texture.js';
import { Asset } from '../../asset/asset.js';

class HdrParser {
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
			profilerHint: TEXHINT_ASSET,
			addressU: ADDRESS_REPEAT,
			addressV: ADDRESS_CLAMP_TO_EDGE,
			minFilter: FILTER_NEAREST,
			magFilter: FILTER_NEAREST,
			width: textureData.width,
			height: textureData.height,
			levels: textureData.levels,
			format: PIXELFORMAT_RGBA8,
			type: TEXTURETYPE_RGBE,
			mipmaps: false
		}, textureOptions));
		texture.upload();
		return texture;
	}
	parse(data) {
		const readStream = new ReadStream(data);
		const magic = readStream.readLine();
		if (!magic.startsWith('#?RADIANCE')) {
			return null;
		}
		const variables = {};
		while (true) {
			const line = readStream.readLine();
			if (line.length === 0) {
				break;
			} else {
				const parts = line.split('=');
				if (parts.length === 2) {
					variables[parts[0]] = parts[1];
				}
			}
		}
		if (!variables.hasOwnProperty('FORMAT')) {
			return null;
		}
		const resolution = readStream.readLine().split(' ');
		if (resolution.length !== 4) {
			return null;
		}
		const height = parseInt(resolution[1], 10);
		const width = parseInt(resolution[3], 10);
		const pixels = this._readPixels(readStream, width, height, resolution[0] === '-Y');
		if (!pixels) {
			return null;
		}
		return {
			width: width,
			height: height,
			levels: [pixels]
		};
	}
	_readPixels(readStream, width, height, flipY) {
		if (width < 8 || width > 0x7fff) {
			return this._readPixelsFlat(readStream, width, height);
		}
		const rgbe = [0, 0, 0, 0];
		readStream.readArray(rgbe);
		if (rgbe[0] !== 2 || rgbe[1] !== 2 || (rgbe[2] & 0x80) !== 0) {
			readStream.skip(-4);
			return this._readPixelsFlat(readStream, width, height);
		}
		const buffer = new ArrayBuffer(width * height * 4);
		const view = new Uint8Array(buffer);
		let scanstart = flipY ? 0 : width * 4 * (height - 1);
		let x, y, i, channel, count, value;
		for (y = 0; y < height; ++y) {
			if (y) {
				readStream.readArray(rgbe);
			}
			if ((rgbe[2] << 8) + rgbe[3] !== width) {
				return null;
			}
			for (channel = 0; channel < 4; ++channel) {
				x = 0;
				while (x < width) {
					count = readStream.readU8();
					if (count > 128) {
						count -= 128;
						if (x + count > width) {
							return null;
						}
						value = readStream.readU8();
						for (i = 0; i < count; ++i) {
							view[scanstart + channel + 4 * x++] = value;
						}
					} else {
						if (count === 0 || x + count > width) {
							return null;
						}
						for (i = 0; i < count; ++i) {
							view[scanstart + channel + 4 * x++] = readStream.readU8();
						}
					}
				}
			}
			scanstart += width * 4 * (flipY ? 1 : -1);
		}
		return view;
	}
	_readPixelsFlat(readStream, width, height) {
		return readStream.remainingBytes === width * height * 4 ? new Uint8Array(readStream.arraybuffer, readStream.offset) : null;
	}
}

export { HdrParser };
