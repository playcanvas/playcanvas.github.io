/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
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
