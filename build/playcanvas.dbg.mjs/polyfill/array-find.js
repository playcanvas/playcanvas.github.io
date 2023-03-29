/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { defineProtoFunc } from './defineProtoFunc.js';

// https://tc39.github.io/ecma262/#sec-array.prototype.find
defineProtoFunc(Array, 'find', function (predicate) {
  // 1. Let O be ? ToObject(this value).
  if (this == null) {
    throw TypeError('"this" is null or not defined');
  }
  var o = Object(this);

  // 2. Let len be ? ToLength(? Get(O, "length")).
  var len = o.length >>> 0;

  // 3. If IsCallable(predicate) is false, throw a TypeError exception.
  if (typeof predicate !== 'function') {
    throw TypeError('predicate must be a function');
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
    // d. If testResult is true, return kValue.
    var kValue = o[k];
    if (predicate.call(thisArg, kValue, k, o)) {
      return kValue;
    }
    // e. Increase k by 1.
    k++;
  }

  // 7. Return undefined.
  return undefined;
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXJyYXktZmluZC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL3BvbHlmaWxsL2FycmF5LWZpbmQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgZGVmaW5lUHJvdG9GdW5jIH0gZnJvbSBcIi4vZGVmaW5lUHJvdG9GdW5jLmpzXCI7XG5cbi8vIGh0dHBzOi8vdGMzOS5naXRodWIuaW8vZWNtYTI2Mi8jc2VjLWFycmF5LnByb3RvdHlwZS5maW5kXG5kZWZpbmVQcm90b0Z1bmMoQXJyYXksICdmaW5kJywgZnVuY3Rpb24ocHJlZGljYXRlKSB7XG4gICAgLy8gMS4gTGV0IE8gYmUgPyBUb09iamVjdCh0aGlzIHZhbHVlKS5cbiAgICBpZiAodGhpcyA9PSBudWxsKSB7XG4gICAgICAgIHRocm93IFR5cGVFcnJvcignXCJ0aGlzXCIgaXMgbnVsbCBvciBub3QgZGVmaW5lZCcpO1xuICAgIH1cblxuICAgIHZhciBvID0gT2JqZWN0KHRoaXMpO1xuXG4gICAgLy8gMi4gTGV0IGxlbiBiZSA/IFRvTGVuZ3RoKD8gR2V0KE8sIFwibGVuZ3RoXCIpKS5cbiAgICB2YXIgbGVuID0gby5sZW5ndGggPj4+IDA7XG5cbiAgICAvLyAzLiBJZiBJc0NhbGxhYmxlKHByZWRpY2F0ZSkgaXMgZmFsc2UsIHRocm93IGEgVHlwZUVycm9yIGV4Y2VwdGlvbi5cbiAgICBpZiAodHlwZW9mIHByZWRpY2F0ZSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICB0aHJvdyBUeXBlRXJyb3IoJ3ByZWRpY2F0ZSBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcbiAgICB9XG5cbiAgICAvLyA0LiBJZiB0aGlzQXJnIHdhcyBzdXBwbGllZCwgbGV0IFQgYmUgdGhpc0FyZzsgZWxzZSBsZXQgVCBiZSB1bmRlZmluZWQuXG4gICAgdmFyIHRoaXNBcmcgPSBhcmd1bWVudHNbMV07XG5cbiAgICAvLyA1LiBMZXQgayBiZSAwLlxuICAgIHZhciBrID0gMDtcblxuICAgIC8vIDYuIFJlcGVhdCwgd2hpbGUgayA8IGxlblxuICAgIHdoaWxlIChrIDwgbGVuKSB7XG4gICAgICAgIC8vIGEuIExldCBQayBiZSAhIFRvU3RyaW5nKGspLlxuICAgICAgICAvLyBiLiBMZXQga1ZhbHVlIGJlID8gR2V0KE8sIFBrKS5cbiAgICAgICAgLy8gYy4gTGV0IHRlc3RSZXN1bHQgYmUgVG9Cb29sZWFuKD8gQ2FsbChwcmVkaWNhdGUsIFQsIMKrIGtWYWx1ZSwgaywgTyDCuykpLlxuICAgICAgICAvLyBkLiBJZiB0ZXN0UmVzdWx0IGlzIHRydWUsIHJldHVybiBrVmFsdWUuXG4gICAgICAgIHZhciBrVmFsdWUgPSBvW2tdO1xuICAgICAgICBpZiAocHJlZGljYXRlLmNhbGwodGhpc0FyZywga1ZhbHVlLCBrLCBvKSkge1xuICAgICAgICAgICAgcmV0dXJuIGtWYWx1ZTtcbiAgICAgICAgfVxuICAgICAgICAvLyBlLiBJbmNyZWFzZSBrIGJ5IDEuXG4gICAgICAgIGsrKztcbiAgICB9XG5cbiAgICAvLyA3LiBSZXR1cm4gdW5kZWZpbmVkLlxuICAgIHJldHVybiB1bmRlZmluZWQ7XG59KTtcbiJdLCJuYW1lcyI6WyJkZWZpbmVQcm90b0Z1bmMiLCJBcnJheSIsInByZWRpY2F0ZSIsIlR5cGVFcnJvciIsIm8iLCJPYmplY3QiLCJsZW4iLCJsZW5ndGgiLCJ0aGlzQXJnIiwiYXJndW1lbnRzIiwiayIsImtWYWx1ZSIsImNhbGwiLCJ1bmRlZmluZWQiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7QUFFQTtBQUNBQSxlQUFlLENBQUNDLEtBQUssRUFBRSxNQUFNLEVBQUUsVUFBU0MsU0FBUyxFQUFFO0FBQy9DO0VBQ0EsSUFBSSxJQUFJLElBQUksSUFBSSxFQUFFO0lBQ2QsTUFBTUMsU0FBUyxDQUFDLCtCQUErQixDQUFDLENBQUE7QUFDcEQsR0FBQTtBQUVBLEVBQUEsSUFBSUMsQ0FBQyxHQUFHQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUE7O0FBRXBCO0FBQ0EsRUFBQSxJQUFJQyxHQUFHLEdBQUdGLENBQUMsQ0FBQ0csTUFBTSxLQUFLLENBQUMsQ0FBQTs7QUFFeEI7QUFDQSxFQUFBLElBQUksT0FBT0wsU0FBUyxLQUFLLFVBQVUsRUFBRTtJQUNqQyxNQUFNQyxTQUFTLENBQUMsOEJBQThCLENBQUMsQ0FBQTtBQUNuRCxHQUFBOztBQUVBO0FBQ0EsRUFBQSxJQUFJSyxPQUFPLEdBQUdDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQTs7QUFFMUI7RUFDQSxJQUFJQyxDQUFDLEdBQUcsQ0FBQyxDQUFBOztBQUVUO0VBQ0EsT0FBT0EsQ0FBQyxHQUFHSixHQUFHLEVBQUU7QUFDWjtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUEsSUFBSUssTUFBTSxHQUFHUCxDQUFDLENBQUNNLENBQUMsQ0FBQyxDQUFBO0FBQ2pCLElBQUEsSUFBSVIsU0FBUyxDQUFDVSxJQUFJLENBQUNKLE9BQU8sRUFBRUcsTUFBTSxFQUFFRCxDQUFDLEVBQUVOLENBQUMsQ0FBQyxFQUFFO0FBQ3ZDLE1BQUEsT0FBT08sTUFBTSxDQUFBO0FBQ2pCLEtBQUE7QUFDQTtBQUNBRCxJQUFBQSxDQUFDLEVBQUUsQ0FBQTtBQUNQLEdBQUE7O0FBRUE7QUFDQSxFQUFBLE9BQU9HLFNBQVMsQ0FBQTtBQUNwQixDQUFDLENBQUMifQ==
