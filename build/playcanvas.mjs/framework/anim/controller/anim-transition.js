import { ANIM_INTERRUPTION_NONE } from './constants.js';

class AnimTransition {
	constructor({
		from,
		to,
		time = 0,
		priority = 0,
		conditions = [],
		exitTime = null,
		transitionOffset = null,
		interruptionSource = ANIM_INTERRUPTION_NONE
	}) {
		this._from = from;
		this._to = to;
		this._time = time;
		this._priority = priority;
		this._conditions = conditions;
		this._exitTime = exitTime;
		this._transitionOffset = transitionOffset;
		this._interruptionSource = interruptionSource;
	}
	get from() {
		return this._from;
	}
	set to(value) {
		this._to = value;
	}
	get to() {
		return this._to;
	}
	get time() {
		return this._time;
	}
	get priority() {
		return this._priority;
	}
	get conditions() {
		return this._conditions;
	}
	get exitTime() {
		return this._exitTime;
	}
	get transitionOffset() {
		return this._transitionOffset;
	}
	get interruptionSource() {
		return this._interruptionSource;
	}
	get hasExitTime() {
		return !!this.exitTime;
	}
}

export { AnimTransition };
