import '../../core/debug.js';
import { platform } from '../../core/platform.js';
import { WebgpuGraphicsDevice } from './webgpu/webgpu-graphics-device.js';
import { DEVICETYPE_WEBGL2, DEVICETYPE_WEBGL1, DEVICETYPE_WEBGPU } from './constants.js';
import { WebglGraphicsDevice } from './webgl/webgl-graphics-device.js';

function createGraphicsDevice(canvas, options = {}) {
	var _options$deviceTypes;
	const deviceTypes = (_options$deviceTypes = options.deviceTypes) != null ? _options$deviceTypes : [];
	if (!deviceTypes.includes(DEVICETYPE_WEBGL2)) {
		deviceTypes.push(DEVICETYPE_WEBGL2);
	}
	if (!deviceTypes.includes(DEVICETYPE_WEBGL1)) {
		deviceTypes.push(DEVICETYPE_WEBGL1);
	}
	if (platform.browser && !!navigator.xr) {
		var _options$xrCompatible;
		(_options$xrCompatible = options.xrCompatible) != null ? _options$xrCompatible : options.xrCompatible = true;
	}
	let device;
	for (let i = 0; i < deviceTypes.length; i++) {
		var _window, _window$navigator;
		const deviceType = deviceTypes[i];
		if (deviceType === DEVICETYPE_WEBGPU && (_window = window) != null && (_window$navigator = _window.navigator) != null && _window$navigator.gpu) {
			device = new WebgpuGraphicsDevice(canvas, options);
			return device.initWebGpu(options.glslangUrl, options.twgslUrl);
		}
		if (deviceType !== DEVICETYPE_WEBGPU) {
			options.preferWebGl2 = deviceType === DEVICETYPE_WEBGL2;
			device = new WebglGraphicsDevice(canvas, options);
			return Promise.resolve(device);
		}
	}
	return Promise.reject(new Error("Failed to allocate graphics device"));
}

export { createGraphicsDevice };
