/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { defineProtoFunc } from './defineProtoFunc.js';

// https://tc39.github.io/ecma262/#sec-array.prototype.findindex
defineProtoFunc(Array, 'findIndex', function (predicate) {
  // 1. Let O be ? ToObject(this value).
  if (this == null) {
    throw new TypeError('"this" is null or not defined');
  }
  var o = Object(this);

  // 2. Let len be ? ToLength(? Get(O, "length")).
  var len = o.length >>> 0;

  // 3. If IsCallable(predicate) is false, throw a TypeError exception.
  if (typeof predicate !== 'function') {
    throw new TypeError('predicate must be a function');
  }

  // 4. If thisArg was supplied, let T be thisArg; else let T be undefined.
  var thisArg = arguments[1];

  // 5. Let k be 0.
  var k = 0;

  // 6. Repeat, while k < len
  while (k < len) {
    // a. Let Pk be ! ToString(k).
    // b. Let kValue be ? Get(O, Pk).
    // c. Let testResult be ToBoolean(? Call(predicate, T, « kValue, k, O »)).
    // d. If testResult is true, return k.
    var kValue = o[k];
    if (predicate.call(thisArg, kValue, k, o)) {
      return k;
    }
    // e. Increase k by 1.
    k++;
  }

  // 7. Return -1.
  return -1;
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXJyYXktZmluZC1pbmRleC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL3BvbHlmaWxsL2FycmF5LWZpbmQtaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgZGVmaW5lUHJvdG9GdW5jIH0gZnJvbSBcIi4vZGVmaW5lUHJvdG9GdW5jLmpzXCI7XG5cbi8vIGh0dHBzOi8vdGMzOS5naXRodWIuaW8vZWNtYTI2Mi8jc2VjLWFycmF5LnByb3RvdHlwZS5maW5kaW5kZXhcbmRlZmluZVByb3RvRnVuYyhBcnJheSwgJ2ZpbmRJbmRleCcsIGZ1bmN0aW9uKHByZWRpY2F0ZSkge1xuICAgIC8vIDEuIExldCBPIGJlID8gVG9PYmplY3QodGhpcyB2YWx1ZSkuXG4gICAgaWYgKHRoaXMgPT0gbnVsbCkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdcInRoaXNcIiBpcyBudWxsIG9yIG5vdCBkZWZpbmVkJyk7XG4gICAgfVxuXG4gICAgdmFyIG8gPSBPYmplY3QodGhpcyk7XG5cbiAgICAvLyAyLiBMZXQgbGVuIGJlID8gVG9MZW5ndGgoPyBHZXQoTywgXCJsZW5ndGhcIikpLlxuICAgIHZhciBsZW4gPSBvLmxlbmd0aCA+Pj4gMDtcblxuICAgIC8vIDMuIElmIElzQ2FsbGFibGUocHJlZGljYXRlKSBpcyBmYWxzZSwgdGhyb3cgYSBUeXBlRXJyb3IgZXhjZXB0aW9uLlxuICAgIGlmICh0eXBlb2YgcHJlZGljYXRlICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ3ByZWRpY2F0ZSBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcbiAgICB9XG5cbiAgICAvLyA0LiBJZiB0aGlzQXJnIHdhcyBzdXBwbGllZCwgbGV0IFQgYmUgdGhpc0FyZzsgZWxzZSBsZXQgVCBiZSB1bmRlZmluZWQuXG4gICAgdmFyIHRoaXNBcmcgPSBhcmd1bWVudHNbMV07XG5cbiAgICAvLyA1LiBMZXQgayBiZSAwLlxuICAgIHZhciBrID0gMDtcblxuICAgIC8vIDYuIFJlcGVhdCwgd2hpbGUgayA8IGxlblxuICAgIHdoaWxlIChrIDwgbGVuKSB7XG4gICAgICAgIC8vIGEuIExldCBQayBiZSAhIFRvU3RyaW5nKGspLlxuICAgICAgICAvLyBiLiBMZXQga1ZhbHVlIGJlID8gR2V0KE8sIFBrKS5cbiAgICAgICAgLy8gYy4gTGV0IHRlc3RSZXN1bHQgYmUgVG9Cb29sZWFuKD8gQ2FsbChwcmVkaWNhdGUsIFQsIMKrIGtWYWx1ZSwgaywgTyDCuykpLlxuICAgICAgICAvLyBkLiBJZiB0ZXN0UmVzdWx0IGlzIHRydWUsIHJldHVybiBrLlxuICAgICAgICB2YXIga1ZhbHVlID0gb1trXTtcbiAgICAgICAgaWYgKHByZWRpY2F0ZS5jYWxsKHRoaXNBcmcsIGtWYWx1ZSwgaywgbykpIHtcbiAgICAgICAgICAgIHJldHVybiBrO1xuICAgICAgICB9XG4gICAgICAgIC8vIGUuIEluY3JlYXNlIGsgYnkgMS5cbiAgICAgICAgaysrO1xuICAgIH1cblxuICAgIC8vIDcuIFJldHVybiAtMS5cbiAgICByZXR1cm4gLTE7XG59KTtcbiJdLCJuYW1lcyI6WyJkZWZpbmVQcm90b0Z1bmMiLCJBcnJheSIsInByZWRpY2F0ZSIsIlR5cGVFcnJvciIsIm8iLCJPYmplY3QiLCJsZW4iLCJsZW5ndGgiLCJ0aGlzQXJnIiwiYXJndW1lbnRzIiwiayIsImtWYWx1ZSIsImNhbGwiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7QUFFQTtBQUNBQSxlQUFlLENBQUNDLEtBQUssRUFBRSxXQUFXLEVBQUUsVUFBU0MsU0FBUyxFQUFFO0FBQ3BEO0VBQ0EsSUFBSSxJQUFJLElBQUksSUFBSSxFQUFFO0FBQ2QsSUFBQSxNQUFNLElBQUlDLFNBQVMsQ0FBQywrQkFBK0IsQ0FBQyxDQUFBO0FBQ3hELEdBQUE7QUFFQSxFQUFBLElBQUlDLENBQUMsR0FBR0MsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFBOztBQUVwQjtBQUNBLEVBQUEsSUFBSUMsR0FBRyxHQUFHRixDQUFDLENBQUNHLE1BQU0sS0FBSyxDQUFDLENBQUE7O0FBRXhCO0FBQ0EsRUFBQSxJQUFJLE9BQU9MLFNBQVMsS0FBSyxVQUFVLEVBQUU7QUFDakMsSUFBQSxNQUFNLElBQUlDLFNBQVMsQ0FBQyw4QkFBOEIsQ0FBQyxDQUFBO0FBQ3ZELEdBQUE7O0FBRUE7QUFDQSxFQUFBLElBQUlLLE9BQU8sR0FBR0MsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFBOztBQUUxQjtFQUNBLElBQUlDLENBQUMsR0FBRyxDQUFDLENBQUE7O0FBRVQ7RUFDQSxPQUFPQSxDQUFDLEdBQUdKLEdBQUcsRUFBRTtBQUNaO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBQSxJQUFJSyxNQUFNLEdBQUdQLENBQUMsQ0FBQ00sQ0FBQyxDQUFDLENBQUE7QUFDakIsSUFBQSxJQUFJUixTQUFTLENBQUNVLElBQUksQ0FBQ0osT0FBTyxFQUFFRyxNQUFNLEVBQUVELENBQUMsRUFBRU4sQ0FBQyxDQUFDLEVBQUU7QUFDdkMsTUFBQSxPQUFPTSxDQUFDLENBQUE7QUFDWixLQUFBO0FBQ0E7QUFDQUEsSUFBQUEsQ0FBQyxFQUFFLENBQUE7QUFDUCxHQUFBOztBQUVBO0FBQ0EsRUFBQSxPQUFPLENBQUMsQ0FBQyxDQUFBO0FBQ2IsQ0FBQyxDQUFDIn0=
