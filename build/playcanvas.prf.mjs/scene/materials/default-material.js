/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import '../../core/tracing.js';
import { DeviceCache } from '../../platform/graphics/device-cache.js';

const defaultMaterialDeviceCache = new DeviceCache();
function getDefaultMaterial(device) {
	const material = defaultMaterialDeviceCache.get(device);
	return material;
}
function setDefaultMaterial(device, material) {
	defaultMaterialDeviceCache.get(device, () => {
		return material;
	});
}

export { getDefaultMaterial, setDefaultMaterial };
