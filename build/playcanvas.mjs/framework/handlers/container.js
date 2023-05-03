import { path } from '../../core/path.js';
import { GlbContainerParser } from '../parsers/glb-container-parser.js';

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
		this.glbContainerParser = new GlbContainerParser(app.graphicsDevice, app.assets, 0);
		this.parsers = {};
	}
	set maxRetries(value) {
		this.glbContainerParser.maxRetries = value;
		for (const parser in this.parsers) {
			if (this.parsers.hasOwnProperty(parser)) {
				this.parsers[parser].maxRetries = value;
			}
		}
	}
	get maxRetries() {
		return this.glbContainerParser.maxRetries;
	}
	_getUrlWithoutParams(url) {
		return url.indexOf('?') >= 0 ? url.split('?')[0] : url;
	}
	_getParser(url) {
		const ext = url ? path.getExtension(this._getUrlWithoutParams(url)).toLowerCase().replace('.', '') : null;
		return this.parsers[ext] || this.glbContainerParser;
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
