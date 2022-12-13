/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { _lightProps, _lightPropsDefault } from './component.js';

class LightComponentData {
  constructor() {
    const _props = _lightProps;
    const _propsDefault = _lightPropsDefault;
    for (let i = 0; i < _props.length; i++) {
      const value = _propsDefault[i];
      if (value && value.clone) {
        this[_props[i]] = value.clone();
      } else {
        this[_props[i]] = value;
      }
    }
  }
}

export { LightComponentData };
