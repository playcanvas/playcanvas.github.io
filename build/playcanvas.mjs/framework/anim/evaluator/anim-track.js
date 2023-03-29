import { AnimEvents } from './anim-events.js';

class AnimTrack {
	constructor(name, duration, inputs, outputs, curves, animEvents = new AnimEvents([])) {
		this._name = name;
		this._duration = duration;
		this._inputs = inputs;
		this._outputs = outputs;
		this._curves = curves;
		this._animEvents = animEvents;
	}
	get name() {
		return this._name;
	}
	get duration() {
		return this._duration;
	}
	get inputs() {
		return this._inputs;
	}
	get outputs() {
		return this._outputs;
	}
	get curves() {
		return this._curves;
	}
	set events(animEvents) {
		this._animEvents = animEvents;
	}
	get events() {
		return this._animEvents.events;
	}
	eval(time, snapshot) {
		snapshot._time = time;
		const inputs = this._inputs;
		const outputs = this._outputs;
		const curves = this._curves;
		const cache = snapshot._cache;
		const results = snapshot._results;
		for (let i = 0; i < inputs.length; ++i) {
			cache[i].update(time, inputs[i]._data);
		}
		for (let i = 0; i < curves.length; ++i) {
			const curve = curves[i];
			const output = outputs[curve._output];
			const result = results[i];
			cache[curve._input].eval(result, curve._interpolation, output);
		}
	}
}
AnimTrack.EMPTY = Object.freeze(new AnimTrack('empty', Number.MAX_VALUE, [], [], []));

export { AnimTrack };
