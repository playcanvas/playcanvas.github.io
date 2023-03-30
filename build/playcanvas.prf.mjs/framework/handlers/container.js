/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { path } from '../../core/path.js';
import { GlbParser } from '../parsers/glb-parser.js';

class ContainerResource {
	instantiateModelEntity(options) {
		return null;
	}
	instantiateRenderEntity(options) {
		return null;
	}
	getMaterialVariants() {
		return null;
	}
	applyMaterialVariant(entity, name) {}
	applyMaterialVariantInstances(instances, name) {}
}
class ContainerHandler {
	constructor(app) {
		this.handlerType = "container";
		this.glbParser = new GlbParser(app.graphicsDevice, app.assets, 0);
		this.parsers = {};
	}
	set maxRetries(value) {
		this.glbParser.maxRetries = value;
		for (const parser in this.parsers) {
			if (this.parsers.hasOwnProperty(parser)) {
				this.parsers[parser].maxRetries = value;
			}
		}
	}
	get maxRetries() {
		return this.glbParser.maxRetries;
	}
	_getUrlWithoutParams(url) {
		return url.indexOf('?') >= 0 ? url.split('?')[0] : url;
	}
	_getParser(url) {
		const ext = url ? path.getExtension(this._getUrlWithoutParams(url)).toLowerCase().replace('.', '') : null;
		return this.parsers[ext] || this.glbParser;
	}
	load(url, callback, asset) {
		if (typeof url === 'string') {
			url = {
				load: url,
				original: url
			};
		}
		this._getParser(url.original).load(url, callback, asset);
	}
	open(url, data, asset) {
		return this._getParser(url).open(url, data, asset);
	}
	patch(asset, assets) {}
}

export { ContainerHandler, ContainerResource };
