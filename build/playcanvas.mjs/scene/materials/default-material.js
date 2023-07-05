import '../../core/debug.js';
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
