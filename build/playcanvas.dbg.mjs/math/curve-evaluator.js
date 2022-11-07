/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { CURVE_STEP, CURVE_LINEAR, CURVE_SMOOTHSTEP, CURVE_CATMULL, CURVE_CARDINAL, CURVE_SPLINE } from './constants.js';
import { math } from './math.js';

class CurveEvaluator {
  constructor(curve, time = 0) {
    this._curve = curve;
    this._left = -Infinity;
    this._right = Infinity;
    this._recip = 0;
    this._p0 = 0;
    this._p1 = 0;
    this._m0 = 0;
    this._m1 = 0;

    this._reset(time);
  }

  evaluate(time, forceReset = false) {
    if (forceReset || time < this._left || time >= this._right) {
      this._reset(time);
    }

    let result;
    const type = this._curve.type;

    if (type === CURVE_STEP) {
      result = this._p0;
    } else {
      const t = this._recip === 0 ? 0 : (time - this._left) * this._recip;

      if (type === CURVE_LINEAR) {
        result = math.lerp(this._p0, this._p1, t);
      } else if (type === CURVE_SMOOTHSTEP) {
        result = math.lerp(this._p0, this._p1, t * t * (3 - 2 * t));
      } else {
        result = this._evaluateHermite(this._p0, this._p1, this._m0, this._m1, t);
      }
    }

    return result;
  }

  _reset(time) {
    const keys = this._curve.keys;
    const len = keys.length;

    if (!len) {
      this._left = -Infinity;
      this._right = Infinity;
      this._recip = 0;
      this._p0 = this._p1 = this._m0 = this._m1 = 0;
    } else {
      if (time < keys[0][0]) {
        this._left = -Infinity;
        this._right = keys[0][0];
        this._recip = 0;
        this._p0 = this._p1 = keys[0][1];
        this._m0 = this._m1 = 0;
      } else if (time >= keys[len - 1][0]) {
        this._left = keys[len - 1][0];
        this._right = Infinity;
        this._recip = 0;
        this._p0 = this._p1 = keys[len - 1][1];
        this._m0 = this._m1 = 0;
      } else {
        let index = 0;

        while (time >= keys[index + 1][0]) {
          index++;
        }

        this._left = keys[index][0];
        this._right = keys[index + 1][0];
        const diff = 1.0 / (this._right - this._left);
        this._recip = isFinite(diff) ? diff : 0;
        this._p0 = keys[index][1];
        this._p1 = keys[index + 1][1];

        if (this._isHermite()) {
          this._calcTangents(keys, index);
        }
      }
    }
  }

  _isHermite() {
    return this._curve.type === CURVE_CATMULL || this._curve.type === CURVE_CARDINAL || this._curve.type === CURVE_SPLINE;
  }

  _calcTangents(keys, index) {
    let a;
    const b = keys[index];
    const c = keys[index + 1];
    let d;

    if (index === 0) {
      a = [keys[0][0] + (keys[0][0] - keys[1][0]), keys[0][1] + (keys[0][1] - keys[1][1])];
    } else {
      a = keys[index - 1];
    }

    if (index === keys.length - 2) {
      d = [keys[index + 1][0] + (keys[index + 1][0] - keys[index][0]), keys[index + 1][1] + (keys[index + 1][1] - keys[index][1])];
    } else {
      d = keys[index + 2];
    }

    if (this._curve.type === CURVE_SPLINE) {
      const s1_ = 2 * (c[0] - b[0]) / (c[0] - a[0]);
      const s2_ = 2 * (c[0] - b[0]) / (d[0] - b[0]);
      this._m0 = this._curve.tension * (isFinite(s1_) ? s1_ : 0) * (c[1] - a[1]);
      this._m1 = this._curve.tension * (isFinite(s2_) ? s2_ : 0) * (d[1] - b[1]);
    } else {
      const s1 = (c[0] - b[0]) / (b[0] - a[0]);
      const s2 = (c[0] - b[0]) / (d[0] - c[0]);
      const a_ = b[1] + (a[1] - b[1]) * (isFinite(s1) ? s1 : 0);
      const d_ = c[1] + (d[1] - c[1]) * (isFinite(s2) ? s2 : 0);
      const tension = this._curve.type === CURVE_CATMULL ? 0.5 : this._curve.tension;
      this._m0 = tension * (c[1] - a_);
      this._m1 = tension * (d_ - b[1]);
    }
  }

