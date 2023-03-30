/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import '../../core/tracing.js';
import { DeviceCache } from '../../platform/graphics/device-cache.js';

const programLibraryDeviceCache = new DeviceCache();
function getProgramLibrary(device) {
	const library = programLibraryDeviceCache.get(device);
	return library;
}
function setProgramLibrary(device, library) {
	programLibraryDeviceCache.get(device, () => {
		return library;
	});
}

export { getProgramLibrary, setProgramLibrary };
