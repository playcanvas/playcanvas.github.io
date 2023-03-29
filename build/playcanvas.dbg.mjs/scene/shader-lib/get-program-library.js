/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../core/debug.js';
import { DeviceCache } from '../../platform/graphics/device-cache.js';

// Device cache storing a program library
const programLibraryDeviceCache = new DeviceCache();

/**
 * Returns program library for a specified instance of a device.
 *
 * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} device - The
 * graphics device used to own the program library.
 * @returns {import('./program-library.js').ProgramLibrary} The instance of {@link ProgramLibrary}
 * @ignore
 */
function getProgramLibrary(device) {
  const library = programLibraryDeviceCache.get(device);
  Debug.assert(library);
  return library;
}

/**
 * Assigns the program library to device cache.
 *
 * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} device - The
 * graphics device used to own the program library.
 * @param {import('./program-library.js').ProgramLibrary} library - The instance of
 * {@link ProgramLibrary}.
 * @ignore
 */
function setProgramLibrary(device, library) {
  Debug.assert(library);
  programLibraryDeviceCache.get(device, () => {
    return library;
  });
}

export { getProgramLibrary, setProgramLibrary };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2V0LXByb2dyYW0tbGlicmFyeS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvZ2V0LXByb2dyYW0tbGlicmFyeS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgRGV2aWNlQ2FjaGUgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9kZXZpY2UtY2FjaGUuanMnO1xuXG4vLyBEZXZpY2UgY2FjaGUgc3RvcmluZyBhIHByb2dyYW0gbGlicmFyeVxuY29uc3QgcHJvZ3JhbUxpYnJhcnlEZXZpY2VDYWNoZSA9IG5ldyBEZXZpY2VDYWNoZSgpO1xuXG4vKipcbiAqIFJldHVybnMgcHJvZ3JhbSBsaWJyYXJ5IGZvciBhIHNwZWNpZmllZCBpbnN0YW5jZSBvZiBhIGRldmljZS5cbiAqXG4gKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZ3JhcGhpY3MtZGV2aWNlLmpzJykuR3JhcGhpY3NEZXZpY2V9IGRldmljZSAtIFRoZVxuICogZ3JhcGhpY3MgZGV2aWNlIHVzZWQgdG8gb3duIHRoZSBwcm9ncmFtIGxpYnJhcnkuXG4gKiBAcmV0dXJucyB7aW1wb3J0KCcuL3Byb2dyYW0tbGlicmFyeS5qcycpLlByb2dyYW1MaWJyYXJ5fSBUaGUgaW5zdGFuY2Ugb2Yge0BsaW5rIFByb2dyYW1MaWJyYXJ5fVxuICogQGlnbm9yZVxuICovXG5mdW5jdGlvbiBnZXRQcm9ncmFtTGlicmFyeShkZXZpY2UpIHtcbiAgICBjb25zdCBsaWJyYXJ5ID0gcHJvZ3JhbUxpYnJhcnlEZXZpY2VDYWNoZS5nZXQoZGV2aWNlKTtcbiAgICBEZWJ1Zy5hc3NlcnQobGlicmFyeSk7XG4gICAgcmV0dXJuIGxpYnJhcnk7XG59XG5cbi8qKlxuICogQXNzaWducyB0aGUgcHJvZ3JhbSBsaWJyYXJ5IHRvIGRldmljZSBjYWNoZS5cbiAqXG4gKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZ3JhcGhpY3MtZGV2aWNlLmpzJykuR3JhcGhpY3NEZXZpY2V9IGRldmljZSAtIFRoZVxuICogZ3JhcGhpY3MgZGV2aWNlIHVzZWQgdG8gb3duIHRoZSBwcm9ncmFtIGxpYnJhcnkuXG4gKiBAcGFyYW0ge2ltcG9ydCgnLi9wcm9ncmFtLWxpYnJhcnkuanMnKS5Qcm9ncmFtTGlicmFyeX0gbGlicmFyeSAtIFRoZSBpbnN0YW5jZSBvZlxuICoge0BsaW5rIFByb2dyYW1MaWJyYXJ5fS5cbiAqIEBpZ25vcmVcbiAqL1xuZnVuY3Rpb24gc2V0UHJvZ3JhbUxpYnJhcnkoZGV2aWNlLCBsaWJyYXJ5KSB7XG4gICAgRGVidWcuYXNzZXJ0KGxpYnJhcnkpO1xuICAgIHByb2dyYW1MaWJyYXJ5RGV2aWNlQ2FjaGUuZ2V0KGRldmljZSwgKCkgPT4ge1xuICAgICAgICByZXR1cm4gbGlicmFyeTtcbiAgICB9KTtcbn1cblxuZXhwb3J0IHsgZ2V0UHJvZ3JhbUxpYnJhcnksIHNldFByb2dyYW1MaWJyYXJ5IH07XG4iXSwibmFtZXMiOlsicHJvZ3JhbUxpYnJhcnlEZXZpY2VDYWNoZSIsIkRldmljZUNhY2hlIiwiZ2V0UHJvZ3JhbUxpYnJhcnkiLCJkZXZpY2UiLCJsaWJyYXJ5IiwiZ2V0IiwiRGVidWciLCJhc3NlcnQiLCJzZXRQcm9ncmFtTGlicmFyeSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFHQTtBQUNBLE1BQU1BLHlCQUF5QixHQUFHLElBQUlDLFdBQVcsRUFBRSxDQUFBOztBQUVuRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBU0MsaUJBQWlCLENBQUNDLE1BQU0sRUFBRTtBQUMvQixFQUFBLE1BQU1DLE9BQU8sR0FBR0oseUJBQXlCLENBQUNLLEdBQUcsQ0FBQ0YsTUFBTSxDQUFDLENBQUE7QUFDckRHLEVBQUFBLEtBQUssQ0FBQ0MsTUFBTSxDQUFDSCxPQUFPLENBQUMsQ0FBQTtBQUNyQixFQUFBLE9BQU9BLE9BQU8sQ0FBQTtBQUNsQixDQUFBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVNJLGlCQUFpQixDQUFDTCxNQUFNLEVBQUVDLE9BQU8sRUFBRTtBQUN4Q0UsRUFBQUEsS0FBSyxDQUFDQyxNQUFNLENBQUNILE9BQU8sQ0FBQyxDQUFBO0FBQ3JCSixFQUFBQSx5QkFBeUIsQ0FBQ0ssR0FBRyxDQUFDRixNQUFNLEVBQUUsTUFBTTtBQUN4QyxJQUFBLE9BQU9DLE9BQU8sQ0FBQTtBQUNsQixHQUFDLENBQUMsQ0FBQTtBQUNOOzs7OyJ9
