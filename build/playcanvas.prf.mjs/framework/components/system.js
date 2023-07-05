import { EventHandler } from '../../core/event-handler.js';
import { Color } from '../../core/math/color.js';
import { Vec2 } from '../../core/math/vec2.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Vec4 } from '../../core/math/vec4.js';

class ComponentSystem extends EventHandler {
	constructor(app) {
		super();
		this.app = app;
		this.store = {};
		this.schema = [];
	}
	addComponent(entity, data = {}) {
		const component = new this.ComponentType(this, entity);
		const componentData = new this.DataType();
		this.store[entity.getGuid()] = {
			entity: entity,
			data: componentData
		};
		entity[this.id] = component;
		entity.c[this.id] = component;
		this.initializeComponentData(component, data, []);
		this.fire('add', entity, component);
		return component;
	}
	removeComponent(entity) {
		const record = this.store[entity.getGuid()];
		const component = entity.c[this.id];
		this.fire('beforeremove', entity, component);
		delete this.store[entity.getGuid()];
		entity[this.id] = undefined;
		delete entity.c[this.id];
		this.fire('remove', entity, record.data);
	}
	cloneComponent(entity, clone) {
		const src = this.store[entity.getGuid()];
		return this.addComponent(clone, src.data);
	}
	initializeComponentData(component, data = {}, properties) {
		for (let i = 0, len = properties.length; i < len; i++) {
			const descriptor = properties[i];
			let name, type;
			if (typeof descriptor === 'object') {
				name = descriptor.name;
				type = descriptor.type;
			} else {
				name = descriptor;
				type = undefined;
			}
			let value = data[name];
			if (value !== undefined) {
				if (type !== undefined) {
					value = convertValue(value, type);
				}
				component[name] = value;
			} else {
				component[name] = component.data[name];
			}
		}
		if (component.enabled && component.entity.enabled) {
			component.onEnable();
		}
	}
	getPropertiesOfType(type) {
		const matchingProperties = [];
		const schema = this.schema || [];
		schema.forEach(function (descriptor) {
			if (descriptor && typeof descriptor === 'object' && descriptor.type === type) {
				matchingProperties.push(descriptor);
			}
		});
		return matchingProperties;
	}
	destroy() {
		this.off();
	}
}
function convertValue(value, type) {
	if (!value) {
		return value;
	}
	switch (type) {
		case 'rgb':
			if (value instanceof Color) {
				return value.clone();
			}
			return new Color(value[0], value[1], value[2]);
		case 'rgba':
			if (value instanceof Color) {
				return value.clone();
			}
			return new Color(value[0], value[1], value[2], value[3]);
		case 'vec2':
			if (value instanceof Vec2) {
				return value.clone();
			}
			return new Vec2(value[0], value[1]);
		case 'vec3':
			if (value instanceof Vec3) {
				return value.clone();
			}
			return new Vec3(value[0], value[1], value[2]);
		case 'vec4':
			if (value instanceof Vec4) {
				return value.clone();
			}
			return new Vec4(value[0], value[1], value[2], value[3]);
		case 'boolean':
		case 'number':
		case 'string':
			return value;
		case 'entity':
			return value;
		default:
			throw new Error('Could not convert unhandled type: ' + type);
	}
}

export { ComponentSystem };
