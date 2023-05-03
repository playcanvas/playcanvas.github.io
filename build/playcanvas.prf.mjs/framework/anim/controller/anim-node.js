import { Vec2 } from '../../../core/math/vec2.js';

class AnimNode {
	constructor(state, parent, name, point, speed = 1) {
		this._state = state;
		this._parent = parent;
		this._name = name;
		if (Array.isArray(point)) {
			this._point = new Vec2(point[0], point[1]);
			this._pointLength = this._point.length();
		} else {
			this._point = point;
			this._pointLength = point;
		}
		this._speed = speed;
		this._weightedSpeed = 1.0;
		this._weight = 1.0;
		this._animTrack = null;
	}
	get parent() {
		return this._parent;
	}
	get name() {
		return this._name;
	}
	get path() {
		return this._parent ? this._parent.path + '.' + this._name : this._name;
	}
	get point() {
		return this._point;
	}
	get pointLength() {
		return this._pointLength;
	}
	set weight(value) {
		this._weight = value;
	}
	get weight() {
		return this._parent ? this._parent.weight * this._weight : this._weight;
	}
	get normalizedWeight() {
		const totalWeight = this._state.totalWeight;
		if (totalWeight === 0.0) return 0.0;
		return this.weight / totalWeight;
	}
	get speed() {
		return this._weightedSpeed * this._speed;
	}
	get absoluteSpeed() {
		return Math.abs(this._speed);
	}
	set weightedSpeed(weightedSpeed) {
		this._weightedSpeed = weightedSpeed;
	}
	get weightedSpeed() {
		return this._weightedSpeed;
	}
	set animTrack(value) {
		this._animTrack = value;
	}
	get animTrack() {
		return this._animTrack;
	}
}

export { AnimNode };
