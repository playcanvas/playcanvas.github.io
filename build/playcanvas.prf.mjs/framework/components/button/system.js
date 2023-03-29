/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';
import { ButtonComponent } from './component.js';
import { ButtonComponentData } from './data.js';

const _schema = ['enabled', 'active', {
	name: 'imageEntity',
	type: 'entity'
}, {
	name: 'hitPadding',
	type: 'vec4'
}, 'transitionMode', {
	name: 'hoverTint',
	type: 'rgba'
}, {
	name: 'pressedTint',
	type: 'rgba'
}, {
	name: 'inactiveTint',
	type: 'rgba'
}, 'fadeDuration', 'hoverSpriteAsset', 'hoverSpriteFrame', 'pressedSpriteAsset', 'pressedSpriteFrame', 'inactiveSpriteAsset', 'inactiveSpriteFrame'];
class ButtonComponentSystem extends ComponentSystem {
	constructor(app) {
		super(app);
		this.id = 'button';
		this.ComponentType = ButtonComponent;
		this.DataType = ButtonComponentData;
		this.schema = _schema;
		this.on('beforeremove', this._onRemoveComponent, this);
		this.app.systems.on('update', this.onUpdate, this);
	}
	initializeComponentData(component, data, properties) {
		super.initializeComponentData(component, data, _schema);
	}
	onUpdate(dt) {
		const components = this.store;
		for (const id in components) {
			const entity = components[id].entity;
			const component = entity.button;
			if (component.enabled && entity.enabled) {
				component.onUpdate();
			}
		}
	}
	_onRemoveComponent(entity, component) {
		component.onRemove();
	}
	destroy() {
		super.destroy();
		this.app.systems.off('update', this.onUpdate, this);
	}
}
Component._buildAccessors(ButtonComponent.prototype, _schema);

export { ButtonComponentSystem };
