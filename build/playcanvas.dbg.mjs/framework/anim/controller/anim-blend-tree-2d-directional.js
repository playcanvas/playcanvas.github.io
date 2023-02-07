/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Vec2 } from '../../../core/math/vec2.js';
import { math } from '../../../core/math/math.js';
import { AnimBlendTree } from './anim-blend-tree.js';

/**
 * An AnimBlendTree that calculates its weights using a 2D directional algorithm based on the thesis
 * http://runevision.com/thesis/rune_skovbo_johansen_thesis.pdf Chapter 6.
 *
 * @ignore
 */
class AnimBlendTreeDirectional2D extends AnimBlendTree {
  pointCache(i, j) {
    const pointKey = `${i}${j}`;
    if (!this._pointCache[pointKey]) {
      this._pointCache[pointKey] = new Vec2((this._children[j].pointLength - this._children[i].pointLength) / ((this._children[j].pointLength + this._children[i].pointLength) / 2), Vec2.angleRad(this._children[i].point, this._children[j].point) * 2.0);
    }
    return this._pointCache[pointKey];
  }
  calculateWeights() {
    if (this.updateParameterValues()) return;
    let weightSum, weightedDurationSum;
    AnimBlendTreeDirectional2D._p.set(...this._parameterValues);
    const pLength = AnimBlendTreeDirectional2D._p.length();
    weightSum = 0.0;
    weightedDurationSum = 0.0;
    for (let i = 0; i < this._children.length; i++) {
      const child = this._children[i];
      const pi = child.point;
      const piLength = child.pointLength;
      let minj = Number.MAX_VALUE;
      for (let j = 0; j < this._children.length; j++) {
        if (i === j) continue;
        const pipj = this.pointCache(i, j);
        const pjLength = this._children[j].pointLength;
        AnimBlendTreeDirectional2D._pip.set((pLength - piLength) / ((pjLength + piLength) / 2), Vec2.angleRad(pi, AnimBlendTreeDirectional2D._p) * 2.0);
        const result = math.clamp(1.0 - Math.abs(AnimBlendTreeDirectional2D._pip.dot(pipj) / pipj.lengthSq()), 0.0, 1.0);
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
        const weightedChildDuration = child.animTrack.duration / weightedDurationSum * weightSum;
        child.weightedSpeed = child.absoluteSpeed * weightedChildDuration;
      }
    }
  }
}
AnimBlendTreeDirectional2D._p = new Vec2();
AnimBlendTreeDirectional2D._pip = new Vec2();

