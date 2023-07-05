import { extends as _extends } from '../../../_virtual/_rollupPluginBabelHelpers.js';
import '../../../core/debug.js';
import { ReadStream } from '../../../core/read-stream.js';
import { TEXHINT_ASSET, ADDRESS_CLAMP_TO_EDGE, ADDRESS_REPEAT } from '../../../platform/graphics/constants.js';
import { Texture } from '../../../platform/graphics/texture.js';
import { Asset } from '../../asset/asset.js';
import { basisTranscode } from '../../handlers/basis.js';

const KHRConstants = {
	KHR_DF_MODEL_ETC1S: 163,
	KHR_DF_MODEL_UASTC: 166
};
class Ktx2Parser {
	constructor(registry, device) {
		this.maxRetries = 0;
		this.device = device;
	}
	load(url, callback, asset) {
		Asset.fetchArrayBuffer(url.load, (err, result) => {
			if (err) {
				callback(err, result);
			} else {
				this.parse(result, url, callback, asset);
			}
		}, asset, this.maxRetries);
	}
	open(url, data, device, textureOptions = {}) {
		const texture = new Texture(device, _extends({
			name: url,
			profilerHint: TEXHINT_ASSET,
			addressU: data.cubemap ? ADDRESS_CLAMP_TO_EDGE : ADDRESS_REPEAT,
			addressV: data.cubemap ? ADDRESS_CLAMP_TO_EDGE : ADDRESS_REPEAT,
			width: data.width,
			height: data.height,
			format: data.format,
			cubemap: data.cubemap,
			levels: data.levels
		}, textureOptions));
		texture.upload();
		return texture;
	}
	parse(arraybuffer, url, callback, asset) {
		const rs = new ReadStream(arraybuffer);
		const magic = [rs.readU32be(), rs.readU32be(), rs.readU32be()];
		if (magic[0] !== 0xAB4B5458 || magic[1] !== 0x203230BB || magic[2] !== 0x0D0A1A0A) {
			return null;
		}
		const header = {
			vkFormat: rs.readU32(),
			typeSize: rs.readU32(),
			pixelWidth: rs.readU32(),
			pixelHeight: rs.readU32(),
			pixelDepth: rs.readU32(),
			layerCount: rs.readU32(),
			faceCount: rs.readU32(),
			levelCount: rs.readU32(),
			supercompressionScheme: rs.readU32()
		};
		const index = {
			dfdByteOffset: rs.readU32(),
			dfdByteLength: rs.readU32(),
			kvdByteOffset: rs.readU32(),
			kvdByteLength: rs.readU32(),
			sgdByteOffset: rs.readU64(),
			sgdByteLength: rs.readU64()
		};
		const levels = [];
		for (let i = 0; i < Math.max(1, header.levelCount); ++i) {
			levels.push({
				byteOffset: rs.readU64(),
				byteLength: rs.readU64(),
				uncompressedByteLength: rs.readU64()
			});
		}
		const dfdTotalSize = rs.readU32();
		if (dfdTotalSize !== index.kvdByteOffset - index.dfdByteOffset) {
			return null;
		}
		rs.skip(8);
		const colorModel = rs.readU8();
		rs.skip(index.dfdByteLength - 9);
		rs.skip(index.kvdByteLength);
		if (header.supercompressionScheme === 1 || colorModel === KHRConstants.KHR_DF_MODEL_UASTC) {
			var _asset$file, _asset$file$variants, _asset$file$variants$;
			const basisModuleFound = basisTranscode(this.device, url.load, arraybuffer, callback, {
				isGGGR: ((asset == null ? void 0 : (_asset$file = asset.file) == null ? void 0 : (_asset$file$variants = _asset$file.variants) == null ? void 0 : (_asset$file$variants$ = _asset$file$variants.basis) == null ? void 0 : _asset$file$variants$.opt) & 8) !== 0,
				isKTX2: true
			});
			if (!basisModuleFound) {
				callback('Basis module not found. Asset "' + asset.name + '" basis texture variant will not be loaded.');
			}
		} else {
			callback('unsupported KTX2 pixel format');
		}
	}
}

export { Ktx2Parser };
