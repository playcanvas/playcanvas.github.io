import { AnimCache } from './anim-cache.js';

class AnimSnapshot {
	constructor(animTrack) {
		this._name = animTrack.name + 'Snapshot';
		this._time = -1;
		this._cache = [];
		this._results = [];
		for (let i = 0; i < animTrack._inputs.length; ++i) {
			this._cache[i] = new AnimCache();
		}
		const curves = animTrack._curves;
		const outputs = animTrack._outputs;
		for (let i = 0; i < curves.length; ++i) {
			const curve = curves[i];
			const output = outputs[curve._output];
			const storage = [];
			for (let j = 0; j < output._components; ++j) {
				storage[j] = 0;
			}
			this._results[i] = storage;
		}
	}
}

export { AnimSnapshot };