export { AnimBlendTreeDirectional2D };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW5pbS1ibGVuZC10cmVlLTJkLWRpcmVjdGlvbmFsLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2FuaW0vY29udHJvbGxlci9hbmltLWJsZW5kLXRyZWUtMmQtZGlyZWN0aW9uYWwuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgVmVjMiB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC92ZWMyLmpzJztcbmltcG9ydCB7IG1hdGggfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvbWF0aC5qcyc7XG5cbmltcG9ydCB7IEFuaW1CbGVuZFRyZWUgfSBmcm9tICcuL2FuaW0tYmxlbmQtdHJlZS5qcyc7XG5cbi8qKlxuICogQW4gQW5pbUJsZW5kVHJlZSB0aGF0IGNhbGN1bGF0ZXMgaXRzIHdlaWdodHMgdXNpbmcgYSAyRCBkaXJlY3Rpb25hbCBhbGdvcml0aG0gYmFzZWQgb24gdGhlIHRoZXNpc1xuICogaHR0cDovL3J1bmV2aXNpb24uY29tL3RoZXNpcy9ydW5lX3Nrb3Zib19qb2hhbnNlbl90aGVzaXMucGRmIENoYXB0ZXIgNi5cbiAqXG4gKiBAaWdub3JlXG4gKi9cbmNsYXNzIEFuaW1CbGVuZFRyZWVEaXJlY3Rpb25hbDJEIGV4dGVuZHMgQW5pbUJsZW5kVHJlZSB7XG4gICAgc3RhdGljIF9wID0gbmV3IFZlYzIoKTtcblxuICAgIHN0YXRpYyBfcGlwID0gbmV3IFZlYzIoKTtcblxuICAgIHBvaW50Q2FjaGUoaSwgaikge1xuICAgICAgICBjb25zdCBwb2ludEtleSA9IGAke2l9JHtqfWA7XG4gICAgICAgIGlmICghdGhpcy5fcG9pbnRDYWNoZVtwb2ludEtleV0pIHtcbiAgICAgICAgICAgIHRoaXMuX3BvaW50Q2FjaGVbcG9pbnRLZXldID0gbmV3IFZlYzIoXG4gICAgICAgICAgICAgICAgKHRoaXMuX2NoaWxkcmVuW2pdLnBvaW50TGVuZ3RoIC0gdGhpcy5fY2hpbGRyZW5baV0ucG9pbnRMZW5ndGgpIC8gKCh0aGlzLl9jaGlsZHJlbltqXS5wb2ludExlbmd0aCArIHRoaXMuX2NoaWxkcmVuW2ldLnBvaW50TGVuZ3RoKSAvIDIpLFxuICAgICAgICAgICAgICAgIFZlYzIuYW5nbGVSYWQodGhpcy5fY2hpbGRyZW5baV0ucG9pbnQsIHRoaXMuX2NoaWxkcmVuW2pdLnBvaW50KSAqIDIuMFxuICAgICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fcG9pbnRDYWNoZVtwb2ludEtleV07XG4gICAgfVxuXG4gICAgY2FsY3VsYXRlV2VpZ2h0cygpIHtcbiAgICAgICAgaWYgKHRoaXMudXBkYXRlUGFyYW1ldGVyVmFsdWVzKCkpIHJldHVybjtcbiAgICAgICAgbGV0IHdlaWdodFN1bSwgd2VpZ2h0ZWREdXJhdGlvblN1bTtcbiAgICAgICAgQW5pbUJsZW5kVHJlZURpcmVjdGlvbmFsMkQuX3Auc2V0KC4uLnRoaXMuX3BhcmFtZXRlclZhbHVlcyk7XG4gICAgICAgIGNvbnN0IHBMZW5ndGggPSBBbmltQmxlbmRUcmVlRGlyZWN0aW9uYWwyRC5fcC5sZW5ndGgoKTtcbiAgICAgICAgd2VpZ2h0U3VtID0gMC4wO1xuICAgICAgICB3ZWlnaHRlZER1cmF0aW9uU3VtID0gMC4wO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2NoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBjaGlsZCA9IHRoaXMuX2NoaWxkcmVuW2ldO1xuICAgICAgICAgICAgY29uc3QgcGkgPSBjaGlsZC5wb2ludDtcbiAgICAgICAgICAgIGNvbnN0IHBpTGVuZ3RoID0gY2hpbGQucG9pbnRMZW5ndGg7XG4gICAgICAgICAgICBsZXQgbWluaiA9IE51bWJlci5NQVhfVkFMVUU7XG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHRoaXMuX2NoaWxkcmVuLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgaWYgKGkgPT09IGopIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIGNvbnN0IHBpcGogPSB0aGlzLnBvaW50Q2FjaGUoaSwgaik7XG4gICAgICAgICAgICAgICAgY29uc3QgcGpMZW5ndGggPSB0aGlzLl9jaGlsZHJlbltqXS5wb2ludExlbmd0aDtcbiAgICAgICAgICAgICAgICBBbmltQmxlbmRUcmVlRGlyZWN0aW9uYWwyRC5fcGlwLnNldCgocExlbmd0aCAtIHBpTGVuZ3RoKSAvICgocGpMZW5ndGggKyBwaUxlbmd0aCkgLyAyKSwgVmVjMi5hbmdsZVJhZChwaSwgQW5pbUJsZW5kVHJlZURpcmVjdGlvbmFsMkQuX3ApICogMi4wKTtcbiAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSBtYXRoLmNsYW1wKDEuMCAtIE1hdGguYWJzKChBbmltQmxlbmRUcmVlRGlyZWN0aW9uYWwyRC5fcGlwLmRvdChwaXBqKSAvIHBpcGoubGVuZ3RoU3EoKSkpLCAwLjAsIDEuMCk7XG4gICAgICAgICAgICAgICAgaWYgKHJlc3VsdCA8IG1pbmopIG1pbmogPSByZXN1bHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjaGlsZC53ZWlnaHQgPSBtaW5qO1xuICAgICAgICAgICAgd2VpZ2h0U3VtICs9IG1pbmo7XG4gICAgICAgICAgICBpZiAodGhpcy5fc3luY0FuaW1hdGlvbnMpIHtcbiAgICAgICAgICAgICAgICB3ZWlnaHRlZER1cmF0aW9uU3VtICs9IChjaGlsZC5hbmltVHJhY2suZHVyYXRpb24gLyBjaGlsZC5hYnNvbHV0ZVNwZWVkKSAqIGNoaWxkLndlaWdodDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2NoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBjaGlsZCA9IHRoaXMuX2NoaWxkcmVuW2ldO1xuICAgICAgICAgICAgY2hpbGQud2VpZ2h0ID0gY2hpbGQuX3dlaWdodCAvIHdlaWdodFN1bTtcbiAgICAgICAgICAgIGlmICh0aGlzLl9zeW5jQW5pbWF0aW9ucykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHdlaWdodGVkQ2hpbGREdXJhdGlvbiA9IChjaGlsZC5hbmltVHJhY2suZHVyYXRpb24gLyB3ZWlnaHRlZER1cmF0aW9uU3VtKSAqIHdlaWdodFN1bTtcbiAgICAgICAgICAgICAgICBjaGlsZC53ZWlnaHRlZFNwZWVkID0gIGNoaWxkLmFic29sdXRlU3BlZWQgKiB3ZWlnaHRlZENoaWxkRHVyYXRpb247XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCB7IEFuaW1CbGVuZFRyZWVEaXJlY3Rpb25hbDJEIH07XG4iXSwibmFtZXMiOlsiQW5pbUJsZW5kVHJlZURpcmVjdGlvbmFsMkQiLCJBbmltQmxlbmRUcmVlIiwicG9pbnRDYWNoZSIsImkiLCJqIiwicG9pbnRLZXkiLCJfcG9pbnRDYWNoZSIsIlZlYzIiLCJfY2hpbGRyZW4iLCJwb2ludExlbmd0aCIsImFuZ2xlUmFkIiwicG9pbnQiLCJjYWxjdWxhdGVXZWlnaHRzIiwidXBkYXRlUGFyYW1ldGVyVmFsdWVzIiwid2VpZ2h0U3VtIiwid2VpZ2h0ZWREdXJhdGlvblN1bSIsIl9wIiwic2V0IiwiX3BhcmFtZXRlclZhbHVlcyIsInBMZW5ndGgiLCJsZW5ndGgiLCJjaGlsZCIsInBpIiwicGlMZW5ndGgiLCJtaW5qIiwiTnVtYmVyIiwiTUFYX1ZBTFVFIiwicGlwaiIsInBqTGVuZ3RoIiwiX3BpcCIsInJlc3VsdCIsIm1hdGgiLCJjbGFtcCIsIk1hdGgiLCJhYnMiLCJkb3QiLCJsZW5ndGhTcSIsIndlaWdodCIsIl9zeW5jQW5pbWF0aW9ucyIsImFuaW1UcmFjayIsImR1cmF0aW9uIiwiYWJzb2x1dGVTcGVlZCIsIl93ZWlnaHQiLCJ3ZWlnaHRlZENoaWxkRHVyYXRpb24iLCJ3ZWlnaHRlZFNwZWVkIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSwwQkFBMEIsU0FBU0MsYUFBYSxDQUFDO0FBS25EQyxFQUFBQSxVQUFVLENBQUNDLENBQUMsRUFBRUMsQ0FBQyxFQUFFO0FBQ2IsSUFBQSxNQUFNQyxRQUFRLEdBQUksQ0FBQSxFQUFFRixDQUFFLENBQUEsRUFBRUMsQ0FBRSxDQUFDLENBQUEsQ0FBQTtBQUMzQixJQUFBLElBQUksQ0FBQyxJQUFJLENBQUNFLFdBQVcsQ0FBQ0QsUUFBUSxDQUFDLEVBQUU7QUFDN0IsTUFBQSxJQUFJLENBQUNDLFdBQVcsQ0FBQ0QsUUFBUSxDQUFDLEdBQUcsSUFBSUUsSUFBSSxDQUNqQyxDQUFDLElBQUksQ0FBQ0MsU0FBUyxDQUFDSixDQUFDLENBQUMsQ0FBQ0ssV0FBVyxHQUFHLElBQUksQ0FBQ0QsU0FBUyxDQUFDTCxDQUFDLENBQUMsQ0FBQ00sV0FBVyxLQUFLLENBQUMsSUFBSSxDQUFDRCxTQUFTLENBQUNKLENBQUMsQ0FBQyxDQUFDSyxXQUFXLEdBQUcsSUFBSSxDQUFDRCxTQUFTLENBQUNMLENBQUMsQ0FBQyxDQUFDTSxXQUFXLElBQUksQ0FBQyxDQUFDLEVBQ3ZJRixJQUFJLENBQUNHLFFBQVEsQ0FBQyxJQUFJLENBQUNGLFNBQVMsQ0FBQ0wsQ0FBQyxDQUFDLENBQUNRLEtBQUssRUFBRSxJQUFJLENBQUNILFNBQVMsQ0FBQ0osQ0FBQyxDQUFDLENBQUNPLEtBQUssQ0FBQyxHQUFHLEdBQUcsQ0FDeEUsQ0FBQTtBQUNMLEtBQUE7QUFDQSxJQUFBLE9BQU8sSUFBSSxDQUFDTCxXQUFXLENBQUNELFFBQVEsQ0FBQyxDQUFBO0FBQ3JDLEdBQUE7QUFFQU8sRUFBQUEsZ0JBQWdCLEdBQUc7QUFDZixJQUFBLElBQUksSUFBSSxDQUFDQyxxQkFBcUIsRUFBRSxFQUFFLE9BQUE7SUFDbEMsSUFBSUMsU0FBUyxFQUFFQyxtQkFBbUIsQ0FBQTtJQUNsQ2YsMEJBQTBCLENBQUNnQixFQUFFLENBQUNDLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQ0MsZ0JBQWdCLENBQUMsQ0FBQTtBQUMzRCxJQUFBLE1BQU1DLE9BQU8sR0FBR25CLDBCQUEwQixDQUFDZ0IsRUFBRSxDQUFDSSxNQUFNLEVBQUUsQ0FBQTtBQUN0RE4sSUFBQUEsU0FBUyxHQUFHLEdBQUcsQ0FBQTtBQUNmQyxJQUFBQSxtQkFBbUIsR0FBRyxHQUFHLENBQUE7QUFDekIsSUFBQSxLQUFLLElBQUlaLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBRyxJQUFJLENBQUNLLFNBQVMsQ0FBQ1ksTUFBTSxFQUFFakIsQ0FBQyxFQUFFLEVBQUU7QUFDNUMsTUFBQSxNQUFNa0IsS0FBSyxHQUFHLElBQUksQ0FBQ2IsU0FBUyxDQUFDTCxDQUFDLENBQUMsQ0FBQTtBQUMvQixNQUFBLE1BQU1tQixFQUFFLEdBQUdELEtBQUssQ0FBQ1YsS0FBSyxDQUFBO0FBQ3RCLE1BQUEsTUFBTVksUUFBUSxHQUFHRixLQUFLLENBQUNaLFdBQVcsQ0FBQTtBQUNsQyxNQUFBLElBQUllLElBQUksR0FBR0MsTUFBTSxDQUFDQyxTQUFTLENBQUE7QUFDM0IsTUFBQSxLQUFLLElBQUl0QixDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUcsSUFBSSxDQUFDSSxTQUFTLENBQUNZLE1BQU0sRUFBRWhCLENBQUMsRUFBRSxFQUFFO1FBQzVDLElBQUlELENBQUMsS0FBS0MsQ0FBQyxFQUFFLFNBQUE7UUFDYixNQUFNdUIsSUFBSSxHQUFHLElBQUksQ0FBQ3pCLFVBQVUsQ0FBQ0MsQ0FBQyxFQUFFQyxDQUFDLENBQUMsQ0FBQTtRQUNsQyxNQUFNd0IsUUFBUSxHQUFHLElBQUksQ0FBQ3BCLFNBQVMsQ0FBQ0osQ0FBQyxDQUFDLENBQUNLLFdBQVcsQ0FBQTtBQUM5Q1QsUUFBQUEsMEJBQTBCLENBQUM2QixJQUFJLENBQUNaLEdBQUcsQ0FBQyxDQUFDRSxPQUFPLEdBQUdJLFFBQVEsS0FBSyxDQUFDSyxRQUFRLEdBQUdMLFFBQVEsSUFBSSxDQUFDLENBQUMsRUFBRWhCLElBQUksQ0FBQ0csUUFBUSxDQUFDWSxFQUFFLEVBQUV0QiwwQkFBMEIsQ0FBQ2dCLEVBQUUsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFBO0FBQy9JLFFBQUEsTUFBTWMsTUFBTSxHQUFHQyxJQUFJLENBQUNDLEtBQUssQ0FBQyxHQUFHLEdBQUdDLElBQUksQ0FBQ0MsR0FBRyxDQUFFbEMsMEJBQTBCLENBQUM2QixJQUFJLENBQUNNLEdBQUcsQ0FBQ1IsSUFBSSxDQUFDLEdBQUdBLElBQUksQ0FBQ1MsUUFBUSxFQUFFLENBQUUsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUE7QUFDbEgsUUFBQSxJQUFJTixNQUFNLEdBQUdOLElBQUksRUFBRUEsSUFBSSxHQUFHTSxNQUFNLENBQUE7QUFDcEMsT0FBQTtNQUNBVCxLQUFLLENBQUNnQixNQUFNLEdBQUdiLElBQUksQ0FBQTtBQUNuQlYsTUFBQUEsU0FBUyxJQUFJVSxJQUFJLENBQUE7TUFDakIsSUFBSSxJQUFJLENBQUNjLGVBQWUsRUFBRTtBQUN0QnZCLFFBQUFBLG1CQUFtQixJQUFLTSxLQUFLLENBQUNrQixTQUFTLENBQUNDLFFBQVEsR0FBR25CLEtBQUssQ0FBQ29CLGFBQWEsR0FBSXBCLEtBQUssQ0FBQ2dCLE1BQU0sQ0FBQTtBQUMxRixPQUFBO0FBQ0osS0FBQTtBQUNBLElBQUEsS0FBSyxJQUFJbEMsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHLElBQUksQ0FBQ0ssU0FBUyxDQUFDWSxNQUFNLEVBQUVqQixDQUFDLEVBQUUsRUFBRTtBQUM1QyxNQUFBLE1BQU1rQixLQUFLLEdBQUcsSUFBSSxDQUFDYixTQUFTLENBQUNMLENBQUMsQ0FBQyxDQUFBO0FBQy9Ca0IsTUFBQUEsS0FBSyxDQUFDZ0IsTUFBTSxHQUFHaEIsS0FBSyxDQUFDcUIsT0FBTyxHQUFHNUIsU0FBUyxDQUFBO01BQ3hDLElBQUksSUFBSSxDQUFDd0IsZUFBZSxFQUFFO1FBQ3RCLE1BQU1LLHFCQUFxQixHQUFJdEIsS0FBSyxDQUFDa0IsU0FBUyxDQUFDQyxRQUFRLEdBQUd6QixtQkFBbUIsR0FBSUQsU0FBUyxDQUFBO0FBQzFGTyxRQUFBQSxLQUFLLENBQUN1QixhQUFhLEdBQUl2QixLQUFLLENBQUNvQixhQUFhLEdBQUdFLHFCQUFxQixDQUFBO0FBQ3RFLE9BQUE7QUFDSixLQUFBO0FBQ0osR0FBQTtBQUNKLENBQUE7QUFuRE0zQywwQkFBMEIsQ0FDckJnQixFQUFFLEdBQUcsSUFBSVQsSUFBSSxFQUFFLENBQUE7QUFEcEJQLDBCQUEwQixDQUdyQjZCLElBQUksR0FBRyxJQUFJdEIsSUFBSSxFQUFFOzs7OyJ9
