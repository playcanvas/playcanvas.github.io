import { Vec3 } from '../../../core/math/vec3.js';
import { Component } from '../component.js';

class ZoneComponent extends Component {
	constructor(system, entity) {
		super(system, entity);
		this._oldState = true;
		this._size = new Vec3();
		this.on('set_enabled', this._onSetEnabled, this);
	}
	set size(data) {
		if (data instanceof Vec3) {
			this._size.copy(data);
		} else if (data instanceof Array && data.length >= 3) {
			this.size.set(data[0], data[1], data[2]);
		}
	}
	get size() {
		return this._size;
	}
	onEnable() {
		this._checkState();
	}
	onDisable() {
		this._checkState();
	}
	_onSetEnabled(prop, old, value) {
		this._checkState();
	}
	_checkState() {
		const state = this.enabled && this.entity.enabled;
		if (state === this._oldState) return;
		this._oldState = state;
		this.fire('enable');
		this.fire('state', this.enabled);
	}
	_onBeforeRemove() {
		this.fire('remove');
	}
}

export { ZoneComponent };
