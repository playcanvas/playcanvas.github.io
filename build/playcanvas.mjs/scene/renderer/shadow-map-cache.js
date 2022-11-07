import { LIGHTTYPE_OMNI } from '../constants.js';
import { ShadowMap } from './shadow-map.js';

class ShadowMapCache {
  constructor() {
    this.shadowMapCache = new Map();
  }
  destroy() {
    this.clear();
    this.shadowMapCache = null;
  }

  clear() {
    this.shadowMapCache.forEach(shadowMaps => {
      shadowMaps.forEach(shadowMap => {
        shadowMap.destroy();
      });
    });
    this.shadowMapCache.clear();
  }

  getKey(light) {
    const isCubeMap = light._type === LIGHTTYPE_OMNI;
    const shadowType = light._shadowType;
    const resolution = light._shadowResolution;
    return `${isCubeMap}-${shadowType}-${resolution}`;
  }

  get(device, light) {
    const key = this.getKey(light);
    const shadowMaps = this.shadowMapCache.get(key);
    if (shadowMaps && shadowMaps.length) {
      return shadowMaps.pop();
    }

    const shadowMap = ShadowMap.create(device, light);
    shadowMap.cached = true;
    return shadowMap;
  }

  add(light, shadowMap) {
    const key = this.getKey(light);
    const shadowMaps = this.shadowMapCache.get(key);
    if (shadowMaps) {
      shadowMaps.push(shadowMap);
    } else {
      this.shadowMapCache.set(key, [shadowMap]);
    }
  }
}

export { ShadowMapCache };