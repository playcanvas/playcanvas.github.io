/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { BUFFER_GPUDYNAMIC, BUFFER_STREAM, BUFFER_DYNAMIC, BUFFER_STATIC } from '../constants.js';

/**
 * A WebGL implementation of the Buffer.
 *
 * @ignore
 */
class WebglBuffer {
  constructor() {
    this.bufferId = null;
  }
  destroy(device) {
    if (this.bufferId) {
      device.gl.deleteBuffer(this.bufferId);
      this.bufferId = null;
    }
  }
  get initialized() {
    return !!this.bufferId;
  }
  loseContext() {
    this.bufferId = null;
  }
  unlock(device, usage, target, storage) {
    const gl = device.gl;
    if (!this.bufferId) {
      this.bufferId = gl.createBuffer();
    }
    let glUsage;
    switch (usage) {
      case BUFFER_STATIC:
        glUsage = gl.STATIC_DRAW;
        break;
      case BUFFER_DYNAMIC:
        glUsage = gl.DYNAMIC_DRAW;
        break;
      case BUFFER_STREAM:
        glUsage = gl.STREAM_DRAW;
        break;
      case BUFFER_GPUDYNAMIC:
        if (device.webgl2) {
          glUsage = gl.DYNAMIC_COPY;
        } else {
          glUsage = gl.STATIC_DRAW;
        }
        break;
    }
    gl.bindBuffer(target, this.bufferId);
    gl.bufferData(target, storage, glUsage);
  }
}

