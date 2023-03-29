/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';
import { ScrollbarComponent } from './component.js';
import { ScrollbarComponentData } from './data.js';

const _schema = [{
	name: 'enabled',
	type: 'boolean'
}, {
	name: 'orientation',
	type: 'number'
}, {
	name: 'value',
	type: 'number'
}, {
	name: 'handleSize',
	type: 'number'
}, {
	name: 'handleEntity',
	type: 'entity'
}];
class ScrollbarComponentSystem extends ComponentSystem {
	constructor(app) {
		super(app);
		this.id = 'scrollbar';
		this.ComponentType = ScrollbarComponent;
		this.DataType = ScrollbarComponentData;
		this.schema = _schema;
		this.on('beforeremove', this._onRemoveComponent, this);
	}
	initializeComponentData(component, data, properties) {
		super.initializeComponentData(component, data, _schema);
	}
	_onRemoveComponent(entity, component) {
		component.onRemove();
	}
}
Component._buildAccessors(ScrollbarComponent.prototype, _schema);

export { ScrollbarComponentSystem };