  _evaluateHermite(p0, p1, m0, m1, t) {
    const t2 = t * t;
    const twot = t + t;
    const omt = 1 - t;
    const omt2 = omt * omt;
    return p0 * ((1 + twot) * omt2) + m0 * (t * omt2) + p1 * (t2 * (3 - twot)) + m1 * (t2 * (t - 1));
  }

}

export { CurveEvaluator };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3VydmUtZXZhbHVhdG9yLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvbWF0aC9jdXJ2ZS1ldmFsdWF0b3IuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ1VSVkVfQ0FSRElOQUwsIENVUlZFX0NBVE1VTEwsIENVUlZFX0xJTkVBUiwgQ1VSVkVfU01PT1RIU1RFUCwgQ1VSVkVfU1BMSU5FLCBDVVJWRV9TVEVQIH0gZnJvbSAnLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgbWF0aCB9IGZyb20gJy4vbWF0aC5qcyc7XG5cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuL2N1cnZlLmpzJykuQ3VydmV9IEN1cnZlICovXG5cbi8qKlxuICogQSBjbGFzcyBmb3IgZXZhbHVhdGluZyBhIGN1cnZlIGF0IGEgc3BlY2lmaWMgdGltZS5cbiAqXG4gKiBAaWdub3JlXG4gKi9cbmNsYXNzIEN1cnZlRXZhbHVhdG9yIHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgQ3VydmVFdmFsdWF0b3IgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0N1cnZlfSBjdXJ2ZSAtIFRoZSBjdXJ2ZSB0byBldmFsdWF0ZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdGltZSAtIFRoZSBpbml0aWFsIHRpbWUgdG8gZXZhbHVhdGUgdGhlIGN1cnZlIGF0LiBEZWZhdWx0cyB0byAwLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGN1cnZlLCB0aW1lID0gMCkge1xuICAgICAgICB0aGlzLl9jdXJ2ZSA9IGN1cnZlO1xuICAgICAgICB0aGlzLl9sZWZ0ID0gLUluZmluaXR5O1xuICAgICAgICB0aGlzLl9yaWdodCA9IEluZmluaXR5O1xuICAgICAgICB0aGlzLl9yZWNpcCA9IDA7XG4gICAgICAgIHRoaXMuX3AwID0gMDtcbiAgICAgICAgdGhpcy5fcDEgPSAwO1xuICAgICAgICB0aGlzLl9tMCA9IDA7XG4gICAgICAgIHRoaXMuX20xID0gMDtcbiAgICAgICAgdGhpcy5fcmVzZXQodGltZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRXZhbHVhdGUgdGhlIGN1cnZlIGF0IHRoZSBnaXZlbiB0aW1lLiBTcGVjaWZ5IGZvcmNlUmVzZXQgaWYgdGhlIHVuZGVybHlpbmcgY3VydmUga2V5cyBoYXZlXG4gICAgICogY2hhbmdlZCBzaW5jZSB0aGUgbGFzdCBldmFsdWF0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHRpbWUgLSBUaW1lIHRvIGV2YWx1YXRlIHRoZSBjdXJ2ZSBhdC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtmb3JjZVJlc2V0PWZhbHNlXSAtIEZvcmNlIHJlc2V0IG9mIHRoZSBjdXJ2ZS5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBUaGUgZXZhbHVhdGVkIHZhbHVlLlxuICAgICAqL1xuICAgIGV2YWx1YXRlKHRpbWUsIGZvcmNlUmVzZXQgPSBmYWxzZSkge1xuICAgICAgICBpZiAoZm9yY2VSZXNldCB8fCB0aW1lIDwgdGhpcy5fbGVmdCB8fCB0aW1lID49IHRoaXMuX3JpZ2h0KSB7XG4gICAgICAgICAgICB0aGlzLl9yZXNldCh0aW1lKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCByZXN1bHQ7XG5cbiAgICAgICAgY29uc3QgdHlwZSA9IHRoaXMuX2N1cnZlLnR5cGU7XG4gICAgICAgIGlmICh0eXBlID09PSBDVVJWRV9TVEVQKSB7XG4gICAgICAgICAgICAvLyBzdGVwXG4gICAgICAgICAgICByZXN1bHQgPSB0aGlzLl9wMDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIGNhbGN1bGF0ZSBub3JtYWxpemVkIHRcbiAgICAgICAgICAgIGNvbnN0IHQgPSAodGhpcy5fcmVjaXAgPT09IDApID8gMCA6ICh0aW1lIC0gdGhpcy5fbGVmdCkgKiB0aGlzLl9yZWNpcDtcblxuICAgICAgICAgICAgaWYgKHR5cGUgPT09IENVUlZFX0xJTkVBUikge1xuICAgICAgICAgICAgICAgIC8vIGxpbmVhclxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IG1hdGgubGVycCh0aGlzLl9wMCwgdGhpcy5fcDEsIHQpO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh0eXBlID09PSBDVVJWRV9TTU9PVEhTVEVQKSB7XG4gICAgICAgICAgICAgICAgLy8gc21vb3Roc3RlcFxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IG1hdGgubGVycCh0aGlzLl9wMCwgdGhpcy5fcDEsIHQgKiB0ICogKDMgLSAyICogdCkpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBjdXJ2ZVxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IHRoaXMuX2V2YWx1YXRlSGVybWl0ZSh0aGlzLl9wMCwgdGhpcy5fcDEsIHRoaXMuX20wLCB0aGlzLl9tMSwgdCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDYWxjdWxhdGUgd2VpZ2h0cyBmb3IgdGhlIGN1cnZlIGludGVydmFsIGF0IHRoZSBnaXZlbiB0aW1lLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHRpbWUgLSBUaW1lIHRvIGV2YWx1YXRlIHRoZSBjdXJ2ZSBhdC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9yZXNldCh0aW1lKSB7XG4gICAgICAgIGNvbnN0IGtleXMgPSB0aGlzLl9jdXJ2ZS5rZXlzO1xuICAgICAgICBjb25zdCBsZW4gPSBrZXlzLmxlbmd0aDtcblxuICAgICAgICBpZiAoIWxlbikge1xuICAgICAgICAgICAgLy8gY3VydmUgaXMgZW1wdHlcbiAgICAgICAgICAgIHRoaXMuX2xlZnQgPSAtSW5maW5pdHk7XG4gICAgICAgICAgICB0aGlzLl9yaWdodCA9IEluZmluaXR5O1xuICAgICAgICAgICAgdGhpcy5fcmVjaXAgPSAwO1xuICAgICAgICAgICAgdGhpcy5fcDAgPSB0aGlzLl9wMSA9IHRoaXMuX20wID0gdGhpcy5fbTEgPSAwO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKHRpbWUgPCBrZXlzWzBdWzBdKSB7XG4gICAgICAgICAgICAgICAgLy8gaXRlcmF0b3IgZmFsbHMgdG8gdGhlIGxlZnQgb2YgdGhlIHN0YXJ0IG9mIHRoZSBjdXJ2ZVxuICAgICAgICAgICAgICAgIHRoaXMuX2xlZnQgPSAtSW5maW5pdHk7XG4gICAgICAgICAgICAgICAgdGhpcy5fcmlnaHQgPSBrZXlzWzBdWzBdO1xuICAgICAgICAgICAgICAgIHRoaXMuX3JlY2lwID0gMDtcbiAgICAgICAgICAgICAgICB0aGlzLl9wMCA9IHRoaXMuX3AxID0ga2V5c1swXVsxXTtcbiAgICAgICAgICAgICAgICB0aGlzLl9tMCA9IHRoaXMuX20xID0gMDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodGltZSA+PSBrZXlzW2xlbiAtIDFdWzBdKSB7XG4gICAgICAgICAgICAgICAgLy8gaXRlcmF0b3IgZmFsbHMgdG8gdGhlIHJpZ2h0IG9mIHRoZSBlbmQgb2YgdGhlIGN1cnZlXG4gICAgICAgICAgICAgICAgdGhpcy5fbGVmdCA9IGtleXNbbGVuIC0gMV1bMF07XG4gICAgICAgICAgICAgICAgdGhpcy5fcmlnaHQgPSBJbmZpbml0eTtcbiAgICAgICAgICAgICAgICB0aGlzLl9yZWNpcCA9IDA7XG4gICAgICAgICAgICAgICAgdGhpcy5fcDAgPSB0aGlzLl9wMSA9IGtleXNbbGVuIC0gMV1bMV07XG4gICAgICAgICAgICAgICAgdGhpcy5fbTAgPSB0aGlzLl9tMSA9IDA7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIGl0ZXJhdG9yIGZhbGxzIHdpdGhpbiB0aGUgYm91bmRzIG9mIHRoZSBjdXJ2ZVxuICAgICAgICAgICAgICAgIC8vIHBlcmZvcm0gYSBsaW5lYXIgc2VhcmNoIGZvciB0aGUga2V5IGp1c3QgbGVmdCBvZiB0aGUgY3VycmVudCB0aW1lLlxuICAgICAgICAgICAgICAgIC8vIChUT0RPOiBmb3IgY2FzZXMgd2hlcmUgdGhlIGN1cnZlIGhhcyBtb3JlIHRoYW4gJ24nIGtleXMgaXQgd2lsbFxuICAgICAgICAgICAgICAgIC8vIGJlIG1vcmUgZWZmaWNpZW50IHRvIHBlcmZvcm0gYSBiaW5hcnkgc2VhcmNoIGhlcmUgaW5zdGVhZC4gV2hpY2ggaXNcbiAgICAgICAgICAgICAgICAvLyBzdHJhaWdodCBmb3J3YXJkIHRoYW5rcyB0byB0aGUgc29ydGVkIGxpc3Qgb2Yga25vdHMpLlxuICAgICAgICAgICAgICAgIGxldCBpbmRleCA9IDA7XG4gICAgICAgICAgICAgICAgd2hpbGUgKHRpbWUgPj0ga2V5c1tpbmRleCArIDFdWzBdKSB7XG4gICAgICAgICAgICAgICAgICAgIGluZGV4Kys7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMuX2xlZnQgPSBrZXlzW2luZGV4XVswXTtcbiAgICAgICAgICAgICAgICB0aGlzLl9yaWdodCA9IGtleXNbaW5kZXggKyAxXVswXTtcbiAgICAgICAgICAgICAgICBjb25zdCBkaWZmID0gMS4wIC8gKHRoaXMuX3JpZ2h0IC0gdGhpcy5fbGVmdCk7XG4gICAgICAgICAgICAgICAgdGhpcy5fcmVjaXAgPSAoaXNGaW5pdGUoZGlmZikgPyBkaWZmIDogMCk7XG4gICAgICAgICAgICAgICAgdGhpcy5fcDAgPSBrZXlzW2luZGV4XVsxXTtcbiAgICAgICAgICAgICAgICB0aGlzLl9wMSA9IGtleXNbaW5kZXggKyAxXVsxXTtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5faXNIZXJtaXRlKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fY2FsY1RhbmdlbnRzKGtleXMsIGluZGV4KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHdoZXRoZXIgdGhlIGN1cnZlIGlzIGEgaGVybWl0ZS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHRoZSBjdXJ2ZSBpcyBhIGhlcm1pdGUgYW5kIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9pc0hlcm1pdGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jdXJ2ZS50eXBlID09PSBDVVJWRV9DQVRNVUxMIHx8XG4gICAgICAgICAgICAgICB0aGlzLl9jdXJ2ZS50eXBlID09PSBDVVJWRV9DQVJESU5BTCB8fFxuICAgICAgICAgICAgICAgdGhpcy5fY3VydmUudHlwZSA9PT0gQ1VSVkVfU1BMSU5FO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENhbGN1bGF0ZSB0YW5nZW50cyBmb3IgdGhlIGhlcm1pdGUgY3VydmUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcltdW119IGtleXMgLSBUaGUga2V5cyBvZiB0aGUgY3VydmUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGluZGV4IC0gVGhlIGtleSBpbmRleCBvZiB0aGUga2V5IHRvIGNhbGN1bGF0ZSB0aGUgdGFuZ2VudHMgZm9yLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2NhbGNUYW5nZW50cyhrZXlzLCBpbmRleCkge1xuICAgICAgICBsZXQgYTtcbiAgICAgICAgY29uc3QgYiA9IGtleXNbaW5kZXhdO1xuICAgICAgICBjb25zdCBjID0ga2V5c1tpbmRleCArIDFdO1xuICAgICAgICBsZXQgZDtcblxuICAgICAgICBpZiAoaW5kZXggPT09IDApIHtcbiAgICAgICAgICAgIGEgPSBba2V5c1swXVswXSArIChrZXlzWzBdWzBdIC0ga2V5c1sxXVswXSksXG4gICAgICAgICAgICAgICAga2V5c1swXVsxXSArIChrZXlzWzBdWzFdIC0ga2V5c1sxXVsxXSldO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYSA9IGtleXNbaW5kZXggLSAxXTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpbmRleCA9PT0ga2V5cy5sZW5ndGggLSAyKSB7XG4gICAgICAgICAgICBkID0gW2tleXNbaW5kZXggKyAxXVswXSArIChrZXlzW2luZGV4ICsgMV1bMF0gLSBrZXlzW2luZGV4XVswXSksXG4gICAgICAgICAgICAgICAga2V5c1tpbmRleCArIDFdWzFdICsgKGtleXNbaW5kZXggKyAxXVsxXSAtIGtleXNbaW5kZXhdWzFdKV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkID0ga2V5c1tpbmRleCArIDJdO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX2N1cnZlLnR5cGUgPT09IENVUlZFX1NQTElORSkge1xuICAgICAgICAgICAgLy8gY2FsY3VsYXRlIHRhbmdlbnQgc2NhbGUgKGR1ZSB0byBub24tdW5pZm9ybSBrbm90IHNwYWNpbmcpXG4gICAgICAgICAgICBjb25zdCBzMV8gPSAyICogKGNbMF0gLSBiWzBdKSAvIChjWzBdIC0gYVswXSk7XG4gICAgICAgICAgICBjb25zdCBzMl8gPSAyICogKGNbMF0gLSBiWzBdKSAvIChkWzBdIC0gYlswXSk7XG5cbiAgICAgICAgICAgIHRoaXMuX20wID0gdGhpcy5fY3VydmUudGVuc2lvbiAqIChpc0Zpbml0ZShzMV8pID8gczFfIDogMCkgKiAoY1sxXSAtIGFbMV0pO1xuICAgICAgICAgICAgdGhpcy5fbTEgPSB0aGlzLl9jdXJ2ZS50ZW5zaW9uICogKGlzRmluaXRlKHMyXykgPyBzMl8gOiAwKSAqIChkWzFdIC0gYlsxXSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBvcmlnaW5hbCB0YW5nZW50IHNjYWxlIGNhbGNcbiAgICAgICAgICAgIGNvbnN0IHMxID0gKGNbMF0gLSBiWzBdKSAvIChiWzBdIC0gYVswXSk7XG4gICAgICAgICAgICBjb25zdCBzMiA9IChjWzBdIC0gYlswXSkgLyAoZFswXSAtIGNbMF0pO1xuXG4gICAgICAgICAgICBjb25zdCBhXyA9IGJbMV0gKyAoYVsxXSAtIGJbMV0pICogKGlzRmluaXRlKHMxKSA/IHMxIDogMCk7XG4gICAgICAgICAgICBjb25zdCBkXyA9IGNbMV0gKyAoZFsxXSAtIGNbMV0pICogKGlzRmluaXRlKHMyKSA/IHMyIDogMCk7XG5cbiAgICAgICAgICAgIGNvbnN0IHRlbnNpb24gPSAodGhpcy5fY3VydmUudHlwZSA9PT0gQ1VSVkVfQ0FUTVVMTCkgPyAwLjUgOiB0aGlzLl9jdXJ2ZS50ZW5zaW9uO1xuXG4gICAgICAgICAgICB0aGlzLl9tMCA9IHRlbnNpb24gKiAoY1sxXSAtIGFfKTtcbiAgICAgICAgICAgIHRoaXMuX20xID0gdGVuc2lvbiAqIChkXyAtIGJbMV0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRXZhbHVhdGUgdGhlIGhlcm1pdGUgY3VydmUgYXQgdGhlIGdpdmVuIHRpbWUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gcDAgLSBUaGUgZmlyc3Qga2V5LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBwMSAtIFRoZSBzZWNvbmQga2V5LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBtMCAtIFRoZSBmaXJzdCB0YW5nZW50LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBtMSAtIFRoZSBzZWNvbmQgdGFuZ2VudC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdCAtIFRpbWUgdG8gZXZhbHVhdGUgdGhlIGN1cnZlIGF0LlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFRoZSB2YWx1ZSBvZiB0aGUgaGVybWl0ZSBjdXJ2ZSBhdCB0aGUgZ2l2ZW4gdGltZS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9ldmFsdWF0ZUhlcm1pdGUocDAsIHAxLCBtMCwgbTEsIHQpIHtcbiAgICAgICAgY29uc3QgdDIgPSB0ICogdDtcbiAgICAgICAgY29uc3QgdHdvdCA9IHQgKyB0O1xuICAgICAgICBjb25zdCBvbXQgPSAxIC0gdDtcbiAgICAgICAgY29uc3Qgb210MiA9IG9tdCAqIG9tdDtcbiAgICAgICAgcmV0dXJuIHAwICogKCgxICsgdHdvdCkgKiBvbXQyKSArXG4gICAgICAgICAgICAgICBtMCAqICh0ICogb210MikgK1xuICAgICAgICAgICAgICAgcDEgKiAodDIgKiAoMyAtIHR3b3QpKSArXG4gICAgICAgICAgICAgICBtMSAqICh0MiAqICh0IC0gMSkpO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgQ3VydmVFdmFsdWF0b3IgfTtcbiJdLCJuYW1lcyI6WyJDdXJ2ZUV2YWx1YXRvciIsImNvbnN0cnVjdG9yIiwiY3VydmUiLCJ0aW1lIiwiX2N1cnZlIiwiX2xlZnQiLCJJbmZpbml0eSIsIl9yaWdodCIsIl9yZWNpcCIsIl9wMCIsIl9wMSIsIl9tMCIsIl9tMSIsIl9yZXNldCIsImV2YWx1YXRlIiwiZm9yY2VSZXNldCIsInJlc3VsdCIsInR5cGUiLCJDVVJWRV9TVEVQIiwidCIsIkNVUlZFX0xJTkVBUiIsIm1hdGgiLCJsZXJwIiwiQ1VSVkVfU01PT1RIU1RFUCIsIl9ldmFsdWF0ZUhlcm1pdGUiLCJrZXlzIiwibGVuIiwibGVuZ3RoIiwiaW5kZXgiLCJkaWZmIiwiaXNGaW5pdGUiLCJfaXNIZXJtaXRlIiwiX2NhbGNUYW5nZW50cyIsIkNVUlZFX0NBVE1VTEwiLCJDVVJWRV9DQVJESU5BTCIsIkNVUlZFX1NQTElORSIsImEiLCJiIiwiYyIsImQiLCJzMV8iLCJzMl8iLCJ0ZW5zaW9uIiwiczEiLCJzMiIsImFfIiwiZF8iLCJwMCIsInAxIiwibTAiLCJtMSIsInQyIiwidHdvdCIsIm9tdCIsIm9tdDIiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBVUEsTUFBTUEsY0FBTixDQUFxQjtBQU9qQkMsRUFBQUEsV0FBVyxDQUFDQyxLQUFELEVBQVFDLElBQUksR0FBRyxDQUFmLEVBQWtCO0lBQ3pCLElBQUtDLENBQUFBLE1BQUwsR0FBY0YsS0FBZCxDQUFBO0lBQ0EsSUFBS0csQ0FBQUEsS0FBTCxHQUFhLENBQUNDLFFBQWQsQ0FBQTtJQUNBLElBQUtDLENBQUFBLE1BQUwsR0FBY0QsUUFBZCxDQUFBO0lBQ0EsSUFBS0UsQ0FBQUEsTUFBTCxHQUFjLENBQWQsQ0FBQTtJQUNBLElB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