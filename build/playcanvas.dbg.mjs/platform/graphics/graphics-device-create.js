/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../core/debug.js';
import { WebgpuGraphicsDevice } from './webgpu/webgpu-graphics-device.js';
import { DEVICETYPE_WEBGL, DEVICETYPE_WEBGPU } from './constants.js';
import { WebglGraphicsDevice } from './webgl/webgl-graphics-device.js';

/**
 * Creates a graphics device.
 *
 * @param {HTMLCanvasElement} canvas - The canvas element.
 * @param {object} options - Graphics device options.
 * @param {string[]} [options.deviceTypes] - An array of DEVICETYPE_*** constants, defining the
 * order in which the device are attempted to get created. Defaults to [{@link DEVICETYPE_WEBGL}].
 * @param {string} [options.glslangUrl] - An url to glslang script, required if
 * {@link DEVICETYPE_WEBGPU} type is added to deviceTypes array. Not used for
 * {@link DEVICETYPE_WEBGL} device type creation.
 * @param {string} [options.twgslUrl] - An url to twgsl script, required glslangUrl was specified.
 * @returns {Promise} - Promise object representing the created graphics device.
 */
function createGraphicsDevice(canvas, options = {}) {
  var _options$deviceTypes;
  options.deviceTypes = (_options$deviceTypes = options.deviceTypes) != null ? _options$deviceTypes : [DEVICETYPE_WEBGL];
  let device;
  for (let i = 0; i < options.deviceTypes.length; i++) {
    var _window, _window$navigator;
    const deviceType = options.deviceTypes[i];
    if (deviceType === DEVICETYPE_WEBGPU && (_window = window) != null && (_window$navigator = _window.navigator) != null && _window$navigator.gpu) {
      device = new WebgpuGraphicsDevice(canvas, options);
      return device.initWebGpu(options.glslangUrl, options.twgslUrl);
    }
    if (deviceType === DEVICETYPE_WEBGL) {
      device = new WebglGraphicsDevice(canvas, options);
      return Promise.resolve(device);
    }
  }
  Debug.assert(device, 'Failed to allocate graphics device based on requested device types: ', options.deviceTypes);
  return Promise.reject(new Error("Failed to allocated graphics device"));
}

