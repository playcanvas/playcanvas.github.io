/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { path } from '../../core/path.js';
import '../../core/tracing.js';
import { Http, http } from '../../platform/net/http.js';
import { getDefaultMaterial } from '../../scene/materials/default-material.js';
import { GlbModelParser } from '../parsers/glb-model.js';
import { JsonModelParser } from '../parsers/json-model.js';

class ModelHandler {
	constructor(app) {
		this.handlerType = "model";
		this._device = app.graphicsDevice;
		this._parsers = [];
		this._defaultMaterial = getDefaultMaterial(this._device);
		this.maxRetries = 0;
		this.addParser(new JsonModelParser(this._device, this._defaultMaterial), function (url, data) {
			return path.getExtension(url) === '.json';
		});
		this.addParser(new GlbModelParser(this._device, this._defaultMaterial), function (url, data) {
			return path.getExtension(url) === '.glb';
		});
	}
	load(url, callback) {
		if (typeof url === 'string') {
			url = {
				load: url,
				original: url
			};
		}
		const options = {
			retry: this.maxRetries > 0,
			maxRetries: this.maxRetries
		};
		if (url.load.startsWith('blob:') || url.load.startsWith('data:')) {
			if (path.getExtension(url.original).toLowerCase() === '.glb') {
				options.responseType = Http.ResponseType.ARRAY_BUFFER;
			} else {
				options.responseType = Http.ResponseType.JSON;
			}
		}
		http.get(url.load, options, function (err, response) {
			if (!callback) return;
			if (!err) {
				callback(null, response);
			} else {
				callback(`Error loading model: ${url.original} [${err}]`);
			}
		});
	}
	open(url, data) {
		for (let i = 0; i < this._parsers.length; i++) {
			const p = this._parsers[i];
			if (p.decider(url, data)) {
				return p.parser.parse(data);
			}
		}
		return null;
	}
	patch(asset, assets) {
		if (!asset.resource) return;
		const data = asset.data;
		const self = this;
		asset.resource.meshInstances.forEach(function (meshInstance, i) {
			if (data.mapping) {
				const handleMaterial = function handleMaterial(asset) {
					if (asset.resource) {
						meshInstance.material = asset.resource;
					} else {
						asset.once('load', handleMaterial);
						assets.load(asset);
					}
					asset.once('remove', function (asset) {
						if (meshInstance.material === asset.resource) {
							meshInstance.material = self._defaultMaterial;
						}
					});
				};
				if (!data.mapping[i]) {
					meshInstance.material = self._defaultMaterial;
					return;
				}
				const id = data.mapping[i].material;
				const url = data.mapping[i].path;
				let material;
				if (id !== undefined) {
					if (!id) {
						meshInstance.material = self._defaultMaterial;
					} else {
						material = assets.get(id);
						if (material) {
							handleMaterial(material);
						} else {
							assets.once('add:' + id, handleMaterial);
						}
					}
				} else if (url) {
					const path = asset.getAbsoluteUrl(data.mapping[i].path);
					material = assets.getByUrl(path);
					if (material) {
						handleMaterial(material);
					} else {
						assets.once('add:url:' + path, handleMaterial);
					}
				}
			}
		});
	}
	addParser(parser, decider) {
		this._parsers.push({
			parser: parser,
			decider: decider
		});
	}
}

export { ModelHandler };
