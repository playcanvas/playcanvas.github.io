/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import '../../core/tracing.js';
import { DeviceCache } from '../../graphics/device-cache.js';

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
