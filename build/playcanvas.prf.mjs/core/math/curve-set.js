import { CURVE_SMOOTHSTEP } from './constants.js';
import { Curve } from './curve.js';
import { CurveEvaluator } from './curve-evaluator.js';

class CurveSet {
	constructor() {
		this.curves = [];
		this._type = CURVE_SMOOTHSTEP;
		if (arguments.length > 1) {
			for (let i = 0; i < arguments.length; i++) {
				this.curves.push(new Curve(arguments[i]));
			}
		} else {
			if (arguments.length === 0) {
				this.curves.push(new Curve());
			} else {
				const arg = arguments[0];
				if (typeof arg === 'number') {
					for (let i = 0; i < arg; i++) {
						this.curves.push(new Curve());
					}
				} else {
					for (let i = 0; i < arg.length; i++) {
						this.curves.push(new Curve(arg[i]));
					}
				}
			}
		}
	}
	get length() {
		return this.curves.length;
	}
	set type(value) {
		this._type = value;
		for (let i = 0; i < this.curves.length; i++) {
			this.curves[i].type = value;
		}
	}
	get type() {
		return this._type;
	}
	get(index) {
		return this.curves[index];
	}
	value(time, result = []) {
		const length = this.curves.length;
		result.length = length;
		for (let i = 0; i < length; i++) {
			result[i] = this.curves[i].value(time);
		}
		return result;
	}
	clone() {
		const result = new this.constructor();
		result.curves = [];
		for (let i = 0; i < this.curves.length; i++) {
			result.curves.push(this.curves[i].clone());
		}
		result._type = this._type;
		return result;
	}
	quantize(precision) {
		precision = Math.max(precision, 2);
		const numCurves = this.curves.length;
		const values = new Float32Array(precision * numCurves);
		const step = 1.0 / (precision - 1);
		for (let c = 0; c < numCurves; c++) {
			const ev = new CurveEvaluator(this.curves[c]);
			for (let i = 0; i < precision; i++) {
				values[i * numCurves + c] = ev.evaluate(step * i);
			}
		}
		return values;
	}
	quantizeClamped(precision, min, max) {
		const result = this.quantize(precision);
		for (let i = 0; i < result.length; ++i) {
			result[i] = Math.min(max, Math.max(min, result[i]));
		}
		return result;
	}
}

export { CurveSet };
