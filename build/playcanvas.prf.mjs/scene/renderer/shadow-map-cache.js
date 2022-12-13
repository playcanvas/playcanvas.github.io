/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { LIGHTTYPE_OMNI } from '../constants.js';
import { ShadowMap } from './shadow-map.js';

class ShadowMapCache {
  constructor() {
    this.cache = new Map();
  }
  destroy() {
    this.clear();
    this.cache = null;
  }

  clear() {
    this.cache.forEach(shadowMaps => {
      shadowMaps.forEach(shadowMap => {
        shadowMap.destroy();
      });
    });
    this.cache.clear();
  }

  getKey(light) {
    const isCubeMap = light._type === LIGHTTYPE_OMNI;
    const shadowType = light._shadowType;
    const resolution = light._shadowResolution;
    return `${isCubeMap}-${shadowType}-${resolution}`;
  }

  get(device, light) {
    const key = this.getKey(light);
    const shadowMaps = this.cache.get(key);
    if (shadowMaps && shadowMaps.length) {
      return shadowMaps.pop();
    }

    const shadowMap = ShadowMap.create(device, light);
    shadowMap.cached = true;
    return shadowMap;
  }

  add(light, shadowMap) {
    const key = this.getKey(light);
    const shadowMaps = this.cache.get(key);
    if (shadowMaps) {
      shadowMaps.push(shadowMap);
    } else {
      this.cache.set(key, [shadowMap]);
    }
  }
}

export { ShadowMapCache };
