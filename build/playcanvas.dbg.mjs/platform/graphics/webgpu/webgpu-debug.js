/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../../core/debug.js';

// Maximum number of times a duplicate error message is logged.
const MAX_DUPLICATES = 5;

/**
 * Internal WebGPU debug system. Note that the functions only execute in the debug build, and are
 * stripped out in other builds.
 *
 * @ignore
 */
class WebgpuDebug {
  /** @type {Map<string,number>} */

  /**
   * Start a validation error scope.
   *
   * @param {import('./webgpu-graphics-device.js').WebgpuGraphicsDevice} device - The graphics
   * device.
   */
  static validate(device) {
    device.wgpu.pushErrorScope('validation');
    WebgpuDebug._scopes.push('validation');
  }

  /**
   * Start an out-of-memory error scope.
   *
   * @param {import('./webgpu-graphics-device.js').WebgpuGraphicsDevice} device - The graphics
   * device.
   */
  static memory(device) {
    device.wgpu.pushErrorScope('out-of-memory');
    WebgpuDebug._scopes.push('out-of-memory');
  }

  /**
   * Start an internal error scope.
   *
   * @param {import('./webgpu-graphics-device.js').WebgpuGraphicsDevice} device - The graphics
   * device.
   */
  static internal(device) {
    device.wgpu.pushErrorScope('internal');
    WebgpuDebug._scopes.push('internal');
  }

  /**
   * End the previous error scope, and print errors if any.
   *
   * @param {import('./webgpu-graphics-device.js').WebgpuGraphicsDevice} device - The graphics
   * device.
   * @param {...any} args - Additional parameters that form the error message.
   */
  static end(device, ...args) {
    const header = WebgpuDebug._scopes.pop();
    Debug.assert(header, 'Non matching end.');
    device.wgpu.popErrorScope().then(error => {
      if (error) {
        var _WebgpuDebug$_loggedM;
        const count = (_WebgpuDebug$_loggedM = WebgpuDebug._loggedMessages.get(error.message)) != null ? _WebgpuDebug$_loggedM : 0;
        if (count < MAX_DUPLICATES) {
          const tooMany = count === MAX_DUPLICATES - 1 ? ' (Too many errors, ignoring this one from now)' : '';
          WebgpuDebug._loggedMessages.set(error.message, count + 1);
          console.error(`WebGPU ${header} error: ${error.message}`, tooMany, ...args);
        }
      }
    });
  }
}
WebgpuDebug._scopes = [];
WebgpuDebug._loggedMessages = new Map();

