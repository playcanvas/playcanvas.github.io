/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Entity } from '../entity.js';
import { CompressUtils } from '../../scene/compress/compress-utils.js';
import { Decompress } from '../../scene/compress/decompress.js';
import '../../core/tracing.js';

class SceneParser {
	constructor(app, isTemplate) {
		this._app = app;
		this._isTemplate = isTemplate;
	}
	parse(data) {
		const entities = {};
		let parent = null;
		const compressed = data.compressedFormat;
		if (compressed && !data.entDecompressed) {
			data.entDecompressed = true;
			data.entities = new Decompress(data.entities, compressed).run();
		}
		for (const id in data.entities) {
			const curData = data.entities[id];
			const curEnt = this._createEntity(curData, compressed);
			entities[id] = curEnt;
			if (curData.parent === null) {
				parent = curEnt;
			}
		}
		for (const id in data.entities) {
			const curEnt = entities[id];
			const children = data.entities[id].children;
			const len = children.length;
			for (let i = 0; i < len; i++) {
				const childEnt = entities[children[i]];
				if (childEnt) {
					curEnt.addChild(childEnt);
				}
			}
		}
		this._openComponentData(parent, data.entities);
		return parent;
	}
	_createEntity(data, compressed) {
		const entity = new Entity(data.name, this._app);
		entity.setGuid(data.resource_id);
		this._setPosRotScale(entity, data, compressed);
		entity._enabled = data.enabled !== undefined ? data.enabled : true;
		if (this._isTemplate) {
			entity._template = true;
		} else {
			entity._enabledInHierarchy = entity._enabled;
		}
		entity.template = data.template;
		if (data.tags) {
			for (let i = 0; i < data.tags.length; i++) {
				entity.tags.add(data.tags[i]);
			}
		}
		if (data.labels) {
			data.labels.forEach(function (label) {
				entity.addLabel(label);
			});
		}
		return entity;
	}
	_setPosRotScale(entity, data, compressed) {
		if (compressed) {
			CompressUtils.setCompressedPRS(entity, data, compressed);
		} else {
			const p = data.position;
			const r = data.rotation;
			const s = data.scale;
			entity.setLocalPosition(p[0], p[1], p[2]);
			entity.setLocalEulerAngles(r[0], r[1], r[2]);
			entity.setLocalScale(s[0], s[1], s[2]);
		}
	}
	_openComponentData(entity, entities) {
		const systemsList = this._app.systems.list;
		let len = systemsList.length;
		const entityData = entities[entity.getGuid()];
		for (let i = 0; i < len; i++) {
			const system = systemsList[i];
			const componentData = entityData.components[system.id];
			if (componentData) {
				system.addComponent(entity, componentData);
			}
		}
		len = entityData.children.length;
		const children = entity._children;
		for (let i = 0; i < len; i++) {
			if (children[i]) {
				children[i] = this._openComponentData(children[i], entities);
			}
		}
		return entity;
	}
}

export { SceneParser };
