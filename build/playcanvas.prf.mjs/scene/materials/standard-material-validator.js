/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import '../../core/tracing.js';
import { CULLFACE_NONE, CULLFACE_BACK, CULLFACE_FRONT, CULLFACE_FRONTANDBACK, FUNC_NEVER, FUNC_LESS, FUNC_EQUAL, FUNC_LESSEQUAL, FUNC_GREATER, FUNC_NOTEQUAL, FUNC_GREATEREQUAL, FUNC_ALWAYS } from '../../platform/graphics/constants.js';
import { Texture } from '../../platform/graphics/texture.js';
import { SPECOCC_NONE, SPECOCC_AO, SPECOCC_GLOSSDEPENDENT, BLEND_SUBTRACTIVE, BLEND_ADDITIVE, BLEND_NORMAL, BLEND_NONE, BLEND_PREMULTIPLIED, BLEND_MULTIPLICATIVE, BLEND_ADDITIVEALPHA, BLEND_MULTIPLICATIVE2X, BLEND_SCREEN, BLEND_MIN, BLEND_MAX, SPECULAR_PHONG, SPECULAR_BLINN } from '../constants.js';
import { standardMaterialParameterTypes, standardMaterialRemovedParameters } from './standard-material-parameters.js';

class StandardMaterialValidator {
	constructor() {
		this.removeInvalid = true;
		this.valid = true;
		this.enumValidators = {
			occludeSpecular: this._createEnumValidator([SPECOCC_NONE, SPECOCC_AO, SPECOCC_GLOSSDEPENDENT]),
			cull: this._createEnumValidator([CULLFACE_NONE, CULLFACE_BACK, CULLFACE_FRONT, CULLFACE_FRONTANDBACK]),
			blendType: this._createEnumValidator([BLEND_SUBTRACTIVE, BLEND_ADDITIVE, BLEND_NORMAL, BLEND_NONE, BLEND_PREMULTIPLIED, BLEND_MULTIPLICATIVE, BLEND_ADDITIVEALPHA, BLEND_MULTIPLICATIVE2X, BLEND_SCREEN, BLEND_MIN, BLEND_MAX]),
			depthFunc: this._createEnumValidator([FUNC_NEVER, FUNC_LESS, FUNC_EQUAL, FUNC_LESSEQUAL, FUNC_GREATER, FUNC_NOTEQUAL, FUNC_GREATEREQUAL, FUNC_ALWAYS]),
			shadingModel: this._createEnumValidator([SPECULAR_PHONG, SPECULAR_BLINN])
		};
	}
	setInvalid(key, data) {
		this.valid = false;
		if (this.removeInvalid) {
			delete data[key];
		}
	}
	validate(data) {
		const TYPES = standardMaterialParameterTypes;
		const REMOVED = standardMaterialRemovedParameters;
		const pathMapping = data.mappingFormat === 'path';
		for (const key in data) {
			const type = TYPES[key];
			if (!type) {
				if (REMOVED[key]) {
					delete data[key];
				} else {
					this.valid = false;
				}
				continue;
			}
			if (type.startsWith('enum')) {
				const enumType = type.split(':')[1];
				if (this.enumValidators[enumType]) {
					if (!this.enumValidators[enumType](data[key])) {
						this.setInvalid(key, data);
					}
				}
			} else if (type === 'number') {
				if (typeof data[key] !== 'number') {
					this.setInvalid(key, data);
				}
			} else if (type === 'boolean') {
				if (typeof data[key] !== 'boolean') {
					this.setInvalid(key, data);
				}
			} else if (type === 'string') {
				if (typeof data[key] !== 'string') {
					this.setInvalid(key, data);
				}
			} else if (type === 'vec2') {
				if (!(data[key] instanceof Array && data[key].length === 2)) {
					this.setInvalid(key, data);
				}
			} else if (type === 'rgb') {
				if (!(data[key] instanceof Array && data[key].length === 3)) {
					this.setInvalid(key, data);
				}
			} else if (type === 'texture') {
				if (!pathMapping) {
					if (!(typeof data[key] === 'number' || data[key] === null)) {
						if (!(data[key] instanceof Texture)) {
							this.setInvalid(key, data);
						}
					}
				} else {
					if (!(typeof data[key] === 'string' || data[key] === null)) {
						if (!(data[key] instanceof Texture)) {
							this.setInvalid(key, data);
						}
					}
				}
			} else if (type === 'boundingbox') {
				if (!(data[key].center && data[key].center instanceof Array && data[key].center.length === 3)) {
					this.setInvalid(key, data);
				}
				if (!(data[key].halfExtents && data[key].halfExtents instanceof Array && data[key].halfExtents.length === 3)) {
					this.setInvalid(key, data);
				}
			} else if (type === 'cubemap') {
				if (!(typeof data[key] === 'number' || data[key] === null || data[key] === undefined)) {
					if (!(data[key] instanceof Texture && data[key].cubemap)) {
						this.setInvalid(key, data);
					}
				}
			} else if (type === 'chunks') {
				const chunkNames = Object.keys(data[key]);
				for (let i = 0; i < chunkNames.length; i++) {
					if (typeof data[key][chunkNames[i]] !== 'string') {
						this.setInvalid(chunkNames[i], data[key]);
					}
				}
			} else {
				console.error('Unknown material type: ' + type);
			}
		}
		data.validated = true;
		return this.valid;
	}
	_createEnumValidator(values) {
		return function (value) {
			return values.indexOf(value) >= 0;
		};
	}
}

export { StandardMaterialValidator };