export { WebgpuDebug };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViZ3B1LWRlYnVnLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvcGxhdGZvcm0vZ3JhcGhpY3Mvd2ViZ3B1L3dlYmdwdS1kZWJ1Zy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gXCIuLi8uLi8uLi9jb3JlL2RlYnVnLmpzXCI7XG5cbi8vIE1heGltdW0gbnVtYmVyIG9mIHRpbWVzIGEgZHVwbGljYXRlIGVycm9yIG1lc3NhZ2UgaXMgbG9nZ2VkLlxuY29uc3QgTUFYX0RVUExJQ0FURVMgPSA1O1xuXG4vKipcbiAqIEludGVybmFsIFdlYkdQVSBkZWJ1ZyBzeXN0ZW0uIE5vdGUgdGhhdCB0aGUgZnVuY3Rpb25zIG9ubHkgZXhlY3V0ZSBpbiB0aGUgZGVidWcgYnVpbGQsIGFuZCBhcmVcbiAqIHN0cmlwcGVkIG91dCBpbiBvdGhlciBidWlsZHMuXG4gKlxuICogQGlnbm9yZVxuICovXG5jbGFzcyBXZWJncHVEZWJ1ZyB7XG4gICAgc3RhdGljIF9zY29wZXMgPSBbXTtcblxuICAgIC8qKiBAdHlwZSB7TWFwPHN0cmluZyxudW1iZXI+fSAqL1xuICAgIHN0YXRpYyBfbG9nZ2VkTWVzc2FnZXMgPSBuZXcgTWFwKCk7XG5cbiAgICAvKipcbiAgICAgKiBTdGFydCBhIHZhbGlkYXRpb24gZXJyb3Igc2NvcGUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi93ZWJncHUtZ3JhcGhpY3MtZGV2aWNlLmpzJykuV2ViZ3B1R3JhcGhpY3NEZXZpY2V9IGRldmljZSAtIFRoZSBncmFwaGljc1xuICAgICAqIGRldmljZS5cbiAgICAgKi9cbiAgICBzdGF0aWMgdmFsaWRhdGUoZGV2aWNlKSB7XG4gICAgICAgIGRldmljZS53Z3B1LnB1c2hFcnJvclNjb3BlKCd2YWxpZGF0aW9uJyk7XG4gICAgICAgIFdlYmdwdURlYnVnLl9zY29wZXMucHVzaCgndmFsaWRhdGlvbicpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFN0YXJ0IGFuIG91dC1vZi1tZW1vcnkgZXJyb3Igc2NvcGUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi93ZWJncHUtZ3JhcGhpY3MtZGV2aWNlLmpzJykuV2ViZ3B1R3JhcGhpY3NEZXZpY2V9IGRldmljZSAtIFRoZSBncmFwaGljc1xuICAgICAqIGRldmljZS5cbiAgICAgKi9cbiAgICBzdGF0aWMgbWVtb3J5KGRldmljZSkge1xuICAgICAgICBkZXZpY2Uud2dwdS5wdXNoRXJyb3JTY29wZSgnb3V0LW9mLW1lbW9yeScpO1xuICAgICAgICBXZWJncHVEZWJ1Zy5fc2NvcGVzLnB1c2goJ291dC1vZi1tZW1vcnknKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTdGFydCBhbiBpbnRlcm5hbCBlcnJvciBzY29wZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3dlYmdwdS1ncmFwaGljcy1kZXZpY2UuanMnKS5XZWJncHVHcmFwaGljc0RldmljZX0gZGV2aWNlIC0gVGhlIGdyYXBoaWNzXG4gICAgICogZGV2aWNlLlxuICAgICAqL1xuICAgIHN0YXRpYyBpbnRlcm5hbChkZXZpY2UpIHtcbiAgICAgICAgZGV2aWNlLndncHUucHVzaEVycm9yU2NvcGUoJ2ludGVybmFsJyk7XG4gICAgICAgIFdlYmdwdURlYnVnLl9zY29wZXMucHVzaCgnaW50ZXJuYWwnKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFbmQgdGhlIHByZXZpb3VzIGVycm9yIHNjb3BlLCBhbmQgcHJpbnQgZXJyb3JzIGlmIGFueS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3dlYmdwdS1ncmFwaGljcy1kZXZpY2UuanMnKS5XZWJncHVHcmFwaGljc0RldmljZX0gZGV2aWNlIC0gVGhlIGdyYXBoaWNzXG4gICAgICogZGV2aWNlLlxuICAgICAqIEBwYXJhbSB7Li4uYW55fSBhcmdzIC0gQWRkaXRpb25hbCBwYXJhbWV0ZXJzIHRoYXQgZm9ybSB0aGUgZXJyb3IgbWVzc2FnZS5cbiAgICAgKi9cbiAgICBzdGF0aWMgZW5kKGRldmljZSwgLi4uYXJncykge1xuICAgICAgICBjb25zdCBoZWFkZXIgPSBXZWJncHVEZWJ1Zy5fc2NvcGVzLnBvcCgpO1xuICAgICAgICBEZWJ1Zy5hc3NlcnQoaGVhZGVyLCAnTm9uIG1hdGNoaW5nIGVuZC4nKTtcblxuICAgICAgICBkZXZpY2Uud2dwdS5wb3BFcnJvclNjb3BlKCkudGhlbigoZXJyb3IpID0+IHtcbiAgICAgICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvdW50ID0gV2ViZ3B1RGVidWcuX2xvZ2dlZE1lc3NhZ2VzLmdldChlcnJvci5tZXNzYWdlKSA/PyAwO1xuICAgICAgICAgICAgICAgIGlmIChjb3VudCA8IE1BWF9EVVBMSUNBVEVTKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHRvb01hbnkgPSBjb3VudCA9PT0gTUFYX0RVUExJQ0FURVMgLSAxID8gJyAoVG9vIG1hbnkgZXJyb3JzLCBpZ25vcmluZyB0aGlzIG9uZSBmcm9tIG5vdyknIDogJyc7XG4gICAgICAgICAgICAgICAgICAgIFdlYmdwdURlYnVnLl9sb2dnZWRNZXNzYWdlcy5zZXQoZXJyb3IubWVzc2FnZSwgY291bnQgKyAxKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihgV2ViR1BVICR7aGVhZGVyfSBlcnJvcjogJHtlcnJvci5tZXNzYWdlfWAsIHRvb01hbnksIC4uLmFyZ3MpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBXZWJncHVEZWJ1ZyB9O1xuIl0sIm5hbWVzIjpbIk1BWF9EVVBMSUNBVEVTIiwiV2ViZ3B1RGVidWciLCJ2YWxpZGF0ZSIsImRldmljZSIsIndncHUiLCJwdXNoRXJyb3JTY29wZSIsIl9zY29wZXMiLCJwdXNoIiwibWVtb3J5IiwiaW50ZXJuYWwiLCJlbmQiLCJhcmdzIiwiaGVhZGVyIiwicG9wIiwiRGVidWciLCJhc3NlcnQiLCJwb3BFcnJvclNjb3BlIiwidGhlbiIsImVycm9yIiwiY291bnQiLCJfbG9nZ2VkTWVzc2FnZXMiLCJnZXQiLCJtZXNzYWdlIiwidG9vTWFueSIsInNldCIsImNvbnNvbGUiLCJNYXAiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7QUFFQTtBQUNBLE1BQU1BLGNBQWMsR0FBRyxDQUFDLENBQUE7O0FBRXhCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1DLFdBQVcsQ0FBQztBQUdkOztBQUdBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJLE9BQU9DLFFBQVEsQ0FBQ0MsTUFBTSxFQUFFO0FBQ3BCQSxJQUFBQSxNQUFNLENBQUNDLElBQUksQ0FBQ0MsY0FBYyxDQUFDLFlBQVksQ0FBQyxDQUFBO0FBQ3hDSixJQUFBQSxXQUFXLENBQUNLLE9BQU8sQ0FBQ0MsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFBO0FBQzFDLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0ksT0FBT0MsTUFBTSxDQUFDTCxNQUFNLEVBQUU7QUFDbEJBLElBQUFBLE1BQU0sQ0FBQ0MsSUFBSSxDQUFDQyxjQUFjLENBQUMsZUFBZSxDQUFDLENBQUE7QUFDM0NKLElBQUFBLFdBQVcsQ0FBQ0ssT0FBTyxDQUFDQyxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUE7QUFDN0MsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSSxPQUFPRSxRQUFRLENBQUNOLE1BQU0sRUFBRTtBQUNwQkEsSUFBQUEsTUFBTSxDQUFDQyxJQUFJLENBQUNDLGNBQWMsQ0FBQyxVQUFVLENBQUMsQ0FBQTtBQUN0Q0osSUFBQUEsV0FBVyxDQUFDSyxPQUFPLENBQUNDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQTtBQUN4QyxHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0ksRUFBQSxPQUFPRyxHQUFHLENBQUNQLE1BQU0sRUFBRSxHQUFHUSxJQUFJLEVBQUU7QUFDeEIsSUFBQSxNQUFNQyxNQUFNLEdBQUdYLFdBQVcsQ0FBQ0ssT0FBTyxDQUFDTyxHQUFHLEVBQUUsQ0FBQTtBQUN4Q0MsSUFBQUEsS0FBSyxDQUFDQyxNQUFNLENBQUNILE1BQU0sRUFBRSxtQkFBbUIsQ0FBQyxDQUFBO0lBRXpDVCxNQUFNLENBQUNDLElBQUksQ0FBQ1ksYUFBYSxFQUFFLENBQUNDLElBQUksQ0FBRUMsS0FBSyxJQUFLO0FBQ3hDLE1BQUEsSUFBSUEsS0FBSyxFQUFFO0FBQUEsUUFBQSxJQUFBLHFCQUFBLENBQUE7QUFDUCxRQUFBLE1BQU1DLEtBQUssR0FBQSxDQUFBLHFCQUFBLEdBQUdsQixXQUFXLENBQUNtQixlQUFlLENBQUNDLEdBQUcsQ0FBQ0gsS0FBSyxDQUFDSSxPQUFPLENBQUMsb0NBQUksQ0FBQyxDQUFBO1FBQ2pFLElBQUlILEtBQUssR0FBR25CLGNBQWMsRUFBRTtVQUN4QixNQUFNdUIsT0FBTyxHQUFHSixLQUFLLEtBQUtuQixjQUFjLEdBQUcsQ0FBQyxHQUFHLGdEQUFnRCxHQUFHLEVBQUUsQ0FBQTtBQUNwR0MsVUFBQUEsV0FBVyxDQUFDbUIsZUFBZSxDQUFDSSxHQUFHLENBQUNOLEtBQUssQ0FBQ0ksT0FBTyxFQUFFSCxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUE7QUFDekRNLFVBQUFBLE9BQU8sQ0FBQ1AsS0FBSyxDQUFFLENBQUEsT0FBQSxFQUFTTixNQUFPLENBQVVNLFFBQUFBLEVBQUFBLEtBQUssQ0FBQ0ksT0FBUSxFQUFDLEVBQUVDLE9BQU8sRUFBRSxHQUFHWixJQUFJLENBQUMsQ0FBQTtBQUMvRSxTQUFBO0FBQ0osT0FBQTtBQUNKLEtBQUMsQ0FBQyxDQUFBO0FBQ04sR0FBQTtBQUNKLENBQUE7QUE3RE1WLFdBQVcsQ0FDTkssT0FBTyxHQUFHLEVBQUUsQ0FBQTtBQURqQkwsV0FBVyxDQUlObUIsZUFBZSxHQUFHLElBQUlNLEdBQUcsRUFBRTs7OzsifQ==
