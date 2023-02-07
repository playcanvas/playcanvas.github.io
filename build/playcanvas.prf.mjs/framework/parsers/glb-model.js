/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { GlbContainerResource } from './glb-container-resource.js';
import { GlbParser } from './glb-parser.js';

class GlbModelParser {
	constructor(device, defaultMaterial) {
		this._device = device;
		this._defaultMaterial = defaultMaterial;
	}
	parse(data) {
		const glbResources = GlbParser.parse('filename.glb', data, this._device);
		if (glbResources) {
			const model = GlbContainerResource.createModel(glbResources, this._defaultMaterial);
			glbResources.destroy();
			return model;
		}
		return null;
	}
}

export { GlbModelParser };
