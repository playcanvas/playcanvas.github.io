import '../../core/debug.js';
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
