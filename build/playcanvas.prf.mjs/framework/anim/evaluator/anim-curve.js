/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
class AnimCurve {
	constructor(paths, input, output, interpolation) {
		this._paths = paths;
		this._input = input;
		this._output = output;
		this._interpolation = interpolation;
	}
	get paths() {
		return this._paths;
	}
	get input() {
		return this._input;
	}
	get output() {
		return this._output;
	}
	get interpolation() {
		return this._interpolation;
	}
}

export { AnimCurve };
