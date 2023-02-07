/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import '../../core/tracing.js';
import { WebgpuGraphicsDevice } from './webgpu/webgpu-graphics-device.js';
import { DEVICETYPE_WEBGL, DEVICETYPE_WEBGPU } from './constants.js';
import { WebglGraphicsDevice } from './webgl/webgl-graphics-device.js';

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
	return Promise.reject(new Error("Failed to allocated graphics device"));
}

export { createGraphicsDevice };
