/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import '../../core/tracing.js';
import { DEVICETYPE_WEBGL } from './constants.js';
import { WebglGraphicsDevice } from './webgl/webgl-graphics-device.js';

function createGraphicsDevice(canvas, options = {}) {
  var _options$deviceTypes;
  options.deviceTypes = (_options$deviceTypes = options.deviceTypes) != null ? _options$deviceTypes : [DEVICETYPE_WEBGL];
  let device;
  for (let i = 0; i < options.deviceTypes.length; i++) {
    const deviceType = options.deviceTypes[i];
    if (deviceType === DEVICETYPE_WEBGL) {
      device = new WebglGraphicsDevice(canvas, options);
      return Promise.resolve(device);
    }
  }
  return Promise.reject(new Error("Failed to allocated graphics device"));
}

export { createGraphicsDevice };