export { WebglBuffer };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViZ2wtYnVmZmVyLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvcGxhdGZvcm0vZ3JhcGhpY3Mvd2ViZ2wvd2ViZ2wtYnVmZmVyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEJVRkZFUl9EWU5BTUlDLCBCVUZGRVJfR1BVRFlOQU1JQywgQlVGRkVSX1NUQVRJQywgQlVGRkVSX1NUUkVBTSB9IGZyb20gJy4uL2NvbnN0YW50cy5qcyc7XG5cbi8qKlxuICogQSBXZWJHTCBpbXBsZW1lbnRhdGlvbiBvZiB0aGUgQnVmZmVyLlxuICpcbiAqIEBpZ25vcmVcbiAqL1xuY2xhc3MgV2ViZ2xCdWZmZXIge1xuICAgIGJ1ZmZlcklkID0gbnVsbDtcblxuICAgIGRlc3Ryb3koZGV2aWNlKSB7XG4gICAgICAgIGlmICh0aGlzLmJ1ZmZlcklkKSB7XG4gICAgICAgICAgICBkZXZpY2UuZ2wuZGVsZXRlQnVmZmVyKHRoaXMuYnVmZmVySWQpO1xuICAgICAgICAgICAgdGhpcy5idWZmZXJJZCA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgaW5pdGlhbGl6ZWQoKSB7XG4gICAgICAgIHJldHVybiAhIXRoaXMuYnVmZmVySWQ7XG4gICAgfVxuXG4gICAgbG9zZUNvbnRleHQoKSB7XG4gICAgICAgIHRoaXMuYnVmZmVySWQgPSBudWxsO1xuICAgIH1cblxuICAgIHVubG9jayhkZXZpY2UsIHVzYWdlLCB0YXJnZXQsIHN0b3JhZ2UpIHtcbiAgICAgICAgY29uc3QgZ2wgPSBkZXZpY2UuZ2w7XG5cbiAgICAgICAgaWYgKCF0aGlzLmJ1ZmZlcklkKSB7XG4gICAgICAgICAgICB0aGlzLmJ1ZmZlcklkID0gZ2wuY3JlYXRlQnVmZmVyKCk7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgZ2xVc2FnZTtcbiAgICAgICAgc3dpdGNoICh1c2FnZSkge1xuICAgICAgICAgICAgY2FzZSBCVUZGRVJfU1RBVElDOlxuICAgICAgICAgICAgICAgIGdsVXNhZ2UgPSBnbC5TVEFUSUNfRFJBVztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgQlVGRkVSX0RZTkFNSUM6XG4gICAgICAgICAgICAgICAgZ2xVc2FnZSA9IGdsLkRZTkFNSUNfRFJBVztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgQlVGRkVSX1NUUkVBTTpcbiAgICAgICAgICAgICAgICBnbFVzYWdlID0gZ2wuU1RSRUFNX0RSQVc7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIEJVRkZFUl9HUFVEWU5BTUlDOlxuICAgICAgICAgICAgICAgIGlmIChkZXZpY2Uud2ViZ2wyKSB7XG4gICAgICAgICAgICAgICAgICAgIGdsVXNhZ2UgPSBnbC5EWU5BTUlDX0NPUFk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgZ2xVc2FnZSA9IGdsLlNUQVRJQ19EUkFXO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIGdsLmJpbmRCdWZmZXIodGFyZ2V0LCB0aGlzLmJ1ZmZlcklkKTtcbiAgICAgICAgZ2wuYnVmZmVyRGF0YSh0YXJnZXQsIHN0b3JhZ2UsIGdsVXNhZ2UpO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgV2ViZ2xCdWZmZXIgfTtcbiJdLCJuYW1lcyI6WyJXZWJnbEJ1ZmZlciIsImJ1ZmZlcklkIiwiZGVzdHJveSIsImRldmljZSIsImdsIiwiZGVsZXRlQnVmZmVyIiwiaW5pdGlhbGl6ZWQiLCJsb3NlQ29udGV4dCIsInVubG9jayIsInVzYWdlIiwidGFyZ2V0Iiwic3RvcmFnZSIsImNyZWF0ZUJ1ZmZlciIsImdsVXNhZ2UiLCJCVUZGRVJfU1RBVElDIiwiU1RBVElDX0RSQVciLCJCVUZGRVJfRFlOQU1JQyIsIkRZTkFNSUNfRFJBVyIsIkJVRkZFUl9TVFJFQU0iLCJTVFJFQU1fRFJBVyIsIkJVRkZFUl9HUFVEWU5BTUlDIiwid2ViZ2wyIiwiRFlOQU1JQ19DT1BZIiwiYmluZEJ1ZmZlciIsImJ1ZmZlckRhdGEiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsV0FBVyxDQUFDO0FBQUEsRUFBQSxXQUFBLEdBQUE7SUFBQSxJQUNkQyxDQUFBQSxRQUFRLEdBQUcsSUFBSSxDQUFBO0FBQUEsR0FBQTtFQUVmQyxPQUFPLENBQUNDLE1BQU0sRUFBRTtJQUNaLElBQUksSUFBSSxDQUFDRixRQUFRLEVBQUU7TUFDZkUsTUFBTSxDQUFDQyxFQUFFLENBQUNDLFlBQVksQ0FBQyxJQUFJLENBQUNKLFFBQVEsQ0FBQyxDQUFBO01BQ3JDLElBQUksQ0FBQ0EsUUFBUSxHQUFHLElBQUksQ0FBQTtBQUN4QixLQUFBO0FBQ0osR0FBQTtBQUVBLEVBQUEsSUFBSUssV0FBVyxHQUFHO0FBQ2QsSUFBQSxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUNMLFFBQVEsQ0FBQTtBQUMxQixHQUFBO0FBRUFNLEVBQUFBLFdBQVcsR0FBRztJQUNWLElBQUksQ0FBQ04sUUFBUSxHQUFHLElBQUksQ0FBQTtBQUN4QixHQUFBO0VBRUFPLE1BQU0sQ0FBQ0wsTUFBTSxFQUFFTSxLQUFLLEVBQUVDLE1BQU0sRUFBRUMsT0FBTyxFQUFFO0FBQ25DLElBQUEsTUFBTVAsRUFBRSxHQUFHRCxNQUFNLENBQUNDLEVBQUUsQ0FBQTtBQUVwQixJQUFBLElBQUksQ0FBQyxJQUFJLENBQUNILFFBQVEsRUFBRTtBQUNoQixNQUFBLElBQUksQ0FBQ0EsUUFBUSxHQUFHRyxFQUFFLENBQUNRLFlBQVksRUFBRSxDQUFBO0FBQ3JDLEtBQUE7QUFFQSxJQUFBLElBQUlDLE9BQU8sQ0FBQTtBQUNYLElBQUEsUUFBUUosS0FBSztBQUNULE1BQUEsS0FBS0ssYUFBYTtRQUNkRCxPQUFPLEdBQUdULEVBQUUsQ0FBQ1csV0FBVyxDQUFBO0FBQ3hCLFFBQUEsTUFBQTtBQUNKLE1BQUEsS0FBS0MsY0FBYztRQUNmSCxPQUFPLEdBQUdULEVBQUUsQ0FBQ2EsWUFBWSxDQUFBO0FBQ3pCLFFBQUEsTUFBQTtBQUNKLE1BQUEsS0FBS0MsYUFBYTtRQUNkTCxPQUFPLEdBQUdULEVBQUUsQ0FBQ2UsV0FBVyxDQUFBO0FBQ3hCLFFBQUEsTUFBQTtBQUNKLE1BQUEsS0FBS0MsaUJBQWlCO1FBQ2xCLElBQUlqQixNQUFNLENBQUNrQixNQUFNLEVBQUU7VUFDZlIsT0FBTyxHQUFHVCxFQUFFLENBQUNrQixZQUFZLENBQUE7QUFDN0IsU0FBQyxNQUFNO1VBQ0hULE9BQU8sR0FBR1QsRUFBRSxDQUFDVyxXQUFXLENBQUE7QUFDNUIsU0FBQTtBQUNBLFFBQUEsTUFBQTtBQUFNLEtBQUE7SUFHZFgsRUFBRSxDQUFDbUIsVUFBVSxDQUFDYixNQUFNLEVBQUUsSUFBSSxDQUFDVCxRQUFRLENBQUMsQ0FBQTtJQUNwQ0csRUFBRSxDQUFDb0IsVUFBVSxDQUFDZCxNQUFNLEVBQUVDLE9BQU8sRUFBRUUsT0FBTyxDQUFDLENBQUE7QUFDM0MsR0FBQTtBQUNKOzs7OyJ9
