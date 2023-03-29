/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { TEXHINT_ASSET, ADDRESS_CLAMP_TO_EDGE, ADDRESS_REPEAT } from '../../../platform/graphics/constants.js';
import { Texture } from '../../../platform/graphics/texture.js';
import { Asset } from '../../asset/asset.js';
import { basisTranscode } from '../../handlers/basis.js';

class BasisParser {
	constructor(registry, device) {
		this.device = device;
		this.maxRetries = 0;
	}
	load(url, callback, asset) {
		const device = this.device;
		const transcode = data => {
			var _asset$file, _asset$file$variants, _asset$file$variants$;
			const basisModuleFound = basisTranscode(device, url.load, data, callback, {
				isGGGR: ((asset == null ? void 0 : (_asset$file = asset.file) == null ? void 0 : (_asset$file$variants = _asset$file.variants) == null ? void 0 : (_asset$file$variants$ = _asset$file$variants.basis) == null ? void 0 : _asset$file$variants$.opt) & 8) !== 0
			});
			if (!basisModuleFound) {
				callback(`Basis module not found. Asset '${asset.name}' basis texture variant will not be loaded.`);
			}
		};
		Asset.fetchArrayBuffer(url.load, (err, result) => {
			if (err) {
				callback(err);
			} else {
				transcode(result);
			}
		}, asset, this.maxRetries);
	}
	open(url, data, device) {
		const texture = new Texture(device, {
			name: url,
			profilerHint: TEXHINT_ASSET,
			addressU: data.cubemap ? ADDRESS_CLAMP_TO_EDGE : ADDRESS_REPEAT,
			addressV: data.cubemap ? ADDRESS_CLAMP_TO_EDGE : ADDRESS_REPEAT,
			width: data.width,
			height: data.height,
			format: data.format,
			cubemap: data.cubemap,
			levels: data.levels
		});
		texture.upload();
		return texture;
	}
}

export { BasisParser };
