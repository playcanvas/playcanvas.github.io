/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { GlbContainerResource } from './glb-container-resource.js';
import { GlbParser } from './glb-parser.js';

class GlbModelParser {
	constructor(device, defaultMaterial) {
		this._device = device;
		this._defaultMaterial = defaultMaterial;
	}
	parse(data, callback) {
		GlbParser.parse('filename.glb', data, this._device, null, (err, result) => {
			if (err) {
				callback(err);
			} else {
				const model = GlbContainerResource.createModel(result, this._defaultMaterial);
				result.destroy();
				callback(null, model);
			}
		});
	}
}

export { GlbModelParser };