export { createGraphicsDevice };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3JhcGhpY3MtZGV2aWNlLWNyZWF0ZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS1jcmVhdGUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcblxuaW1wb3J0IHsgV2ViZ3B1R3JhcGhpY3NEZXZpY2UgfSBmcm9tICcuL3dlYmdwdS93ZWJncHUtZ3JhcGhpY3MtZGV2aWNlLmpzJztcbmltcG9ydCB7IERFVklDRVRZUEVfV0VCR0wsIERFVklDRVRZUEVfV0VCR1BVIH0gZnJvbSAnLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgV2ViZ2xHcmFwaGljc0RldmljZSB9IGZyb20gJy4vd2ViZ2wvd2ViZ2wtZ3JhcGhpY3MtZGV2aWNlLmpzJztcblxuLyoqXG4gKiBDcmVhdGVzIGEgZ3JhcGhpY3MgZGV2aWNlLlxuICpcbiAqIEBwYXJhbSB7SFRNTENhbnZhc0VsZW1lbnR9IGNhbnZhcyAtIFRoZSBjYW52YXMgZWxlbWVudC5cbiAqIEBwYXJhbSB7b2JqZWN0fSBvcHRpb25zIC0gR3JhcGhpY3MgZGV2aWNlIG9wdGlvbnMuXG4gKiBAcGFyYW0ge3N0cmluZ1tdfSBbb3B0aW9ucy5kZXZpY2VUeXBlc10gLSBBbiBhcnJheSBvZiBERVZJQ0VUWVBFXyoqKiBjb25zdGFudHMsIGRlZmluaW5nIHRoZVxuICogb3JkZXIgaW4gd2hpY2ggdGhlIGRldmljZSBhcmUgYXR0ZW1wdGVkIHRvIGdldCBjcmVhdGVkLiBEZWZhdWx0cyB0byBbe0BsaW5rIERFVklDRVRZUEVfV0VCR0x9XS5cbiAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5nbHNsYW5nVXJsXSAtIEFuIHVybCB0byBnbHNsYW5nIHNjcmlwdCwgcmVxdWlyZWQgaWZcbiAqIHtAbGluayBERVZJQ0VUWVBFX1dFQkdQVX0gdHlwZSBpcyBhZGRlZCB0byBkZXZpY2VUeXBlcyBhcnJheS4gTm90IHVzZWQgZm9yXG4gKiB7QGxpbmsgREVWSUNFVFlQRV9XRUJHTH0gZGV2aWNlIHR5cGUgY3JlYXRpb24uXG4gKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMudHdnc2xVcmxdIC0gQW4gdXJsIHRvIHR3Z3NsIHNjcmlwdCwgcmVxdWlyZWQgZ2xzbGFuZ1VybCB3YXMgc3BlY2lmaWVkLlxuICogQHJldHVybnMge1Byb21pc2V9IC0gUHJvbWlzZSBvYmplY3QgcmVwcmVzZW50aW5nIHRoZSBjcmVhdGVkIGdyYXBoaWNzIGRldmljZS5cbiAqL1xuZnVuY3Rpb24gY3JlYXRlR3JhcGhpY3NEZXZpY2UoY2FudmFzLCBvcHRpb25zID0ge30pIHtcbiAgICBvcHRpb25zLmRldmljZVR5cGVzID0gb3B0aW9ucy5kZXZpY2VUeXBlcyA/PyBbREVWSUNFVFlQRV9XRUJHTF07XG5cbiAgICBsZXQgZGV2aWNlO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgb3B0aW9ucy5kZXZpY2VUeXBlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBkZXZpY2VUeXBlID0gb3B0aW9ucy5kZXZpY2VUeXBlc1tpXTtcblxuICAgICAgICBpZiAoZGV2aWNlVHlwZSA9PT0gREVWSUNFVFlQRV9XRUJHUFUgJiYgd2luZG93Py5uYXZpZ2F0b3I/LmdwdSkge1xuICAgICAgICAgICAgZGV2aWNlID0gbmV3IFdlYmdwdUdyYXBoaWNzRGV2aWNlKGNhbnZhcywgb3B0aW9ucyk7XG4gICAgICAgICAgICByZXR1cm4gZGV2aWNlLmluaXRXZWJHcHUob3B0aW9ucy5nbHNsYW5nVXJsLCBvcHRpb25zLnR3Z3NsVXJsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChkZXZpY2VUeXBlID09PSBERVZJQ0VUWVBFX1dFQkdMKSB7XG4gICAgICAgICAgICBkZXZpY2UgPSBuZXcgV2ViZ2xHcmFwaGljc0RldmljZShjYW52YXMsIG9wdGlvbnMpO1xuICAgICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShkZXZpY2UpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgRGVidWcuYXNzZXJ0KGRldmljZSwgJ0ZhaWxlZCB0byBhbGxvY2F0ZSBncmFwaGljcyBkZXZpY2UgYmFzZWQgb24gcmVxdWVzdGVkIGRldmljZSB0eXBlczogJywgb3B0aW9ucy5kZXZpY2VUeXBlcyk7XG4gICAgcmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyBFcnJvcihcIkZhaWxlZCB0byBhbGxvY2F0ZWQgZ3JhcGhpY3MgZGV2aWNlXCIpKTtcbn1cblxuZXhwb3J0IHsgY3JlYXRlR3JhcGhpY3NEZXZpY2UgfTtcbiJdLCJuYW1lcyI6WyJjcmVhdGVHcmFwaGljc0RldmljZSIsImNhbnZhcyIsIm9wdGlvbnMiLCJkZXZpY2VUeXBlcyIsIkRFVklDRVRZUEVfV0VCR0wiLCJkZXZpY2UiLCJpIiwibGVuZ3RoIiwiZGV2aWNlVHlwZSIsIkRFVklDRVRZUEVfV0VCR1BVIiwid2luZG93IiwibmF2aWdhdG9yIiwiZ3B1IiwiV2ViZ3B1R3JhcGhpY3NEZXZpY2UiLCJpbml0V2ViR3B1IiwiZ2xzbGFuZ1VybCIsInR3Z3NsVXJsIiwiV2ViZ2xHcmFwaGljc0RldmljZSIsIlByb21pc2UiLCJyZXNvbHZlIiwiRGVidWciLCJhc3NlcnQiLCJyZWplY3QiLCJFcnJvciJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQU1BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBU0Esb0JBQW9CLENBQUNDLE1BQU0sRUFBRUMsT0FBTyxHQUFHLEVBQUUsRUFBRTtBQUFBLEVBQUEsSUFBQSxvQkFBQSxDQUFBO0VBQ2hEQSxPQUFPLENBQUNDLFdBQVcsR0FBR0QsQ0FBQUEsb0JBQUFBLEdBQUFBLE9BQU8sQ0FBQ0MsV0FBVyxLQUFBLElBQUEsR0FBQSxvQkFBQSxHQUFJLENBQUNDLGdCQUFnQixDQUFDLENBQUE7QUFFL0QsRUFBQSxJQUFJQyxNQUFNLENBQUE7QUFDVixFQUFBLEtBQUssSUFBSUMsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHSixPQUFPLENBQUNDLFdBQVcsQ0FBQ0ksTUFBTSxFQUFFRCxDQUFDLEVBQUUsRUFBRTtBQUFBLElBQUEsSUFBQSxPQUFBLEVBQUEsaUJBQUEsQ0FBQTtBQUNqRCxJQUFBLE1BQU1FLFVBQVUsR0FBR04sT0FBTyxDQUFDQyxXQUFXLENBQUNHLENBQUMsQ0FBQyxDQUFBO0lBRXpDLElBQUlFLFVBQVUsS0FBS0MsaUJBQWlCLElBQUlDLENBQUFBLE9BQUFBLEdBQUFBLE1BQU0sS0FBTixJQUFBLElBQUEsQ0FBQSxpQkFBQSxHQUFBLE9BQUEsQ0FBUUMsU0FBUyxLQUFBLElBQUEsSUFBakIsaUJBQW1CQyxDQUFBQSxHQUFHLEVBQUU7QUFDNURQLE1BQUFBLE1BQU0sR0FBRyxJQUFJUSxvQkFBb0IsQ0FBQ1osTUFBTSxFQUFFQyxPQUFPLENBQUMsQ0FBQTtNQUNsRCxPQUFPRyxNQUFNLENBQUNTLFVBQVUsQ0FBQ1osT0FBTyxDQUFDYSxVQUFVLEVBQUViLE9BQU8sQ0FBQ2MsUUFBUSxDQUFDLENBQUE7QUFDbEUsS0FBQTtJQUVBLElBQUlSLFVBQVUsS0FBS0osZ0JBQWdCLEVBQUU7QUFDakNDLE1BQUFBLE1BQU0sR0FBRyxJQUFJWSxtQkFBbUIsQ0FBQ2hCLE1BQU0sRUFBRUMsT0FBTyxDQUFDLENBQUE7QUFDakQsTUFBQSxPQUFPZ0IsT0FBTyxDQUFDQyxPQUFPLENBQUNkLE1BQU0sQ0FBQyxDQUFBO0FBQ2xDLEtBQUE7QUFDSixHQUFBO0VBRUFlLEtBQUssQ0FBQ0MsTUFBTSxDQUFDaEIsTUFBTSxFQUFFLHNFQUFzRSxFQUFFSCxPQUFPLENBQUNDLFdBQVcsQ0FBQyxDQUFBO0VBQ2pILE9BQU9lLE9BQU8sQ0FBQ0ksTUFBTSxDQUFDLElBQUlDLEtBQUssQ0FBQyxxQ0FBcUMsQ0FBQyxDQUFDLENBQUE7QUFDM0U7Ozs7In0=
