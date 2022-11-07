/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
class ObjectPool {
  constructor(constructorFunc, size) {
    this._constructor = constructorFunc;
    this._pool = [];
    this._count = 0;
    this._resize(size);
  }
  _resize(size) {
    if (size > this._pool.length) {
      for (let i = this._pool.length; i < size; i++) {
        this._pool[i] = new this._constructor();
      }
    }
  }
  allocate() {
    if (this._count >= this._pool.length) {
      this._resize(this._pool.length * 2);
    }
    return this._pool[this._count++];
  }
  freeAll() {
    this._count = 0;
  }
}

export { ObjectPool };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib2JqZWN0LXBvb2wuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9jb3JlL29iamVjdC1wb29sLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImNsYXNzIE9iamVjdFBvb2wge1xuICAgIGNvbnN0cnVjdG9yKGNvbnN0cnVjdG9yRnVuYywgc2l6ZSkge1xuICAgICAgICB0aGlzLl9jb25zdHJ1Y3RvciA9IGNvbnN0cnVjdG9yRnVuYztcbiAgICAgICAgdGhpcy5fcG9vbCA9IFtdO1xuICAgICAgICB0aGlzLl9jb3VudCA9IDA7XG5cbiAgICAgICAgdGhpcy5fcmVzaXplKHNpemUpO1xuICAgIH1cblxuICAgIF9yZXNpemUoc2l6ZSkge1xuICAgICAgICBpZiAoc2l6ZSA+IHRoaXMuX3Bvb2wubGVuZ3RoKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gdGhpcy5fcG9vbC5sZW5ndGg7IGkgPCBzaXplOyBpKyspIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9wb29sW2ldID0gbmV3IHRoaXMuX2NvbnN0cnVjdG9yKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhbGxvY2F0ZSgpIHtcbiAgICAgICAgaWYgKHRoaXMuX2NvdW50ID49IHRoaXMuX3Bvb2wubGVuZ3RoKSB7XG4gICAgICAgICAgICB0aGlzLl9yZXNpemUodGhpcy5fcG9vbC5sZW5ndGggKiAyKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fcG9vbFt0aGlzLl9jb3VudCsrXTtcbiAgICB9XG5cbiAgICBmcmVlQWxsKCkge1xuICAgICAgICB0aGlzLl9jb3VudCA9IDA7XG4gICAgfVxufVxuXG5leHBvcnQgeyBPYmplY3RQb29sIH07XG4iXSwibmFtZXMiOlsiT2JqZWN0UG9vbCIsImNvbnN0cnVjdG9yIiwiY29uc3RydWN0b3JGdW5jIiwic2l6ZSIsIl9jb25zdHJ1Y3RvciIsIl9wb29sIiwiX2NvdW50IiwiX3Jlc2l6ZSIsImxlbmd0aCIsImkiLCJhbGxvY2F0ZSIsImZyZWVBbGwiXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsTUFBTUEsVUFBVSxDQUFDO0FBQ2JDLEVBQUFBLFdBQVcsQ0FBQ0MsZUFBZSxFQUFFQyxJQUFJLEVBQUU7SUFDL0IsSUFBSSxDQUFDQyxZQUFZLEdBQUdGLGVBQWUsQ0FBQTtJQUNuQyxJQUFJLENBQUNHLEtBQUssR0FBRyxFQUFFLENBQUE7SUFDZixJQUFJLENBQUNDLE1BQU0sR0FBRyxDQUFDLENBQUE7QUFFZixJQUFBLElBQUksQ0FBQ0MsT0FBTyxDQUFDSixJQUFJLENBQUMsQ0FBQTtBQUN0QixHQUFBO0VBRUFJLE9BQU8sQ0FBQ0osSUFBSSxFQUFFO0FBQ1YsSUFBQSxJQUFJQSxJQUFJLEdBQUcsSUFBSSxDQUFDRSxLQUFLLENBQUNHLE1BQU0sRUFBRTtBQUMxQixNQUFBLEtBQUssSUFBSUMsQ0FBQyxHQUFHLElBQUksQ0FBQ0osS0FBSyxDQUFDRyxNQUFNLEVBQUVDLENBQUMsR0FBR04sSUFBSSxFQUFFTSxDQUFDLEVBQUUsRUFBRTtRQUMzQyxJQUFJLENBQUNKLEtBQUssQ0FBQ0ksQ0FBQyxDQUFDLEdBQUcsSUFBSSxJQUFJLENBQUNMLFlBQVksRUFBRSxDQUFBO0FBQzNDLE9BQUE7QUFDSixLQUFBO0FBQ0osR0FBQTtBQUVBTSxFQUFBQSxRQUFRLEdBQUc7SUFDUCxJQUFJLElBQUksQ0FBQ0osTUFBTSxJQUFJLElBQUksQ0FBQ0QsS0FBSyxDQUFDRyxNQUFNLEVBQUU7TUFDbEMsSUFBSSxDQUFDRCxPQUFPLENBQUMsSUFBSSxDQUFDRixLQUFLLENBQUNHLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQTtBQUN2QyxLQUFBO0lBQ0EsT0FBTyxJQUFJLENBQUNILEtBQUssQ0FBQyxJQUFJLENBQUNDLE1BQU0sRUFBRSxDQUFDLENBQUE7QUFDcEMsR0FBQTtBQUVBSyxFQUFBQSxPQUFPLEdBQUc7SUFDTixJQUFJLENBQUNMLE1BQU0sR0FBRyxDQUFDLENBQUE7QUFDbkIsR0FBQTtBQUNKOzs7OyJ9