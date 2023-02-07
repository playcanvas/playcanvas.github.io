/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../core/debug.js';
import { DeviceCache } from '../../platform/graphics/device-cache.js';

// device cache storing default material
const defaultMaterialDeviceCache = new DeviceCache();

/**
 * Returns default material, which is a material used instead of null material.
 *
 * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} device - The
 * graphics device used to own the material.
 * @returns {import('./standard-material.js').StandardMaterial} The default instance of
 * {@link StandardMaterial}.
 * @ignore
 */
function getDefaultMaterial(device) {
  const material = defaultMaterialDeviceCache.get(device);
  Debug.assert(material);
  return material;
}

/**
 * Assigns the default material to device cache
 *
 * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} device - The
 * graphics device used to own the material.
 * @param {import('./standard-material.js').StandardMaterial} material - The instance of
 * {@link StandardMaterial}.
 * @ignore
 */
function setDefaultMaterial(device, material) {
  Debug.assert(material);
  defaultMaterialDeviceCache.get(device, () => {
    return material;
  });
}

export { getDefaultMaterial, setDefaultMaterial };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVmYXVsdC1tYXRlcmlhbC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3NjZW5lL21hdGVyaWFscy9kZWZhdWx0LW1hdGVyaWFsLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbmltcG9ydCB7IERldmljZUNhY2hlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZGV2aWNlLWNhY2hlLmpzJztcblxuLy8gZGV2aWNlIGNhY2hlIHN0b3JpbmcgZGVmYXVsdCBtYXRlcmlhbFxuY29uc3QgZGVmYXVsdE1hdGVyaWFsRGV2aWNlQ2FjaGUgPSBuZXcgRGV2aWNlQ2FjaGUoKTtcblxuLyoqXG4gKiBSZXR1cm5zIGRlZmF1bHQgbWF0ZXJpYWwsIHdoaWNoIGlzIGEgbWF0ZXJpYWwgdXNlZCBpbnN0ZWFkIG9mIG51bGwgbWF0ZXJpYWwuXG4gKlxuICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS5qcycpLkdyYXBoaWNzRGV2aWNlfSBkZXZpY2UgLSBUaGVcbiAqIGdyYXBoaWNzIGRldmljZSB1c2VkIHRvIG93biB0aGUgbWF0ZXJpYWwuXG4gKiBAcmV0dXJucyB7aW1wb3J0KCcuL3N0YW5kYXJkLW1hdGVyaWFsLmpzJykuU3RhbmRhcmRNYXRlcmlhbH0gVGhlIGRlZmF1bHQgaW5zdGFuY2Ugb2ZcbiAqIHtAbGluayBTdGFuZGFyZE1hdGVyaWFsfS5cbiAqIEBpZ25vcmVcbiAqL1xuZnVuY3Rpb24gZ2V0RGVmYXVsdE1hdGVyaWFsKGRldmljZSkge1xuICAgIGNvbnN0IG1hdGVyaWFsID0gZGVmYXVsdE1hdGVyaWFsRGV2aWNlQ2FjaGUuZ2V0KGRldmljZSk7XG4gICAgRGVidWcuYXNzZXJ0KG1hdGVyaWFsKTtcbiAgICByZXR1cm4gbWF0ZXJpYWw7XG59XG5cbi8qKlxuICogQXNzaWducyB0aGUgZGVmYXVsdCBtYXRlcmlhbCB0byBkZXZpY2UgY2FjaGVcbiAqXG4gKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZ3JhcGhpY3MtZGV2aWNlLmpzJykuR3JhcGhpY3NEZXZpY2V9IGRldmljZSAtIFRoZVxuICogZ3JhcGhpY3MgZGV2aWNlIHVzZWQgdG8gb3duIHRoZSBtYXRlcmlhbC5cbiAqIEBwYXJhbSB7aW1wb3J0KCcuL3N0YW5kYXJkLW1hdGVyaWFsLmpzJykuU3RhbmRhcmRNYXRlcmlhbH0gbWF0ZXJpYWwgLSBUaGUgaW5zdGFuY2Ugb2ZcbiAqIHtAbGluayBTdGFuZGFyZE1hdGVyaWFsfS5cbiAqIEBpZ25vcmVcbiAqL1xuZnVuY3Rpb24gc2V0RGVmYXVsdE1hdGVyaWFsKGRldmljZSwgbWF0ZXJpYWwpIHtcbiAgICBEZWJ1Zy5hc3NlcnQobWF0ZXJpYWwpO1xuICAgIGRlZmF1bHRNYXRlcmlhbERldmljZUNhY2hlLmdldChkZXZpY2UsICgpID0+IHtcbiAgICAgICAgcmV0dXJuIG1hdGVyaWFsO1xuICAgIH0pO1xufVxuXG5leHBvcnQgeyBzZXREZWZhdWx0TWF0ZXJpYWwsIGdldERlZmF1bHRNYXRlcmlhbCB9O1xuIl0sIm5hbWVzIjpbImRlZmF1bHRNYXRlcmlhbERldmljZUNhY2hlIiwiRGV2aWNlQ2FjaGUiLCJnZXREZWZhdWx0TWF0ZXJpYWwiLCJkZXZpY2UiLCJtYXRlcmlhbCIsImdldCIsIkRlYnVnIiwiYXNzZXJ0Iiwic2V0RGVmYXVsdE1hdGVyaWFsIl0sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQUlBO0FBQ0EsTUFBTUEsMEJBQTBCLEdBQUcsSUFBSUMsV0FBVyxFQUFFLENBQUE7O0FBRXBEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVNDLGtCQUFrQixDQUFDQyxNQUFNLEVBQUU7QUFDaEMsRUFBQSxNQUFNQyxRQUFRLEdBQUdKLDBCQUEwQixDQUFDSyxHQUFHLENBQUNGLE1BQU0sQ0FBQyxDQUFBO0FBQ3ZERyxFQUFBQSxLQUFLLENBQUNDLE1BQU0sQ0FBQ0gsUUFBUSxDQUFDLENBQUE7QUFDdEIsRUFBQSxPQUFPQSxRQUFRLENBQUE7QUFDbkIsQ0FBQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTSSxrQkFBa0IsQ0FBQ0wsTUFBTSxFQUFFQyxRQUFRLEVBQUU7QUFDMUNFLEVBQUFBLEtBQUssQ0FBQ0MsTUFBTSxDQUFDSCxRQUFRLENBQUMsQ0FBQTtBQUN0QkosRUFBQUEsMEJBQTBCLENBQUNLLEdBQUcsQ0FBQ0YsTUFBTSxFQUFFLE1BQU07QUFDekMsSUFBQSxPQUFPQyxRQUFRLENBQUE7QUFDbkIsR0FBQyxDQUFDLENBQUE7QUFDTjs7OzsifQ==
