/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
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
