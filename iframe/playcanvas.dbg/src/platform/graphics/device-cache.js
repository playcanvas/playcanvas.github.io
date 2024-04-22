/**
 * A cache storing shared resources associated with a device. The resources are removed
 * from the cache when the device is destroyed.
 *
 * @ignore
 */
class DeviceCache {
  constructor() {
    /**
     * Cache storing the resource for each GraphicsDevice
     *
     * @type {Map<import('./graphics-device.js').GraphicsDevice, any>}
     */
    this._cache = new Map();
  }
  /**
   * Returns the resources for the supplied device.
   *
   * @param {import('./graphics-device.js').GraphicsDevice} device - The graphics device.
   * @returns {any} The resource for the device.
   */
  get(device, onCreate) {
    if (!this._cache.has(device)) {
      this._cache.set(device, onCreate());

      // when the device is destroyed, destroy and remove its entry
      device.on('destroy', () => {
        this.remove(device);
      });

      // when the context is lost, call optional loseContext on its entry
      device.on('devicelost', () => {
        var _this$_cache$get;
        (_this$_cache$get = this._cache.get(device)) == null || _this$_cache$get.loseContext == null || _this$_cache$get.loseContext(device);
      });
    }
    return this._cache.get(device);
  }

  /**
   * Destroys and removes the content of the cache associated with the device
   *
   * @param {import('./graphics-device.js').GraphicsDevice} device - The graphics device.
   */
  remove(device) {
    var _this$_cache$get2;
    (_this$_cache$get2 = this._cache.get(device)) == null || _this$_cache$get2.destroy == null || _this$_cache$get2.destroy(device);
    this._cache.delete(device);
  }
}

export { DeviceCache };
