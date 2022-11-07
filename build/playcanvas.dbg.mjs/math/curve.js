/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { extend } from '../core/core.js';
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3VydmUuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9tYXRoL2N1cnZlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGV4dGVuZCB9IGZyb20gJy4uL2NvcmUvY29yZS5qcyc7XG5cbmltcG9ydCB7IENVUlZFX1NNT09USFNURVAgfSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBDdXJ2ZUV2YWx1YXRvciB9IGZyb20gJy4vY3VydmUtZXZhbHVhdG9yLmpzJztcblxuLyoqXG4gKiBBIGN1cnZlIGlzIGEgY29sbGVjdGlvbiBvZiBrZXlzICh0aW1lL3ZhbHVlIHBhaXJzKS4gVGhlIHNoYXBlIG9mIHRoZSBjdXJ2ZSBpcyBkZWZpbmVkIGJ5IGl0c1xuICogdHlwZSB0aGF0IHNwZWNpZmllcyBhbiBpbnRlcnBvbGF0aW9uIHNjaGVtZSBmb3IgdGhlIGtleXMuXG4gKi9cbmNsYXNzIEN1cnZlIHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgbmV3IEN1cnZlIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJbXX0gW2RhdGFdIC0gQW4gYXJyYXkgb2Yga2V5cyAocGFpcnMgb2YgbnVtYmVycyB3aXRoIHRoZSB0aW1lIGZpcnN0IGFuZCB2YWx1ZVxuICAgICAqIHNlY29uZCkuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgY3VydmUgPSBuZXcgcGMuQ3VydmUoW1xuICAgICAqICAgICAwLCAwLCAgICAgICAgLy8gQXQgMCB0aW1lLCB2YWx1ZSBvZiAwXG4gICAgICogICAgIDAuMzMsIDIsICAgICAvLyBBdCAwLjMzIHRpbWUsIHZhbHVlIG9mIDJcbiAgICAgKiAgICAgMC42NiwgMi42LCAgIC8vIEF0IDAuNjYgdGltZSwgdmFsdWUgb2YgMi42XG4gICAgICogICAgIDEsIDMgICAgICAgICAvLyBBdCAxIHRpbWUsIHZhbHVlIG9mIDNcbiAgICAgKiBdKTtcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihkYXRhKSB7XG4gICAgICAgIHRoaXMua2V5cyA9IFtdO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgY3VydmUgaW50ZXJwb2xhdGlvbiBzY2hlbWUuIENhbiBiZTpcbiAgICAgICAgICpcbiAgICAgICAgICogLSB7QGxpbmsgQ1VSVkVfTElORUFSfVxuICAgICAgICAgKiAtIHtAbGluayBDVVJWRV9TTU9PVEhTVEVQfVxuICAgICAgICAgKiAtIHtAbGluayBDVVJWRV9TUExJTkV9XG4gICAgICAgICAqIC0ge0BsaW5rIENVUlZFX1NURVB9XG4gICAgICAgICAqXG4gICAgICAgICAqIERlZmF1bHRzIHRvIHtAbGluayBDVVJWRV9TTU9PVEhTVEVQfS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMudHlwZSA9IENVUlZFX1NNT09USFNURVA7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIENvbnRyb2xzIGhvdyB7QGxpbmsgQ1VSVkVfU1BMSU5FfSB0YW5nZW50cyBhcmUgY2FsY3VsYXRlZC4gVmFsaWQgcmFuZ2UgaXMgYmV0d2VlbiAwIGFuZFxuICAgICAgICAgKiAxIHdoZXJlIDAgcmVzdWx0cyBpbiBhIG5vbi1zbW9vdGggY3VydmUgKGVxdWl2YWxlbnQgdG8gbGluZWFyIGludGVycG9sYXRpb24pIGFuZCAxXG4gICAgICAgICAqIHJlc3VsdHMgaW4gYSB2ZXJ5IHNtb290aCBjdXJ2ZS4gVXNlIDAuNSBmb3IgYSBDYXRtdWxsLXJvbSBzcGxpbmUuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnRlbnNpb24gPSAwLjU7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtDdXJ2ZUV2YWx1YXRvcn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2V2YWwgPSBuZXcgQ3VydmVFdmFsdWF0b3IodGhpcyk7XG5cbiAgICAgICAgaWYgKGRhdGEpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZGF0YS5sZW5ndGggLSAxOyBpICs9IDIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmtleXMucHVzaChbZGF0YVtpXSwgZGF0YVtpICsgMV1dKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc29ydCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgbnVtYmVyIG9mIGtleXMgaW4gdGhlIGN1cnZlLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBnZXQgbGVuZ3RoKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5rZXlzLmxlbmd0aDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBZGQgYSBuZXcga2V5IHRvIHRoZSBjdXJ2ZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB0aW1lIC0gVGltZSB0byBhZGQgbmV3IGtleS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdmFsdWUgLSBWYWx1ZSBvZiBuZXcga2V5LlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJbXX0gW3RpbWUsIHZhbHVlXSBwYWlyLlxuICAgICAqL1xuICAgIGFkZCh0aW1lLCB2YWx1ZSkge1xuICAgICAgICBjb25zdCBrZXlzID0gdGhpcy5rZXlzO1xuICAgICAgICBjb25zdCBsZW4gPSBrZXlzLmxlbmd0aDtcbiAgICAgICAgbGV0IGkgPSAwO1xuXG4gICAgICAgIGZvciAoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChrZXlzW2ldWzBdID4gdGltZSkge1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qga2V5ID0gW3RpbWUsIHZhbHVlXTtcbiAgICAgICAgdGhpcy5rZXlzLnNwbGljZShpLCAwLCBrZXkpO1xuICAgICAgICByZXR1cm4ga2V5O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybiBhIHNwZWNpZmljIGtleS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBpbmRleCAtIFRoZSBpbmRleCBvZiB0aGUga2V5IHRvIHJldHVybi5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyW119IFRoZSBrZXkgYXQgdGhlIHNwZWNpZmllZCBpbmRleC5cbiAgICAgKi9cbiAgICBnZXQoaW5kZXgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMua2V5c1tpbmRleF07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU29ydCBrZXlzIGJ5IHRpbWUuXG4gICAgICovXG4gICAgc29ydCgpIHtcbiAgICAgICAgdGhpcy5rZXlzLnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgICAgICAgIHJldHVybiBhWzBdIC0gYlswXTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgaW50ZXJwb2xhdGVkIHZhbHVlIG9mIHRoZSBjdXJ2ZSBhdCBzcGVjaWZpZWQgdGltZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB0aW1lIC0gVGhlIHRpbWUgYXQgd2hpY2ggdG8gY2FsY3VsYXRlIHRoZSB2YWx1ZS5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBUaGUgaW50ZXJwb2xhdGVkIHZhbHVlLlxuICAgICAqL1xuICAgIHZhbHVlKHRpbWUpIHtcbiAgICAgICAgLy8gd2UgZm9yY2UgcmVzZXQgdGhlIGV2YWx1YXRpb24gYmVjYXVzZSBrZXlzIG1heSBoYXZlIGNoYW5nZWQgc2luY2UgdGhlIGxhc3QgZXZhbHVhdGVcbiAgICAgICAgLy8gKHdlIGNhbid0IGtub3cpXG4gICAgICAgIHJldHVybiB0aGlzLl9ldmFsLmV2YWx1YXRlKHRpbWUsIHRydWUpO1xuICAgIH1cblxuICAgIGNsb3Nlc3QodGltZSkge1xuICAgICAgICBjb25zdCBrZXlzID0gdGhpcy5rZXlzO1xuICAgICAgICBjb25zdCBsZW5ndGggPSBrZXlzLmxlbmd0aDtcbiAgICAgICAgbGV0IG1pbiA9IDI7XG4gICAgICAgIGxldCByZXN1bHQgPSBudWxsO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGRpZmYgPSBNYXRoLmFicyh0aW1lIC0ga2V5c1tpXVswXSk7XG4gICAgICAgICAgICBpZiAobWluID49IGRpZmYpIHtcbiAgICAgICAgICAgICAgICBtaW4gPSBkaWZmO1xuICAgICAgICAgICAgICAgIHJlc3VsdCA9IGtleXNbaV07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgY2xvbmUgb2YgdGhlIHNwZWNpZmllZCBjdXJ2ZSBvYmplY3QuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7dGhpc30gQSBjbG9uZSBvZiB0aGUgc3BlY2lmaWVkIGN1cnZlLlxuICAgICAqL1xuICAgIGNsb25lKCkge1xuICAgICAgICAvKiogQHR5cGUge3RoaXN9ICovXG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IG5ldyB0aGlzLmNvbnN0cnVjdG9yKCk7XG4gICAgICAgIHJlc3VsdC5rZXlzID0gZXh0ZW5kKHJlc3VsdC5rZXlzLCB0aGlzLmtleXMpO1xuICAgICAgICByZXN1bHQudHlwZSA9IHRoaXMudHlwZTtcbiAgICAgICAgcmVzdWx0LnRlbnNpb24gPSB0aGlzLnRlbnNpb247XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2FtcGxlIHRoZSBjdXJ2ZSBhdCByZWd1bGFyIGludGVydmFscyBvdmVyIHRoZSByYW5nZSBbMC4uMV0uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gcHJlY2lzaW9uIC0gVGhlIG51bWJlciBvZiBzYW1wbGVzIHRvIHJldHVybi5cbiAgICAgKiBAcmV0dXJucyB7RmxvYXQzMkFycmF5fSBUaGUgc2V0IG9mIHF1YW50aXplZCB2YWx1ZXMuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHF1YW50aXplKHByZWNpc2lvbikge1xuICAgICAgICBwcmVjaXNpb24gPSBNYXRoLm1heChwcmVjaXNpb24sIDIpO1xuXG4gICAgICAgIGNvbnN0IHZhbHVlcyA9IG5ldyBGbG9hdDMyQXJyYXkocHJlY2lzaW9uKTtcbiAgICAgICAgY29uc3Qgc3RlcCA9IDEuMCAvIChwcmVjaXNpb24gLSAxKTtcblxuICAgICAgICAvLyBxdWFudGl6ZSBncmFwaCB0byB0YWJsZSBvZiBpbnRlcnBvbGF0ZWQgdmFsdWVzXG4gICAgICAgIHZhbHVlc1swXSA9IHRoaXMuX2V2YWwuZXZhbHVhdGUoMCwgdHJ1ZSk7XG4gICAgICAgIGZvciAobGV0IGkgPSAxOyBpIDwgcHJlY2lzaW9uOyBpKyspIHtcbiAgICAgICAgICAgIHZhbHVlc1tpXSA9IHRoaXMuX2V2YWwuZXZhbHVhdGUoc3RlcCAqIGkpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHZhbHVlcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTYW1wbGUgdGhlIGN1cnZlIGF0IHJlZ3VsYXIgaW50ZXJ2YWxzIG92ZXIgdGhlIHJhbmdlIFswLi4xXSBhbmQgY2xhbXAgdGhlIHJlc3VsdGluZyBzYW1wbGVzXG4gICAgICogdG8gW21pbi4ubWF4XS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBwcmVjaXNpb24gLSBUaGUgbnVtYmVyIG9mIHNhbXBsZXMgdG8gcmV0dXJuLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBtaW4gLSBUaGUgbWluaW11bSBvdXRwdXQgdmFsdWUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG1heCAtIFRoZSBtYXhpbXVtIG91dHB1dCB2YWx1ZS5cbiAgICAgKiBAcmV0dXJucyB7RmxvYXQzMkFycmF5fSBUaGUgc2V0IG9mIHF1YW50aXplZCB2YWx1ZXMuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHF1YW50aXplQ2xhbXBlZChwcmVjaXNpb24sIG1pbiwgbWF4KSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMucXVhbnRpemUocHJlY2lzaW9uKTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCByZXN1bHQubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIHJlc3VsdFtpXSA9IE1hdGgubWluKG1heCwgTWF0aC5tYXgobWluLCByZXN1bHRbaV0pKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbn1cblxuZXhwb3J0IHsgQ3VydmUgfTtcbiJdLCJuYW1lcyI6WyJDdXJ2ZSIsImNvbnN0cnVjdG9yIiwiZGF0YSIsImtleXMiLCJ0eXBlIiwiQ1VSVkVfU01PT1RIU1RFUCIsInRlbnNpb24iLCJfZXZhbCIsIkN1cnZlRXZhbHVhdG9yIiwiaSIsImxlbmd0aCIsInB1c2giLCJzb3J0IiwiYWRkIiwidGltZSIsInZhbHVlIiwibGVuIiwia2V5Iiwic3BsaWNlIiwiZ2V0IiwiaW5kZXgiLCJhIiwiYiIsImV2YWx1YXRlIiwiY2xvc2VzdCIsIm1pbiIsInJlc3VsdCIsImRpZmYiLCJNYXRoIiwiYWJzIiwiY2xvbmUiLCJleHRlbmQiLCJxdWFudGl6ZSIsInByZWNpc2lvbiIsIm1heCIsInZhbHVlcyIsIkZsb2F0MzJBcnJheSIsInN0ZXAiLCJxdWFudGl6ZUNsYW1wZWQiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQVNBLE1BQU1BLEtBQU4sQ0FBWTtFQWNSQyxXQUFXLENBQUNDLElBQUQsRUFBTztJQUNkLElBQUtDLENBQUFBLElBQUwsR0FBWSxFQUFaLENBQUE7SUFjQSxJQUFLQyxDQUFBQSxJQUFMLEdBQVlDLGdCQUFaLENBQUE7SUFTQSxJQUFLQyxDQUFBQSxPQUFMLEdBQWUsR0FBZixDQUFBO0FBTUEsSUFBQSxJQUFBLENBQUtDLEtBQUwsR0FBYSxJQUFJQyxj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