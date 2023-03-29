/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
class DeviceCache {
	constructor() {
		this._cache = new Map();
	}
	get(device, onCreate) {
		if (!this._cache.has(device)) {
			this._cache.set(device, onCreate());
			device.on('destroy', () => {
				this.remove(device);
			});
			device.on('devicelost', () => {
				var _this$_cache$get;
				(_this$_cache$get = this._cache.get(device)) == null ? void 0 : _this$_cache$get.loseContext == null ? void 0 : _this$_cache$get.loseContext(device);
			});
		}
		return this._cache.get(device);
	}
	remove(device) {
		var _this$_cache$get2;
		(_this$_cache$get2 = this._cache.get(device)) == null ? void 0 : _this$_cache$get2.destroy == null ? void 0 : _this$_cache$get2.destroy(device);
		this._cache.delete(device);
	}
}

export { DeviceCache };
