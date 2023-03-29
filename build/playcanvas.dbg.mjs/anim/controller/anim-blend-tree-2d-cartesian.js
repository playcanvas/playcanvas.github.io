/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Vec2 } from '../../math/vec2.js';
import { math } from '../../math/math.js';
import { AnimBlendTree } from './anim-blend-tree.js';

class AnimBlendTreeCartesian2D extends AnimBlendTree {
  pointDistanceCache(i, j) {
    const pointKey = `${i}${j}`;

    if (!this._pointCache[pointKey]) {
      this._pointCache[pointKey] = this._children[j].point.clone().sub(this._children[i].point);
    }

    return this._pointCache[pointKey];
  }

  calculateWeights() {
    if (this.updateParameterValues()) return;
    let weightSum, weightedDurationSum;

    AnimBlendTreeCartesian2D._p.set(...this._parameterValues);

    weightSum = 0.0;
    weightedDurationSum = 0.0;

    for (let i = 0; i < this._children.length; i++) {
      const child = this._children[i];
      const pi = child.point;

      AnimBlendTreeCartesian2D._pip.set(AnimBlendTreeCartesian2D._p.x, AnimBlendTreeCartesian2D._p.y).sub(pi);

      let minj = Number.MAX_VALUE;

      for (let j = 0; j < this._children.length; j++) {
        if (i === j) continue;
        const pipj = this.pointDistanceCache(i, j);
        const result = math.clamp(1.0 - AnimBlendTreeCartesian2D._pip.dot(pipj) / pipj.lengthSq(), 0.0, 1.0);
        if (result < minj) minj = result;
      }

      child.weight = minj;
      weightSum += minj;

      if (this._syncAnimations) {
        weightedDurationSum += child.animTrack.duration / child.absoluteSpeed * child.weight;
      }
    }

    for (let i = 0; i < this._children.length; i++) {
      const child = this._children[i];
      child.weight = child._weight / weightSum;

      if (this._syncAnimations) {
        child.weightedSpeed = child.animTrack.duration / child.absoluteSpeed / weightedDurationSum;
      }
    }
  }

}

AnimBlendTreeCartesian2D._p = new Vec2();
AnimBlendTreeCartesian2D._pip = new Vec2();

