/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
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
