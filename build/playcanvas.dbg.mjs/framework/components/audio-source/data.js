/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { DISTANCE_INVERSE } from '../../../platform/audio/constants.js';

class AudioSourceComponentData {
  constructor() {
    this.enabled = true;
    this.assets = [];
    this.activate = true;
    this.volume = 1;
    this.pitch = 1;
    this.loop = false;
    this['3d'] = true;
    this.minDistance = 1;
    this.maxDistance = 10000;
    this.rollOffFactor = 1;
    this.distanceModel = DISTANCE_INVERSE;

    this.paused = true;
    this.sources = {};
    this.currentSource = null;
    this.channel = null;
  }
}

export { AudioSourceComponentData };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGF0YS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL2ZyYW1ld29yay9jb21wb25lbnRzL2F1ZGlvLXNvdXJjZS9kYXRhLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERJU1RBTkNFX0lOVkVSU0UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9hdWRpby9jb25zdGFudHMuanMnO1xuXG5jbGFzcyBBdWRpb1NvdXJjZUNvbXBvbmVudERhdGEge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICAvLyBzZXJpYWxpemVkXG4gICAgICAgIHRoaXMuZW5hYmxlZCA9IHRydWU7XG4gICAgICAgIHRoaXMuYXNzZXRzID0gW107XG4gICAgICAgIHRoaXMuYWN0aXZhdGUgPSB0cnVlO1xuICAgICAgICB0aGlzLnZvbHVtZSA9IDE7XG4gICAgICAgIHRoaXMucGl0Y2ggPSAxO1xuICAgICAgICB0aGlzLmxvb3AgPSBmYWxzZTtcbiAgICAgICAgdGhpc1snM2QnXSA9IHRydWU7XG5cbiAgICAgICAgdGhpcy5taW5EaXN0YW5jZSA9IDE7XG4gICAgICAgIHRoaXMubWF4RGlzdGFuY2UgPSAxMDAwMDtcbiAgICAgICAgdGhpcy5yb2xsT2ZmRmFjdG9yID0gMTtcbiAgICAgICAgdGhpcy5kaXN0YW5jZU1vZGVsID0gRElTVEFOQ0VfSU5WRVJTRTtcblxuICAgICAgICAvLyBub3Qgc2VyaWFsaXplZFxuICAgICAgICB0aGlzLnBhdXNlZCA9IHRydWU7XG5cbiAgICAgICAgdGhpcy5zb3VyY2VzID0ge307XG4gICAgICAgIHRoaXMuY3VycmVudFNvdXJjZSA9IG51bGw7XG4gICAgICAgIHRoaXMuY2hhbm5lbCA9IG51bGw7XG4gICAgfVxufVxuXG5leHBvcnQgeyBBdWRpb1NvdXJjZUNvbXBvbmVudERhdGEgfTtcbiJdLCJuYW1lcyI6WyJBdWRpb1NvdXJjZUNvbXBvbmVudERhdGEiLCJjb25zdHJ1Y3RvciIsImVuYWJsZWQiLCJhc3NldHMiLCJhY3RpdmF0ZSIsInZvbHVtZSIsInBpdGNoIiwibG9vcCIsIm1pbkRpc3RhbmNlIiwibWF4RGlzdGFuY2UiLCJyb2xsT2ZmRmFjdG9yIiwiZGlzdGFuY2VNb2RlbCIsIkRJU1RBTkNFX0lOVkVSU0UiLCJwYXVzZWQiLCJzb3VyY2VzIiwiY3VycmVudFNvdXJjZSIsImNoYW5uZWwiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7QUFFQSxNQUFNQSx3QkFBd0IsQ0FBQztBQUMzQkMsRUFBQUEsV0FBVyxHQUFHO0lBRVYsSUFBSSxDQUFDQyxPQUFPLEdBQUcsSUFBSSxDQUFBO0lBQ25CLElBQUksQ0FBQ0MsTUFBTSxHQUFHLEVBQUUsQ0FBQTtJQUNoQixJQUFJLENBQUNDLFFBQVEsR0FBRyxJQUFJLENBQUE7SUFDcEIsSUFBSSxDQUFDQyxNQUFNLEdBQUcsQ0FBQyxDQUFBO0lBQ2YsSUFBSSxDQUFDQyxLQUFLLEdBQUcsQ0FBQyxDQUFBO0lBQ2QsSUFBSSxDQUFDQyxJQUFJLEdBQUcsS0FBSyxDQUFBO0FBQ2pCLElBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQTtJQUVqQixJQUFJLENBQUNDLFdBQVcsR0FBRyxDQUFDLENBQUE7SUFDcEIsSUFBSSxDQUFDQyxXQUFXLEdBQUcsS0FBSyxDQUFBO0lBQ3hCLElBQUksQ0FBQ0MsYUFBYSxHQUFHLENBQUMsQ0FBQTtJQUN0QixJQUFJLENBQUNDLGFBQWEsR0FBR0MsZ0JBQWdCLENBQUE7O0lBR3JDLElBQUksQ0FBQ0MsTUFBTSxHQUFHLElBQUksQ0FBQTtBQUVsQixJQUFBLElBQUksQ0FBQ0MsT0FBTyxHQUFHLEVBQUUsQ0FBQTtJQUNqQixJQUFJLENBQUNDLGFBQWEsR0FBRyxJQUFJLENBQUE7SUFDekIsSUFBSSxDQUFDQyxPQUFPLEdBQUcsSUFBSSxDQUFBO0FBQ3ZCLEdBQUE7QUFDSjs7OzsifQ==