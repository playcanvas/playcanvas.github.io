/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { WebglBuffer } from './webgl-buffer.js';

class WebglVertexBuffer extends WebglBuffer {
  constructor(...args) {
    super(...args);
    this.vao = null;
  }

  destroy(device) {
    super.destroy(device);
    device.boundVao = null;
    device.gl.bindVertexArray(null);
  }

  loseContext() {
    super.loseContext();
    this.vao = null;
  }

  unlock(vertexBuffer) {
    const device = vertexBuffer.device;
    super.unlock(device, vertexBuffer.usage, device.gl.ARRAY_BUFFER, vertexBuffer.storage);
  }

}

export { WebglVertexBuffer };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViZ2wtdmVydGV4LWJ1ZmZlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2dyYXBoaWNzL3dlYmdsL3dlYmdsLXZlcnRleC1idWZmZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgV2ViZ2xCdWZmZXIgfSBmcm9tIFwiLi93ZWJnbC1idWZmZXIuanNcIjtcblxuLyoqXG4gKiBBIFdlYkdMIGltcGxlbWVudGF0aW9uIG9mIHRoZSBWZXJ0ZXhCdWZmZXIuXG4gKlxuICogQGlnbm9yZVxuICovXG5jbGFzcyBXZWJnbFZlcnRleEJ1ZmZlciBleHRlbmRzIFdlYmdsQnVmZmVyIHtcbiAgICAvLyB2ZXJ0ZXggYXJyYXkgb2JqZWN0XG4gICAgdmFvID0gbnVsbDtcblxuICAgIGRlc3Ryb3koZGV2aWNlKSB7XG5cbiAgICAgICAgc3VwZXIuZGVzdHJveShkZXZpY2UpO1xuXG4gICAgICAgIC8vIGNsZWFyIHVwIGJvdW5kIHZlcnRleCBidWZmZXJzXG4gICAgICAgIGRldmljZS5ib3VuZFZhbyA9IG51bGw7XG4gICAgICAgIGRldmljZS5nbC5iaW5kVmVydGV4QXJyYXkobnVsbCk7XG4gICAgfVxuXG4gICAgbG9zZUNvbnRleHQoKSB7XG4gICAgICAgIHN1cGVyLmxvc2VDb250ZXh0KCk7XG4gICAgICAgIHRoaXMudmFvID0gbnVsbDtcbiAgICB9XG5cbiAgICB1bmxvY2sodmVydGV4QnVmZmVyKSB7XG5cbiAgICAgICAgY29uc3QgZGV2aWNlID0gdmVydGV4QnVmZmVyLmRldmljZTtcbiAgICAgICAgc3VwZXIudW5sb2NrKGRldmljZSwgdmVydGV4QnVmZmVyLnVzYWdlLCBkZXZpY2UuZ2wuQVJSQVlfQlVGRkVSLCB2ZXJ0ZXhCdWZmZXIuc3RvcmFnZSk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBXZWJnbFZlcnRleEJ1ZmZlciB9O1xuIl0sIm5hbWVzIjpbIldlYmdsVmVydGV4QnVmZmVyIiwiV2ViZ2xCdWZmZXIiLCJ2YW8iLCJkZXN0cm95IiwiZGV2aWNlIiwiYm91bmRWYW8iLCJnbCIsImJpbmRWZXJ0ZXhBcnJheSIsImxvc2VDb250ZXh0IiwidW5sb2NrIiwidmVydGV4QnVmZmVyIiwidXNhZ2UiLCJBUlJBWV9CVUZGRVIiLCJzdG9yYWdlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7O0FBT0EsTUFBTUEsaUJBQU4sU0FBZ0NDLFdBQWhDLENBQTRDO0FBQUEsRUFBQSxXQUFBLENBQUEsR0FBQSxJQUFBLEVBQUE7QUFBQSxJQUFBLEtBQUEsQ0FBQSxHQUFBLElBQUEsQ0FBQSxDQUFBO0lBQUEsSUFFeENDLENBQUFBLEdBRndDLEdBRWxDLElBRmtDLENBQUE7QUFBQSxHQUFBOztFQUl4Q0MsT0FBTyxDQUFDQyxNQUFELEVBQVM7SUFFWixLQUFNRCxDQUFBQSxPQUFOLENBQWNDLE1BQWQsQ0FBQSxDQUFBO0lBR0FBLE1BQU0sQ0FBQ0MsUUFBUCxHQUFrQixJQUFsQixDQUFBO0FBQ0FELElBQUFBLE1BQU0sQ0FBQ0UsRUFBUCxDQUFVQyxlQUFWLENBQTBCLElBQTFCLENBQUEsQ0FBQTtBQUNILEdBQUE7O0FBRURDLEVBQUFBLFdBQVcsR0FBRztBQUNWLElBQUEsS0FBQSxDQUFNQSxXQUFOLEVBQUEsQ0FBQTtJQUNBLElBQUtOLENBQUFBLEdBQUwsR0FBVyxJQUFYLENBQUE7QUFDSCxHQUFBOztFQUVETyxNQUFNLENBQUNDLFlBQUQsRUFBZTtBQUVqQixJQUFBLE1BQU1OLE1BQU0sR0FBR00sWUFBWSxDQUFDTixNQUE1QixDQUFBO0FBQ0EsSUFBQSxLQUFBLENBQU1LLE1BQU4sQ0FBYUwsTUFBYixFQUFxQk0sWUFBWSxDQUFDQyxLQUFsQyxFQUF5Q1AsTUFBTSxDQUFDRSxFQUFQLENBQVVNLFlBQW5ELEVBQWlFRixZQUFZLENBQUNHLE9BQTlFLENBQUEsQ0FBQTtBQUNILEdBQUE7O0FBdEJ1Qzs7OzsifQ==