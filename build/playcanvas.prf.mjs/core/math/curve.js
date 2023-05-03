import { extend } from '../core.js';
import { CURVE_SMOOTHSTEP } from './constants.js';
import { CurveEvaluator } from './curve-evaluator.js';

class Curve {
	constructor(data) {
		this.keys = [];
		this.type = CURVE_SMOOTHSTEP;
		this.tension = 0.5;
		this._eval = new CurveEvaluator(this);
		if (data) {
			for (let i = 0; i < data.length - 1; i += 2) {
				this.keys.push([data[i], data[i + 1]]);
			}
		}
		this.sort();
	}
	get length() {
		return this.keys.length;
	}
	add(time, value) {
		const keys = this.keys;
		const len = keys.length;
		let i = 0;
		for (; i < len; i++) {
			if (keys[i][0] > time) {
				break;
			}
		}
		const key = [time, value];
		this.keys.splice(i, 0, key);
		return key;
	}
	get(index) {
		return this.keys[index];
	}
	sort() {
		this.keys.sort(function (a, b) {
			return a[0] - b[0];
		});
	}
	value(time) {
		return this._eval.evaluate(time, true);
	}
	closest(time) {
		const keys = this.keys;
		const length = keys.length;
		let min = 2;
		let result = null;
		for (let i = 0; i < length; i++) {
			const diff = Math.abs(time - keys[i][0]);
			if (min >= diff) {
				min = diff;
				result = keys[i];
			} else {
				break;
			}
		}
		return result;
	}
	clone() {
		const result = new this.constructor();
		result.keys = extend(result.keys, this.keys);
		result.type = this.type;
		result.tension = this.tension;
		return result;
	}
	quantize(precision) {
		precision = Math.max(precision, 2);
		const values = new Float32Array(precision);
		const step = 1.0 / (precision - 1);
		values[0] = this._eval.evaluate(0, true);
		for (let i = 1; i < precision; i++) {
			values[i] = this._eval.evaluate(step * i);
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

export { Curve };