export { AnimBlendTreeCartesian2D };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW5pbS1ibGVuZC10cmVlLTJkLWNhcnRlc2lhbi5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2FuaW0vY29udHJvbGxlci9hbmltLWJsZW5kLXRyZWUtMmQtY2FydGVzaWFuLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFZlYzIgfSBmcm9tICcuLi8uLi9tYXRoL3ZlYzIuanMnO1xuaW1wb3J0IHsgbWF0aCB9IGZyb20gJy4uLy4uL21hdGgvbWF0aC5qcyc7XG5cbmltcG9ydCB7IEFuaW1CbGVuZFRyZWUgfSBmcm9tICcuL2FuaW0tYmxlbmQtdHJlZS5qcyc7XG5cbi8qKlxuICogQW4gQW5pbUJsZW5kVHJlZSB0aGF0IGNhbGN1bGF0ZXMgaXRzIHdlaWdodHMgdXNpbmcgYSAyRCBDYXJ0ZXNpYW4gYWxnb3JpdGhtIGJhc2VkIG9uIHRoZSB0aGVzaXNcbiAqIGh0dHA6Ly9ydW5ldmlzaW9uLmNvbS90aGVzaXMvcnVuZV9za292Ym9fam9oYW5zZW5fdGhlc2lzLnBkZiBDaGFwdGVyIDYgU2VjdGlvbiAzLlxuICpcbiAqIEBpZ25vcmVcbiAqL1xuY2xhc3MgQW5pbUJsZW5kVHJlZUNhcnRlc2lhbjJEIGV4dGVuZHMgQW5pbUJsZW5kVHJlZSB7XG4gICAgc3RhdGljIF9wID0gbmV3IFZlYzIoKTtcblxuICAgIHN0YXRpYyBfcGlwID0gbmV3IFZlYzIoKTtcblxuICAgIHBvaW50RGlzdGFuY2VDYWNoZShpLCBqKSB7XG4gICAgICAgIGNvbnN0IHBvaW50S2V5ID0gYCR7aX0ke2p9YDtcbiAgICAgICAgaWYgKCF0aGlzLl9wb2ludENhY2hlW3BvaW50S2V5XSkge1xuICAgICAgICAgICAgdGhpcy5fcG9pbnRDYWNoZVtwb2ludEtleV0gPSB0aGlzLl9jaGlsZHJlbltqXS5wb2ludC5jbG9uZSgpLnN1Yih0aGlzLl9jaGlsZHJlbltpXS5wb2ludCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX3BvaW50Q2FjaGVbcG9pbnRLZXldO1xuICAgIH1cblxuICAgIGNhbGN1bGF0ZVdlaWdodHMoKSB7XG4gICAgICAgIGlmICh0aGlzLnVwZGF0ZVBhcmFtZXRlclZhbHVlcygpKSByZXR1cm47XG4gICAgICAgIGxldCB3ZWlnaHRTdW0sIHdlaWdodGVkRHVyYXRpb25TdW07XG4gICAgICAgIEFuaW1CbGVuZFRyZWVDYXJ0ZXNpYW4yRC5fcC5zZXQoLi4udGhpcy5fcGFyYW1ldGVyVmFsdWVzKTtcbiAgICAgICAgd2VpZ2h0U3VtID0gMC4wO1xuICAgICAgICB3ZWlnaHRlZER1cmF0aW9uU3VtID0gMC4wO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2NoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBjaGlsZCA9IHRoaXMuX2NoaWxkcmVuW2ldO1xuICAgICAgICAgICAgY29uc3QgcGkgPSBjaGlsZC5wb2ludDtcbiAgICAgICAgICAgIEFuaW1CbGVuZFRyZWVDYXJ0ZXNpYW4yRC5fcGlwLnNldChBbmltQmxlbmRUcmVlQ2FydGVzaWFuMkQuX3AueCwgQW5pbUJsZW5kVHJlZUNhcnRlc2lhbjJELl9wLnkpLnN1YihwaSk7XG4gICAgICAgICAgICBsZXQgbWluaiA9IE51bWJlci5NQVhfVkFMVUU7XG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHRoaXMuX2NoaWxkcmVuLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgaWYgKGkgPT09IGopIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIGNvbnN0IHBpcGogPSB0aGlzLnBvaW50RGlzdGFuY2VDYWNoZShpLCBqKTtcbiAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSBtYXRoLmNsYW1wKDEuMCAtIChBbmltQmxlbmRUcmVlQ2FydGVzaWFuMkQuX3BpcC5kb3QocGlwaikgLyBwaXBqLmxlbmd0aFNxKCkpLCAwLjAsIDEuMCk7XG4gICAgICAgICAgICAgICAgaWYgKHJlc3VsdCA8IG1pbmopIG1pbmogPSByZXN1bHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjaGlsZC53ZWlnaHQgPSBtaW5qO1xuICAgICAgICAgICAgd2VpZ2h0U3VtICs9IG1pbmo7XG4gICAgICAgICAgICBpZiAodGhpcy5fc3luY0FuaW1hdGlvbnMpIHtcbiAgICAgICAgICAgICAgICB3ZWlnaHRlZER1cmF0aW9uU3VtICs9IGNoaWxkLmFuaW1UcmFjay5kdXJhdGlvbiAvIGNoaWxkLmFic29sdXRlU3BlZWQgKiBjaGlsZC53ZWlnaHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgY2hpbGQgPSB0aGlzLl9jaGlsZHJlbltpXTtcbiAgICAgICAgICAgIGNoaWxkLndlaWdodCA9IGNoaWxkLl93ZWlnaHQgLyB3ZWlnaHRTdW07XG4gICAgICAgICAgICBpZiAodGhpcy5fc3luY0FuaW1hdGlvbnMpIHtcbiAgICAgICAgICAgICAgICBjaGlsZC53ZWlnaHRlZFNwZWVkID0gY2hpbGQuYW5pbVRyYWNrLmR1cmF0aW9uIC8gY2hpbGQuYWJzb2x1dGVTcGVlZCAvIHdlaWdodGVkRHVyYXRpb25TdW07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCB7IEFuaW1CbGVuZFRyZWVDYXJ0ZXNpYW4yRCB9O1xuIl0sIm5hbWVzIjpbIkFuaW1CbGVuZFRyZWVDYXJ0ZXNpYW4yRCIsIkFuaW1CbGVuZFRyZWUiLCJwb2ludERpc3RhbmNlQ2FjaGUiLCJpIiwiaiIsInBvaW50S2V5IiwiX3BvaW50Q2FjaGUiLCJfY2hpbGRyZW4iLCJwb2ludCIsImNsb25lIiwic3ViIiwiY2FsY3VsYXRlV2VpZ2h0cyIsInVwZGF0ZVBhcmFtZXRlclZhbHVlcyIsIndlaWdodFN1bSIsIndlaWdodGVkRHVyYXRpb25TdW0iLCJfcCIsInNldCIsIl9wYXJhbWV0ZXJWYWx1ZXMiLCJsZW5ndGgiLCJjaGlsZCIsInBpIiwiX3BpcCIsIngiLCJ5IiwibWluaiIsIk51bWJlciIsIk1BWF9WQUxVRSIsInBpcGoiLCJyZXN1bHQiLCJtYXRoIiwiY2xhbXAiLCJkb3QiLCJsZW5ndGhTcSIsIndlaWdodCIsIl9zeW5jQW5pbWF0aW9ucyIsImFuaW1UcmFjayIsImR1cmF0aW9uIiwiYWJzb2x1dGVTcGVlZCIsIl93ZWlnaHQiLCJ3ZWlnaHRlZFNwZWVkIiwiVmVjMiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O0FBV0EsTUFBTUEsd0JBQU4sU0FBdUNDLGFBQXZDLENBQXFEO0FBS2pEQyxFQUFBQSxrQkFBa0IsQ0FBQ0MsQ0FBRCxFQUFJQyxDQUFKLEVBQU87QUFDckIsSUFBQSxNQUFNQyxRQUFRLEdBQUksQ0FBQSxFQUFFRixDQUFFLENBQUEsRUFBRUMsQ0FBRSxDQUExQixDQUFBLENBQUE7O0FBQ0EsSUFBQSxJQUFJLENBQUMsSUFBS0UsQ0FBQUEsV0FBTCxDQUFpQkQsUUFBakIsQ0FBTCxFQUFpQztNQUM3QixJQUFLQyxDQUFBQSxXQUFMLENBQWlCRCxRQUFqQixDQUFBLEdBQTZCLEtBQUtFLFNBQUwsQ0FBZUgsQ0FBZixDQUFrQkksQ0FBQUEsS0FBbEIsQ0FBd0JDLEtBQXhCLEVBQUEsQ0FBZ0NDLEdBQWhDLENBQW9DLElBQUEsQ0FBS0gsU0FBTCxDQUFlSixDQUFmLENBQWtCSyxDQUFBQSxLQUF0RCxDQUE3QixDQUFBO0FBQ0gsS0FBQTs7QUFDRCxJQUFBLE9BQU8sSUFBS0YsQ0FBQUEsV0FBTCxDQUFpQkQsUUFBakIsQ0FBUCxDQUFBO0FBQ0gsR0FBQTs7QUFFRE0sRUFBQUEsZ0JBQWdCLEdBQUc7SUFDZixJQUFJLElBQUEsQ0FBS0MscUJBQUwsRUFBSixFQUFrQyxPQUFBO0lBQ2xDLElBQUlDLFNBQUosRUFBZUMsbUJBQWYsQ0FBQTs7QUFDQWQsSUFBQUEsd0JBQXdCLENBQUNlLEVBQXpCLENBQTRCQyxHQUE1QixDQUFnQyxHQUFHLEtBQUtDLGdCQUF4QyxDQUFBLENBQUE7O0FBQ0FKLElBQUFBLFNBQVMs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
