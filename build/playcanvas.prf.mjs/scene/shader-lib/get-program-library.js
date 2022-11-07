/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
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
